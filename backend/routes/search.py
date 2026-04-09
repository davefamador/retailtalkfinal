"""
Search route — the CORE of the thesis.

Architecture (from README.md):
                      User Query: "I want an affordable dress"
                                |
                ================|================
                |               |               |
        [Intent Class.]   [Slot/Entity     [BERT Embedding]
                |          Extraction]          |
                v               |              v
          intent:purchase       v         768-dim vector
                        {                      |
                         category: "dress"     |
                         price: "affordable"   |
                        }                      |
                ================|===============|
                               |               |
                        [Query Rewriting]      |
                        "dress" + filters      |
                               |               |
                ===============|================
                |              |               |
        [Supabase Filter] [pgvector      [CrossEncoder
         price <= budget   Similarity]    Ranker]
                |              |               |
                ===============|================
                               |
                       [ESCI Classifier]
                        E / S / C / I
                               |
                       [Score Blending]
                       0.5*R + 0.3*C + 0.2*S
                               |
                       Final Ranked Results

Pipeline Stages:
1. BERT Embedding: Query → 768-dimensional vector
2. pgvector Similarity: Top-50 candidates via cosine similarity
3. CrossEncoder Re-Ranking: Pairwise relevance scoring
4. ESCI Classifier: E/S/C/I classification with softmax probabilities
5. Score Blending: 0.5×Ranker + 0.3×Classifier + 0.2×Similarity
"""

from fastapi import APIRouter, Query, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import traceback
import tempfile
import os
import numpy as np

from models.bert_service import bert_service
from models.classifier import classifier_service, LABEL_PRIORITY
from models.ranker import ranker_service
from models.query_rewriter import query_rewriter
from database import search_similar_products, search_similar_products_filtered, get_supabase
from config import (
    SEARCH_TOP_K_CANDIDATES,
    SEARCH_MAX_RESULTS,
    RANKER_WEIGHT,
    CLASSIFIER_WEIGHT,
    SIMILARITY_WEIGHT,
)

router = APIRouter(prefix="/search", tags=["Search"])


# =============================================================================
#  Response Models
# =============================================================================

class SearchResultItem(BaseModel):
    id: str
    title: str
    description: str
    price: float
    stock: int = 0
    image_url: str
    seller_id: str
    # Scoring components
    similarity: float = 0.0          # pgvector cosine similarity (0-1)
    ranker_score: float = 0.0        # CrossEncoder relevance score (0-1, normalized)
    relevance_score: float = 0.0     # Final blended score: 0.5*R + 0.3*C + 0.2*S
    # ESCI classification
    relevance_label: str = "Exact"   # E/S/C/I classification
    relevance_confidence: float = 1.0
    exact_prob: float = 0.0
    substitute_prob: float = 0.0
    complement_prob: float = 0.0
    irrelevant_prob: float = 0.0


class SearchResponse(BaseModel):
    query: str
    total_results: int
    results: list[SearchResultItem]
    message: str = ""
    # Query Rewriting metadata (from Intent + Slot extraction)
    rewritten_query: str = ""
    detected_intents: list[str] = []
    extracted_slots: dict = {}
    applied_filters: dict = {}
    search_groups: list[dict] = []   # [{search_text, filters}, ...] for compound queries


# =============================================================================
#  Helper Functions
# =============================================================================

def _first_image(images_field) -> str:
    """Extract the first image URL from a product's images field."""
    images = images_field or []
    if isinstance(images, str):
        return images
    if isinstance(images, list) and len(images) > 0:
        return images[0]
    return ""


def _compute_blended_score(
    ranker_score: float,
    classifier_priority: float,
    similarity: float,
    w_ranker: float = RANKER_WEIGHT,
    w_classifier: float = CLASSIFIER_WEIGHT,
    w_similarity: float = SIMILARITY_WEIGHT,
) -> float:
    """
    Score Blending formula from README:
    relevance_score = 0.4×R + 0.25×C + 0.35×S

    Where:
    - R = Ranker score (CrossEncoder, normalized 0-1)
    - C = Classifier priority (E=1.0, S=0.67, C=0.33, I=0.0)
    - S = Similarity (pgvector cosine similarity, 0-1)
    """
    return (
        w_ranker * ranker_score +
        w_classifier * classifier_priority +
        w_similarity * similarity
    )


def _label_to_priority_weight(label: str) -> float:
    """
    Convert ESCI label to priority weight for score blending.
    E=1.0, S=0.67, C=0.33, I=0.0
    """
    priority = LABEL_PRIORITY.get(label, 3)  # Default to Irrelevant (3)
    return (3 - priority) / 3


def _run_search_pipeline(
    search_text: str,
    filters: dict,
    original_query: str,
    max_candidates: int,
    include_complements: bool,
    include_substitutes: bool,
    show_all: bool,
) -> list[SearchResultItem]:
    """
    Core search pipeline for a single search group.
    Stages: BERT Embedding -> pgvector -> CrossEncoder -> ESCI -> Score Blending
    """
    query_embedding = bert_service.compute_embedding(search_text)

    if filters:
        raw_candidates = search_similar_products_filtered(
            query_embedding, top_k=max_candidates,
            price_min=filters.get("price_min"), price_max=filters.get("price_max"),
            brand=filters.get("brand"), color=filters.get("color"),
        )
    else:
        raw_candidates = search_similar_products(query_embedding, top_k=max_candidates)

    print(f"[Search]   '{search_text}': {len(raw_candidates)} raw candidates")

    # Hard post-filter: enforce price constraints even if pgvector missed them
    # (safety net for cases where the DB filter didn't apply, e.g. no-filter branch)
    if filters.get("price_max") is not None:
        raw_candidates = [c for c in raw_candidates if float(c["price"]) <= filters["price_max"]]
    if filters.get("price_min") is not None:
        raw_candidates = [c for c in raw_candidates if float(c["price"]) >= filters["price_min"]]

    MIN_SIMILARITY_THRESHOLD = 0.20
    candidates = raw_candidates if show_all else [c for c in raw_candidates if c["similarity"] >= MIN_SIMILARITY_THRESHOLD]
    if not candidates:
        return []

    product_titles = [c["title"] for c in candidates]
    if ranker_service._loaded:
        raw_ranker_scores = ranker_service.rank(original_query, product_titles)
        ranker_scores = ranker_service.normalize_scores(raw_ranker_scores)
    else:
        ranker_scores = [c["similarity"] for c in candidates]

    product_embeddings = np.array([c["embedding"] for c in candidates])
    if classifier_service._loaded:
        classifications = classifier_service.classify_batch(query_embedding, product_embeddings)
    else:
        classifications = [{"label": "Exact", "confidence": 1.0, "class_id": 0,
            "exact_prob": 1.0, "substitute_prob": 0.0, "complement_prob": 0.0, "irrelevant_prob": 0.0}
            for _ in candidates]

    if ranker_service._loaded:
        w_r, w_c, w_s = 0.55, 0.05, 0.40
    else:
        w_r, w_c, w_s = 0.0, 0.05, 0.95

    MIN_RELEVANCE_SCORE = 0.75
    scored = []
    for idx, (cand, cls) in enumerate(zip(candidates, classifications)):
        label = cls["label"]
        r_score = float(ranker_scores[idx])
        sim = float(cand["similarity"])
        rel = _compute_blended_score(r_score, _label_to_priority_weight(label), sim, w_r, w_c, w_s)
        # All labels (including Exact) must meet the minimum relevance threshold.
        # Irrelevant products are shown only if they score >= 0.75; otherwise dropped.
        if not show_all and rel < MIN_RELEVANCE_SCORE:
            continue
        if not show_all and label == "Substitute" and not include_substitutes:
            continue
        if not show_all and label == "Complement" and not include_complements:
            continue
        scored.append(SearchResultItem(
            id=str(cand["id"]), title=cand["title"],
            description=cand.get("description") or "",
            price=float(cand["price"]),
            stock=int(cand.get("stock", 0)),
            image_url=_first_image(cand.get("images")),
            seller_id=str(cand["seller_id"]),
            similarity=round(sim, 4), ranker_score=round(r_score, 4),
            relevance_score=round(rel, 4), relevance_label=label,
            relevance_confidence=round(cls["confidence"], 4),
            exact_prob=round(cls.get("exact_prob", 0.0), 4),
            substitute_prob=round(cls.get("substitute_prob", 0.0), 4),
            complement_prob=round(cls.get("complement_prob", 0.0), 4),
            irrelevant_prob=round(cls.get("irrelevant_prob", 0.0), 4),
        ))
    return scored


# =============================================================================
#  Main Search Route
# =============================================================================

@router.get("/", response_model=SearchResponse)
async def search_products(
    q: str = Query(..., min_length=1, max_length=500, description="Search query text"),
    max_results: int = Query(default=SEARCH_MAX_RESULTS, ge=1, le=100),
    include_complements: bool = Query(default=True, description="Include Complement results"),
    include_substitutes: bool = Query(default=True, description="Include Substitute results"),
    show_all: bool = Query(default=False, description="Show all products without threshold filtering (admin mode)"),
):
    """
    Product Search with compound query support.
    Splits compound queries (e.g. 'shoes under 300 and bags under 500')
    into independent search groups, each with its own filters.
    """
    try:
        rewritten = query_rewriter.process(q)

        print(f"[Search] Original query: '{q}'")
        print(f"[Search] Intents: {rewritten.intents}")
        print(f"[Search] Slots: {rewritten.slots}")
        print(f"[Search] Search groups: {len(rewritten.search_groups)}")
        for i, g in enumerate(rewritten.search_groups):
            print(f"[Search]   Group {i+1}: '{g.search_text}' | Filters: {g.filters}")

        if not bert_service._loaded:
            return await _fallback_text_search(q, rewritten, max_results)

        # Run pipeline for each search group
        all_results = []
        for group in rewritten.search_groups:
            group_results = _run_search_pipeline(
                search_text=group.search_text,
                filters=group.filters,
                original_query=q,
                max_candidates=SEARCH_TOP_K_CANDIDATES,
                include_complements=include_complements,
                include_substitutes=include_substitutes,
                show_all=show_all,
            )
            all_results.extend(group_results)

        # Deduplicate by product id (keep highest relevance score)
        seen = {}
        for r in all_results:
            if r.id not in seen or r.relevance_score > seen[r.id].relevance_score:
                seen[r.id] = r

        final_results = sorted(seen.values(), key=lambda r: r.relevance_score, reverse=True)[:max_results]
        print(f"[Search] Final results: {len(final_results)} (from {len(rewritten.search_groups)} group(s))")

        return SearchResponse(
            query=q,
            total_results=len(final_results),
            results=final_results,
            message="" if final_results else "No products found matching your query.",
            rewritten_query=rewritten.search_text,
            detected_intents=rewritten.intents,
            extracted_slots=rewritten.slots,
            applied_filters=rewritten.search_groups[0].filters if len(rewritten.search_groups) == 1 else {},
            search_groups=[{"search_text": g.search_text, "filters": g.filters} for g in rewritten.search_groups],
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Search] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


# =============================================================================
#  Fallback: Text-only search when ML models are not loaded
# =============================================================================

async def _fallback_text_search(
    original_query: str,
    rewritten,
    max_results: int,
) -> SearchResponse:
    """Simple ILIKE text search fallback when ML models are not available."""
    sb = get_supabase()
    all_results = []

    for group in rewritten.search_groups:
        qb = sb.table("products").select("*").eq("is_active", True).eq("status", "approved").gt("stock", 0)
        qb = qb.or_(f"title.ilike.%{group.search_text}%,description.ilike.%{group.search_text}%")
        if "price_max" in group.filters:
            qb = qb.lte("price", group.filters["price_max"])
        if "price_min" in group.filters:
            qb = qb.gte("price", group.filters["price_min"])
        response = qb.limit(max_results).execute()

        for p in response.data:
            all_results.append(SearchResultItem(
                id=str(p["id"]), title=p["title"],
                description=p.get("description") or "",
                price=float(p["price"]),
                image_url=_first_image(p.get("images")),
                seller_id=str(p["seller_id"]),
                similarity=1.0, ranker_score=0.0, relevance_score=1.0,
                relevance_label="Exact", relevance_confidence=1.0,
                exact_prob=1.0, substitute_prob=0.0, complement_prob=0.0, irrelevant_prob=0.0,
            ))

    # Deduplicate
    seen = {}
    for r in all_results:
        if r.id not in seen or r.relevance_score > seen[r.id].relevance_score:
            seen[r.id] = r
    results = sorted(seen.values(), key=lambda r: r.relevance_score, reverse=True)[:max_results]

    return SearchResponse(
        query=original_query,
        total_results=len(results),
        results=results,
        message="" if results else "No products found.",
        rewritten_query=rewritten.search_text,
        detected_intents=rewritten.intents,
        extracted_slots=rewritten.slots,
        applied_filters=rewritten.search_groups[0].filters if len(rewritten.search_groups) == 1 else {},
        search_groups=[{"search_text": g.search_text, "filters": g.filters} for g in rewritten.search_groups],
    )


# =============================================================================
#  Voice Transcription Endpoint
# =============================================================================

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Accept an audio file (webm from MediaRecorder) and return transcribed text.
    Uses SpeechRecognition + pydub for cross-browser voice search support.
    """
    tmp_webm = None
    tmp_wav = None
    try:
        import speech_recognition as sr
        from pydub import AudioSegment

        # Save uploaded audio to temp file
        tmp_webm = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
        content = await audio.read()
        tmp_webm.write(content)
        tmp_webm.close()

        # Convert webm → wav
        tmp_wav_path = tmp_webm.name.replace(".webm", ".wav")
        audio_segment = AudioSegment.from_file(tmp_webm.name, format="webm")
        audio_segment.export(tmp_wav_path, format="wav")
        tmp_wav = tmp_wav_path

        # Transcribe using Google Speech Recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(tmp_wav) as source:
            audio_data = recognizer.record(source)

        transcript = recognizer.recognize_google(audio_data)
        return {"transcript": transcript}

    except ImportError:
        return {"error": "Speech recognition libraries not installed. Run: pip install SpeechRecognition pydub"}
    except Exception as e:
        print(f"[Transcribe] Error: {e}")
        return {"error": f"Transcription failed: {str(e)}"}
    finally:
        if tmp_webm and os.path.exists(tmp_webm.name):
            os.unlink(tmp_webm.name)
        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)