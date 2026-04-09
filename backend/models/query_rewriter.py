"""
Query Rewriter — transforms raw user queries into structured search inputs
using intent classification and slot extraction.

Takes:  raw query + intents + extracted slots
Returns: rewritten search text + structured filters + metadata
"""

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SearchGroup:
    """A single search sub-query with its own text and filters."""
    search_text: str
    filters: dict = field(default_factory=dict)


@dataclass
class RewrittenQuery:
    """Output of the query rewriter."""
    search_text: str           # Cleaned query for BERT embedding + keyword matching
    filters: dict              # Structured filters for Supabase WHERE clauses
    original_query: str        # The raw user input
    intents: list = field(default_factory=list)   # Detected intents
    slots: dict = field(default_factory=dict)     # All extracted slots
    is_rewritten: bool = False  # Whether any rewriting was applied
    search_groups: list = field(default_factory=list)  # List[SearchGroup] for compound queries


# Slot types that represent product names (included in search text)
PRODUCT_SLOTS = {"PRODUCT1", "PRODUCT2"}

# Slot types that become Supabase filters (excluded from search text)
FILTER_SLOTS = {"PRICE_MIN", "PRICE_MAX", "PRICE_MOD", "BRAND", "COLOR",
                "SIZE", "RATING_MIN", "RATING_MOD"}

# Modifier words to strip from search text (common non-product words)
MODIFIER_WORDS = {
    "under", "below", "less", "than", "above", "over", "more",
    "at", "least", "most", "around", "between", "and",
    "cheaper", "cheapest", "expensive",
    "budget", "affordable", "cheap", "pricey",
    "minimum", "maximum", "max", "min",
    "rating", "rated", "stars", "star",
    "i", "want", "need", "looking", "for", "find", "show", "me",
    "the", "a", "an", "of", "with", "in", "na", "ng", "ang", "yung",
    "paano", "saan", "ano", "may", "gusto", "ko", "hanap",
    "magkano", "pesos", "peso", "php",
}


# Conjunction patterns for compound query splitting
COMPOUND_CONJUNCTIONS = [
    r'\s+and\s+',
    r'\s+at\s+saka\s+',
    r'\s+tapos\s+',
    r'\s+tsaka\s+',
    r'\s+pati\s+(na\s+)?',
]


def split_compound_query(query: str) -> list[str]:
    """
    Split a compound query on conjunctions ('and', 'at saka', etc.)
    into separate product searches.

    "party items less than 300 and shoes for kids less 200"
    -> ["party items less than 300", "shoes for kids less 200"]

    "peanut butter and jelly under 200"
    -> ["peanut butter", "jelly under 200"]
    """
    for conj in COMPOUND_CONJUNCTIONS:
        parts = re.split(conj, query, flags=re.IGNORECASE)
        if len(parts) >= 2:
            cleaned = [p.strip() for p in parts if p and p.strip()]
            if len(cleaned) >= 2:
                return cleaned
    return [query]


def split_sentences(query: str) -> list[str]:
    """
    Split a multi-sentence or compound query into individual sub-queries.
    1. Splits on . ? ! followed by whitespace (standard sentence splitting).
    2. Splits on commas that act as product separators.
    3. Then splits each sentence on conjunctions ('and', 'at saka').
    """
    # Split on sentence-ending punctuation: . followed by space+letter (avoids
    # decimals like "3.5"), or ? / ! at end/followed by whitespace.
    parts = re.split(r'\.(?=\s+[A-Za-z])|[?!](?:\s+|$)', query)
    sentences = [s.strip().rstrip('.!?') for s in parts if s and s.strip()]
    sentences = [s for s in sentences if s]
    if not sentences:
        sentences = [query.strip()]

    # Split on commas — treat commas as product separators
    comma_parts = []
    for sent in sentences:
        csv = [p.strip() for p in sent.split(',') if p and p.strip()]
        comma_parts.extend(csv if len(csv) >= 2 else [sent])

    # Compound query splitting on each part (handles 'and')
    all_parts = []
    for part in comma_parts:
        compound_parts = split_compound_query(part)
        all_parts.extend(compound_parts)

    return all_parts if all_parts else [query.strip()]


def _merge_rewritten_queries(
    sub_queries: list[RewrittenQuery],
    original_query: str,
) -> RewrittenQuery:
    """Merge multiple per-sentence RewrittenQuery results into one."""
    if len(sub_queries) == 1:
        rq = sub_queries[0]
        rq.search_groups = [SearchGroup(search_text=rq.search_text, filters=rq.filters)]
        return rq

    # Union of all intents (deduplicated, preserving order)
    merged_intents = list(dict.fromkeys(
        intent for rq in sub_queries for intent in rq.intents
    ))

    # Each sub-query that originated from a separator (dot, comma, 'and') represents
    # a distinct product search — always keep them as independent search groups.
    # We only collapse to a single group when all sub-queries share the same search
    # text (i.e., splitting produced no meaningful separation).
    distinct_texts = len({rq.search_text for rq in sub_queries}) > 1

    if distinct_texts:
        # ── COMPOUND QUERY ──
        # Each sub-query becomes its own SearchGroup with independent filters.
        search_groups = [
            SearchGroup(search_text=rq.search_text, filters=rq.filters)
            for rq in sub_queries
        ]
        merged_slots = {}
        product_idx = 1
        for rq in sub_queries:
            for key, value in rq.slots.items():
                if key in ("PRODUCT1", "PRODUCT2"):
                    slot_key = f"PRODUCT{product_idx}"
                    if slot_key not in merged_slots:
                        merged_slots[slot_key] = value
                        product_idx += 1
                elif key not in merged_slots:
                    merged_slots[key] = value
        search_text = " | ".join(g.search_text for g in search_groups)
        return RewrittenQuery(
            search_text=search_text,
            filters={},
            original_query=original_query,
            intents=merged_intents,
            slots=merged_slots,
            is_rewritten=True,
            search_groups=search_groups,
        )

    # ── SINGLE GROUP (original merge behavior) ──
    merged_slots = {}
    for rq in sub_queries:
        for key, value in rq.slots.items():
            if key in ("PRODUCT1", "PRODUCT2"):
                if "PRODUCT1" not in merged_slots:
                    merged_slots["PRODUCT1"] = value
                elif "PRODUCT2" not in merged_slots:
                    merged_slots["PRODUCT2"] = value
            elif key not in merged_slots:
                merged_slots[key] = value

    merged_filters = {}
    for rq in sub_queries:
        for key, value in rq.filters.items():
            if key not in merged_filters:
                merged_filters[key] = value
            elif key == "price_min":
                merged_filters[key] = max(merged_filters[key], value)
            elif key == "price_max":
                merged_filters[key] = min(merged_filters[key], value)
            elif key == "rating_min":
                merged_filters[key] = max(merged_filters[key], value)

    seen = set()
    search_parts = []
    for rq in sub_queries:
        for word in rq.search_text.split():
            lower = word.lower()
            if lower not in seen:
                seen.add(lower)
                search_parts.append(word)
    search_text = " ".join(search_parts)

    return RewrittenQuery(
        search_text=search_text,
        filters=merged_filters,
        original_query=original_query,
        intents=merged_intents,
        slots=merged_slots,
        is_rewritten=any(rq.is_rewritten for rq in sub_queries),
        search_groups=[SearchGroup(search_text=search_text, filters=merged_filters)],
    )


def _parse_price(value: str) -> Optional[float]:
    """Try to parse a numeric value from a price slot."""
    clean = re.sub(r"[^\d.]", "", value)
    try:
        return float(clean)
    except ValueError:
        return None


def _detect_price_direction(query: str) -> Optional[str]:
    """
    Detect whether the user's price intent is a minimum or maximum
    based on modifier words in the raw query.

    Returns "min", "max", or None if ambiguous.
    """
    q = query.lower()
    # Patterns that indicate a MINIMUM price ("more than X", "above X", etc.)
    min_patterns = [
        r"\bmore\s+than\b", r"\babove\b", r"\bover\b", r"\bat\s+least\b",
        r"\bhigher\s+than\b", r"\bstarting\b", r"\bfrom\b",
        r"\bexpensive\b", r"\bpricey\b",
        # Filipino
        r"\bhigit\s+sa\b", r"\bmula\s+sa\b",
    ]
    # Patterns that indicate a MAXIMUM price ("less than X", "under X", etc.)
    max_patterns = [
        r"\bless\s+than\b", r"\bunder\b", r"\bbelow\b", r"\bat\s+most\b",
        r"\bcheaper\s+than\b", r"\bbudget\b", r"\bcheap\b", r"\baffordable\b",
        # Filipino
        r"\bmura\b", r"\bmababa\b",
    ]
    for pat in min_patterns:
        if re.search(pat, q):
            return "min"
    for pat in max_patterns:
        if re.search(pat, q):
            return "max"
    return None


def rewrite(query: str, intents: list[str], slots: dict) -> RewrittenQuery:
    """
    Rewrite a user query based on detected intents and extracted slots.

    Logic:
    - For free_form queries (and no other intents): pass through as-is
    - For filtered_search: extract filter slots into structured filters,
      build search text from product slots only
    - For single_search / multi_search: build search text from product slots,
      include brand/color in search text too
    """

    # Default: use original query as-is
    result = RewrittenQuery(
        search_text=query.strip(),
        filters={},
        original_query=query.strip(),
        intents=intents,
        slots=slots,
    )

    # If no intents or slots were extracted, return original query
    if not intents and not slots:
        return result

    # Free-form intent with no product slots: pass through as-is
    # (e.g., "pano magluto ng adobo" — not a product search)
    if "free_form" in intents and len(intents) == 1 and not slots:
        return result

    # --- Correct price slot direction ---
    # The NER model may tag the price value as PRICE_MAX when the user
    # actually means "more than X" (a minimum), or vice versa.
    # Use modifier words in the raw query to fix this.
    direction = _detect_price_direction(query)

    has_min = "PRICE_MIN" in slots
    has_max = "PRICE_MAX" in slots

    if direction == "min" and has_max and not has_min:
        # NER said PRICE_MAX but user said "more than" → swap to PRICE_MIN
        slots["PRICE_MIN"] = slots.pop("PRICE_MAX")
    elif direction == "max" and has_min and not has_max:
        # NER said PRICE_MIN but user said "under" → swap to PRICE_MAX
        slots["PRICE_MAX"] = slots.pop("PRICE_MIN")

    # --- Regex fallback: extract price if NER missed it ---
    # Covers patterns like "less than 30", "under 500", "more than 100", etc.
    if direction is not None and "PRICE_MIN" not in slots and "PRICE_MAX" not in slots:
        price_match = re.search(r'(\d+(?:\.\d+)?)', query)
        if price_match:
            price_val = price_match.group(1)
            if direction == "max":
                slots["PRICE_MAX"] = price_val
                print(f"[QueryRewriter] Regex fallback: PRICE_MAX={price_val} (from '{query}')")
            elif direction == "min":
                slots["PRICE_MIN"] = price_val
                print(f"[QueryRewriter] Regex fallback: PRICE_MIN={price_val} (from '{query}')")

    # --- Build structured filters from slots ---
    filters = {}

    price_max = slots.get("PRICE_MAX")
    if price_max:
        parsed = _parse_price(price_max)
        if parsed is not None:
            filters["price_max"] = parsed

    price_min = slots.get("PRICE_MIN")
    if price_min:
        parsed = _parse_price(price_min)
        if parsed is not None:
            filters["price_min"] = parsed

    brand = slots.get("BRAND")
    if brand:
        filters["brand"] = brand.strip()

    color = slots.get("COLOR")
    if color:
        filters["color"] = color.strip()

    size = slots.get("SIZE")
    if size:
        filters["size"] = size.strip()

    rating_min = slots.get("RATING_MIN")
    if rating_min:
        parsed = _parse_price(rating_min)
        if parsed is not None:
            filters["rating_min"] = parsed

    # --- Build search text ---
    search_parts = []

    # Include product names
    for slot_type in ["PRODUCT1", "PRODUCT2"]:
        if slot_type in slots:
            search_parts.append(slots[slot_type].strip())

    # Include brand in search text (helps BERT + keyword matching)
    if brand:
        search_parts.insert(0, brand.strip())

    # Include color in search text (helps keyword matching)
    if color:
        search_parts.insert(0, color.strip())

    # If we have product-related slots, use them as the search text
    if search_parts:
        search_text = " ".join(search_parts)
    else:
        # No product slots found — clean the original query
        # Remove modifier words and price values
        words = query.strip().split()
        cleaned = [
            w for w in words
            if w.lower() not in MODIFIER_WORDS
            and not re.match(r"^\d+$", w)
        ]
        search_text = " ".join(cleaned) if cleaned else query.strip()

    result.search_text = search_text
    result.filters = filters
    result.is_rewritten = bool(filters) or (search_text != query.strip())

    return result


class QueryRewriterService:
    """
    Orchestrates intent classification + slot extraction + query rewriting.
    This is the main entry point called from the search route.
    """

    def __init__(self):
        self._intent_service = None
        self._slot_service = None

    def init(self, intent_service, slot_service):
        """Initialize with references to the intent and slot services."""
        self._intent_service = intent_service
        self._slot_service = slot_service

    def process(self, query: str) -> RewrittenQuery:
        """
        Full query rewriting pipeline with multi-sentence support:
        1. Split query into sentences
        2. Process each sentence (intent + slot + rewrite)
        3. Merge results into a single RewrittenQuery

        Returns RewrittenQuery with search_text, filters, intents, and slots.
        """
        sentences = split_sentences(query)

        if len(sentences) == 1:
            # Single sentence: no splitting overhead
            result = self._process_single(sentences[0])
            result.original_query = query.strip()
            result.search_groups = [SearchGroup(search_text=result.search_text, filters=result.filters)]
            self._log(query, result)
            return result

        # Multiple sentences: process each independently, then merge
        sub_results = [self._process_single(s) for s in sentences]
        merged = _merge_rewritten_queries(sub_results, original_query=query.strip())

        if merged.is_rewritten:
            print(f"[QueryRewriter] '{query}' -> '{merged.search_text}'")
            print(f"[QueryRewriter]   Sentences: {sentences}")
            print(f"[QueryRewriter]   Intents: {merged.intents}")
            print(f"[QueryRewriter]   Slots:   {merged.slots}")
            print(f"[QueryRewriter]   Filters: {merged.filters}")

        return merged

    def _process_single(self, sentence: str) -> RewrittenQuery:
        """Process a single sentence through intent + slot + rewrite."""
        # Step 1: Classify intents
        intent_result = {"intents": [], "probabilities": {}}
        if self._intent_service and self._intent_service._loaded:
            intent_result = self._intent_service.predict(sentence)

        # Step 2: Extract slots
        slot_result = {"slots": {}, "tagged_tokens": []}
        if self._slot_service and self._slot_service._loaded:
            slot_result = self._slot_service.extract(sentence)

        # Step 3: Rewrite
        return rewrite(
            query=sentence,
            intents=intent_result["intents"],
            slots=slot_result["slots"],
        )

    def _log(self, query: str, result: RewrittenQuery):
        """Log rewriting details for debugging."""
        if result.is_rewritten:
            print(f"[QueryRewriter] '{query}' -> '{result.search_text}'")
            print(f"[QueryRewriter]   Intents: {result.intents}")
            print(f"[QueryRewriter]   Slots:   {result.slots}")
            print(f"[QueryRewriter]   Filters: {result.filters}")


# Global singleton
query_rewriter = QueryRewriterService()
