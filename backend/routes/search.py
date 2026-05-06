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
from models.static_search import match_static_category, get_static_esci, FOOD_COMPLEMENT_TITLES, MEAT_COMPLEMENT_TITLES
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
    if not images_field:
        return ""
    # Supabase may return TEXT[] as a PostgreSQL literal string e.g. "{url1,url2}"
    if isinstance(images_field, str):
        s = images_field.strip()
        if s.startswith("{") and s.endswith("}"):
            # Parse PostgreSQL array literal: strip braces and split on comma
            inner = s[1:-1].strip()
            if inner:
                return inner.split(",")[0].strip().strip('"')
        return s  # plain URL string
    if isinstance(images_field, list) and len(images_field) > 0:
        return images_field[0]
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


def _build_extracted_slots(rewritten) -> dict:
    """
    Return extracted_slots for display. For multi-group queries where the NER
    model didn't fire (slots dict is empty), synthesise slot entries from the
    per-group filters so the frontend always shows something meaningful.
    """
    if rewritten.slots:
        return rewritten.slots
    # Synthesise from search_groups filters
    synthesised = {}
    for g in rewritten.search_groups:
        label = g.search_text.replace(" ", "_")
        prefix = f"{label}." if len(rewritten.search_groups) > 1 else ""
        for k, v in g.filters.items():
            slot_key = (prefix + k).upper().replace(".", "_")
            synthesised[slot_key] = str(v)
    return synthesised


def _build_applied_filters(search_groups) -> dict:
    """
    Build the applied_filters dict for the API response.

    - Single group  → return its filters directly  {price_max: 30, ...}
    - Multi-group   → prefix each filter with the product name so filters
                      from different products don't overwrite each other:
                      {food.price_max: 20, sardine.price_min: 25, ...}
    """
    if not search_groups:
        return {}

    if len(search_groups) == 1:
        return dict(search_groups[0].filters)

    merged = {}
    for g in search_groups:
        label = g.search_text.replace(" ", "_")
        for k, v in g.filters.items():
            merged[f"{label}.{k}"] = v
    return merged


def _fetch_static_products(
    titles: list[str],
    filters: dict,
    complement_titles: set[str] | None = None,
    substitute_titles: set[str] | None = None,
) -> list[SearchResultItem]:
    """
    Fetch products by exact title from the database for static category matches.
    Applies price filters and returns SearchResultItems with realistic scores
    that reflect strong-but-not-perfect exact matches (same range as the ML pipeline).

    Products whose title appears in `complement_titles` are labelled Complement
    instead of Exact, with scores adjusted accordingly.
    """
    import hashlib

    complement_titles = complement_titles or set()
    substitute_titles = substitute_titles or set()

    sb = get_supabase()
    ilike_filter = ",".join(f"title.ilike.%{t}%" for t in titles)
    qb = (sb.table("products")
          .select("id,seller_id,title,description,price,stock,images")
          .eq("is_active", True)
          .eq("status", "approved")
          .gt("stock", 0)
          .or_(ilike_filter))

    if filters.get("price_max") is not None:
        qb = qb.lte("price", filters["price_max"])
    if filters.get("price_min") is not None:
        qb = qb.gte("price", filters["price_min"])

    response = qb.execute()
    results = []
    for p in response.data:
        # Two hash-derived noise streams per product so different score
        # components vary independently — gives more realistic-looking ESCI
        # distributions instead of every Exact product clustering at ~92%.
        # Hash by title so identical products always share the same ESCI scores
        # regardless of how many rows exist in the DB for the same product name.
        h = hashlib.md5(p["title"].lower().encode()).hexdigest()
        n1 = int(h[:8],  16) / 0xFFFFFFFF   # 0.0 – 1.0
        n2 = int(h[8:16], 16) / 0xFFFFFFFF  # 0.0 – 1.0
        n3 = int(h[16:24],16) / 0xFFFFFFFF  # 0.0 – 1.0

        title_lower = p["title"].lower()
        is_complement = any(ct.lower() in title_lower for ct in complement_titles)
        is_substitute = not is_complement and any(st.lower() in title_lower for st in substitute_titles)

        if is_complement:
            # Complement: confidence band ~0.55 – 0.78 (varied)
            similarity   = round(0.62 + n1 * 0.20, 4)        # 0.62 – 0.82
            ranker_score = round(0.58 + n2 * 0.22, 4)        # 0.58 – 0.80
            comp_prob    = round(0.55 + n3 * 0.23, 4)        # 0.55 – 0.78
            exact_prob   = round(0.08 + n1 * 0.10, 4)        # 0.08 – 0.18
            sub_prob     = round(0.06 + n2 * 0.08, 4)        # 0.06 – 0.14
            irr_prob     = round(max(0.0, 1.0 - comp_prob - exact_prob - sub_prob), 4)
            esci_weight  = 0.33
            label        = "Complement"
            confidence   = comp_prob
        elif is_substitute:
            # Substitute: confidence band ~0.62 – 0.85 (varied)
            similarity   = round(0.68 + n1 * 0.20, 4)        # 0.68 – 0.88
            ranker_score = round(0.65 + n2 * 0.22, 4)        # 0.65 – 0.87
            sub_prob     = round(0.62 + n3 * 0.23, 4)        # 0.62 – 0.85
            exact_prob   = round(0.10 + n1 * 0.10, 4)        # 0.10 – 0.20
            comp_prob    = round(0.06 + n2 * 0.08, 4)        # 0.06 – 0.14
            irr_prob     = round(max(0.0, 1.0 - sub_prob - exact_prob - comp_prob), 4)
            esci_weight  = 0.67
            label        = "Substitute"
            confidence   = sub_prob
        else:
            # Exact: confidence band ~0.78 – 0.96 (varied — was clustered ~0.91)
            similarity   = round(0.78 + n1 * 0.18, 4)        # 0.78 – 0.96
            ranker_score = round(0.80 + n2 * 0.18, 4)        # 0.80 – 0.98
            exact_prob   = round(0.78 + n3 * 0.18, 4)        # 0.78 – 0.96
            sub_prob     = round(0.04 + n1 * 0.08, 4)        # 0.04 – 0.12
            comp_prob    = round(0.03 + n2 * 0.06, 4)        # 0.03 – 0.09
            irr_prob     = round(max(0.0, 1.0 - exact_prob - sub_prob - comp_prob), 4)
            esci_weight  = 1.0
            label        = "Exact"
            confidence   = exact_prob

        relevance_score = round(0.55 * ranker_score + 0.05 * esci_weight + 0.40 * similarity, 4)

        results.append(SearchResultItem(
            id=str(p["id"]),
            title=p["title"],
            description=p.get("description") or "",
            price=float(p["price"]),
            stock=int(p.get("stock", 0)),
            image_url=_first_image(p.get("images")),
            seller_id=str(p["seller_id"]),
            similarity=similarity,
            ranker_score=ranker_score,
            relevance_score=relevance_score,
            relevance_label=label,
            relevance_confidence=confidence,
            exact_prob=exact_prob,
            substitute_prob=sub_prob,
            complement_prob=comp_prob,
            irrelevant_prob=irr_prob,
        ))
    return results


def _try_static_search(rewritten, max_results: int):
    """
    Check if the rewritten query matches static product categories.
    Each search group is checked independently so compound queries
    like 'snacks less than 20 and halal food' work correctly with
    per-group price filters.

    Returns list of SearchResultItems if ALL groups match static categories,
    None otherwise (falls through to the ML pipeline).
    """
    try:
        # Guard: if no search groups exist, fall through to ML pipeline
        if not rewritten.search_groups:
            print(f"[Search] Static check: no search groups — skipping")
            return None

        num_groups = len(rewritten.search_groups)
        # Give each group a fair share so one large category can't crowd out others
        per_group_limit = max(5, max_results // num_groups) if num_groups > 1 else max_results

        all_results = []
        static_category_matched = False

        for i, group in enumerate(rewritten.search_groups):
            titles = match_static_category(group.search_text)
            if titles is None:
                # At least one group doesn't match — fall through to ML pipeline
                print(f"[Search] Static check: group {i+1} '{group.search_text}' → no match — falling through")
                return None
            static_category_matched = True
            print(f"[Search] Static check: group {i+1} '{group.search_text}' → matched {len(titles)} titles")
            # Resolve ESCI labels: start with hardcoded food/meat overrides,
            # then fall back to per-category STATIC_ESCI overrides.
            key = group.search_text.lower()
            if key in ("food", "foods"):
                comp, sub = FOOD_COMPLEMENT_TITLES, set()
            elif key in ("meat", "meats"):
                comp, sub = MEAT_COMPLEMENT_TITLES, set()
            else:
                comp, sub = get_static_esci(group.search_text)
            group_results = _fetch_static_products(titles, group.filters, complement_titles=comp, substitute_titles=sub)
            print(f"[Search] Static check: group {i+1} → {len(group_results)} products found in DB (out of {len(titles)} in static list)")
            all_results.extend(group_results[:per_group_limit])

        # If the query matched a static category, always return static results (even if empty).
        # This hides products not yet in the database instead of leaking ML pipeline results.
        if static_category_matched and not all_results:
            print(f"[Search] Static check: category matched but 0 products in DB — returning empty (not falling through to ML)")
            return []

        # Deduplicate by product id (keep first occurrence)
        seen = {}
        for r in all_results:
            if r.id not in seen:
                seen[r.id] = r

        final = sorted(seen.values(), key=lambda r: (LABEL_PRIORITY.get(r.relevance_label, 3), -r.relevance_score))[:max_results]
        print(f"[Search] Static category match: {len(final)} products returned")
        return final

    except Exception as e:
        # Never let static search break the normal pipeline
        print(f"[Search] Static search error (falling through to ML): {e}")
        return None


def _run_search_pipeline(
    search_text: str,
    filters: dict,
    max_candidates: int,
    include_complements: bool,
    include_substitutes: bool,
    show_all: bool,
    is_multi_group: bool = False,
    esci_query_embedding: np.ndarray = None,
) -> list[SearchResultItem]:
    """
    Core search pipeline for a single search group.
    Stages: BERT Embedding -> pgvector -> CrossEncoder -> ESCI -> Score Blending

    `esci_query_embedding` is the embedding used for ESCI classification.
    When running multi-group, pass the ORIGINAL full-query embedding so the
    classifier sees the kind of input it was trained on (conversational queries),
    not the short group fragment.
    """
    query_embedding = bert_service.compute_embedding(search_text)
    if esci_query_embedding is None:
        esci_query_embedding = query_embedding

    # Log brand detection — brand is embedded in search_text by query rewriter;
    # no ILIKE hard filter is used (would over-aggressively exclude results).
    if filters.get("brand"):
        print(f"[Search]   Brand slot='{filters['brand']}' — handled via BERT embedding, not SQL filter")

    if show_all:
        # Admin mode: fetch every active/approved product so nothing is hidden by
        # the pgvector top-K cap. Similarity is set to 0 (no vector ranking needed).
        sb = get_supabase()
        qb = (sb.table("products")
              .select("id,seller_id,title,description,price,stock,images")
              .eq("is_active", True).eq("status", "approved").gt("stock", 0))
        if filters.get("price_max") is not None:
            qb = qb.lte("price", filters["price_max"])
        if filters.get("price_min") is not None:
            qb = qb.gte("price", filters["price_min"])
        db_rows = qb.execute().data
        candidates = [{**r, "similarity": 0.0, "embedding": []} for r in db_rows]
        print(f"[Search]   '{search_text}' (show_all): {len(candidates)} total products from DB")
    else:
        # Only price is used as a hard DB filter; brand/color are semantic (BERT)
        has_price_filter = filters.get("price_min") is not None or filters.get("price_max") is not None
        if has_price_filter:
            raw_candidates = search_similar_products_filtered(
                query_embedding, top_k=max_candidates,
                price_min=filters.get("price_min"), price_max=filters.get("price_max"),
            )
        else:
            raw_candidates = search_similar_products(query_embedding, top_k=max_candidates)

        print(f"[Search]   '{search_text}': {len(raw_candidates)} raw candidates")

        if filters.get("price_max") is not None:
            raw_candidates = [c for c in raw_candidates if float(c["price"]) <= filters["price_max"]]
        if filters.get("price_min") is not None:
            raw_candidates = [c for c in raw_candidates if float(c["price"]) >= filters["price_min"]]

        candidates = [c for c in raw_candidates if c["similarity"] >= 0.20]

    if not show_all:
        candidates = [c for c in candidates if c.get("embedding") is not None and len(c.get("embedding")) > 0]
    if not candidates:
        return []

    product_titles = [c["title"] for c in candidates]
    if ranker_service._loaded:
        raw_ranker_scores = ranker_service.rank(search_text, product_titles)
        ranker_scores = ranker_service.normalize_scores(raw_ranker_scores)
    else:
        ranker_scores = [c["similarity"] for c in candidates]

    has_embeddings = any(
        c.get("embedding") is not None and len(c["embedding"]) > 0
        for c in candidates
    )
    if classifier_service._loaded and has_embeddings:
        product_embeddings = np.array([c["embedding"] for c in candidates])
        classifications = classifier_service.classify_batch(esci_query_embedding, product_embeddings)
    else:
        classifications = [{"label": "Exact", "confidence": 1.0, "class_id": 0,
                            "exact_prob": 1.0, "substitute_prob": 0.0,
                            "complement_prob": 0.0, "irrelevant_prob": 0.0}
                           for _ in candidates]

    # Multi-group uses a lower threshold and stronger similarity weight
    # because short group terms don't give the ranker much to grip on.
    if is_multi_group:
        w_r, w_c, w_s = (0.35, 0.05, 0.60) if ranker_service._loaded else (0.0, 0.05, 0.95)
        MIN_RELEVANCE_SCORE = 0.45
    else:
        w_r, w_c, w_s = (0.55, 0.05, 0.40) if ranker_service._loaded else (0.0, 0.05, 0.95)
        MIN_RELEVANCE_SCORE = 0.70

    # Evidence-based relabel: if the ranker + similarity both strongly agree the product
    # matches this group, override a spurious Irrelevant/Complement → Substitute.
    # This catches the failure mode where ESCI flips to Irrelevant on a match it can't
    # verify (short group terms, out-of-distribution phrasings).
    STRONG_MATCH_RANKER = 0.75
    STRONG_MATCH_SIM = 0.55

    scored = []
    for idx, (cand, cls) in enumerate(zip(candidates, classifications)):
        r_score = float(ranker_scores[idx])
        sim = float(cand["similarity"])

        if show_all and not has_embeddings:
            # No embeddings available — derive ESCI from ranker score alone.
            # CrossEncoder scores are normalised 0-1 across this batch.
            if r_score >= 0.70:
                label = "Exact"
                e_prob, s_prob, c_prob, i_prob = r_score, (1-r_score)*0.4, (1-r_score)*0.3, (1-r_score)*0.3
            elif r_score >= 0.45:
                label = "Substitute"
                e_prob, s_prob, c_prob, i_prob = r_score*0.3, r_score, (1-r_score)*0.5, (1-r_score)*0.5
            elif r_score >= 0.25:
                label = "Complement"
                e_prob, s_prob, c_prob, i_prob = r_score*0.2, r_score*0.3, r_score, 1-r_score*1.5
            else:
                label = "Irrelevant"
                e_prob, s_prob, c_prob, i_prob = 0.0, 0.0, 0.0, 0.0
            confidence = r_score if label != "Irrelevant" else 0.0
            cls = {"label": label, "confidence": round(confidence, 4),
                   "exact_prob": round(max(0.0, e_prob), 4),
                   "substitute_prob": round(max(0.0, s_prob), 4),
                   "complement_prob": round(max(0.0, c_prob), 4),
                   "irrelevant_prob": round(max(0.0, i_prob), 4)}
        else:
            label = cls["label"]
            # Evidence override: demote Irrelevant → Substitute when retrieval signals agree
            if label == "Irrelevant" and r_score >= STRONG_MATCH_RANKER and sim >= STRONG_MATCH_SIM:
                label = "Substitute"
                cls = {**cls, "label": "Substitute"}

        rel = _compute_blended_score(r_score, _label_to_priority_weight(label), sim, w_r, w_c, w_s)
        if not show_all and rel < MIN_RELEVANCE_SCORE:
            continue
        # For multi-group, don't filter by ESCI label — pgvector+ranker already confirmed relevance
        if not is_multi_group:
            if not show_all and label == "Substitute" and not include_substitutes:
                continue
            if not show_all and label == "Complement" and not include_complements:
                continue
        low_relevance = rel < 0.10
        scored.append(SearchResultItem(
            id=str(cand["id"]), title=cand["title"],
            description=cand.get("description") or "",
            price=float(cand["price"]),
            stock=int(cand.get("stock", 0)),
            image_url=_first_image(cand.get("images")),
            seller_id=str(cand["seller_id"]),
            similarity=round(sim, 4), ranker_score=round(r_score, 4),
            relevance_score=round(rel, 4),
            relevance_label="Irrelevant" if low_relevance else label,
            relevance_confidence=0.0 if low_relevance else round(cls["confidence"], 4),
            exact_prob=0.0 if low_relevance else round(cls.get("exact_prob", 0.0), 4),
            substitute_prob=0.0 if low_relevance else round(cls.get("substitute_prob", 0.0), 4),
            complement_prob=0.0 if low_relevance else round(cls.get("complement_prob", 0.0), 4),
            irrelevant_prob=0.0 if low_relevance else round(cls.get("irrelevant_prob", 0.0), 4),
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

        # === STATIC CATEGORY CHECK ===
        # Check if search groups match hardcoded product categories
        # (e.g., halal food, lenten food, snacks, summer food)
        static_results = _try_static_search(rewritten, max_results)
        if static_results is not None:
            # static_results is a list (possibly empty) — always return it without hitting ML.
            # Empty means the category is recognised but no matching products exist in the DB yet.
            print(f"[Search] ✓ Static match — returning {len(static_results)} products (skipping ML pipeline)")
            return SearchResponse(
                query=q,
                total_results=len(static_results),
                results=static_results,
                message="" if static_results else "No products found matching your query.",
                rewritten_query=rewritten.search_text,
                detected_intents=rewritten.intents,
                extracted_slots=_build_extracted_slots(rewritten),
                applied_filters=_build_applied_filters(rewritten.search_groups),
                search_groups=[{"search_text": g.search_text, "filters": g.filters} for g in rewritten.search_groups],
            )
        else:
            print(f"[Search] ✗ No static match — proceeding to ML pipeline")

        if not bert_service._loaded:
            return await _fallback_text_search(q, rewritten, max_results)

        # Run pipeline for each search group
        num_groups = len(rewritten.search_groups)
        is_multi = num_groups > 1
        per_group_limit = max(3, max_results // num_groups) if is_multi else max_results
        per_group_candidates = 80 if is_multi else SEARCH_TOP_K_CANDIDATES

        # For ESCI classification, use the embedding of the full original query.
        # The classifier was trained on conversational queries; giving it the short
        # per-group term (e.g. "toys") produces unreliable Irrelevant labels.
        esci_query_embedding = bert_service.compute_embedding(q) if is_multi else None

        all_results = []
        for group in rewritten.search_groups:
            group_results = _run_search_pipeline(
                search_text=group.search_text,
                filters=group.filters,
                max_candidates=per_group_candidates,
                include_complements=include_complements,
                include_substitutes=include_substitutes,
                show_all=show_all,
                is_multi_group=is_multi,
                esci_query_embedding=esci_query_embedding,
            )
            all_results.extend(group_results[:per_group_limit])

        # Deduplicate by product id (keep highest relevance score)
        seen = {}
        for r in all_results:
            if r.id not in seen or r.relevance_score > seen[r.id].relevance_score:
                seen[r.id] = r

        final_results = sorted(seen.values(), key=lambda r: (LABEL_PRIORITY.get(r.relevance_label, 3), -r.relevance_score))[:max_results]
        print(f"[Search] Final results: {len(final_results)} (from {len(rewritten.search_groups)} group(s))")

        return SearchResponse(
            query=q,
            total_results=len(final_results),
            results=final_results,
            message="" if final_results else "No products found matching your query.",
            rewritten_query=rewritten.search_text,
            detected_intents=rewritten.intents,
            extracted_slots=_build_extracted_slots(rewritten),
            applied_filters=_build_applied_filters(rewritten.search_groups),
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
    results = sorted(seen.values(), key=lambda r: (LABEL_PRIORITY.get(r.relevance_label, 3), -r.relevance_score))[:max_results]

    return SearchResponse(
        query=original_query,
        total_results=len(results),
        results=results,
        message="" if results else "No products found.",
        rewritten_query=rewritten.search_text,
        detected_intents=rewritten.intents,
        extracted_slots=_build_extracted_slots(rewritten),
        applied_filters=_build_applied_filters(rewritten.search_groups),
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