"""
Transaction routes — buy products, view transaction history, manage balance.
Buyer's money is held on purchase (pending). On successful delivery/completion,
the product amount is credited to the admin. Buyer can cancel with conditions.
Supports quantity (buyer selects how many to buy).
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
from database import get_supabase
from routes.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])

DELIVERY_FEE = 90.00


# --- Request/Response Models ---

class BuyRequest(BaseModel):
    product_id: str
    quantity: int = 1  # How many items to buy


class TopUpRequest(BaseModel):
    amount: float


class WithdrawRequest(BaseModel):
    amount: float


class TransactionResponse(BaseModel):
    id: str
    buyer_id: str
    seller_id: str
    product_id: str
    product_title: str
    amount: float
    quantity: int = 1
    seller_amount: float
    admin_commission: float
    delivery_fee: float = 0
    status: str
    purchase_type: str = "delivery"
    delivery_user_id: str = ""
    delivery_user_name: str = ""
    delivery_user_contact: str = ""
    seller_name: str = ""
    buyer_name: str = ""
    assigned_staff_id: str = ""
    assigned_staff_name: str = ""
    delivery_address: str = ""
    product_images: list = []
    group_id: str = ""
    created_at: str


class BalanceResponse(BaseModel):
    user_id: str
    balance: float


class SVFEntry(BaseModel):
    id: str
    user_id: str
    transaction_type: str
    amount: float
    metadata: Optional[dict] = None
    created_at: str


# --- Routes ---

@router.post("/buy", response_model=TransactionResponse)
async def buy_product(req: BuyRequest, current_user: dict = Depends(get_current_user)):
    """
    Buy a product. 100% of product revenue goes to the department balance.
    Buyer can select quantity. Stock is decremented.
    """
    sb = get_supabase()
    user_id = current_user["sub"]

    if req.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    # 1. Check user isn't banned
    user_result = sb.table("users").select("role, is_banned").eq("id", user_id).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_result.data[0]
    if user_data.get("is_banned"):
        raise HTTPException(status_code=403, detail="Your account has been banned")

    user_role = user_data["role"]
    if user_role == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot purchase products")
    if user_role != "buyer":
        raise HTTPException(status_code=403, detail="Only buyers can purchase products")

    # Always delivery orders

    # For delivery orders, get buyer's delivery address
    delivery_address = ""
    contact = sb.table("user_contacts").select("contact_number, delivery_address").eq("user_id", user_id).execute()
    if not contact.data:
        raise HTTPException(status_code=400, detail="Please add your contact number and delivery address before placing a delivery order")
    delivery_address = (contact.data[0].get("delivery_address") or "").strip()
    if not delivery_address:
        raise HTTPException(status_code=400, detail="Please set your delivery address before placing a delivery order")

    # 2. Get product
    product_result = sb.table("products").select("*").eq("id", req.product_id).eq("is_active", True).eq("status", "approved").execute()
    if not product_result.data:
        raise HTTPException(status_code=404, detail="Product not found or not available")

    product = product_result.data[0]

    # 3. Can't buy your own product
    if product["seller_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot buy your own product")

    # 4. Check stock
    current_stock = int(product.get("stock", 0))
    if current_stock <= 0:
        raise HTTPException(status_code=400, detail="Product is out of stock")
    if req.quantity > current_stock:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough stock. Available: {current_stock}, requested: {req.quantity}",
        )

    # 5. Check buyer balance
    balance_result = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    if not balance_result.data:
        raise HTTPException(status_code=400, detail="No balance found. Top up your wallet first.")

    buyer_balance = float(balance_result.data[0]["balance"])
    unit_price = float(product["price"])
    total_price = unit_price * req.quantity

    # --- Group detection: find an open group for this buyer+store within 1 hour ---
    seller_id = product["seller_id"]
    # Determine the delivery unit (department or seller)
    seller_info = sb.table("users").select("department_id").eq("id", seller_id).execute()
    seller_dept_id = seller_info.data[0].get("department_id") if seller_info.data else None

    existing_group_id = None
    delivery_fee = 90.00  # Default: new group

    # Look for an active group for this buyer within the same store/department in the last hour.
    # An open group has NO transaction in ondeliver/delivered/undelivered/cancelled state.
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    if seller_dept_id:
        # Get all sellers in the same department
        dept_sellers = sb.table("users").select("id").eq("department_id", seller_dept_id).execute()
        dept_seller_ids = [s["id"] for s in (dept_sellers.data or [])]
        # Find recent pending/approved transactions for this buyer from department sellers
        recent = sb.table("product_transactions").select("group_id, status").eq(
            "buyer_id", user_id
        ).in_("seller_id", dept_seller_ids).in_(
            "status", ["pending", "approved"]
        ).gte("created_at", one_hour_ago).not_.is_("group_id", "null").execute()
    else:
        recent = sb.table("product_transactions").select("group_id, status").eq(
            "buyer_id", user_id
        ).eq("seller_id", seller_id).in_(
            "status", ["pending", "approved"]
        ).gte("created_at", one_hour_ago).not_.is_("group_id", "null").execute()

    if recent.data:
        # Collect candidate group ids
        candidate_groups = set(r["group_id"] for r in recent.data if r.get("group_id"))
        # Filter out any group that has a picked-up/done transaction
        for gid in candidate_groups:
            bad = sb.table("product_transactions").select("id", count="exact").eq(
                "group_id", gid
            ).in_("status", ["ondeliver", "delivered", "undelivered", "cancelled"]).execute()
            if (bad.count or 0) == 0:
                existing_group_id = gid
                delivery_fee = 0.0  # Joining existing group — no extra delivery fee
                break

    group_id = existing_group_id if existing_group_id else str(uuid.uuid4())
    grand_total = total_price + delivery_fee

    if buyer_balance < grand_total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You have PHP {buyer_balance:.2f}, total cost is PHP {grand_total:.2f}",
        )

    # 6. Amounts
    seller_amount = total_price
    admin_commission = 0.0

    # 7. Deduct from buyer
    new_buyer_balance = buyer_balance - grand_total
    sb.table("user_balances").update({"balance": new_buyer_balance}).eq("user_id", user_id).execute()

    # Log the purchase deduction in stored_value so it appears in wallet history
    sb.table("stored_value").insert({
        "user_id": user_id,
        "transaction_type": "purchase",
        "amount": grand_total,
        "metadata": {
            "product_id": req.product_id,
            "product_title": product["title"],
            "quantity": req.quantity,
            "product_amount": total_price,
            "delivery_fee": delivery_fee,
            "group_id": group_id,
            "joined_existing_group": existing_group_id is not None,
        },
    }).execute()

    # 8. Decrement stock
    new_stock = current_stock - req.quantity
    sb.table("products").update({"stock": new_stock}).eq("id", req.product_id).execute()

    # 9. Create product_transaction record
    txn_result = sb.table("product_transactions").insert({
        "buyer_id": user_id,
        "seller_id": product["seller_id"],
        "product_id": req.product_id,
        "quantity": req.quantity,
        "amount": total_price,
        "seller_amount": seller_amount,
        "admin_commission": admin_commission,
        "delivery_fee": delivery_fee,
        "delivery_address": delivery_address,
        "purchase_type": "delivery",
        "status": "pending",
        "group_id": group_id,
    }).execute()

    if not txn_result.data:
        raise HTTPException(status_code=500, detail="Failed to create transaction")

    txn = txn_result.data[0]
    return TransactionResponse(
        id=txn["id"],
        buyer_id=txn["buyer_id"],
        seller_id=txn["seller_id"],
        product_id=txn["product_id"],
        product_title=product["title"],
        amount=float(txn["amount"]),
        quantity=int(txn.get("quantity", 1)),
        seller_amount=float(txn.get("seller_amount", 0)),
        admin_commission=float(txn.get("admin_commission", 0)),
        delivery_fee=float(txn.get("delivery_fee", 0)),
        status=txn["status"],
        purchase_type=txn.get("purchase_type", "delivery"),
        delivery_user_id=txn.get("delivery_user_id") or "",
        group_id=txn.get("group_id") or "",
        created_at=txn["created_at"],
    )


@router.get("/history", response_model=list[TransactionResponse])
async def get_transaction_history(current_user: dict = Depends(get_current_user)):
    """Get all transactions for the current user (as buyer or seller).
    For sellers/managers in a department, includes all department transactions."""
    sb = get_supabase()
    user_id = current_user["sub"]

    bought = sb.table("product_transactions").select("*, products(title, images)").eq("buyer_id", user_id).order("created_at", desc=True).execute()
    sold = sb.table("product_transactions").select("*, products(title, images)").eq("seller_id", user_id).order("created_at", desc=True).execute()

    all_txns = (bought.data or []) + (sold.data or [])

    # For sellers/managers in a department, also include department-wide transactions
    user_info = sb.table("users").select("role, department_id").eq("id", user_id).execute()
    if user_info.data and user_info.data[0].get("role") in ("staff", "manager") and user_info.data[0].get("department_id"):
        dept_id = user_info.data[0]["department_id"]
        dept_staff = sb.table("users").select("id").eq("department_id", dept_id).execute()
        dept_ids = [s["id"] for s in (dept_staff.data or [])]
        # Also include the department manager
        dept_info = sb.table("departments").select("manager_id").eq("id", dept_id).execute()
        if dept_info.data and dept_info.data[0].get("manager_id"):
            mgr_id = dept_info.data[0]["manager_id"]
            if mgr_id not in dept_ids:
                dept_ids.append(mgr_id)
        if dept_ids:
            dept_txns = sb.table("product_transactions").select("*, products(title, images)").in_(
                "seller_id", dept_ids
            ).order("created_at", desc=True).execute()
            all_txns += (dept_txns.data or [])
    seen = set()
    unique_txns = []
    for t in all_txns:
        if t["id"] not in seen:
            seen.add(t["id"])
            unique_txns.append(t)

    unique_txns.sort(key=lambda t: t["created_at"], reverse=True)

    # Get delivery user info
    delivery_ids = set(t.get("delivery_user_id") for t in unique_txns if t.get("delivery_user_id"))
    delivery_names = {}
    delivery_contacts = {}
    if delivery_ids:
        d_users = sb.table("users").select("id, full_name").in_("id", list(delivery_ids)).execute()
        delivery_names = {u["id"]: u["full_name"] for u in (d_users.data or [])}
        d_contacts = sb.table("user_contacts").select("user_id, contact_number").in_("user_id", list(delivery_ids)).execute()
        delivery_contacts = {c["user_id"]: c["contact_number"] for c in (d_contacts.data or [])}

    # Get seller names (use department name if seller belongs to a department)
    seller_ids = set(t.get("seller_id") for t in unique_txns if t.get("seller_id"))
    seller_names = {}
    if seller_ids:
        s_users = sb.table("users").select("id, full_name, department_id").in_("id", list(seller_ids)).execute()
        # Batch-lookup department names
        dept_ids = set(u.get("department_id") for u in (s_users.data or []) if u.get("department_id"))
        dept_names = {}
        if dept_ids:
            depts = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
            dept_names = {d["id"]: d["name"] for d in (depts.data or [])}
        for u in (s_users.data or []):
            dept_id = u.get("department_id")
            if dept_id and dept_id in dept_names:
                seller_names[u["id"]] = dept_names[dept_id]
            else:
                seller_names[u["id"]] = u["full_name"]

    # Get buyer names
    buyer_ids = set(t.get("buyer_id") for t in unique_txns if t.get("buyer_id"))
    buyer_names = {}
    if buyer_ids:
        b_users = sb.table("users").select("id, full_name").in_("id", list(buyer_ids)).execute()
        buyer_names = {u["id"]: u["full_name"] for u in (b_users.data or [])}

    # Get assigned staff names
    assigned_ids = set(t.get("assigned_staff_id") for t in unique_txns if t.get("assigned_staff_id"))
    assigned_names = {}
    if assigned_ids:
        a_users = sb.table("users").select("id, full_name").in_("id", list(assigned_ids)).execute()
        assigned_names = {u["id"]: u["full_name"] for u in (a_users.data or [])}

    return [
        TransactionResponse(
            id=t["id"],
            buyer_id=t["buyer_id"] or "",
            seller_id=t["seller_id"] or "",
            product_id=t["product_id"] or "",
            product_title=t.get("products", {}).get("title", "") if t.get("products") else "",
            product_images=t.get("products", {}).get("images", []) if t.get("products") else [],
            amount=float(t["amount"] or 0),
            quantity=int(t.get("quantity") or 1),
            seller_amount=float(t.get("seller_amount") or 0),
            admin_commission=float(t.get("admin_commission") or 0),
            delivery_fee=float(t.get("delivery_fee") or 0),
            status=t.get("status") or "pending",
            purchase_type=t.get("purchase_type") or "delivery",
            delivery_user_id=t.get("delivery_user_id") or "",
            delivery_user_name=delivery_names.get(t.get("delivery_user_id") or "", ""),
            delivery_user_contact=delivery_contacts.get(t.get("delivery_user_id") or "", ""),
            seller_name=seller_names.get(t.get("seller_id") or "", ""),
            buyer_name=buyer_names.get(t.get("buyer_id") or "", ""),
            assigned_staff_id=t.get("assigned_staff_id") or "",
            assigned_staff_name=assigned_names.get(t.get("assigned_staff_id") or "", ""),
            delivery_address=t.get("delivery_address") or "",
            group_id=t.get("group_id") or "",
            created_at=t.get("created_at") or "",
        )
        for t in unique_txns
    ]


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(current_user: dict = Depends(get_current_user)):
    """Get the current user's balance."""
    sb = get_supabase()
    result = sb.table("user_balances").select("*").eq("user_id", current_user["sub"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Balance not found")

    return BalanceResponse(
        user_id=result.data[0]["user_id"],
        balance=float(result.data[0]["balance"]),
    )


@router.post("/topup", response_model=BalanceResponse)
async def topup_balance(req: TopUpRequest, current_user: dict = Depends(get_current_user)):
    """Add funds to the current user's balance."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    sb = get_supabase()
    user_id = current_user["sub"]

    result = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Balance not found")

    new_balance = float(result.data[0]["balance"]) + req.amount
    sb.table("user_balances").update({"balance": new_balance}).eq("user_id", user_id).execute()

    # Record SVF deposit
    sb.table("stored_value").insert({
        "user_id": user_id,
        "transaction_type": "deposit",
        "amount": req.amount,
    }).execute()

    return BalanceResponse(user_id=user_id, balance=new_balance)


@router.post("/withdraw", response_model=BalanceResponse)
async def withdraw_balance(req: WithdrawRequest, current_user: dict = Depends(get_current_user)):
    """Withdraw funds from the current user's balance."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    sb = get_supabase()
    user_id = current_user["sub"]

    result = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Balance not found")

    current_balance = float(result.data[0]["balance"])
    if current_balance < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    new_balance = current_balance - req.amount
    sb.table("user_balances").update({"balance": new_balance}).eq("user_id", user_id).execute()

    # Record SVF withdrawal
    sb.table("stored_value").insert({
        "user_id": user_id,
        "transaction_type": "withdrawal",
        "amount": req.amount,
    }).execute()

    return BalanceResponse(user_id=user_id, balance=new_balance)


@router.get("/svf-history", response_model=list[SVFEntry])
async def get_svf_history(current_user: dict = Depends(get_current_user)):
    """Get stored value facility history for the current user."""
    sb = get_supabase()
    user_id = current_user["sub"]

    result = sb.table("stored_value").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(100).execute()

    return [
        SVFEntry(
            id=row["id"],
            user_id=row["user_id"],
            transaction_type=row["transaction_type"],
            amount=float(row["amount"]),
            metadata=row.get("metadata"),
            created_at=row["created_at"],
        )
        for row in (result.data or [])
    ]

 

# --- Delivery Order Management (Staff/Manager) ---

class DeliveryOrderStatusUpdate(BaseModel):
    status: str  # 'approved' (ready for pickup)


@router.get("/staff/delivery-orders")
async def get_staff_delivery_orders(current_user: dict = Depends(get_current_user)):
    """Get delivery orders grouped by group_id for all staff in the same department/store."""
    sb = get_supabase()
    user_id = current_user["sub"]

    # Verify seller role and get department
    user = sb.table("users").select("role, department_id").eq("id", user_id).execute()
    if not user.data or user.data[0]["role"] not in ("staff", "manager"):
        raise HTTPException(status_code=403, detail="Only staff/managers can view delivery orders")

    dept_id = user.data[0].get("department_id")

    # Get all staff in the same department so orders are visible to all store staff
    if dept_id:
        staff = sb.table("users").select("id").eq("department_id", dept_id).execute()
        seller_ids = [s["id"] for s in (staff.data or [])]
        if user_id not in seller_ids:
            seller_ids.append(user_id)
    else:
        seller_ids = [user_id]

    txns = sb.table("product_transactions").select(
        "*, products(title, price, images)"
    ).in_("seller_id", seller_ids).in_(
        "status", ["pending", "approved", "ondeliver"]
    ).order("created_at", desc=False).execute()

    if not txns.data:
        return []

    buyer_ids = set(t["buyer_id"] for t in txns.data)
    assigned_ids = set(t["assigned_staff_id"] for t in txns.data if t.get("assigned_staff_id"))
    all_user_ids = buyer_ids | assigned_ids
    users_lookup = sb.table("users").select("id, full_name").in_("id", list(all_user_ids)).execute()
    user_names = {u["id"]: u["full_name"] for u in (users_lookup.data or [])}

    # Group transactions by group_id
    groups = {}
    for t in txns.data:
        gid = t.get("group_id") or t["id"]  # fallback: ungrouped orders use own id
        prod = t.get("products") or {}
        if gid not in groups:
            groups[gid] = {
                "group_id": gid,
                "buyer_id": t["buyer_id"],
                "buyer_name": user_names.get(t["buyer_id"], "Unknown"),
                "delivery_address": t.get("delivery_address", ""),
                "status": t["status"],
                "assigned_staff_id": t.get("assigned_staff_id"),
                "assigned_staff_name": user_names.get(t.get("assigned_staff_id", ""), ""),
                "created_at": t["created_at"],
                "delivery_fee": 90.0,  # flat per group
                "items": [],
                "total_amount": 0.0,
            }
        groups[gid]["items"].append({
            "id": t["id"],
            "product_id": t["product_id"],
            "product_title": prod.get("title", ""),
            "product_price": float(prod.get("price", 0)),
            "product_images": prod.get("images", []),
            "quantity": int(t.get("quantity", 1)),
            "amount": float(t["amount"]),
            "status": t["status"],
        })
        groups[gid]["total_amount"] += float(t["amount"])
        # Group status: escalate to worst (ondeliver > approved > pending)
        current_group_status = groups[gid]["status"]
        t_status = t["status"]
        status_priority = {"pending": 0, "approved": 1, "ondeliver": 2}
        if status_priority.get(t_status, 0) > status_priority.get(current_group_status, 0):
            groups[gid]["status"] = t_status

    return list(groups.values())


@router.put("/staff/delivery-orders/{group_id}/status")
async def update_delivery_order_status(
    group_id: str,
    req: DeliveryOrderStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Staff approves all pending transactions in a group (delivery box)."""
    sb = get_supabase()
    user_id = current_user["sub"]

    if req.status != "approved":
        raise HTTPException(status_code=400, detail="Status must be 'approved'")

    # Verify staff role and get department
    user = sb.table("users").select("role, department_id").eq("id", user_id).execute()
    if not user.data or user.data[0]["role"] not in ("staff", "manager"):
        raise HTTPException(status_code=403, detail="Access denied")

    dept_id = user.data[0].get("department_id")
    user_role = user.data[0]["role"]

    # Get all pending transactions in this group
    group_txns = sb.table("product_transactions").select("*").eq(
        "group_id", group_id
    ).eq("status", "pending").execute()

    # Fallback: group_id may actually be a single transaction's own id (no group_id set)
    if not group_txns.data:
        group_txns = sb.table("product_transactions").select("*").eq(
            "id", group_id
        ).eq("status", "pending").execute()

    if not group_txns.data:
        raise HTTPException(status_code=404, detail="No pending orders found in this group")

    # Verify at least one transaction belongs to this department/seller
    seller_id = group_txns.data[0]["seller_id"]
    if dept_id:
        seller_info = sb.table("users").select("department_id").eq("id", seller_id).execute()
        if not seller_info.data or seller_info.data[0].get("department_id") != dept_id:
            raise HTTPException(status_code=403, detail="Order does not belong to your department")
    else:
        if seller_id != user_id:
            raise HTTPException(status_code=403, detail="Order does not belong to you")

    # Approve all pending transactions in the group
    # Use group_id filter when available; fall back to id for single (ungrouped) orders
    update_data = {"status": "approved", "assigned_staff_id": user_id}
    actual_group_id = group_txns.data[0].get("group_id")
    if actual_group_id:
        sb.table("product_transactions").update(update_data).eq("group_id", actual_group_id).eq("status", "pending").execute()
    else:
        txn_ids = [t["id"] for t in group_txns.data]
        sb.table("product_transactions").update(update_data).in_("id", txn_ids).eq("status", "pending").execute()

    return {"message": f"All orders in group approved and ready for delivery pickup"}


@router.get("/manager/delivery-orders")
async def get_manager_delivery_orders(current_user: dict = Depends(get_current_user)):
    """Get grouped delivery orders for all products in the manager's department."""
    sb = get_supabase()
    user_id = current_user["sub"]

    # Get manager's department
    user = sb.table("users").select("role, department_id").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user.data[0]
    if user_data["role"] not in ("staff", "manager"):
        raise HTTPException(status_code=403, detail="Access denied")

    dept_id = user_data.get("department_id")

    # Fallback: look up department via departments.manager_id
    if not dept_id:
        dept_lookup = sb.table("departments").select("id").eq("manager_id", user_id).limit(1).execute()
        if dept_lookup.data:
            dept_id = dept_lookup.data[0]["id"]

    # Get all sellers in this department (or just this seller if no department)
    if dept_id:
        staff = sb.table("users").select("id").eq("department_id", dept_id).execute()
        seller_ids = [s["id"] for s in (staff.data or [])]
        if user_id not in seller_ids:
            seller_ids.append(user_id)
    else:
        seller_ids = [user_id]

    if not seller_ids:
        return []

    txns = sb.table("product_transactions").select(
        "*, products(title, price, images)"
    ).in_("seller_id", seller_ids).in_(
        "status", ["pending", "approved", "ondeliver"]
    ).order("created_at", desc=False).execute()

    if not txns.data:
        return []

    buyer_ids = set(t["buyer_id"] for t in txns.data)
    assigned_ids = set(t["assigned_staff_id"] for t in txns.data if t.get("assigned_staff_id"))
    all_user_ids = buyer_ids | set(t["seller_id"] for t in txns.data) | assigned_ids
    users_result = sb.table("users").select("id, full_name").in_("id", list(all_user_ids)).execute()
    user_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    # Group transactions by group_id
    groups = {}
    for t in txns.data:
        gid = t.get("group_id") or t["id"]
        prod = t.get("products") or {}
        if gid not in groups:
            groups[gid] = {
                "group_id": gid,
                "buyer_id": t["buyer_id"],
                "buyer_name": user_names.get(t["buyer_id"], "Unknown"),
                "seller_name": user_names.get(t["seller_id"], "Unknown"),
                "delivery_address": t.get("delivery_address", ""),
                "status": t["status"],
                "assigned_staff_id": t.get("assigned_staff_id"),
                "assigned_staff_name": user_names.get(t.get("assigned_staff_id", ""), ""),
                "created_at": t["created_at"],
                "delivery_fee": 90.0,
                "items": [],
                "total_amount": 0.0,
            }
        groups[gid]["items"].append({
            "id": t["id"],
            "product_id": t["product_id"],
            "product_title": prod.get("title", ""),
            "product_price": float(prod.get("price", 0)),
            "product_images": prod.get("images", []),
            "quantity": int(t.get("quantity", 1)),
            "amount": float(t["amount"]),
            "status": t["status"],
        })
        groups[gid]["total_amount"] += float(t["amount"])
        status_priority = {"pending": 0, "approved": 1, "ondeliver": 2}
        if status_priority.get(t["status"], 0) > status_priority.get(groups[gid]["status"], 0):
            groups[gid]["status"] = t["status"]

    return list(groups.values())


@router.put("/manager/delivery-orders/{group_id}/status")
async def manager_update_delivery_order_status(
    group_id: str,
    req: DeliveryOrderStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Manager approves all pending transactions in a group."""
    sb = get_supabase()
    user_id = current_user["sub"]

    if req.status != "approved":
        raise HTTPException(status_code=400, detail="Status must be 'approved'")

    # Get manager's department
    user = sb.table("users").select("role, department_id").eq("id", user_id).execute()
    if not user.data or user.data[0]["role"] not in ("staff", "manager"):
        raise HTTPException(status_code=403, detail="Access denied")

    dept_id = user.data[0].get("department_id")

    # Fallback: look up department via departments.manager_id
    if not dept_id:
        dept_lookup = sb.table("departments").select("id").eq("manager_id", user_id).limit(1).execute()
        if dept_lookup.data:
            dept_id = dept_lookup.data[0]["id"]

    # Get all pending transactions in this group
    group_txns = sb.table("product_transactions").select("*").eq(
        "group_id", group_id
    ).eq("status", "pending").execute()

    # Fallback: group_id may actually be a single transaction's own id (no group_id set)
    if not group_txns.data:
        group_txns = sb.table("product_transactions").select("*").eq(
            "id", group_id
        ).eq("status", "pending").execute()

    if not group_txns.data:
        raise HTTPException(status_code=404, detail="No pending orders found in this group")

    seller_id = group_txns.data[0]["seller_id"]
    if dept_id:
        seller_info = sb.table("users").select("department_id").eq("id", seller_id).execute()
        if not seller_info.data or seller_info.data[0].get("department_id") != dept_id:
            raise HTTPException(status_code=403, detail="Order does not belong to your department")
    else:
        if seller_id != user_id:
            raise HTTPException(status_code=403, detail="Order does not belong to you")

    # Approve all pending transactions in the group
    # Use group_id filter when available; fall back to id for single (ungrouped) orders
    update_data = {"status": "approved", "assigned_staff_id": user_id}
    actual_group_id = group_txns.data[0].get("group_id")
    if actual_group_id:
        sb.table("product_transactions").update(update_data).eq("group_id", actual_group_id).eq("status", "pending").execute()
    else:
        txn_ids = [t["id"] for t in group_txns.data]
        sb.table("product_transactions").update(update_data).in_("id", txn_ids).eq("status", "pending").execute()

    return {"message": "All orders in group approved for delivery pickup"}


# --- Manager Reassign Order ---

class ReassignOrderRequest(BaseModel):
    staff_id: str


@router.put("/manager/reassign/{transaction_id}")
async def manager_reassign_order(
    transaction_id: str,
    req: ReassignOrderRequest,
    current_user: dict = Depends(get_current_user),
):
    """Manager reassigns an order to a specific staff member."""
    sb = get_supabase()
    user_id = current_user["sub"]

    # Verify manager role
    user = sb.table("users").select("role, department_id").eq("id", user_id).execute()
    if not user.data or user.data[0]["role"] != "manager":
        raise HTTPException(status_code=403, detail="Only managers can reassign orders")

    dept_id = user.data[0].get("department_id")
    if not dept_id:
        dept_lookup = sb.table("departments").select("id").eq("manager_id", user_id).limit(1).execute()
        if dept_lookup.data:
            dept_id = dept_lookup.data[0]["id"]

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    # Verify target staff belongs to same department
    target_staff = sb.table("users").select("id, department_id, full_name").eq("id", req.staff_id).execute()
    if not target_staff.data:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if target_staff.data[0].get("department_id") != dept_id:
        raise HTTPException(status_code=403, detail="Staff member is not in your department")

    # Verify transaction exists and belongs to department
    txn = sb.table("product_transactions").select("*").eq("id", transaction_id).execute()
    if not txn.data:
        raise HTTPException(status_code=404, detail="Transaction not found")

    seller_id = txn.data[0]["seller_id"]
    seller_info = sb.table("users").select("department_id").eq("id", seller_id).execute()
    if not seller_info.data or seller_info.data[0].get("department_id") != dept_id:
        raise HTTPException(status_code=403, detail="Order does not belong to your department")

    sb.table("product_transactions").update({
        "assigned_staff_id": req.staff_id,
    }).eq("id", transaction_id).execute()

    staff_name = target_staff.data[0]["full_name"]
    return {"message": f"Order reassigned to {staff_name}"}


# --- Buyer Order Cancellation ---

CANCELLATION_FEE = 50.00


@router.put("/buyer/cancel/{group_id}")
async def buyer_cancel_order(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Buyer cancels all orders in a group (delivery box).
    - Free cancel if pending/approved (not yet picked up).
    - ₱50 cancellation fee if ondeliver; fee goes to delivery user.
    """
    sb = get_supabase()
    user_id = current_user["sub"]

    # Get all transactions in this group that belong to this buyer
    group_txns = sb.table("product_transactions").select("*").eq(
        "group_id", group_id
    ).eq("buyer_id", user_id).execute()

    # Fallback: try treating group_id as a single transaction_id for backwards compat
    if not group_txns.data:
        group_txns = sb.table("product_transactions").select("*").eq(
            "id", group_id
        ).eq("buyer_id", user_id).execute()

    if not group_txns.data:
        raise HTTPException(status_code=404, detail="Order not found")

    # Determine group status (worst-case: ondeliver beats approved/pending)
    status_priority = {"pending": 0, "approved": 1, "ondeliver": 2}
    group_status = max((t["status"] for t in group_txns.data if t["status"] in status_priority), key=lambda s: status_priority.get(s, 0))

    # Cancellable only if pending, approved, or ondeliver
    if group_status not in ("pending", "approved", "ondeliver"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel order group with status '{group_status}'.")

    # Total refundable amount = sum of all item amounts + the delivery fee (from primary txn)
    total_product_amount = sum(float(t.get("amount", 0)) for t in group_txns.data)
    total_delivery_fee = sum(float(t.get("delivery_fee", 0)) for t in group_txns.data)
    grand_total = total_product_amount + total_delivery_fee

    if group_status in ("pending", "approved"):
        refund_amount = grand_total
        fee_to_delivery = 0.0
    else:  # ondeliver
        fee_to_delivery = CANCELLATION_FEE
        refund_amount = grand_total - fee_to_delivery

    # 1. Cancel all transactions in the group
    sb.table("product_transactions").update({"status": "cancelled"}).eq("group_id", group_id).eq("buyer_id", user_id).execute()

    # 2. Refund buyer
    if refund_amount > 0:
        buyer_bal = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
        if buyer_bal.data:
            new_bal = float(buyer_bal.data[0]["balance"]) + refund_amount
            sb.table("user_balances").update({"balance": new_bal}).eq("user_id", user_id).execute()

    # 3. Pay cancellation fee to delivery user (if mid-delivery cancel)
    delivery_user_id = next((t.get("delivery_user_id") for t in group_txns.data if t.get("delivery_user_id")), None)
    representative_txn_id = group_txns.data[0]["id"]

    if fee_to_delivery > 0 and delivery_user_id:
        del_bal = sb.table("user_balances").select("balance").eq("user_id", delivery_user_id).execute()
        if del_bal.data:
            new_del_bal = float(del_bal.data[0]["balance"]) + fee_to_delivery
            sb.table("user_balances").update({"balance": new_del_bal}).eq("user_id", delivery_user_id).execute()

        # Log in delivery_earnings for earnings history
        sb.table("delivery_earnings").insert({
            "delivery_user_id": delivery_user_id,
            "transaction_id": representative_txn_id,
            "amount": fee_to_delivery,
        }).execute()

    # 4. Restore product stock for all cancelled items
    for t in group_txns.data:
        prod = sb.table("products").select("stock").eq("id", t["product_id"]).execute()
        if prod.data:
            new_stock = int(prod.data[0]["stock"]) + int(t.get("quantity", 1))
            sb.table("products").update({"stock": new_stock}).eq("id", t["product_id"]).execute()

    fee_msg = f" A cancellation fee of PHP {fee_to_delivery:.2f} was deducted." if fee_to_delivery > 0 else ""
    return {
        "message": f"All orders in group cancelled. PHP {refund_amount:.2f} refunded to your wallet.{fee_msg}",
        "refund_amount": refund_amount,
        "cancellation_fee": fee_to_delivery,
    }


# --- Salary History (for staff/managers) ---

@router.get("/salary-history")
async def get_salary_history(current_user: dict = Depends(get_current_user)):
    """Get salary payment history for the current user (staff or manager)."""
    sb = get_supabase()
    user_id = current_user["sub"]

    # Verify role
    user = sb.table("users").select("role, salary").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    if user.data[0]["role"] not in ("staff", "manager"):
        raise HTTPException(status_code=403, detail="Only staff and managers can view salary history")

    fixed_salary = float(user.data[0].get("salary", 0))

    # Get all salary payments for this user
    payments = sb.table("salary_payments").select("*").eq(
        "recipient_id", user_id
    ).order("created_at", desc=True).limit(100).execute()

    # Current month paid
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    paid_this_month = sum(
        float(p["amount"]) for p in (payments.data or []) if p["payment_month"] == current_month
    )

    total_all_time = sum(float(p["amount"]) for p in (payments.data or []))

    # Build salary deposit entries
    salary_entries = []
    for p in (payments.data or []):
        salary_entries.append({
            "id": p["id"],
            "type": "salary_deposit",
            "amount": float(p["amount"]),
            "payment_month": p.get("payment_month", ""),
            "notes": p.get("notes", "Salary payment"),
            "created_at": p["created_at"],
        })

    # Get SVF withdrawal history for this user
    svf = sb.table("stored_value").select("*").eq("user_id", user_id).eq(
        "transaction_type", "withdrawal"
    ).order("created_at", desc=True).limit(100).execute()

    withdrawal_entries = []
    for w in (svf.data or []):
        withdrawal_entries.append({
            "id": w["id"],
            "type": "withdrawal",
            "amount": float(w["amount"]),
            "payment_month": "",
            "notes": "Salary withdrawal",
            "created_at": w["created_at"],
        })

    # Merge and sort by date descending
    all_transactions = salary_entries + withdrawal_entries
    all_transactions.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "fixed_salary": fixed_salary,
        "paid_this_month": round(paid_this_month, 2),
        "remaining_this_month": round(max(fixed_salary - paid_this_month, 0), 2),
        "total_all_time": round(total_all_time, 2),
        "current_month": current_month,
        "history": all_transactions,
    }
