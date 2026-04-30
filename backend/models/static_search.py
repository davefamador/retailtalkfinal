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

    "Beef":["Beef Rendang"],
    "BeefRendang":["Beef Rendang"],
    "Tiyula Itum":["Tiyula Itum"],
    "TiyulaItum":["Tiyula Itum"],
    "Pastil":["Pastil"],
    "Kebab":["Kebab"],
    "Shawarma":["Shawarma"],
    "Satay":["Satay"],
    "Escabeche":["Escabeche"],
    "Biko":["Biko"],
    "Puto Maya":["Puto Maya"],
    "Binignit":["Binignit"],
    "Buko Juice":["Buko Juice"],
    
    "canned goods": ["Sardines","Luncheon Meat", "Pate", "Meat Loaf", "Corned Beef"],
    "canned good": ["Sardines", "Luncheon Meat", "Pate", "Meat Loaf", "Corned Beef"],
    "canned products": ["Sardines", "Luncheon Meat", "Pate", "Meat Loaf", "Corned Beef"],
    "canned product": ["Sardines", "Luncheon Meat", "Pate", "Meat Loaf", "Corned Beef"],
    "canned food": ["Sardines", "Luncheon Meat", "Pate", "Meat Loaf", "Corned Beef"],
    "canned": ["Sardines", "Luncheon Meat", "Pate", "Meat Loaf", "Corned Beef"],

    "Sardines":["Sardines"],
    "Sardine":["Sardines"],

    "Fudgee Barr":["Fudgee Barr"],
    "FudgeeBarr":["Fudgee Barr"],
    "Marty's Cracklin":["Marty's Cracklin"],
    "Martys Cracklin":["Marty's Cracklin"],
    "Marty's Cracklin":["Marty's Cracklin"],
    "Fudgee Barr":["Fudgee Barr"],
    
    "Bread":["Gardenia Classic White Bread"],
    "White Bread":["Gardenia Classic White Bread"],
    
    "raincoat": ["Raincoat"],
    "Raincoat": ["Raincoat"],
    "rain boots": ["Rain Boots"],
    "Rain Boots": ["Rain Boots"],
    "waterproof jacket": ["Waterproof Jacket"],
    "Waterproof Jacket": ["Waterproof Jacket"],
    "shorts": ["shorts"],
    "Shorts": ["shorts"],
    "flip flops": ["flip flops"],
    "Flip Flops": ["flip flops"],
    "shirt": ["shirt"],
    "Shirt": ["shirt"],
    "casual sleeveless tops": ["casual sleeveless tops"],
    "Casual Sleeveless Tops": ["casual sleeveless tops"],
    "Sarouel Pants": ["Sarouel Pants"],
    "SarouelPants": ["Sarouel Pants"],
    "Jacket": ["Jacket"],
    "Keffiyeh": ["Keffiyeh"],
    "Long Sleeve": ["Long Sleeve"],
    "Summer Hat": ["Summer Hat"],
    "Hat": ["Hat"],


    # Food
    "food": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche", "Biko", "Puto Maya", "Binignit", "Buko Juice", "Shawarma","Satay"],
    "foods": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche", "Biko", "Puto Maya", "Binignit", "Buko Juice", "Shawarma","Satay"],    
    # Halal / Muslim food
    "halal food":   ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab","Satay"],
    "muslim food":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab","Satay"],
    "halal":        ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab","Satay"],
    # Seasonal Food
    "Seasonal Food":["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab","Escabeche", "Biko", "Puto Maya", "Binignit", "Buko Juice", "Shawarma","Satay"],
    "Season Food":["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab","Escabeche", "Biko", "Puto Maya", "Binignit", "Buko Juice", "Shawarma","Satay"],  
    # Lenten season food
    "lenten season food": ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    "lenten food":        ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    "lenten":             ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    # School Supplies
    "school supplies": ["notebook", "pen", "pencil", "eraser", "ruler"],
    "school supplies": ["notebook", "pen", "pencil", "eraser", "ruler"],

    # drinks
    "drinks": ["Buko Juice"],
    "drink": ["Buko Juice"],
    
    #Toys
    "toys": ["Lego"],
    "toy": ["Lego"],

    # Snacks
    "snacks": ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang", "Oishi Prawn Crackers", "Skyflakes"],
    "snack":  ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang", "Oishi Prawn Crackers", "Skyflakes"],

    # Seasonal Clothes
    "season clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops", "shirt", "casual sleeveless tops", "Sarouel Pants","Jacket","Keffiyeh","Long Sleeve","Summer Hat","Hat"],
    "seasonal clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops", "shirt", "casual sleeveless tops", "Sarouel Pants","Jacket","Keffiyeh","Long Sleeve","Summer Hat","Hat"],
    "weather clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops", "shirt", "casual sleeveless tops", "Sarouel Pants"],
    "clothes for the season": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops", "shirt", "casual sleeveless tops", "Sarouel Pants"],

    # Wet Season clothes
    "wet season clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "wet clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "wet season": ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "rainy season clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "rainy clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "rainy season": ["Raincoat", "Rain Boots", "Waterproof Jacket"],

    # Dry Season clothes
    "dry season clothes": ["shorts", "flip flops", "shirt"],
    "dry clothes": ["shorts", "flip flops", "shirt"],
    "dry season": ["shorts", "flip flops", "shirt"],
    "hot season clothes": ["shorts", "flip flops", "shirt"],
    "hot season": ["shorts", "flip flops", "shirt"],

    # Summer Clothes
    "summer clothes": ["shorts", "flip flops", "shirt", "Sarouel Pants","Jacket","Keffiyeh","Long Sleeve","Summer Hat", "Hat"],
    "summer": ["shorts", "flip flops", "shirt", "Sarouel Pants","Jacket","Keffiyeh","Long Sleeve","Summer Hat","Hat"]
}

# Summer food = all food products EXCLUDING sardines, luncheon meat, and snacks
SUMMER_FOOD_TITLES = [
    "Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
    "Gardenia Classic White Bread", "Kebab","Satay",
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
