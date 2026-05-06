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

# All keys are lowercased for lookup. Values must match exact product titles in the DB.
STATIC_CATEGORIES = {
    # ── Individual products ───────────────────────────────────────────────────
    "beef rendang":             ["Beef Rendang"],
    "beef":                     ["Beef Rendang"],
    "tiyula itum":              ["Tiyula Itum"],
    "pastil":                   ["Pastil"],
    "kebab":                    ["Kebab"],
    "shawarma":                 ["Shawarma"],
    "satay":                    ["Satay"],
    "escabeche":                ["Escabeche"],
    "biko":                     ["Biko"],
    "puto maya":                ["Puto Maya"],
    "puto":                     ["Puto Maya"],
    "binignit":                 ["Binignit"],
    "buko juice":               ["Buko Juice"],
    "pate":                     ["Pate"],
    "sardines":                 ["Sardines"],
    "sardine":                  ["Sardines"],
    "luncheon meat":            ["Luncheon Meat"],
    "luncheon":                 ["Luncheon Meat"],
    "corned beef":              ["Corned Beef"],
    "corned":                   ["Corned Beef"],
    "meat loaf":                ["Meat Loaf"],
    "meatloaf":                 ["Meat Loaf"],
    "fudgee barr":              ["Fudgee Barr"],
    "marty's cracklin":         ["Marty's Cracklin"],
    "martys cracklin":          ["Marty's Cracklin"],
    "nagaraya":                 ["Nagaraya"],
    "boy bawang":               ["Boy Bawang"],
    "oishi prawn crackers":     ["Oishi Prawn Crackers"],
    "oishi":                    ["Oishi Prawn Crackers"],
    "skyflakes":                ["Skyflakes"],
    "bread":                    ["Gardenia Classic White Bread"],
    "white bread":              ["Gardenia Classic White Bread"],
    "gardenia":                 ["Gardenia Classic White Bread"],
    "notebook":                 ["notebook"],
    "pen":                      ["pen"],
    "pencil":                   ["pencil"],
    "eraser":                   ["eraser"],
    "ruler":                    ["ruler"],
    "lego":                     ["Lego"],
    "m&ms":                     ["M&Ms"],
    "mentos":                   ["Mentos"],
    "twizzlers":                ["Twizzlers"],
    "ferrero":                  ["Ferrero"],
    "ferrero rocher":           ["Ferrero"],
    "raincoat":                 ["Raincoat"],
    "rain boots":               ["Rain Boots"],
    "waterproof jacket":        ["Waterproof Jacket"],
    "shorts":                   ["shorts"],
    "flip flops":               ["flip flops"],
    "shirt":                    ["shirt"],
    "sleeveless tops":          ["casual sleeveless tops"],
    "sleeveless":               ["casual sleeveless tops"],
    "casual sleeveless tops":   ["casual sleeveless tops"],
    "sarouel pants":            ["Sarouel Pants"],
    "jacket":                   ["Jacket"],
    "keffiyeh":                 ["Keffiyeh"],
    "long sleeve":              ["Long Sleeve"],
    "summer hat":               ["Summer Hat"],
    "hat":                      ["Hat"],
    "Garlic Luncheon Meat":["Garlic Luncheon Meat"],
    "garlic":["Garlic Luncheon Meat"],
    "luncheon meat garlic":["Garlic Luncheon Meat"],
    "luncheon meat garlic flavor":["Garlic Luncheon Meat"],
    "meat garlic":["Garlic Luncheon Meat"],
    "meat garlic flavor":["Garlic Luncheon Meat","luncheon meat"],
    "meat luncheon":["Garlic Luncheon Meat"],
    
    "Purefoods":["Purefoods", "Purefoods Corned Beef", "Purefoods Luncheon Meat"],


    # ── Food groups ───────────────────────────────────────────────────────────
    "kakanin":      ["Biko", "Puto Maya", "Binignit"],
    "rice food":    ["Biko", "Puto Maya", "Binignit"],
    "rice":         ["Biko", "Puto Maya"],

    "meat":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate", "Luncheon Meat", "Meat Loaf"],
    "meats": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate", "Luncheon Meat", "Meat Loaf"],

    "canned goods":    ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef"],
    "canned good":     ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef"],
    "canned products": ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef"],
    "canned product":  ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef"],
    "canned food":     ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef"],
    "canned":          ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef"],

    "food":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche", "Biko",
              "Puto Maya", "Binignit", "Buko Juice", "Shawarma", "Satay", "Pate",
              "Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf"],
    "foods": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche", "Biko",
              "Puto Maya", "Binignit", "Buko Juice", "Shawarma", "Satay", "Pate",
              "Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf"],

    # Halal / Muslim food
    "halal food":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate"],
    "muslim food": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate"],
    "halal":       ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate"],

    # Seasonal food (all seasonal products)
    "seasonal food": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche",
                      "Biko", "Puto Maya", "Binignit", "Buko Juice", "Shawarma", "Satay", "Pate"],
    "season food":   ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche",
                      "Biko", "Puto Maya", "Binignit", "Buko Juice", "Shawarma", "Satay", "Pate"],
    #Birthday items
    "birthday items": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","Cake","Candles","candle","Gift Box","gift box","pink dress","pink flower","hot wheels","hotwheels"],
    "Birthday": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","Cake","Candles","candle","Gift Box","gift box","pink dress","pink flower","hot wheels","hotwheels"],
    "birthdays": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","Cake","Candles","candle","Gift Box","gift box","pink dress","pink flower","hot wheels","hotwheels"],
    "Birthday items for girls": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","pink dress","pink flower","Gift Box","gift box"],
    "Birthday items for boys": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","blue shirt","Gift Box","gift box"],
    "Birthday items for kids": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","pink dress","blue shirt","pink flower","Gift Box","gift box"],
    "Birthday items for adults": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Playing Cards", "balloons","Gift Box","gift box"],
    # Lenten season food
    "lenten season food": ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    "lenten food":        ["Escabeche", "Biko", "Puto Maya", "Binignit"],
    "lenten":             ["Escabeche", "Biko", "Puto Maya", "Binignit"],

    # Snacks
    "snacks": ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang", "Oishi Prawn Crackers", "Skyflakes"],
    "snack":  ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang", "Oishi Prawn Crackers", "Skyflakes"],
    "candy":      ["M&Ms", "Mentos", "Twizzlers", "sprinkles candy", "Ferrero"],
    "candies":    ["M&Ms", "Mentos", "Twizzlers", "sprinkles candy", "Ferrero"],
    "chocolates": ["M&Ms", "Ferrero"],
    "chocolate":  ["M&Ms", "Ferrero"],
    "sweets":     ["M&Ms", "Mentos", "Twizzlers", "sprinkles candy", "Ferrero"],
    # Drinks
    "drinks": ["Buko Juice"],
    "drink":  ["Buko Juice"],

    # ── School Supplies ───────────────────────────────────────────────────────
    "school supplies": ["notebook", "pen", "pencil", "eraser", "ruler"],
    "school":          ["notebook", "pen", "pencil", "eraser", "ruler"],
    
    # ── Toys ─────────────────────────────────────────────────────────────────
    "toys":     ["Lego","little","UNO","HotWheels","Playing Cards","balloons","stuffed toys"],
    "toy":      ["Lego","little","UNO","HotWheels","Playing Cards","balloons","stuffed toys"],
    "for kids": ["Lego","little","UNO","HotWheels","Playing Cards","balloons","stuffed toys"],
    "balloon": ["balloon"],
    "balloons": ["balloon"],
    "party needs": ["balloon", "party hats", "party poppers", "party decorations"],
    "party supplies": ["balloon", "party hats", "party poppers", "party decorations"],

    # ── Clothing — all ───────────────────────────────────────────────────────
    "clothes":   ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                  "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                  "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "clothing":  ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                  "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                  "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "clothings": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                  "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                  "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],

    # Seasonal clothes (all seasons)
    "season clothes":       ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                             "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                             "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "seasonal clothes":     ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                             "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                             "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "weather clothes":      ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                             "shirt", "casual sleeveless tops", "Sarouel Pants"],
    "clothes for the season": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                               "shirt", "casual sleeveless tops", "Sarouel Pants"],

    # Wet / rainy season clothes
    "wet season clothes":   ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "wet clothes":          ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "wet season":           ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "rainy season clothes": ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "rainy clothes":        ["Raincoat", "Rain Boots", "Waterproof Jacket"],
    "rainy season":         ["Raincoat", "Rain Boots", "Waterproof Jacket"],

    # Dry / hot season clothes
    "dry season clothes": ["shorts", "flip flops", "shirt"],
    "dry clothes":        ["shorts", "flip flops", "shirt"],
    "dry season":         ["shorts", "flip flops", "shirt"],
    "hot season clothes": ["shorts", "flip flops", "shirt"],
    "hot season":         ["shorts", "flip flops", "shirt"],

    # Summer clothes
    "summer clothes": ["shorts", "flip flops", "shirt", "Sarouel Pants",
                       "Jacket", "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "summer":         ["shorts", "flip flops", "shirt", "Sarouel Pants",
                       "Jacket", "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
}

# Titles that appear in the "food" category but are canned goods — shown as Complement
FOOD_COMPLEMENT_TITLES: set[str] = {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf","Juice"}

# Titles that appear in the "meat/meats" category but are canned — shown as Complement
MEAT_COMPLEMENT_TITLES: set[str] = {"Luncheon Meat", "Meat Loaf",""}

# =============================================================================
#  Per-category ESCI overrides
#  Keys match the lowercased query strings from STATIC_CATEGORIES.
#  Each value has optional "complement" and "substitute" keyword sets.
#  Any title that contains a complement keyword → Complement label.
#  Any title that contains a substitute keyword → Substitute label.
#  Remaining titles → Exact (the default).
# =============================================================================
STATIC_ESCI: dict[str, dict] = {

    # ── Candy / Sweets ────────────────────────────────────────────────────────
    # Ferrero Rocher is a gift chocolate box — Substitute for plain candy.
    # M&Ms, Mentos, Twizzlers, SOFT candy are direct candy → Exact.
    "candy":      {"substitute": {"Ferrero"}},
    "candies":    {"substitute": {"Ferrero"}},
    "sweets":     {"substitute": {"Ferrero"}},
    # Chocolates query: M&Ms is Exact, Ferrero Rocher is also Exact (it IS chocolate).
    # Mentos / Twizzlers are candy but not really chocolate → Substitute.
    "chocolates": {"substitute": {"Mentos", "Twizzlers", "sprinkles"}},
    "chocolate":  {"substitute": {"Mentos", "Twizzlers", "sprinkles"}},

    # ── Snacks ────────────────────────────────────────────────────────────────
    # All snack items are Exact for "snacks". Candy/sweets are Complement.
    "snacks": {"complement": {"M&Ms", "Mentos", "Twizzlers", "Ferrero"}},
    "snack":  {"complement": {"M&Ms", "Mentos", "Twizzlers", "Ferrero"}},

    # ── Birthday ──────────────────────────────────────────────────────────────
    # Balloons, banner, party pop = Exact birthday items.
    # Toys (LEGO, UNO, Hot Wheels) = Complement (nice gift, not a birthday decoration).
    # Ferrero = Complement (gift food, not a birthday decoration).
    # Slap Bracelets = Substitute (party favour alternative).
    "birthday items":           {"complement": {"LEGO", "Hot Wheels", "UNO", "Ferrero"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday":                 {"complement": {"LEGO", "Hot Wheels", "UNO", "Ferrero"},
                                  "substitute": {"Slap Bracelets"}},
    "birthdays":                {"complement": {"LEGO", "Hot Wheels", "UNO", "Ferrero"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday items for girls": {"complement": {"Ferrero"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday items for boys":  {"complement": {"LEGO", "Hot Wheels", "UNO"}},
    "birthday items for kids":  {"complement": {"LEGO", "Hot Wheels", "UNO"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday items for adults": {"complement": {"Ferrero"}},

    # ── Toys ─────────────────────────────────────────────────────────────────
    # LEGO, UNO, Hot Wheels = Exact toys.
    # Balloons = Complement (party/play, not a toy per se).
    "toys":     {"complement": {"balloon", "Balloons"}},
    "toy":      {"complement": {"balloon", "Balloons"}},
    "for kids": {"complement": {"balloon", "Balloons"}},

    # ── Party supplies ────────────────────────────────────────────────────────
    # Balloons, banner, party pop = Exact.
    # Toys are Complement at a party (gift, not a supply).
    "party needs":    {"complement": {"LEGO", "Hot Wheels", "UNO", "Ferrero"}},
    "party supplies": {"complement": {"LEGO", "Hot Wheels", "UNO", "Ferrero"}},

    # ── School supplies ───────────────────────────────────────────────────────
    # All items are Exact for "school" / "school supplies".
    # No complements or substitutes needed.

    # ── Halal / Muslim food ───────────────────────────────────────────────────
    # All items are Exact (they are halal by definition in the category).

    # ── Canned goods ─────────────────────────────────────────────────────────
    # All items are Exact for "canned goods".

    # ── Lenten food ───────────────────────────────────────────────────────────
    # All items are Exact.

    # ── Seasonal food ────────────────────────────────────────────────────────
    # Canned goods appear as Complement in seasonal food (convenient, not seasonal cuisine).
    "seasonal food": {"complement": {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf"}},
    "season food":   {"complement": {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf"}},

    # ── Clothes ──────────────────────────────────────────────────────────────
    # Hats/accessories = Complement for generic "clothes" searches.
    "clothes":   {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "clothing":  {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "clothings": {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},

    # Rainy season: Raincoat/Rain Boots/Waterproof Jacket = Exact.
    # No complements needed (list is already precise).

    # Summer clothes: shorts/flip flops/shirt = Exact. Hat = Complement (accessory).
    "summer clothes": {"complement": {"Summer Hat", "Hat"}},
    "summer":         {"complement": {"Summer Hat", "Hat"}},
}

# Summer food = seasonal food EXCLUDING sardines, luncheon meat, canned goods, and snacks
SUMMER_FOOD_TITLES = [
    "Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
    "Gardenia Classic White Bread", "Kebab", "Satay",
    "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum",
]

# All phrases that should return SUMMER_FOOD_TITLES
SUMMER_FOOD_KEYWORDS = {
    "summer food",
    "summer foods",
    "hot season food",
    "hot season foods",
    "summer season food",
    "summer season foods",
}


# =============================================================================
#  Matching Logic
# =============================================================================

# Keys are already lowercase, so no normalisation needed beyond strip().
_STATIC_CATEGORIES_LOWER = {k.lower(): v for k, v in STATIC_CATEGORIES.items()}


def match_static_category(search_text: str) -> list[str] | None:
    """
    Check if a search text matches a static product category.

    Returns:
        List of product title keywords if matched, None if no static match found.
    """
    normalized = search_text.lower().strip()

    if normalized in SUMMER_FOOD_KEYWORDS:
        return list(SUMMER_FOOD_TITLES)

    if normalized in _STATIC_CATEGORIES_LOWER:
        return list(_STATIC_CATEGORIES_LOWER[normalized])

    return None


def get_static_esci(search_text: str) -> tuple[set[str], set[str]]:
    """
    Return (complement_keywords, substitute_keywords) for a static category query.
    A product title is checked via case-insensitive substring match against each keyword.
    Returns empty sets (all Exact) if no override is defined for the category.
    """
    normalized = search_text.lower().strip()
    overrides = STATIC_ESCI.get(normalized, {})
    return overrides.get("complement", set()), overrides.get("substitute", set())
