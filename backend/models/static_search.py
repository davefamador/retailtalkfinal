"""
Static Search — hardcoded category-to-product mappings for specific query types.

Provides deterministic results for cultural/dietary food categories
that require domain-specific knowledge beyond ML model capabilities.

Supports:
- Direct category matching (e.g., "halal food" → specific products)
- Exclusion-based categories (e.g., "summer food" → food minus sardines/luncheon/snacks)
- Price filtering (e.g., "snacks less than 20")
- Compound searching (e.g., "snacks and halal food")
"""


# =============================================================================
#  Static Category Mappings
# =============================================================================

# Category keyword (lowercased) -> list of exact product titles in the database
STATIC_CATEGORIES = {
    # Halal / Muslim food
    "halal food":   ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab"],
    "muslim food":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab"],
    "halal":        ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab"],

    # Lenten season food
    "lenten season food": ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    "lenten food":        ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    "lenten":             ["Escabeche", "Biko", "Puto Maya", "Binignit"],

    # Snacks
    "snacks": ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang", "Oishi Prawn Crackers"],
    "snack":  ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang", "Oishi Prawn Crackers"],
}

# Summer food = all food products EXCLUDING sardines, luncheon meat, and snacks
SUMMER_FOOD_TITLES = [
    "Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
    "Gardenia Classic White Bread", "Kebab", "Lucky Me! Instant Mami Seafood",
    "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum",
]

SUMMER_KEYWORDS = {"summer food", "summer foods"}


# =============================================================================
#  Matching Logic
# =============================================================================

def match_static_category(search_text: str) -> list[str] | None:
    """
    Check if a search text matches a static product category.

    Args:
        search_text: The cleaned/rewritten search text (lowercased matching).

    Returns:
        List of product titles if matched, None if no static match found.
    """
    normalized = search_text.lower().strip()

    # Check direct category matches
    if normalized in STATIC_CATEGORIES:
        return list(STATIC_CATEGORIES[normalized])

    # Check summer food keywords
    if normalized in SUMMER_KEYWORDS:
        return list(SUMMER_FOOD_TITLES)

    return None
