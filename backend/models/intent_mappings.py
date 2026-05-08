

# All keys are lowercased for lookup. Values must match exact product titles in the DB.
INTENT_CATEGORIES = {
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
    "hotwheels":                ["HotWheels"],
    "hot wheels":               ["HotWheels"],
    "hot wheel":                ["HotWheels"],
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

    # Canned goods: Exact=canned meats/fish; Complement=Gardenia bread (go-together with canned goods); Substitute=Buko Juice (drink, not canned meal)
    "canned goods":    ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef",
                        "Gardenia Classic White Bread", "Buko Juice"],
    "canned good":     ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef",
                        "Gardenia Classic White Bread", "Buko Juice"],
    "canned products": ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef",
                        "Gardenia Classic White Bread", "Buko Juice"],
    "canned product":  ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef",
                        "Gardenia Classic White Bread", "Buko Juice"],
    "canned food":     ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef",
                        "Gardenia Classic White Bread", "Buko Juice"],
    "canned":          ["Sardines", "Luncheon Meat", "Meat Loaf", "Corned Beef",
                        "Gardenia Classic White Bread", "Buko Juice"],
    "drinks": [
        "Buko Juice", "Juice", "Juice drink", "orange juice", "mixed juice", "grape juice",
        "fruit drink", "apple juice", "lemon juice", "iced tea", "iced tea in can", "iced tea bottle",
        "red tea", "softdrinks", "Softdrinks", "SOFTDRINKS", "softdrinks", "juices", "JUICES",
        "Juices", "JUICE", "JUICES", "Juices", "drink", "drinks", "coke in can", "coke in can 330ml",
        "coke regular 320ml", "coke regular 320 ml", "coke regular 330ml", "coke regular 330ml",
        "softdrinks in can", "softdrinks in can 330ml", "softdrinks regular 330ml",
        "softdrinks in can 320ml", "softdrinks regular 320ml"
    ],
    "drink": ["Buko Juice", "Juice", "Juice drink", "orange juice", "mixed juice", "grape juice",
              "fruit drink", "apple juice", "lemon juice", "iced tea", "iced tea in can", "iced tea bottle",
              "red tea", "softdrinks", "Softdrinks", "SOFTDRINKS", "softdrinks", "juices", "JUICES",
              "Juices", "JUICE", "JUICES", "Juices", "drink", "drinks", "coke in can", "coke in can 330ml",
              "coke regular 320ml", "coke regular 320 ml", "coke regular 330ml", "coke regular 330ml",
              "softdrinks in can", "softdrinks in can 330ml", "softdrinks regular 330ml",
              "softdrinks in can 320ml", "softdrinks regular 320ml"],
    # food: Exact=main dishes; Substitute=bread; Complement=canned goods+snacks; Irrelevant=Raincoat+Buko Juice (drink/clothing, not food)
    "food":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche", "Biko",
              "Puto Maya", "Binignit", "Shawarma", "Satay", "Pate",
              "Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf",
              "Gardenia Classic White Bread", "Fudgee Barr", "Skyflakes",
              "Raincoat", "Buko Juice"],
    "foods": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche", "Biko",
              "Puto Maya", "Binignit", "Shawarma", "Satay", "Pate",
              "Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf",
              "Gardenia Classic White Bread", "Fudgee Barr", "Skyflakes",
              "Raincoat", "Buko Juice"],

    # Halal / Muslim food: Exact=certified halal dishes; Substitute=Escabeche; Irrelevant=Buko Juice (drink, not food)
    "halal food":  ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate",
                    "Escabeche", "Buko Juice"],
    "muslim food": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate",
                    "Escabeche", "Buko Juice"],
    "halal":       ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Satay", "Pate",
                    "Escabeche", "Buko Juice"],

    # Seasonal food: Exact=traditional seasonal dishes; Substitute=Gardenia; Complement=canned; Irrelevant=Buko Juice (drink)
    "seasonal food": ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche",
                      "Biko", "Puto Maya", "Binignit", "Shawarma", "Satay", "Pate",
                      "Sardines", "Luncheon Meat", "Corned Beef", "Gardenia Classic White Bread",
                      "Buko Juice"],
    "season food":   ["Beef Rendang", "Tiyula Itum", "Pastil", "Kebab", "Escabeche",
                      "Biko", "Puto Maya", "Binignit", "Shawarma", "Satay", "Pate",
                      "Sardines", "Luncheon Meat", "Corned Beef", "Gardenia Classic White Bread",
                      "Buko Juice"],
    #Birthday items
    "birthday items": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","Cake","Candles","candle","Gift Box","gift box","pink dress","pink flower"],
    "Birthday": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","Cake","Candles","candle","Gift Box","gift box","pink dress","pink flower"],
    "birthdays": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","Cake","Candles","candle","Gift Box","gift box","pink dress","pink flower"],
    "Birthday items for girls": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","pink dress","pink flower","Gift Box","gift box"],
    "Birthday items for boys": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","blue shirt","Gift Box","gift box"],
    "Birthday items for kids": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","pink dress","blue shirt","pink flower","Gift Box","gift box"],
    "Birthday items for adults": ["balloon", "party hats", "party poppers", "party decorations", "Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards", "balloons","Gift Box","gift box"],
    # Birthday toys — toy-specific gifts for a birthday; Exact=playable toys; Complement=balloon (decoration, not a toy)
    "birthday toys": ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                      "stuffed toys", "balloon"],
    "birthday toy":  ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                      "stuffed toys", "balloon"],
    # Boys birthday toys — action/vehicle toys; Exact=Lego/HotWheels; Substitute=UNO/Playing Cards (gender-neutral); Complement=stuffed toys/balloon
    "boys birthday toys":     ["Lego", "HotWheels", "Hot Wheels", "UNO", "Playing Cards",
                                "little", "stuffed toys", "balloon"],
    "boy birthday toys":      ["Lego", "HotWheels", "Hot Wheels", "UNO", "Playing Cards",
                                "little", "stuffed toys", "balloon"],
    "birthday toys for boys": ["Lego", "HotWheels", "Hot Wheels", "UNO", "Playing Cards",
                                "little", "stuffed toys", "balloon"],
    # Girls birthday toys — plush/doll toys; Exact=stuffed toys/little; Substitute=UNO/Playing Cards; Complement=Lego/HotWheels/balloon
    "girls birthday toys":     ["stuffed toys", "little", "UNO", "Playing Cards",
                                 "Lego", "HotWheels", "Hot Wheels", "balloon"],
    "girl birthday toys":      ["stuffed toys", "little", "UNO", "Playing Cards",
                                 "Lego", "HotWheels", "Hot Wheels", "balloon"],
    "birthday toys for girls": ["stuffed toys", "little", "UNO", "Playing Cards",
                                 "Lego", "HotWheels", "Hot Wheels", "balloon"],
    # Kids food — child-friendly, easy-to-eat, sweet/fun foods kids enjoy
    "kids food":      ["Buko Juice", "Biko", "Puto Maya", "Fudgee Barr", "M&Ms",
                       "Mentos", "Skyflakes", "Gardenia Classic White Bread",
                       "Corned Beef", "Sardines", "Luncheon Meat"],
    "kids foods":     ["Buko Juice", "Biko", "Puto Maya", "Fudgee Barr", "M&Ms",
                       "Mentos", "Skyflakes", "Gardenia Classic White Bread",
                       "Corned Beef", "Sardines", "Luncheon Meat"],
    "food for kids":  ["Buko Juice", "Biko", "Puto Maya", "Fudgee Barr", "M&Ms",
                       "Mentos", "Skyflakes", "Gardenia Classic White Bread",
                       "Corned Beef", "Sardines", "Luncheon Meat"],
    "children food":  ["Buko Juice", "Biko", "Puto Maya", "Fudgee Barr", "M&Ms",
                       "Mentos", "Skyflakes", "Gardenia Classic White Bread",
                       "Corned Beef", "Sardines", "Luncheon Meat"],
    "children foods": ["Buko Juice", "Biko", "Puto Maya", "Fudgee Barr", "M&Ms",
                       "Mentos", "Skyflakes", "Gardenia Classic White Bread",
                       "Corned Beef", "Sardines", "Luncheon Meat"],

    # Lenten season food: Exact=traditional fasting dishes; Substitute=Sardines (common Lenten protein, canned); Complement=Skyflakes (snack often eaten during fasting)
    "lenten season food": ["Escabeche", "Biko", "Puto Maya", "Binignit",
                           "Sardines", "Skyflakes"],
    "lenten food":        ["Escabeche", "Biko", "Puto Maya", "Binignit",
                           "Sardines", "Skyflakes"],
    "lenten":             ["Escabeche", "Biko", "Puto Maya", "Binignit",
                           "Sardines", "Skyflakes"],

    # Snacks: Exact=savory Filipino snacks; Complement=candy/sweets; Irrelevant=clothing (completely unrelated)
    "snacks": ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang",
               "Oishi Prawn Crackers", "Skyflakes",
               "M&Ms", "Mentos", "Ferrero",
               "Raincoat"],
    "snack":  ["Marty's Cracklin", "Fudgee Barr", "Nagaraya", "Boy Bawang",
               "Oishi Prawn Crackers", "Skyflakes",
               "M&Ms", "Mentos", "Ferrero",
               "Raincoat"],
    # Candy/Sweets: Exact=candy items; Substitute=Ferrero; Complement=Skyflakes; Irrelevant=HotWheels (a toy, not food)
    "candy":      ["M&Ms", "Mentos", "Twizzlers", "sprinkles candy", "Ferrero",
                   "Skyflakes", "HotWheels"],
    "candies":    ["M&Ms", "Mentos", "Twizzlers", "sprinkles candy", "Ferrero",
                   "Skyflakes", "HotWheels"],
    "chocolates": ["M&Ms", "Ferrero",
                   "Mentos", "Twizzlers", "HotWheels"],
    "chocolate":  ["M&Ms", "Ferrero",
                   "Mentos", "Twizzlers", "HotWheels"],
    "sweets":     ["M&Ms", "Mentos", "Twizzlers", "sprinkles candy", "Ferrero",
                   "Skyflakes", "HotWheels"],
    # Drinks / Juice — "Juice" keyword matches any product whose title contains "juice"
    "drinks": ["Juice","drink","softdrinks","SOFTDRINKS","sodadrink","SODADRINK","softdrinks","juices","JUICES","Juices","JUICE","JUICES","Juices"],
    "drink":  ["Juice","drink","softdrinks","SOFTDRINKS","sodadrink","SODADRINK","softdrinks","juices","JUICES","Juices","JUICE","JUICES","Juices"],
    "juice":  ["Juice","drink","softdrinks","SOFTDRINKS","sodadrink","SODADRINK","softdrinks","juices","JUICES","Juices","JUICE","JUICES","Juices"],
    "juices": ["Juice","drink","softdrinks","SOFTDRINKS","sodadrink","SODADRINK","softdrinks","juices","JUICES","Juices","JUICE","JUICES","Juices"],

    # ── School Supplies ───────────────────────────────────────────────────────
    # Exact=stationery; Complement=Lego (educational toy, not a school supply); Irrelevant=Sardines (food, nothing to do with school)
    "school supplies": ["notebook", "pen", "pencil", "eraser", "ruler",
                        "Lego", "Sardines"],
    "school":          ["notebook", "pen", "pencil", "eraser", "ruler",
                        "Lego", "Sardines"],

    # ── Toys / Kids ───────────────────────────────────────────────────────────
    # Exact=playable toys; Complement=balloons+candy (fun but not toys); Irrelevant=Sardines
    "toys":     ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                 "Mini Plush", "stuffed toys", "My Little Pony", "balloon",
                 "M&Ms", "Mentos", "Ferrero", "Pony"],
    "toy":      ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                 "Mini Plush", "stuffed toys", "My Little Pony", "balloon",
                 "Pony"],
    "for kids": ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                 "Mini Plush", "stuffed toys", "My Little Pony", "balloon",
                 "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles candy",
                 "Pony"],
    "kid":      ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                 "Mini Plush", "stuffed toys", "My Little Pony", "balloon",
                 "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles candy",
                 "Pony"],
    "kids":     ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                 "Mini Plush", "stuffed toys", "My Little Pony", "balloon",
                 "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles candy",
                 "Pony"],
    "for kid":  ["Lego", "little", "UNO", "HotWheels", "Hot Wheels", "Playing Cards",
                 "Mini Plush", "stuffed toys", "My Little Pony", "balloon",
                 "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles candy",
                 "Pony"],
    "balloon": ["balloon"],
    "balloons": ["balloon"],
    "party needs": ["balloon", "party hats", "party poppers", "party decorations"],
    "party supplies": ["balloon", "party hats", "party poppers", "party decorations"],
    "party": ["balloon", "party hats", "party poppers", "party decorations"],
    "parties": ["balloon", "party hats", "party poppers", "party decorations"],
    
    # ── Clothing — all ───────────────────────────────────────────────────────
    "clothes":   ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                  "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket","pants",
                  "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat","dress","floral","women dress"],
    "clothing":  ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                  "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket","pants",
                  "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat","dress","floral","women dress"],
    "clothings": ["Raincoat", "Rain Boots", "Waterproof Jacket", "shorts", "flip flops",
                  "shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                  "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat","pants"],
    "shirts": ["shirt", "casual sleeveless tops", "Sarouel Pants", "Jacket",
                  "Keffiyeh", "Long Sleeve", "pants"],
    "shirt": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve", "pants"],
    "t shirt": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve","pants"],
    "t-shirt": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve","pants"],
    "t-shirts": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve", "pants"],
    "men's t-shirt": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve", "pants"],
    "men's t-shirts": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve", "pants"],
    "men's shirt": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve","pants"],
    "men's shirts": ["shirt", "casual sleeveless tops", "Jacket",
                  "Keffiyeh", "Long Sleeve","pants"],
    "boy clothes": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt"],
    "boy shirts": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "boy's clothes": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "boy's shirts": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "men's t-shirt": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "men's t-shirt": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "men's t-shirt": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "men's t-shirt": ["men's t-shirt","t-shirt","shirt","shirts","t-shirts","T-Shirt","t-shirts","T-SHIRTS","T-SHIRT","Shirt","Shirts"],
    "girl clothes": ["dress","women dress","little dress","little dresses"],
    "girl dress": ["dress","women dress","little dress","little dresses"],
    "girl dresses": ["dress","women dress","little dress","little dresses"],
    "girl's clothes": ["dress","women dress","little dress","little dresses"],
    "girl's dress": ["dress","women dress","little dress","little dresses"],
    "girl's dresses": ["dress","women dress","little dress","little dresses"],
    "woman clothes":["women dress","dress","floral"],
    "women's dress":["women dress","dress","floral"],
    "women's dresses":["women dress","dress","floral"],
    "women dresses":["women dress","dress","floral"],
    "women's clothes":["women dress","dress","floral"],
    "women's dresses":["women dress","dress","floral"],
    "dress": ["women dress","dress"],
    "Dress": ["women dress","dress"],
    "Dresses": ["women dress","dress"],
    "dresses": ["women dress","dress"],
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
    "woman attire":["women dress","dress","floral"],
    
    "summer dress":   ["women dress","dress","floral"],
    "dress summer":   ["women dress","dress","floral"],
    "skirt summer":   ["women dress","dress","floral"],
    "blouse summer":  ["casual sleeveless tops", "shirt"],
    "gown summer":    ["women dress", "dress", "floral"],
    "summer dresses": ["women dress","dress","floral"],
    "summer skirt":   ["casual sleeveless tops", "shorts", "flip flops", "shirt"],
    "summer blouse":  ["casual sleeveless tops", "shirt"],
    "summer gown":    ["women dress", "dress", "floral"],
    
    # Dry / hot season clothes
    "dry season clothes": ["shorts", "flip flops", "shirt"],
    "dry clothes":        ["shorts", "flip flops", "shirt"],
    "dry season":         ["shorts", "flip flops", "shirt"],
    "hot season clothes": ["shorts", "flip flops", "shirt"],
    "hot season":         ["shorts", "flip flops", "shirt"],

    # Summer clothes
    "summer clothes":  ["shorts", "flip flops", "shirt", "Sarouel Pants",
                        "Jacket", "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "summer clothing": ["shorts", "flip flops", "shirt", "Sarouel Pants",
                        "Jacket", "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    "summer":          ["shorts", "flip flops", "shirt", "Sarouel Pants",
                        "Jacket", "Keffiyeh", "Long Sleeve", "Summer Hat", "Hat"],
    
    # Summer food (also handled by SUMMER_FOOD_KEYWORDS; listed here so
    # _split_space_separated_products can recognise the 2-word span)
    "summer food":         ["Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
                            "Gardenia Classic White Bread", "Kebab", "Satay",
                            "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum"],
    "summer foods":        ["Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
                            "Gardenia Classic White Bread", "Kebab", "Satay",
                            "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum"],
    "hot season food":     ["Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
                            "Gardenia Classic White Bread", "Kebab", "Satay",
                            "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum"],
    "hot season foods":    ["Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
                            "Gardenia Classic White Bread", "Kebab", "Satay",
                            "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum"],
    "summer season food":  ["Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
                            "Gardenia Classic White Bread", "Kebab", "Satay",
                            "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum"],
    "summer season foods": ["Beef Rendang", "Biko", "Binignit", "Buko Juice", "Escabeche",
                            "Gardenia Classic White Bread", "Kebab", "Satay",
                            "Pastil", "Puto Maya", "Shawarma", "Tiyula Itum"],
}

# Titles that appear in the "food" category but are canned goods — shown as Complement
FOOD_COMPLEMENT_TITLES: set[str] = {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf","Juice"}

# Titles that appear in the "meat/meats" category but are canned — shown as Complement
MEAT_COMPLEMENT_TITLES: set[str] = {"Luncheon Meat", "Meat Loaf",""}

# =============================================================================
#  Per-category ESCI overrides
#  Keys match the lowercased query strings from INTENT_CATEGORIES.
#  Each value has optional "complement" and "substitute" keyword sets.
#  Any title that contains a complement keyword → Complement label.
#  Any title that contains a substitute keyword → Substitute label.
#  Remaining titles → Exact (the default).
# =============================================================================
INTENT_ESCI: dict[str, dict] = {

    # ── Candy / Sweets ────────────────────────────────────────────────────────
    # Ferrero Rocher = Substitute (gift chocolate, not casual candy).
    # Skyflakes = Complement (savory cracker, not candy). HotWheels = Irrelevant (toy, not food).
    "candy":      {"substitute": {"Ferrero"}, "complement": {"Skyflakes"}, "irrelevant": {"HotWheels"}},
    "candies":    {"substitute": {"Ferrero"}, "complement": {"Skyflakes"}, "irrelevant": {"HotWheels"}},
    "sweets":     {"substitute": {"Ferrero"}, "complement": {"Skyflakes"}, "irrelevant": {"HotWheels"}},
    # Chocolates: M&Ms/Ferrero = Exact; Mentos/Twizzlers = Substitute; HotWheels = Irrelevant
    "chocolates": {"substitute": {"Mentos", "Twizzlers", "sprinkles"}, "irrelevant": {"HotWheels"}},
    "chocolate":  {"substitute": {"Mentos", "Twizzlers", "sprinkles"}, "irrelevant": {"HotWheels"}},

    # ── Snacks ────────────────────────────────────────────────────────────────
    # Savory snacks = Exact. Candy/sweets = Complement. Raincoat = Irrelevant (clothing, not food).
    "snacks": {"complement": {"M&Ms", "Mentos", "Ferrero"}, "irrelevant": {"Raincoat"}},
    "snack":  {"complement": {"M&Ms", "Mentos", "Ferrero"}, "irrelevant": {"Raincoat"}},

    # ── Birthday ──────────────────────────────────────────────────────────────
    # Balloons/decorations = Exact birthday items.
    # Toys (LEGO, UNO, Hot Wheels) = Complement (nice gift, not a decoration).
    # Ferrero = Complement (gift food).
    "birthday items":           {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO", "Ferrero",
                                                "stuffed toys", "Playing Cards"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday":                 {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO", "Ferrero",
                                                "stuffed toys", "Playing Cards"},
                                  "substitute": {"Slap Bracelets"}},
    "birthdays":                {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO", "Ferrero",
                                                "stuffed toys", "Playing Cards"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday items for girls": {"complement": {"Ferrero", "stuffed toys"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday items for boys":  {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO"}},
    "birthday items for kids":  {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO"},
                                  "substitute": {"Slap Bracelets"}},
    "birthday items for adults": {"complement": {"Ferrero"}},

    # ── Toys / Kids ───────────────────────────────────────────────────────────
    # Exact=playable toys+plush+pony. Complement=balloon+candy. Irrelevant=Sardines.
    "toys":     {"complement": {"balloon", "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles"}, "irrelevant": {"Sardines"}},
    "toy":      {"complement": {"balloon", "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles"}, "irrelevant": {"Sardines"}},
    "for kids": {"complement": {"balloon", "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles"}, "irrelevant": {"Sardines"}},
    "kid":      {"complement": {"balloon", "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles"}, "irrelevant": {"Sardines"}},
    "kids":     {"complement": {"balloon", "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles"}, "irrelevant": {"Sardines"}},
    "for kid":  {"complement": {"balloon", "M&Ms", "Mentos", "Ferrero", "Twizzlers", "sprinkles"}, "irrelevant": {"Sardines"}},
    # Birthday toys — playable toys = Exact; balloon = Complement (decoration)
    "birthday toys": {"complement": {"balloon", "Balloons"}},
    "birthday toy":  {"complement": {"balloon", "Balloons"}},
    # Boys birthday toys — HotWheels/Lego = Exact; UNO/Playing Cards = Substitute (gender-neutral); stuffed toys/balloon = Complement
    "boys birthday toys":     {"substitute": {"UNO", "Playing Cards"},
                                "complement": {"stuffed toys", "balloon"}},
    "boy birthday toys":      {"substitute": {"UNO", "Playing Cards"},
                                "complement": {"stuffed toys", "balloon"}},
    "birthday toys for boys": {"substitute": {"UNO", "Playing Cards"},
                                "complement": {"stuffed toys", "balloon"}},
    # Girls birthday toys — stuffed toys/little = Exact; UNO/Playing Cards = Substitute; Lego/HotWheels/balloon = Complement
    "girls birthday toys":     {"substitute": {"UNO", "Playing Cards"},
                                 "complement": {"Lego", "HotWheels", "Hot Wheels", "balloon"}},
    "girl birthday toys":      {"substitute": {"UNO", "Playing Cards"},
                                 "complement": {"Lego", "HotWheels", "Hot Wheels", "balloon"}},
    "birthday toys for girls": {"substitute": {"UNO", "Playing Cards"},
                                 "complement": {"Lego", "HotWheels", "Hot Wheels", "balloon"}},

    # ── Party supplies ────────────────────────────────────────────────────────
    # Balloons/decorations = Exact. Toys/food are Complement (gift items, not supplies).
    "party needs":    {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO", "Ferrero"}},
    "party supplies": {"complement": {"LEGO", "Lego", "Hot Wheels", "HotWheels", "UNO", "Ferrero"}},

    # ── School supplies ───────────────────────────────────────────────────────
    # Stationery = Exact. Lego = Complement (educational toy, not a supply). Sardines = Irrelevant (food, nothing to do with school).
    "school supplies": {"complement": {"Lego"}, "irrelevant": {"Sardines"}},
    "school":          {"complement": {"Lego"}, "irrelevant": {"Sardines"}},

    # ── Canned goods ─────────────────────────────────────────────────────────
    # Sardines/Luncheon Meat/Corned Beef/Meat Loaf = Exact. Gardenia bread = Complement (commonly eaten with canned goods). Buko Juice = Complement (drink paired with meal).
    "canned goods":    {"complement": {"Gardenia", "Buko Juice"}},
    "canned good":     {"complement": {"Gardenia", "Buko Juice"}},
    "canned products": {"complement": {"Gardenia", "Buko Juice"}},
    "canned product":  {"complement": {"Gardenia", "Buko Juice"}},
    "canned food":     {"complement": {"Gardenia", "Buko Juice"}},
    "canned":          {"complement": {"Gardenia", "Buko Juice"}},

    # ── Halal / Muslim food ───────────────────────────────────────────────────
    # Halal dishes = Exact. Escabeche = Substitute (fish, halal but not distinctly halal-branded). Buko Juice = Complement (drink, not a dish).
    "halal food":  {"substitute": {"Escabeche"}, "irrelevant": {"Buko Juice"}},
    "muslim food": {"substitute": {"Escabeche"}, "irrelevant": {"Buko Juice"}},
    "halal":       {"substitute": {"Escabeche"}, "irrelevant": {"Buko Juice"}},

    # ── Lenten food ───────────────────────────────────────────────────────────
    # Traditional Lenten dishes = Exact. Sardines = Substitute (common fasting protein, canned). Skyflakes = Complement (snack during fasting).
    "lenten season food": {"substitute": {"Sardines"}, "complement": {"Skyflakes"}},
    "lenten food":        {"substitute": {"Sardines"}, "complement": {"Skyflakes"}},
    "lenten":             {"substitute": {"Sardines"}, "complement": {"Skyflakes"}},

    # ── Drinks ───────────────────────────────────────────────────────────────
    # All juice/drink products = Exact. Sardines = Complement (food pairing).
    "drinks": {"complement": {"Sardines"}},
    "drink":  {"complement": {"Sardines"}},
    "juice":  {},
    "juices": {},

    # ── Meat / Meats ─────────────────────────────────────────────────────────
    # Fresh/cooked meat dishes = Exact. Luncheon Meat/Meat Loaf = Substitute (processed canned meat, not fresh). Sardines = Complement (canned fish, different protein).
    "meat":  {"substitute": {"Luncheon Meat", "Meat Loaf"}, "complement": {"Sardines"}},
    "meats": {"substitute": {"Luncheon Meat", "Meat Loaf"}, "complement": {"Sardines"}},

    # ── Food ─────────────────────────────────────────────────────────────────
    # Main dishes = Exact. Gardenia = Substitute. Canned goods/snacks = Complement. Raincoat = Irrelevant (clothing).
    "food":  {"substitute": {"Gardenia"}, "complement": {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf", "Fudgee Barr", "Skyflakes"}, "irrelevant": {"Raincoat", "Buko Juice"}},
    "foods": {"substitute": {"Gardenia"}, "complement": {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf", "Fudgee Barr", "Skyflakes"}, "irrelevant": {"Raincoat", "Buko Juice"}},

    # ── Kids food ─────────────────────────────────────────────────────────────
    # Sweet/fun foods (juice, kakanin, snacks, candy) = Exact for kids.
    # Canned goods (Sardines, Corned Beef, Luncheon Meat) = Complement (adult staples, not kid-first).
    "kids food":     {"complement": {"Sardines", "Luncheon Meat", "Corned Beef"}},
    "kids foods":    {"complement": {"Sardines", "Luncheon Meat", "Corned Beef"}},
    "food for kids": {"complement": {"Sardines", "Luncheon Meat", "Corned Beef"}},
    "children food": {"complement": {"Sardines", "Luncheon Meat", "Corned Beef"}},
    "children foods":{"complement": {"Sardines", "Luncheon Meat", "Corned Beef"}},

    # ── Seasonal food ────────────────────────────────────────────────────────
    # Seasonal dishes = Exact. Canned goods = Complement (convenient, not seasonal cuisine). Gardenia = Substitute (neutral meal base).
    "seasonal food": {"substitute": {"Gardenia"}, "complement": {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf"}, "irrelevant": {"Buko Juice"}},
    "season food":   {"substitute": {"Gardenia"}, "complement": {"Sardines", "Luncheon Meat", "Corned Beef", "Meat Loaf"}, "irrelevant": {"Buko Juice"}},

    # ── Clothes ──────────────────────────────────────────────────────────────
    # Hats/Keffiyeh = Complement (accessories, not clothing per se).
    "clothes":   {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "clothing":  {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "clothings": {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},

    # Rainy season: Raincoat/Rain Boots/Waterproof Jacket = Exact. No complements (list is precise).

    # Summer clothes: shorts/flip flops/shirt/Sarouel/etc = Exact. Hat = Complement (accessory). Keffiyeh = Complement (head covering, not summer-specific clothing).
    "summer clothes": {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "summer":         {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},

    # Seasonal/weather clothes: all garments = Exact. Hats = Complement.
    "seasonal clothes":       {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "season clothes":         {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "weather clothes":        {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
    "clothes for the season": {"complement": {"Summer Hat", "Hat", "Keffiyeh"}},
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
_INTENT_CATEGORIES_LOWER = {k.lower(): v for k, v in INTENT_CATEGORIES.items()}


def match_intent_category(search_text: str) -> list[str] | None:
    """
    Check if a search text matches a known intent category.

    Returns:
        List of product title keywords if matched, None if no intent match found.
    """
    normalized = search_text.lower().strip()

    if normalized in SUMMER_FOOD_KEYWORDS:
        return list(SUMMER_FOOD_TITLES)

    if normalized in _INTENT_CATEGORIES_LOWER:
        return list(_INTENT_CATEGORIES_LOWER[normalized])

    return None


def get_intent_esci(search_text: str) -> tuple[set[str], set[str], set[str]]:
    """
    Return (complement_keywords, substitute_keywords, irrelevant_keywords) for an intent category query.
    A product title is checked via case-insensitive substring match against each keyword.
    Priority: irrelevant > substitute > complement > exact (default).
    Returns empty sets (all Exact) if no override is defined for the category.
    """
    normalized = search_text.lower().strip()
    overrides = INTENT_ESCI.get(normalized, {})
    return (
        overrides.get("complement", set()),
        overrides.get("substitute", set()),
        overrides.get("irrelevant", set()),
    )
