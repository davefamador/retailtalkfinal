"""
Wishlist routes — buyers can save products to their wishlist.
Also includes seller-facing and admin-facing report endpoints for wishlist analytics.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import get_supabase
from routes.auth import get_current_user

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])


class AddWishlistRequest(BaseModel):
    product_id: str


class WishlistItemResponse(BaseModel):
    id: str
    product_id: str
    title: str
    description: str
    price: float
    stock: int
    seller_id: str
    seller_name: str
    image_url: str
    created_at: str


# --- Routes ---

@router.get("/", response_model=list[WishlistItemResponse])
async def get_wishlist(current_user: dict = Depends(get_current_user)):
    """Get the current buyer's wishlist with product details."""
    sb = get_supabase()
    user_id = current_user["sub"]

    wishlist_data = sb.table("wishlist_items").select(
        "*, products(id, title, description, price, seller_id, images, stock)"
    ).eq("buyer_id", user_id).order("created_at", desc=True).execute()

    items = []
    seller_name_cache = {}

    for w in (wishlist_data.data or []):
        prod = w.get("products")
        if not prod:
            continue

        sid = prod["seller_id"]
        if sid not in seller_name_cache:
            seller_resp = sb.table("users").select("full_name, department_id").eq("id", sid).execute()
            if seller_resp.data:
                full_name = seller_resp.data[0]["full_name"]
                dept_id = seller_resp.data[0].get("department_id")
                if dept_id:
                    dept_resp = sb.table("departments").select("name").eq("id", dept_id).execute()
                    if dept_resp.data:
                        seller_name_cache[sid] = dept_resp.data[0]["name"]
                    else:
                        seller_name_cache[sid] = full_name
                else:
                    seller_name_cache[sid] = full_name
            else:
                seller_name_cache[sid] = "Seller"

        images = prod.get("images") or []

        items.append(WishlistItemResponse(
            id=w["id"],
            product_id=prod["id"],
            title=prod["title"],
            description=prod.get("description", ""),
            price=float(prod["price"]),
            stock=int(prod.get("stock", 0)),
            seller_id=prod["seller_id"],
            seller_name=seller_name_cache[sid],
            image_url=images[0] if images else "",
            created_at=w["created_at"],
        ))

    return items


@router.post("/add")
async def add_to_wishlist(req: AddWishlistRequest, current_user: dict = Depends(get_current_user)):
    """Add a product to the buyer's wishlist."""
    sb = get_supabase()
    user_id = current_user["sub"]

    # Verify product exists and is active
    prod = sb.table("products").select("id, seller_id").eq("id", req.product_id).eq("is_active", True).eq("status", "approved").execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["seller_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot add your own product to wishlist")

    # Check if already in wishlist
    existing = sb.table("wishlist_items").select("id").eq("buyer_id", user_id).eq("product_id", req.product_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Product already in wishlist")

    sb.table("wishlist_items").insert({
        "buyer_id": user_id,
        "product_id": req.product_id,
    }).execute()

    return {"message": "Added to wishlist"}


@router.delete("/remove/{product_id}")
async def remove_from_wishlist(product_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a product from the buyer's wishlist."""
    sb = get_supabase()
    sb.table("wishlist_items").delete().eq("buyer_id", current_user["sub"]).eq("product_id", product_id).execute()
    return {"message": "Removed from wishlist"}


@router.get("/check/{product_id}")
async def check_wishlist(product_id: str, current_user: dict = Depends(get_current_user)):
    """Check if a product is in the buyer's wishlist."""
    sb = get_supabase()
    existing = sb.table("wishlist_items").select("id").eq("buyer_id", current_user["sub"]).eq("product_id", product_id).execute()
    return {"in_wishlist": bool(existing.data)}


@router.get("/seller-report")
async def get_seller_wishlist_report(current_user: dict = Depends(get_current_user)):
    """
    Seller-facing wishlist report.
    Returns wishlist counts for the seller's products and a wishlist-to-product ratio.
    """
    sb = get_supabase()
    user_id = current_user["sub"]

    # Build list of seller IDs (same logic as /products/my — includes department manager)
    seller_ids = [user_id]
    user_info = sb.table("users").select("role, department_id, manager_id").eq("id", user_id).execute()
    if user_info.data and user_info.data[0].get("department_id"):
        dept_id = user_info.data[0]["department_id"]
        dept = sb.table("departments").select("manager_id").eq("id", dept_id).execute()
        if dept.data and dept.data[0].get("manager_id"):
            manager_id = dept.data[0]["manager_id"]
            if manager_id not in seller_ids:
                seller_ids.append(manager_id)
    # If user is a manager, also include products from their department sellers
    if user_info.data and user_info.data[0].get("role") == "manager":
        dept_id = user_info.data[0].get("department_id")
        if dept_id:
            dept_users = sb.table("users").select("id").eq("department_id", dept_id).eq("role", "staff").execute()
            for du in (dept_users.data or []):
                if du["id"] not in seller_ids:
                    seller_ids.append(du["id"])

    # Get all products for these seller IDs
    products = sb.table("products").select("id, title, images, stock").in_("seller_id", seller_ids).execute()
    if not products.data:
        return {
            "total_products": 0,
            "total_wishlists": 0,
            "unique_buyers": 0,
            "wishlist_per_product": 0,
            "products": [],
            "buyers": [],
        }

    product_ids = [p["id"] for p in products.data]

    # Get all wishlist items for these products (include buyer_id and created_at)
    wishlist_data = sb.table("wishlist_items").select("product_id, buyer_id, created_at").in_("product_id", product_ids).execute()

    # Count wishlists per product
    wishlist_counts = {}
    # Track unique buyers
    buyer_ids = set()
    buyer_product_counts = {}
    for w in (wishlist_data.data or []):
        pid = w["product_id"]
        bid = w["buyer_id"]
        wishlist_counts[pid] = wishlist_counts.get(pid, 0) + 1
        buyer_ids.add(bid)
        buyer_product_counts[bid] = buyer_product_counts.get(bid, 0) + 1

    total_wishlists = sum(wishlist_counts.values())
    total_products = len(products.data)
    unique_buyers = len(buyer_ids)

    # Fetch buyer names
    buyers_list = []
    if buyer_ids:
        buyer_data = sb.table("users").select("id, full_name, email").in_("id", list(buyer_ids)).execute()
        buyer_map = {b["id"]: b for b in (buyer_data.data or [])}
        for bid in buyer_ids:
            b = buyer_map.get(bid, {})
            buyers_list.append({
                "buyer_id": bid,
                "buyer_name": b.get("full_name", "Unknown"),
                "buyer_email": b.get("email", ""),
                "wishlist_count": buyer_product_counts.get(bid, 0),
            })
        buyers_list.sort(key=lambda x: x["wishlist_count"], reverse=True)

    product_details = []
    for p in products.data:
        count = wishlist_counts.get(p["id"], 0)
        images = p.get("images") or []
        product_details.append({
            "product_id": p["id"],
            "title": p["title"],
            "image_url": images[0] if images else "",
            "wishlist_count": count,
            "stock": int(p.get("stock") or 0),
        })

    # Sort by wishlist count descending
    product_details.sort(key=lambda x: x["wishlist_count"], reverse=True)

    return {
        "total_products": total_products,
        "total_wishlists": total_wishlists,
        "unique_buyers": unique_buyers,
        "wishlist_per_product": round(total_wishlists / total_products, 2) if total_products > 0 else 0,
        "products": product_details,
        "buyers": buyers_list,
    }


@router.get("/admin-report")
async def get_admin_wishlist_report(current_user: dict = Depends(get_current_user)):
    """
    Admin-facing platform-wide wishlist report.
    Returns wishlists across all stores, top products, top buyers, per-store breakdown,
    and recent activity.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    sb = get_supabase()

    # Get ALL wishlist items with product + buyer info
    wishlist_data = sb.table("wishlist_items").select(
        "id, product_id, buyer_id, created_at"
    ).order("created_at", desc=True).execute()
    all_items = wishlist_data.data or []

    if not all_items:
        return {
            "total_wishlists": 0,
            "unique_buyers": 0,
            "total_products_wishlisted": 0,
            "wishlists_per_product": 0,
            "top_products": [],
            "top_buyers": [],
            "by_store": [],
            "recent_activity": [],
        }

    # Collect unique IDs
    product_ids = list({w["product_id"] for w in all_items})
    buyer_ids = list({w["buyer_id"] for w in all_items})

    # Fetch product details
    products_data = sb.table("products").select("id, title, images, seller_id").in_("id", product_ids).execute()
    product_map = {p["id"]: p for p in (products_data.data or [])}

    # Fetch buyer details
    buyer_data = sb.table("users").select("id, full_name, email").in_("id", buyer_ids).execute()
    buyer_map = {b["id"]: b for b in (buyer_data.data or [])}

    # Fetch seller -> department mapping for store names
    seller_ids = list({p["seller_id"] for p in (products_data.data or [])})
    seller_data = sb.table("users").select("id, full_name, department_id").in_("id", seller_ids).execute()
    seller_map = {s["id"]: s for s in (seller_data.data or [])}

    dept_ids = list({s.get("department_id") for s in (seller_data.data or []) if s.get("department_id")})
    dept_map = {}
    if dept_ids:
        dept_data = sb.table("departments").select("id, name").in_("id", dept_ids).execute()
        dept_map = {d["id"]: d["name"] for d in (dept_data.data or [])}

    def get_store_name(seller_id):
        seller = seller_map.get(seller_id, {})
        dept_id = seller.get("department_id")
        if dept_id and dept_id in dept_map:
            return dept_map[dept_id]
        return seller.get("full_name", "Unknown")

    # --- Counts ---
    product_counts = {}
    buyer_counts = {}
    store_counts = {}

    for w in all_items:
        pid = w["product_id"]
        bid = w["buyer_id"]
        product_counts[pid] = product_counts.get(pid, 0) + 1
        buyer_counts[bid] = buyer_counts.get(bid, 0) + 1

        prod = product_map.get(pid)
        if prod:
            store = get_store_name(prod["seller_id"])
            store_counts[store] = store_counts.get(store, 0) + 1

    # --- Top Products ---
    top_products = []
    for pid, count in sorted(product_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        prod = product_map.get(pid, {})
        images = prod.get("images") or []
        top_products.append({
            "product_id": pid,
            "title": prod.get("title", "Unknown"),
            "image_url": images[0] if images else "",
            "store": get_store_name(prod.get("seller_id", "")),
            "wishlist_count": count,
        })

    # --- Top Buyers ---
    top_buyers = []
    for bid, count in sorted(buyer_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        b = buyer_map.get(bid, {})
        top_buyers.append({
            "buyer_id": bid,
            "buyer_name": b.get("full_name", "Unknown"),
            "buyer_email": b.get("email", ""),
            "wishlist_count": count,
        })

    # --- By Store ---
    by_store = [
        {"store": store, "wishlist_count": count}
        for store, count in sorted(store_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # --- Recent Activity (last 20) ---
    recent_activity = []
    for w in all_items[:20]:
        prod = product_map.get(w["product_id"], {})
        buyer = buyer_map.get(w["buyer_id"], {})
        images = prod.get("images") or []
        recent_activity.append({
            "buyer_name": buyer.get("full_name", "Unknown"),
            "product_title": prod.get("title", "Unknown"),
            "product_image": images[0] if images else "",
            "store": get_store_name(prod.get("seller_id", "")),
            "created_at": w["created_at"],
        })

    total_wishlists = len(all_items)
    unique_products = len(product_counts)

    return {
        "total_wishlists": total_wishlists,
        "unique_buyers": len(buyer_counts),
        "total_products_wishlisted": unique_products,
        "wishlists_per_product": round(total_wishlists / unique_products, 2) if unique_products > 0 else 0,
        "top_products": top_products,
        "top_buyers": top_buyers,
        "by_store": by_store,
        "recent_activity": recent_activity,
    }
