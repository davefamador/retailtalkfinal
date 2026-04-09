"""
Cart routes — shopping cart for buyers.
One flat ₱90 delivery fee per unique department/store (per group).
Checkout creates one transaction per cart item, grouped by group_id per department.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from database import get_supabase
from routes.auth import get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])

DELIVERY_FEE_PER_DEPARTMENT = 90.00


class AddToCartRequest(BaseModel):
    product_id: str
    quantity: int = 1


class UpdateCartRequest(BaseModel):
    product_id: str
    quantity: int


class CartItemResponse(BaseModel):
    id: str
    product_id: str
    title: str
    description: str
    price: float
    quantity: int
    subtotal: float
    seller_id: str
    seller_name: str
    image_url: str


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    departments_count: int
    delivery_fee_per_department: float
    total_delivery_fee: float
    products_total: float
    grand_total: float


# --- Routes ---

@router.get("/", response_model=CartResponse)
async def get_cart(current_user: dict = Depends(get_current_user)):
    """Get the current buyer's cart with delivery fee breakdown."""
    sb = get_supabase()
    user_id = current_user["sub"]

    cart_data = sb.table("cart_items").select(
        "*, products(id, title, description, price, seller_id, images, stock)"
    ).eq("buyer_id", user_id).order("created_at", desc=False).execute()

    items = []
    department_ids = set()
    independent_sellers = set()
    products_total = 0.0
    seller_name_cache = {}
    seller_dept_cache = {}

    for c in (cart_data.data or []):
        prod = c.get("products")
        if not prod:
            continue

        price = float(prod["price"])
        qty = int(c["quantity"])
        subtotal = price * qty
        products_total += subtotal

        # Look up seller name and department (cached)
        sid = prod["seller_id"]
        if sid not in seller_name_cache:
            seller_resp = sb.table("users").select("full_name, department_id").eq("id", sid).execute()
            if seller_resp.data:
                full_name = seller_resp.data[0]["full_name"]
                dept_id_val = seller_resp.data[0].get("department_id")
                seller_dept_cache[sid] = dept_id_val
                if dept_id_val:
                    dept_resp = sb.table("departments").select("name").eq("id", dept_id_val).execute()
                    if dept_resp.data:
                        seller_name_cache[sid] = dept_resp.data[0]["name"]
                    else:
                        seller_name_cache[sid] = full_name
                else:
                    seller_name_cache[sid] = full_name
            else:
                seller_name_cache[sid] = "Seller"
                seller_dept_cache[sid] = None
        seller_name = seller_name_cache[sid]

        # Track unique departments (independent sellers each count as one unit)
        dept_id = seller_dept_cache.get(sid)
        if dept_id:
            department_ids.add(dept_id)
        else:
            independent_sellers.add(sid)

        images = prod.get("images") or []

        items.append(CartItemResponse(
            id=c["id"],
            product_id=prod["id"],
            title=prod["title"],
            description=prod.get("description", ""),
            price=price,
            quantity=qty,
            subtotal=round(subtotal, 2),
            seller_id=prod["seller_id"],
            seller_name=seller_name,
            image_url=images[0] if images else "",
        ))

    # Delivery fee per unique department (independent sellers each count as one unit)
    delivery_units = len(department_ids) + len(independent_sellers)
    total_delivery = delivery_units * DELIVERY_FEE_PER_DEPARTMENT

    return CartResponse(
        items=items,
        departments_count=delivery_units,
        delivery_fee_per_department=DELIVERY_FEE_PER_DEPARTMENT,
        total_delivery_fee=total_delivery,
        products_total=round(products_total, 2),
        grand_total=round(products_total + total_delivery, 2),
    )



@router.post("/add")
async def add_to_cart(req: AddToCartRequest, current_user: dict = Depends(get_current_user)):
    """Add a product to cart (or increment quantity if already there)."""
    sb = get_supabase()
    user_id = current_user["sub"]

    if req.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    # Verify product exists and is active
    prod = sb.table("products").select("id, stock, seller_id").eq("id", req.product_id).eq("is_active", True).eq("status", "approved").execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["seller_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot add your own product to cart")

    # Check if already in cart
    existing = sb.table("cart_items").select("id, quantity").eq("buyer_id", user_id).eq("product_id", req.product_id).execute()
    if existing.data:
        new_qty = existing.data[0]["quantity"] + req.quantity
        if new_qty > prod.data[0]["stock"]:
            raise HTTPException(status_code=400, detail=f"Not enough stock. Available: {prod.data[0]['stock']}")
        sb.table("cart_items").update({"quantity": new_qty}).eq("id", existing.data[0]["id"]).execute()
        return {"message": f"Cart updated. Quantity: {new_qty}"}
    else:
        if req.quantity > prod.data[0]["stock"]:
            raise HTTPException(status_code=400, detail=f"Not enough stock. Available: {prod.data[0]['stock']}")
        sb.table("cart_items").insert({
            "buyer_id": user_id,
            "product_id": req.product_id,
            "quantity": req.quantity,
        }).execute()
        return {"message": "Added to cart"}


@router.put("/update")
async def update_cart_item(req: UpdateCartRequest, current_user: dict = Depends(get_current_user)):
    """Update quantity of a cart item."""
    sb = get_supabase()
    user_id = current_user["sub"]

    if req.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    existing = sb.table("cart_items").select("id").eq("buyer_id", user_id).eq("product_id", req.product_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Item not in cart")

    sb.table("cart_items").update({"quantity": req.quantity}).eq("id", existing.data[0]["id"]).execute()
    return {"message": f"Quantity updated to {req.quantity}"}


@router.delete("/remove/{product_id}")
async def remove_from_cart(product_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a product from cart."""
    sb = get_supabase()
    sb.table("cart_items").delete().eq("buyer_id", current_user["sub"]).eq("product_id", product_id).execute()
    return {"message": "Removed from cart"}


@router.delete("/clear")
async def clear_cart(current_user: dict = Depends(get_current_user)):
    """Clear entire cart."""
    sb = get_supabase()
    sb.table("cart_items").delete().eq("buyer_id", current_user["sub"]).execute()
    return {"message": "Cart cleared"}


class CheckoutRequest(BaseModel):
    pass  # Kept for backwards-compat; all orders are delivery now


@router.post("/checkout")
async def checkout_cart(req: CheckoutRequest = CheckoutRequest(), current_user: dict = Depends(get_current_user)):
    """
    Checkout all items in cart.
    - Delivery: ₱90 delivery fee per unique department (one group per department).
    - All items in the same department share a group_id.
    - The first item in each department group carries the delivery fee; rest are ₱0.
    """
    sb = get_supabase()
    user_id = current_user["sub"]

    # 1. Check user is buyer
    user_result = sb.table("users").select("role, is_banned").eq("id", user_id).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")
    if user_result.data[0].get("is_banned"):
        raise HTTPException(status_code=403, detail="Your account has been banned")
    if user_result.data[0]["role"] == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot purchase products")
    if user_result.data[0]["role"] != "buyer":
        raise HTTPException(status_code=403, detail="Only buyers can checkout")

    # 2. Check contact number and delivery address
    contact = sb.table("user_contacts").select("contact_number, delivery_address").eq("user_id", user_id).execute()
    if not contact.data:
        raise HTTPException(status_code=400, detail="Please add your contact number before placing an order")

    delivery_address = (contact.data[0].get("delivery_address") or "").strip()
    if not delivery_address:
        raise HTTPException(status_code=400, detail="Please set your delivery address before placing a delivery order")

    # 3. Get cart items with product info
    cart_data = sb.table("cart_items").select(
        "*, products(id, title, price, seller_id, stock)"
    ).eq("buyer_id", user_id).execute()

    if not cart_data.data or len(cart_data.data) == 0:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    # 4. Validate stock and calculate totals
    items = []
    products_total = 0.0
    seller_dept_cache = {}

    for c in cart_data.data:
        prod = c.get("products")
        if not prod:
            continue

        if c["quantity"] > prod["stock"]:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for '{prod['title']}'. Available: {prod['stock']}, in cart: {c['quantity']}"
            )

        price = float(prod["price"])
        subtotal = price * c["quantity"]
        products_total += subtotal

        # Look up seller's department (cached)
        sid = prod["seller_id"]
        if sid not in seller_dept_cache:
            seller_info = sb.table("users").select("department_id").eq("id", sid).execute()
            seller_dept_cache[sid] = seller_info.data[0].get("department_id") if seller_info.data else None

        dept_id = seller_dept_cache[sid]
        # Use department_id as delivery unit key, or seller_id for independent sellers
        delivery_unit = dept_id if dept_id else f"ind_{sid}"

        items.append({
            "cart_id": c["id"],
            "product_id": prod["id"],
            "seller_id": prod["seller_id"],
            "title": prod["title"],
            "quantity": c["quantity"],
            "price": price,
            "subtotal": subtotal,
            "delivery_unit": delivery_unit,
        })

    # One group_id per delivery unit — generated fresh for this checkout
    delivery_units = set(i["delivery_unit"] for i in items)
    group_id_map = {unit: str(uuid.uuid4()) for unit in delivery_units}

    total_delivery = len(delivery_units) * DELIVERY_FEE_PER_DEPARTMENT

    # Assign full ₱90 to first item per delivery unit; ₱0 to the rest
    delivery_fee_per_item = {}
    seen_units: set = set()
    for item in items:
        unit = item["delivery_unit"]
        if unit not in seen_units:
            delivery_fee_per_item[item["product_id"]] = DELIVERY_FEE_PER_DEPARTMENT
            seen_units.add(unit)
        else:
            delivery_fee_per_item[item["product_id"]] = 0.0

    grand_total = products_total + total_delivery

    # 5. Check balance
    balance_result = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    if not balance_result.data:
        raise HTTPException(status_code=400, detail="No balance found. Top up your wallet first.")

    buyer_balance = float(balance_result.data[0]["balance"])
    if buyer_balance < grand_total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You have PHP {buyer_balance:.2f}, total is PHP {grand_total:.2f}"
        )

    # 6. Process each item — create transactions and decrement stock
    transaction_ids = []

    for item in items:
        amount = item["subtotal"]
        d_fee = delivery_fee_per_item.get(item["product_id"], 0)
        seller_amount = amount
        admin_commission = 0.0
        group_id = group_id_map[item["delivery_unit"]]

        # Create transaction
        txn = sb.table("product_transactions").insert({
            "buyer_id": user_id,
            "seller_id": item["seller_id"],
            "product_id": item["product_id"],
            "quantity": item["quantity"],
            "amount": amount,
            "seller_amount": seller_amount,
            "admin_commission": admin_commission,
            "delivery_fee": d_fee,
            "delivery_address": delivery_address,
            "purchase_type": "delivery",
            "status": "pending",
            "group_id": group_id,
        }).execute()

        if txn.data:
            transaction_ids.append(txn.data[0]["id"])

        # Decrement stock
        prod_result = sb.table("products").select("stock").eq("id", item["product_id"]).execute()
        if prod_result.data:
            new_stock = int(prod_result.data[0]["stock"]) - item["quantity"]
            sb.table("products").update({"stock": new_stock}).eq("id", item["product_id"]).execute()

    # 7. Deduct from buyer (money held until transaction completes)
    new_balance = buyer_balance - grand_total
    sb.table("user_balances").update({"balance": new_balance}).eq("user_id", user_id).execute()

    # Log the cart checkout as a single purchase entry in wallet history
    try:
        sb.table("stored_value").insert({
            "user_id": user_id,
            "transaction_type": "purchase",
            "amount": grand_total,
            "metadata": {
                "order_type": "cart_checkout",
                "item_count": len(items),
                "departments": len(delivery_units),
                "products_total": round(products_total, 2),
                "delivery_fee": total_delivery,
                "transaction_ids": [str(tid) for tid in transaction_ids],
                "group_ids": list(group_id_map.values()),
            },
        }).execute()
    except Exception:
        pass  # Log failure must not block cart clearing

    # 8. Clear cart
    sb.table("cart_items").delete().eq("buyer_id", user_id).execute()

    return {
        "message": "Order placed successfully!",
        "transaction_ids": transaction_ids,
        "group_ids": list(group_id_map.values()),
        "products_total": round(products_total, 2),
        "delivery_fee": total_delivery,
        "grand_total": round(grand_total, 2),
        "new_balance": round(new_balance, 2),
    }
