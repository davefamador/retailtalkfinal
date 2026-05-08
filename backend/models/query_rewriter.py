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
    price_is_shared: bool = False  # True when price came from a shared trailing clause


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
    "i", "am", "want", "need", "looking", "for", "find", "show", "me",
    "please", "give", "get", "buy", "some", "any",
    "the", "a", "an", "of", "with", "in", "this", "na", "ng", "ang", "yung",
    "paano", "saan", "ano", "may", "gusto", "ko", "hanap",
    "magkano", "pesos", "peso", "php",
    "priced", "costing", "costs", "worth", "price", "cost",
    "ranging", "range", "to",
}

# Filipino keyword → English search term.
# Applied word-by-word before any other processing so the rest of the
# pipeline only ever sees English terms.
_FILIPINO_WORD_MAP: dict[str, str] = {
    # Food / items
    "pagkain":  "food",
    "pagkains": "food",
    "laruan":   "toys",
    "laruang":  "toys",
    "damit":    "clothes",
    "damits":   "clothes",
    "sapatos":  "shoes",
    "medyas":   "socks",
    "bag":      "bag",
    "prutas":   "fruits",
    "gulay":    "vegetables",
    "karne":    "meat",
    "isda":     "fish",
    "tinapay":  "bread",
    "inumin":   "drinks",
    "gatas":    "milk",
    "kape":     "coffee",
    "asukal":   "sugar",
    "bigas":    "rice",
    # Common query words already in MODIFIER_WORDS but include Tagalog forms
    "hanapin":  "find",
    "gusto":    "want",
    "kailangan": "need",
    "ibigay":   "give",
}


def _apply_filipino_map(query: str) -> str:
    """Replace known Filipino words with their English equivalents."""
    words = query.split()
    result = []
    for w in words:
        lower = w.lower()
        result.append(_FILIPINO_WORD_MAP.get(lower, w))
    return " ".join(result)


_INTENT_RULES: list[tuple] = [
    # ── Clothing + season ────────────────────────────────────────────────────
    # trigger: clothing-related word   category: season keyword
    # Note: "dress/blouse/skirt/gown" are excluded from the trigger — they are
    # specific product names protected by _SPECIFIC_ITEM_RE and kept as-is.
    (
        re.compile(
            r'\b(outfit|outfits|wear|wearing|attire|tshirt|t-shirt|shirt|shirts'
            r'|top|tops|clothe|clothes|clothing|clothings|shorts|jacket|jackets'
            r'|flip\s+flops?|sleeveless|long\s+sleeve)\b',
            re.IGNORECASE,
        ),
        re.compile(r'\bsummer\b', re.IGNORECASE),
        "summer clothes",
    ),
    (
        re.compile(
            r'\b(outfit|outfits|wear|wearing|attire|tshirt|t-shirt|shirt|shirts'
            r'|top|tops|clothe|clothes|clothing|clothings|shorts|jacket|jackets'
            r'|flip\s+flops?|sleeveless|long\s+sleeve)\b',
            re.IGNORECASE,
        ),
        re.compile(r'\b(rain(y)?|wet)\b', re.IGNORECASE),
        "rainy season clothes",
    ),
    (
        re.compile(
            r'\b(outfit|outfits|wear|wearing|attire|tshirt|t-shirt|shirt|shirts'
            r'|top|tops|clothe|clothes|clothing|clothings|shorts|jacket|jackets'
            r'|flip\s+flops?|sleeveless|long\s+sleeve)\b',
            re.IGNORECASE,
        ),
        re.compile(r'\b(dry|hot)\b', re.IGNORECASE),
        "dry season clothes",
    ),
    # ── Food + season ─────────────────────────────────────────────────────────
    (
        re.compile(r'\b(eat|eating|food|foods|meal|meals|dish|dishes|cuisine|recipe|cook|cooking)\b', re.IGNORECASE),
        re.compile(r'\bsummer\b', re.IGNORECASE),
        "summer food",
    ),
    (
        re.compile(r'\b(eat|eating|food|foods|meal|meals|dish|dishes|cuisine|recipe|cook|cooking)\b', re.IGNORECASE),
        re.compile(r'\b(lent(en)?|holy|easter|semana\s+santa)\b', re.IGNORECASE),
        "lenten food",
    ),
    (
        re.compile(r'\b(eat|eating|food|foods|meal|meals|dish|dishes|cuisine|recipe|cook|cooking)\b', re.IGNORECASE),
        re.compile(r'\b(rain(y)?|wet)\b', re.IGNORECASE),
        "seasonal food",
    ),
    (
        re.compile(r'\b(eat|eating|food|foods|meal|meals|dish|dishes|cuisine|recipe|cook|cooking)\b', re.IGNORECASE),
        re.compile(r'\b(dry|hot)\b', re.IGNORECASE),
        "seasonal food",
    ),
    # ── Kids food ────────────────────────────────────────────────────────────
    (
        re.compile(r'\b(eat|eating|food|foods|meal|meals|snack|snacks)\b', re.IGNORECASE),
        re.compile(r'\b(kid|kids|child|children|toddler|toddlers|baby|babies)\b', re.IGNORECASE),
        "kids food",
    ),
    # ── Snacks + season / occasion ────────────────────────────────────────────
    (
        re.compile(r'\b(snack|snacks|munch|munching|junk|chips)\b', re.IGNORECASE),
        re.compile(r'\b(party|birthday|celebration|event|occasion)\b', re.IGNORECASE),
        "snacks",
    ),
    # ── Toys / birthday — gender-specific (must come before generic birthday toys) ──
    # "toys for boys birthday" / "boys toys for birthday" → boys birthday toys
    (
        re.compile(r'\b(toy|toys|play|playing)\b', re.IGNORECASE),
        re.compile(r'\b(boy|boys)\b.*\b(birthday|party)\b|\b(birthday|party)\b.*\b(boy|boys)\b', re.IGNORECASE),
        "boys birthday toys",
    ),
    # "toys for girls birthday" / "girls toys for birthday" → girls birthday toys
    (
        re.compile(r'\b(toy|toys|play|playing)\b', re.IGNORECASE),
        re.compile(r'\b(girl|girls)\b.*\b(birthday|party)\b|\b(birthday|party)\b.*\b(girl|girls)\b', re.IGNORECASE),
        "girls birthday toys",
    ),
    # ── Toys / birthday ───────────────────────────────────────────────────────
    # "toys in this birthday" / "toys for a birthday party" → birthday toys
    (
        re.compile(r'\b(toy|toys|play|playing)\b', re.IGNORECASE),
        re.compile(r'\b(birthday|party|celebration)\b', re.IGNORECASE),
        "birthday toys",
    ),
    # "gifts/presents for a birthday/party/kids" → birthday items (decorations + toys)
    (
        re.compile(r'\b(gift|gifts|present|presents)\b', re.IGNORECASE),
        re.compile(r'\b(birthday|party|celebration|kid|kids|children|child)\b', re.IGNORECASE),
        "birthday items",
    ),
    (
        re.compile(r'\b(give|buy|get|looking)\b', re.IGNORECASE),
        re.compile(r'\b(birthday|party|celebration)\b', re.IGNORECASE),
        "birthday items",
    ),
    # ── Canned goods context ──────────────────────────────────────────────────
    (
        re.compile(r'\b(can|canned|tin|tinned|preserved)\b', re.IGNORECASE),
        re.compile(r'\b(food|goods|product|item)\b', re.IGNORECASE),
        "canned goods",
    ),
    # ── Halal context ─────────────────────────────────────────────────────────
    (
        re.compile(r'\b(halal|muslim|islamic|islam)\b', re.IGNORECASE),
        re.compile(r'\b(food|foods|eat|meal|dish)\b', re.IGNORECASE),
        "halal food",
    ),
    # ── School supplies context ───────────────────────────────────────────────
    (
        re.compile(r'\b(school|study|studying|class|classroom|student|students)\b', re.IGNORECASE),
        re.compile(r'\b(supply|supplies|material|materials|stuff|item|items|need|needs)\b', re.IGNORECASE),
        "school supplies",
    ),
]


# Shared sub-patterns for dual-direction price ranges
_MIN_KW = r'(?:more\s+than|above|over|at\s+least|higher\s+than)'
_MAX_KW = r'(?:less\s+than|under|below|at\s+most|cheaper\s+than)'
_NUM_P  = r'\d+(?:\.\d+)?(?:\s+pesos?|php)?'

# Price clause pattern — matches trailing or inline price filters so they can
# be stripped before category matching and re-attached afterwards.
# Dual-direction variants (with or without "and") are checked first so the
# greedy single-bound fallback never splits them.
_PRICE_CLAUSE_RE = re.compile(
    rf'(\s+{_MIN_KW}\s+{_NUM_P}\s+(?:and\s+)?{_MAX_KW}\s+{_NUM_P}'   # more than X [and] less than Y
    rf'|\s+{_MAX_KW}\s+{_NUM_P}\s+(?:and\s+)?{_MIN_KW}\s+{_NUM_P}'   # less than X [and] more than Y
    rf'|\s+{_MIN_KW}\s+{_NUM_P}'                                        # more than X  (single)
    rf'|\s+{_MAX_KW}\s+{_NUM_P}'                                        # less than X  (single)
    rf'|\s+between\s+\d+(?:\.\d+)?\s+(?:and|to)\s+{_NUM_P})',          # between X and Y
    re.IGNORECASE,
)

# Matches any dual-direction or between-range so its "and" is excluded from
# the conjunction guard (both in _normalise_seasonal_clothing and split_compound_query).
_BETWEEN_RANGE_RE = re.compile(
    rf'\bbetween\s+\d+(?:\.\d+)?\s+(?:and|to)\s+\d+(?:\.\d+)?'
    rf'|{_MIN_KW}\s+{_NUM_P}\s+(?:and\s+)?{_MAX_KW}\s+\d+(?:\.\d+)?'
    rf'|{_MAX_KW}\s+{_NUM_P}\s+(?:and\s+)?{_MIN_KW}\s+\d+(?:\.\d+)?',
    re.IGNORECASE
)

_CONJUNCTION_RE = re.compile(
    r'\b(and|at\s+saka|tapos|tsaka|pati(?:\s+na)?)\b', re.IGNORECASE
)


def _normalise_seasonal_clothing(query: str) -> str:

    query_for_conj_check = _BETWEEN_RANGE_RE.sub("", query)
    if _CONJUNCTION_RE.search(query_for_conj_check):
        return query

    price_clause = ""
    m = _PRICE_CLAUSE_RE.search(query)
    if m:
        price_clause = m.group(0)
        query_for_match = query[:m.start()] + query[m.end():]
    else:
        query_for_match = query

    # Guard: if the query names a specific clothing item (dress, blouse, skirt, etc.)
    # keep the specific term — don't generalise to "summer/rainy clothes".
    # e.g. "summer dress" should stay "summer dress", not become "summer clothes".
    _SPECIFIC_ITEM_RE = re.compile(
        r'\b(dress|dresses|blouse|blouses|skirt|skirts|gown|gowns|polo|polos)\b',
        re.IGNORECASE,
    )
    if _SPECIFIC_ITEM_RE.search(query_for_match):
        return query

    for trigger_pat, category_pat, canonical in _INTENT_RULES:
        if trigger_pat.search(query_for_match) and category_pat.search(query_for_match):
            result = canonical + price_clause
            return result

    return query


# Conjunction patterns for compound query splitting
COMPOUND_CONJUNCTIONS = [
    r'\s+and\s+',
    r'\s+at\s+saka\s+',
    r'\s+tapos\s+',
    r'\s+tsaka\s+',
    r'\s+pati\s+(na\s+)?',
]


_BETWEEN_RE = re.compile(
    r'\b(between|sa pagitan ng|nasa pagitan ng)\s+(\d+(?:\.\d+)?)\s+'
    r'(?:pesos?\s+)?(?:and|to|hanggang|at)\s+(\d+(?:\.\d+)?)',
    re.IGNORECASE,
)

# Bare "X to Y" range without the word "between": "snacks 20 to 50"
_BARE_RANGE_RE = re.compile(
    r'(?<!\d)(\d+(?:\.\d+)?)\s+(?:pesos?\s+)?to\s+(\d+(?:\.\d+)?)(?!\d)',
    re.IGNORECASE,
)


def extract_between_range(query: str) -> Optional[tuple[float, float]]:
    """
    Detect price range patterns. Checks in order:
    1. 'between X and Y' / 'between X to Y'
    2. Bare 'X to Y' (e.g. 'snacks 20 to 50')
    Returns (min, max) or None if no range found.
    """
    m = _BETWEEN_RE.search(query)
    if m:
        a, b = float(m.group(2)), float(m.group(3))
        return (min(a, b), max(a, b))
    m = _BARE_RANGE_RE.search(query)
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        return (min(a, b), max(a, b))
    return None


def _strip_between_clause(query: str) -> str:
    """Remove a 'between X and Y' clause from the query string."""
    return _BETWEEN_RE.sub("", query).strip()


# Dual-direction price range: "more than X [and] less than Y" / "under X [and] above Y"
# The "and" is optional so both "more than 200 and less than 300" and
# "more than 200 less than 300" are treated as a single price clause.
_DUAL_DIRECTION_RE = re.compile(
    rf'{_MIN_KW}\s+{_NUM_P}\s+(?:and\s+)?{_MAX_KW}\s+{_NUM_P}'
    rf'|{_MAX_KW}\s+{_NUM_P}\s+(?:and\s+)?{_MIN_KW}\s+{_NUM_P}',
    re.IGNORECASE,
)


def split_compound_query(query: str) -> list[str]:
    """
    Split a compound query on conjunctions ('and', 'at saka', etc.)
    into separate product searches.

    "party items less than 300 and shoes for kids less 200"
    -> ["party items less than 300", "shoes for kids less 200"]

    "peanut butter and jelly under 200"
    -> ["peanut butter", "jelly under 200"]

    "snacks between 20 and 50" — NOT split (between-range guard)
    -> ["snacks between 20 and 50"]

    "dress more than 200 and less than 300" — NOT split (dual-direction guard)
    -> ["dress more than 200 and less than 300"]

    "snacks between 20 and 50 and halal food between 100 and 200"
    -> ["snacks between 20 and 50", "halal food between 100 and 200"]
    """
    # Replace price range clauses with placeholders so their internal "and"
    # is never mistaken for a product conjunction.
    placeholder_map = {}
    working = query

    # Guard dual-direction ranges first (they also contain "and")
    dual_matches = list(_DUAL_DIRECTION_RE.finditer(working))
    for i, m in enumerate(reversed(dual_matches)):
        placeholder = f"__DUAL{i}__"
        placeholder_map[placeholder] = m.group(0)
        working = working[: m.start()] + placeholder + working[m.end():]

    # Guard between-ranges
    between_matches = list(_BETWEEN_RE.finditer(working))
    for i, m in enumerate(reversed(between_matches)):
        placeholder = f"__BETWEEN{i}__"
        placeholder_map[placeholder] = m.group(0)
        working = working[: m.start()] + placeholder + working[m.end():]

    if placeholder_map:
        # Now split the placeholder-substituted string on conjunctions
        split_parts = [working]
        for conj in COMPOUND_CONJUNCTIONS:
            new_parts = []
            for part in split_parts:
                new_parts.extend(re.split(conj, part, flags=re.IGNORECASE))
            split_parts = new_parts

        cleaned = [p.strip() for p in split_parts if p and p.strip()]

        if len(cleaned) < 2:
            # No product-level split found — return original query unchanged
            return [query]

        # Restore placeholders in each part
        restored = []
        for part in cleaned:
            for ph, original_clause in placeholder_map.items():
                part = part.replace(ph, original_clause)
            restored.append(part.strip())
        return [r for r in restored if r]

    for conj in COMPOUND_CONJUNCTIONS:
        parts = re.split(conj, query, flags=re.IGNORECASE)
        if len(parts) >= 2:
            cleaned = [p.strip() for p in parts if p and p.strip()]
            if len(cleaned) >= 2:
                return cleaned
    return [query]


def _split_space_separated_products(part: str) -> list[str]:
    from models.intent_mappings import _INTENT_CATEGORIES_LOWER

    _PRICE_CLAUSE_RE = re.compile(
        r'(?:under|below|less\s+than|above|over|more\s+than|at\s+(?:most|least)'
        r'|between|cheaper\s+than|budget|affordable|cheap|pricey|priced|costing|worth)'
        r'\s+\d+(?:\.\d+)?(?:\s+(?:and|to)\s+\d+(?:\.\d+)?)?',
        re.IGNORECASE,
    )

    # --- Leading price prefix: "under 50 food clothes" (check first) ---
    lead_match = _PRICE_CLAUSE_RE.match(part.strip())

    # --- Trailing price tail: "food clothes under 50" ---
    price_tail_re = re.compile(
        r'\s+(?:under|below|less|above|over|more|at|between|cheaper|budget'
        r'|affordable|cheap|pricey|priced|costing|worth|\d).*$',
        re.IGNORECASE,
    )
    tail_match = price_tail_re.search(part)

    price_clause = ""
    product_segment = part.strip()

    if lead_match:
        # Leading filter wins — strip the price prefix, keep products as segment
        price_clause = lead_match.group(0).strip()
        product_segment = part.strip()[lead_match.end():].strip()
    elif tail_match:
        product_segment = part[:tail_match.start()].strip()
        price_clause = part[tail_match.start():].strip()

    if not product_segment:
        return [part]

    words = product_segment.split()
    products = []
    i = 0
    while i < len(words):
        matched = None
        for span in range(len(words) - i, 0, -1):
            candidate = " ".join(words[i:i + span]).lower()
            if candidate in _INTENT_CATEGORIES_LOWER:
                matched = " ".join(words[i:i + span])
                i += span
                break
        if matched:
            products.append(matched)
        else:
            # Unrecognised word — abort, return original part unchanged
            return [part]

    if len(products) < 2:
        return [part]

    # Re-attach the price clause to each product
    if price_clause:
        if tail_match:
            return [f"{p} {price_clause}" for p in products]
        else:
            # Leading prefix: rewrite as trailing so each sub-part is parseable
            return [f"{p} {price_clause}" for p in products]
    return products


def split_sentences(query: str) -> list[str]:
    """
    Split a multi-sentence or compound query into individual sub-queries.
    1. Splits on . ? ! followed by whitespace (standard sentence splitting).
    2. Splits on commas that act as product separators.
    3. Then splits each sentence on conjunctions ('and', 'at saka').
    4. Then splits space-separated product lists with no conjunctions.
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
    conj_parts = []
    for part in comma_parts:
        conj_parts.extend(split_compound_query(part))

    # Space-separated product list splitting (no conjunctions/commas needed).
    # First try the contextual normaliser — if a part is a known NLP intent
    # phrase (e.g. "toys for kids" → "birthday items"), keep it intact instead
    # of greedily splitting "toys" and "for kids" as separate products.
    all_parts = []
    for part in conj_parts:
        normalised = _normalise_seasonal_clothing(part)
        if normalised != part:
            all_parts.append(normalised)
        else:
            all_parts.extend(_split_space_separated_products(part))

    return all_parts if all_parts else [query.strip()]


def _merge_rewritten_queries(
    sub_queries: list[RewrittenQuery],
    original_query: str,
) -> RewrittenQuery:
    """Merge multiple per-sentence RewrittenQuery results into one.

    A sub-query may already carry multiple search_groups (when the NER found
    2+ product slots inside a single sentence).  We always flatten all groups
    from all sub-queries before deciding whether the result is compound.
    """
    # ── Flatten every sub-query's search_groups ──────────────────────────────
    # A sub-query with search_groups already set (multi-product rewrite path)
    # contributes those groups directly; otherwise it contributes one group
    # from its own search_text + filters.
    def _groups_for(rq: RewrittenQuery) -> list[SearchGroup]:
        if rq.search_groups:
            return rq.search_groups
        return [SearchGroup(search_text=rq.search_text, filters=rq.filters)]

    all_groups: list[SearchGroup] = []
    for rq in sub_queries:
        all_groups.extend(_groups_for(rq))

    # Deduplicate groups with the exact same search_text+filters
    seen_groups: dict[str, SearchGroup] = {}
    for g in all_groups:
        key = f"{g.search_text}|{sorted(g.filters.items())}"
        if key not in seen_groups:
            seen_groups[key] = g
    all_groups = list(seen_groups.values())

    from models.intent_mappings import match_intent_category
    seen_intent_keys: set[str] = set()
    deduped: list[SearchGroup] = []
    for g in all_groups:
        titles = match_intent_category(g.search_text)
        if titles is not None:
            intent_key = "|".join(sorted(titles)) + "|" + str(sorted(g.filters.items()))
            if intent_key in seen_intent_keys:
                continue
            seen_intent_keys.add(intent_key)
        deduped.append(g)
    all_groups = deduped

    # ── Propagate a trailing shared price to all groups ──────────────────────
    #
    # A "trailing shared price" is when the user wrote one price clause at the
    # end and meant it to apply to every product, e.g.:
    #   "toys and snacks below 100"       → both under 100
    #   "food and toys between 20 and 100" → both in range
    #   "summer dress and snacks under 300" → both under 300
    #
    # We propagate when ALL of these hold:
    #   1. Exactly ONE group carries a price (the last split part got it).
    #   2. ALL other groups have NO price at all.
    #   3. The groups with prices came from a single shared price value
    #      (not two different prices like "toys under 200 and snacks under 50").
    #
    # We do NOT propagate when multiple groups already have distinct prices —
    # that means each product was explicitly scoped (already working correctly
    # because each sub-query carries its own filter after split_compound_query).

    priced_groups   = [g for g in all_groups if "price_max" in g.filters or "price_min" in g.filters]
    unpriced_groups = [g for g in all_groups if "price_max" not in g.filters and "price_min" not in g.filters]

    # Only propagate when exactly one group has a price and there are unpriced groups
    if len(priced_groups) == 1 and unpriced_groups:
        src = priced_groups[0]
        shared_max = src.filters.get("price_max")
        shared_min = src.filters.get("price_min")

        if shared_max is not None and shared_min is None:
            # Single-bound max (e.g. "under 300")
            for g in unpriced_groups:
                g.filters["price_max"] = shared_max
            print(f"[QueryRewriter] Trailing shared price_max={shared_max} propagated to {len(unpriced_groups)} group(s)")

        elif shared_min is not None and shared_max is None:
            # Single-bound min (e.g. "more than 100")
            for g in unpriced_groups:
                g.filters["price_min"] = shared_min
            print(f"[QueryRewriter] Trailing shared price_min={shared_min} propagated to {len(unpriced_groups)} group(s)")

        elif shared_min is not None and shared_max is not None:
            # Between-range (e.g. "between 50 and 200")
            for g in unpriced_groups:
                g.filters["price_min"] = shared_min
                g.filters["price_max"] = shared_max
            print(f"[QueryRewriter] Trailing shared between-range ({shared_min},{shared_max}) propagated to {len(unpriced_groups)} group(s)")

    # Union of all intents (deduplicated, preserving order)
    merged_intents = list(dict.fromkeys(
        intent for rq in sub_queries for intent in rq.intents
    ))

    # ── SINGLE effective group ────────────────────────────────────────────────
    if len(all_groups) == 1:
        rq = sub_queries[0]
        rq.search_groups = all_groups
        rq.original_query = original_query
        return rq

    # ── MULTIPLE effective groups — compound / multi-product query ────────────
    merged_slots: dict = {}
    product_idx = 1
    for rq in sub_queries:
        for key, value in rq.slots.items():
            base = key.rstrip("0123456789")
            if base == "PRODUCT":
                slot_key = f"PRODUCT{product_idx}"
                if slot_key not in merged_slots:
                    merged_slots[slot_key] = value
                    product_idx += 1
            elif key not in merged_slots:
                merged_slots[key] = value

    # Multiple distinct search groups always means a multi-search
    if "multi_search" not in merged_intents:
        merged_intents.insert(0, "multi_search")
    merged_intents = [i for i in merged_intents if i != "single_search"]

    search_text = " | ".join(g.search_text for g in all_groups)
    return RewrittenQuery(
        search_text=search_text,
        filters={},
        original_query=original_query,
        intents=merged_intents,
        slots=merged_slots,
        is_rewritten=True,
        search_groups=all_groups,
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

    # Free-form intent with no product slots: pass through as-is
    # (e.g., "pano magluto ng adobo" — not a product search)
    if "free_form" in intents and len(intents) == 1 and not slots:
        return result

    # NOTE: we no longer early-return when intents/slots are both empty.
    # Always apply modifier-word stripping so noisy fragments like
    # "i want food" are cleaned to "food" before BERT embedding.

    # --- Between-range detection (highest priority, no training needed) ---
    between_range = extract_between_range(query)
    if between_range is not None:
        price_min_val, price_max_val = between_range
        slots["PRICE_MIN"] = str(price_min_val)
        slots["PRICE_MAX"] = str(price_max_val)
        print(f"[QueryRewriter] Between-range: PRICE_MIN={price_min_val}, PRICE_MAX={price_max_val} (from '{query}')")

    # --- Dual-direction detection: "less than X more than Y" / "under X above Y" ---
    # Handles queries that state both bounds in plain English without "between".
    # Runs before the single-direction fallback so it takes priority.
    if "PRICE_MIN" not in slots and "PRICE_MAX" not in slots:
        _MAX_PAT = r'(?:less\s+than|under|below|at\s+most|cheaper\s+than)'
        _MIN_PAT = r'(?:more\s+than|above|over|at\s+least|higher\s+than)'
        _NUM     = r'(\d+(?:\.\d+)?)'
        # max … min  e.g. "less than 25 more than 20"
        m = re.search(rf'{_MAX_PAT}\s+{_NUM}[^0-9]*{_MIN_PAT}\s+{_NUM}', query, re.IGNORECASE)
        if m:
            slots["PRICE_MAX"] = m.group(1)
            slots["PRICE_MIN"] = m.group(2)
            print(f"[QueryRewriter] Dual-direction (max,min): PRICE_MAX={m.group(1)}, PRICE_MIN={m.group(2)} (from '{query}')")
        else:
            # min … max  e.g. "more than 20 less than 25"
            m = re.search(rf'{_MIN_PAT}\s+{_NUM}[^0-9]*{_MAX_PAT}\s+{_NUM}', query, re.IGNORECASE)
            if m:
                slots["PRICE_MIN"] = m.group(1)
                slots["PRICE_MAX"] = m.group(2)
                print(f"[QueryRewriter] Dual-direction (min,max): PRICE_MIN={m.group(1)}, PRICE_MAX={m.group(2)} (from '{query}')")

    # --- Correct price slot direction ---
    # The NER model may tag the price value as PRICE_MAX when the user
    # actually means "more than X" (a minimum), or vice versa.
    # Use modifier words in the raw query to fix this.
    direction = _detect_price_direction(query)

    has_min = "PRICE_MIN" in slots
    has_max = "PRICE_MAX" in slots

    # Skip direction correction when both slots already set (between-range or dual-direction)
    if not (has_min and has_max):
        if direction == "min" and has_max and not has_min:
            # NER said PRICE_MAX but user said "more than" → swap to PRICE_MIN
            slots["PRICE_MIN"] = slots.pop("PRICE_MAX")
        elif direction == "max" and has_min and not has_max:
            # NER said PRICE_MIN but user said "under" → swap to PRICE_MAX
            slots["PRICE_MAX"] = slots.pop("PRICE_MIN")

    # --- Regex fallback: extract price if NER missed it ---
    # Covers patterns like "less than 30", "under 500", "more than 100", etc.
    # Skip when both slots already populated.
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
    # Collect all detected product slots (PRODUCT1, PRODUCT2, PRODUCT3, …)
    product_slots = [
        slots[k].strip()
        for k in sorted(slots.keys())
        if k.startswith("PRODUCT") and slots[k].strip()
    ]

    # ── MULTI-PRODUCT in a single sub-sentence ──────────────────────────────
    # If the NER detected 2+ distinct product slots within the same sentence
    # (e.g. "i want food and toys less than 20" arriving unsplit), build a
    # multi-group RewrittenQuery so each product gets its own search pipeline.
    # Shared filters (price, brand, color) are applied to every group.
    if len(product_slots) >= 2:
        search_groups = [
            SearchGroup(search_text=p, filters=dict(filters))  # copy filters to each group
            for p in product_slots
        ]
        intents_out = list(intents) or ["single_search"]
        if "multi_search" not in intents_out:
            intents_out.insert(0, "multi_search")
        intents_out = [i for i in intents_out if i != "single_search"]
        if filters and "filtered_search" not in intents_out:
            intents_out.append("filtered_search")
        print(f"[QueryRewriter] Multi-product in single sentence: {product_slots} | filters={filters}")
        return RewrittenQuery(
            search_text=" | ".join(product_slots),
            filters=filters,
            original_query=query.strip(),
            intents=intents_out,
            slots=slots,
            is_rewritten=True,
            search_groups=search_groups,
        )

    # ── SINGLE PRODUCT (or filtered multi-product) ──────────────────────────
    search_parts = list(product_slots)  # already stripped

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
        # No product slots found — clean the original query.
        # Always strip modifier words (even when no intents/slots were found)
        # so fragments like "i want food" become "food" for BERT embedding.
        words = query.strip().split()
        cleaned = [
            w for w in words
            if w.lower() not in MODIFIER_WORDS
            and not re.match(r"^\d+(?:\.\d+)?$", w)
        ]
        search_text = " ".join(cleaned) if cleaned else query.strip()

    # --- Rule-based intent fallback ---
    # If the BERT intent classifier returned nothing (model not loaded, low
    # confidence, or unseen pattern like "less than X more than Y"), infer
    # intents from what the rewriter itself extracted so the frontend always
    # receives at least one intent.
    intents_out = list(intents)
    if not intents_out:
        if filters:
            # Has price/brand/color filters → filtered_search + single_search
            intents_out = ["filtered_search", "single_search"]
            print(f"[QueryRewriter] Intent fallback: filtered_search+single_search (filters={list(filters.keys())})")
        else:
            # Plain product lookup with no filters → single_search
            intents_out = ["single_search"]
            print(f"[QueryRewriter] Intent fallback: single_search (no filters)")

    result.search_text = search_text
    result.filters = filters
    result.intents = intents_out
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
        query = _apply_filipino_map(query)
        sentences = split_sentences(query)

        if len(sentences) == 1:
            # Single sentence: no splitting overhead
            result = self._process_single(sentences[0])
            result.original_query = query.strip()
            # Preserve multi-product groups built by rewrite(); only fall back
            # to a single group when rewrite() didn't produce any groups.
            if not result.search_groups:
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
        # Step 0: Seasonal/contextual normalisation before ML models run.
        # Converts "a dress for this summer" → "summer clothes
        # category lookup can match it deterministically.
        normalised = _normalise_seasonal_clothing(sentence)
        was_normalised = normalised != sentence

        # Step 1: Classify intents
        intent_result = {"intents": [], "probabilities": {}}
        if self._intent_service and self._intent_service._loaded:
            intent_result = self._intent_service.predict(normalised)

        # Step 2: Extract slots
        slot_result = {"slots": {}, "tagged_tokens": []}
        if self._slot_service and self._slot_service._loaded:
            slot_result = self._slot_service.extract(normalised)

        # Strip PRODUCT slots when the sentence resolves to a known intent
        # category.  The NER often tags only a fragment (e.g. PRODUCT1="items"
        # from "birthday items", PRODUCT1="dress" from "summer dress under 500"),
        # which would override the full canonical category name as search_text.
        #
        # Three cases all require the strip:
        #   1. was_normalised — _normalise_seasonal_clothing rewrote the sentence
        #   2. normalised itself is a known category — arrived pre-normalised
        #      from split_sentences (e.g. "birthday items", "halal food")
        #   3. normalised-minus-price-clause is a known category — e.g.
        #      "summer dress between 100 and 800" → strip price → "summer dress"
        from models.intent_mappings import match_intent_category
        price_stripped = _PRICE_CLAUSE_RE.sub("", normalised).strip()
        sentence_is_known_category = (
            match_intent_category(normalised) is not None
            or match_intent_category(price_stripped) is not None
        )
        if was_normalised or sentence_is_known_category:
            slot_result["slots"] = {
                k: v for k, v in slot_result["slots"].items()
                if not k.startswith("PRODUCT")
            }

        # Step 3: Rewrite
        return rewrite(
            query=normalised,
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
