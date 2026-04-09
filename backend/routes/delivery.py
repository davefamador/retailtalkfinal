"""
Delivery routes — delivery user dashboard.
Available pickups, pick group, update group status, earnings, history.
Max 5 active delivery GROUPS enforced.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from routes.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/delivery", tags=["Delivery"])

MAX_ACTIVE_DELIVERIES = 5
DELIVERY_FEE = 90.00


# --- Helpers ---

async def require_delivery(current_user: dict = Depends(get_current_user)):
    """Ensure the current user is a delivery user."""
    if current_user.get("role") != "delivery":
        sb = get_supabase()
        result = sb.table("users").select("role").eq("id", current_user["sub"]).execute()
        if not result.data or result.data[0]["role"] != "delivery":
            raise HTTPException(status_code=403, detail="Delivery user access required")
    return current_user


# --- Response Models ---

class AvailableOrderResponse(BaseModel):
    group_id: str
    buyer_name: str
    buyer_contact: str = ""
    seller_name: str
    delivery_address: str = ""
    delivery_fee: float
    total_amount: float
    status: str
    created_at: str
    items: list = []


class DeliveryHistoryItem(BaseModel):
    group_id: str
    buyer_name: str
    buyer_contact: str
    seller_name: str
    delivery_address: str = ""
    delivery_fee: float
    total_amount: float
    status: str
    created_at: str
    items: list = []


class EarningsDay(BaseModel):
    date: str
    amount: float
    count: int


class TransactionHistoryItem(BaseModel):
    type: str
    date: str
    amount: float


class EarningsResponse(BaseModel):
    total_earnings: float
    total_deliveries: int
    wallet_balance: float
    daily: list[EarningsDay]
    weekly: list[EarningsDay]
    monthly: list[EarningsDay]
    daily_delivery_count: list[EarningsDay]
    weekly_delivery_count: list[EarningsDay]
    monthly_delivery_count: list[EarningsDay]
    history: list[TransactionHistoryItem] = []


class StatusUpdateRequest(BaseModel):
    status: str  # 'delivered' or 'undelivered'


class WithdrawRequest(BaseModel):
    amount: float


# --- Helper: build grouped order response ---

def _build_groups(txns_data, user_names, buyer_contacts):
    """Group transactions by group_id into delivery box structures."""
    groups = {}
    for t in txns_data:
        gid = t.get("group_id") or t["id"]
        prod = t.get("products") or {}
        if gid not in groups:
            groups[gid] = {
                "group_id": gid,
                "buyer_id": t["buyer_id"],
                "buyer_name": user_names.get(t["buyer_id"], "Unknown"),
                "buyer_contact": buyer_contacts.get(t["buyer_id"], "N/A"),
                "seller_id": t["seller_id"],
                "seller_name": user_names.get(t["seller_id"], "Unknown"),
                "delivery_address": t.get("delivery_address", ""),
                "delivery_fee": DELIVERY_FEE,
                "total_amount": 0.0,
                "status": t["status"],
                "created_at": t["created_at"],
                "items": [],
            }
        groups[gid]["items"].append({
            "transaction_id": t["id"],
            "product_id": t["product_id"],
            "product_title": prod.get("title", ""),
            "product_price": float(prod.get("price", 0)),
            "product_images": prod.get("images", []),
            "quantity": int(t.get("quantity", 1)),
            "amount": float(t["amount"]),
        })
        groups[gid]["total_amount"] += float(t["amount"])
    return list(groups.values())


# --- Routes ---

@router.get("/available", response_model=list[AvailableOrderResponse])
async def get_available_orders(delivery_user: dict = Depends(require_delivery)):
    """Get order GROUPS with all items approved, ready for pickup."""
    sb = get_supabase()

    # Fetch all approved transactions not yet assigned to a delivery user
    txns = sb.table("product_transactions").select(
        "*, products(title, price, images)"
    ).eq("status", "approved").is_("delivery_user_id", "null").order("created_at", desc=False).limit(200).execute()

    if not txns.data:
        return []

    # Build user lookups
    user_ids = set()
    for t in txns.data:
        user_ids.add(t["buyer_id"])
        user_ids.add(t["seller_id"])

    users_result = sb.table("users").select("id, full_name").in_("id", list(user_ids)).execute()
    user_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    buyer_ids = list(set(t["buyer_id"] for t in txns.data))
    contacts_result = sb.table("user_contacts").select("user_id, contact_number").in_("user_id", buyer_ids).execute()
    buyer_contacts = {c["user_id"]: c["contact_number"] for c in (contacts_result.data or [])}

    # Group and filter: only show groups where ALL items are approved
    raw_groups = {}
    for t in txns.data:
        gid = t.get("group_id") or t["id"]
        if gid not in raw_groups:
            raw_groups[gid] = {"txns": [], "all_approved": True}
        raw_groups[gid]["txns"].append(t)

    # Also check if any transaction in this group has a non-approved status (leftover pending items)
    result_groups = []
    for gid, gdata in raw_groups.items():
        group_txns = gdata["txns"]
        # Check for any pending items in the same group (e.g. buyer added another item just now)
        pending_check = sb.table("product_transactions").select("id", count="exact").eq(
            "group_id", gid
        ).eq("status", "pending").execute()
        if (pending_check.count or 0) > 0:
            continue  # Skip — group still has pending items

        # Build item list
        buyer_id = group_txns[0]["buyer_id"]
        seller_id = group_txns[0]["seller_id"]
        items = []
        total_amount = 0.0
        for t in group_txns:
            prod = t.get("products") or {}
            items.append({
                "transaction_id": t["id"],
                "product_id": t["product_id"],
                "product_title": prod.get("title", ""),
                "product_price": float(prod.get("price", 0)),
                "product_images": prod.get("images", []),
                "quantity": int(t.get("quantity", 1)),
                "amount": float(t["amount"]),
            })
            total_amount += float(t["amount"])

        result_groups.append(AvailableOrderResponse(
            group_id=gid,
            buyer_name=user_names.get(buyer_id, "Unknown"),
            buyer_contact=buyer_contacts.get(buyer_id, "N/A"),
            seller_name=user_names.get(seller_id, "Unknown"),
            delivery_address=group_txns[0].get("delivery_address", ""),
            delivery_fee=DELIVERY_FEE,
            total_amount=round(total_amount, 2),
            status="approved",
            created_at=group_txns[0]["created_at"],
            items=items,
        ))

    return result_groups


@router.get("/active", response_model=list[AvailableOrderResponse])
async def get_active_deliveries(delivery_user: dict = Depends(require_delivery)):
    """Get delivery user's current active delivery groups (status='ondeliver')."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    txns = sb.table("product_transactions").select(
        "*, products(title, price, images)"
    ).eq("delivery_user_id", user_id).eq("status", "ondeliver").order("created_at", desc=False).execute()

    if not txns.data:
        return []

    user_ids = set()
    for t in txns.data:
        user_ids.add(t["buyer_id"])
        user_ids.add(t["seller_id"])

    users_result = sb.table("users").select("id, full_name").in_("id", list(user_ids)).execute()
    user_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    buyer_ids = list(set(t["buyer_id"] for t in txns.data))
    contacts_result = sb.table("user_contacts").select("user_id, contact_number").in_("user_id", buyer_ids).execute()
    buyer_contacts = {c["user_id"]: c["contact_number"] for c in (contacts_result.data or [])}

    groups = {}
    for t in txns.data:
        gid = t.get("group_id") or t["id"]
        prod = t.get("products") or {}
        if gid not in groups:
            groups[gid] = {
                "group_id": gid,
                "buyer_name": user_names.get(t["buyer_id"], "Unknown"),
                "buyer_contact": buyer_contacts.get(t["buyer_id"], "N/A"),
                "seller_name": user_names.get(t["seller_id"], "Unknown"),
                "delivery_address": t.get("delivery_address", ""),
                "delivery_fee": DELIVERY_FEE,
                "total_amount": 0.0,
                "status": "ondeliver",
                "created_at": t["created_at"],
                "items": [],
            }
        groups[gid]["items"].append({
            "transaction_id": t["id"],
            "product_id": t["product_id"],
            "product_title": prod.get("title", ""),
            "product_price": float(prod.get("price", 0)),
            "product_images": prod.get("images", []),
            "quantity": int(t.get("quantity", 1)),
            "amount": float(t["amount"]),
        })
        groups[gid]["total_amount"] += float(t["amount"])

    return [
        AvailableOrderResponse(**g)
        for g in groups.values()
    ]


@router.post("/pick/{group_id}")
async def pick_order(group_id: str, delivery_user: dict = Depends(require_delivery)):
    """Pick an entire group for delivery. Max 5 active groups."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    # Check contact number
    contact = sb.table("user_contacts").select("contact_number").eq("user_id", user_id).execute()
    if not contact.data:
        raise HTTPException(status_code=400, detail="Please add your contact number before accepting deliveries")

    # Count active delivery GROUPS (not individual transactions)
    active_groups_result = sb.table("product_transactions").select("id, group_id").eq(
        "delivery_user_id", user_id
    ).eq("status", "ondeliver").execute()
    active_group_ids = set(
        t.get("group_id") or t["id"]
        for t in (active_groups_result.data or [])
    )
    if len(active_group_ids) >= MAX_ACTIVE_DELIVERIES:
        raise HTTPException(
            status_code=400,
            detail=f"You already have {MAX_ACTIVE_DELIVERIES} active delivery groups. Complete some before picking more."
        )

    # Verify all transactions in the group are approved and unassigned
    used_fallback = False
    group_txns = sb.table("product_transactions").select("*").eq(
        "group_id", group_id
    ).execute()

    if not group_txns.data:
        # Fallback: treat as single transaction_id
        group_txns = sb.table("product_transactions").select("*").eq(
            "id", group_id
        ).execute()
        used_fallback = True

    if not group_txns.data:
        raise HTTPException(status_code=404, detail="Order group not found")

    for t in group_txns.data:
        if t["status"] != "approved":
            raise HTTPException(status_code=400, detail=f"Order group is not fully approved yet (status: {t['status']})")
        if t.get("delivery_user_id"):
            raise HTTPException(status_code=400, detail="This order group is already assigned to another delivery user")

    # Assign all transactions in group to delivery user
    if used_fallback:
        sb.table("product_transactions").update({
            "delivery_user_id": user_id,
            "status": "ondeliver",
        }).eq("id", group_id).execute()
    else:
        sb.table("product_transactions").update({
            "delivery_user_id": user_id,
            "status": "ondeliver",
        }).eq("group_id", group_id).execute()

    return {"message": "Order group picked up! Deliver all items to the buyer."}


@router.put("/status/{group_id}")
async def update_delivery_status(
    group_id: str,
    req: StatusUpdateRequest,
    delivery_user: dict = Depends(require_delivery),
):
    """Update delivery status to 'delivered' or 'undelivered' for an entire group."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    if req.status not in ("delivered", "undelivered"):
        raise HTTPException(status_code=400, detail="Status must be 'delivered' or 'undelivered'")

    # Verify this group belongs to this delivery user
    used_fallback = False
    group_txns = sb.table("product_transactions").select("*").eq(
        "group_id", group_id
    ).eq("delivery_user_id", user_id).eq("status", "ondeliver").execute()

    # Fallback: treat as single transaction_id
    if not group_txns.data:
        group_txns = sb.table("product_transactions").select("*").eq(
            "id", group_id
        ).eq("delivery_user_id", user_id).eq("status", "ondeliver").execute()
        used_fallback = True

    if not group_txns.data:
        raise HTTPException(status_code=404, detail="Order group not found or not assigned to you")

    # Update all transactions in group
    if used_fallback:
        sb.table("product_transactions").update({"status": req.status}).eq("id", group_id).eq("delivery_user_id", user_id).execute()
    else:
        sb.table("product_transactions").update({"status": req.status}).eq("group_id", group_id).eq("delivery_user_id", user_id).execute()

    buyer_id = group_txns.data[0]["buyer_id"]
    representative_txn_id = group_txns.data[0]["id"]

    if req.status == "undelivered":
        # Refund buyer: sum of all amounts + delivery fee
        total_refund = sum(
            float(t.get("amount", 0)) + float(t.get("delivery_fee", 0))
            for t in group_txns.data
        )
        buyer_bal = sb.table("user_balances").select("balance").eq("user_id", buyer_id).execute()
        if buyer_bal.data:
            new_buyer_bal = float(buyer_bal.data[0]["balance"]) + total_refund
            sb.table("user_balances").update({"balance": new_buyer_bal}).eq("user_id", buyer_id).execute()

        # Log refund
        sb.table("stored_value").insert({
            "user_id": buyer_id,
            "transaction_type": "deposit",
            "amount": total_refund,
        }).execute()

        # Restore product stock for each item
        for t in group_txns.data:
            product = sb.table("products").select("stock").eq("id", t["product_id"]).execute()
            if product.data:
                current_stock = int(product.data[0].get("stock", 0))
                new_stock = current_stock + int(t.get("quantity", 1))
                sb.table("products").update({"stock": new_stock}).eq("id", t["product_id"]).execute()

    if req.status == "delivered":
        # Delivery fee: ₱90 flat per group goes to delivery user
        sb.table("delivery_earnings").insert({
            "delivery_user_id": user_id,
            "transaction_id": representative_txn_id,
            "amount": DELIVERY_FEE,
        }).execute()
        del_bal = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
        if del_bal.data:
            new_del_bal = float(del_bal.data[0]["balance"]) + DELIVERY_FEE
            sb.table("user_balances").update({"balance": new_del_bal}).eq("user_id", user_id).execute()

        # Admin gets the total product amount for all items in the group
        total_product_amount = sum(float(t.get("amount", 0)) for t in group_txns.data)
        sb.table("admin_earnings").insert({
            "transaction_id": representative_txn_id,
            "amount": total_product_amount,
        }).execute()
        admin_user = sb.table("users").select("id").eq("role", "admin").limit(1).execute()
        if admin_user.data:
            admin_id = admin_user.data[0]["id"]
            admin_bal = sb.table("user_balances").select("balance").eq("user_id", admin_id).execute()
            if admin_bal.data:
                new_admin_bal = float(admin_bal.data[0]["balance"]) + total_product_amount
                sb.table("user_balances").update({"balance": new_admin_bal}).eq("user_id", admin_id).execute()

    status_msg = "delivered" if req.status == "delivered" else "marked as undelivered"
    return {"message": f"Order group {status_msg} successfully!"}


@router.get("/earnings", response_model=EarningsResponse)
async def get_earnings(delivery_user: dict = Depends(require_delivery)):
    """Get delivery earnings with daily/weekly/monthly breakdowns for graphs."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    # Get all earnings
    earnings = sb.table("delivery_earnings").select("*").eq(
        "delivery_user_id", user_id
    ).order("created_at", desc=True).execute()

    # Get wallet balance
    bal = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    wallet_balance = float(bal.data[0]["balance"]) if bal.data else 0.0

    all_data = earnings.data or []
    total_earnings = sum(float(e["amount"]) for e in all_data)
    total_deliveries = len(all_data)

    # Build time-series data
    daily_data = {}
    weekly_data = {}
    monthly_data = {}

    for e in all_data:
        try:
            dt = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
            day_key = dt.strftime("%Y-%m-%d")
            week_start = dt - timedelta(days=dt.weekday())
            week_key = week_start.strftime("%Y-%m-%d")
            month_key = dt.strftime("%Y-%m")
        except Exception:
            day_key = e["created_at"][:10]
            week_key = e["created_at"][:10]
            month_key = e["created_at"][:7]

        amt = float(e["amount"])

        if day_key not in daily_data:
            daily_data[day_key] = {"amount": 0, "count": 0}
        daily_data[day_key]["amount"] += amt
        daily_data[day_key]["count"] += 1

        if week_key not in weekly_data:
            weekly_data[week_key] = {"amount": 0, "count": 0}
        weekly_data[week_key]["amount"] += amt
        weekly_data[week_key]["count"] += 1

        if month_key not in monthly_data:
            monthly_data[month_key] = {"amount": 0, "count": 0}
        monthly_data[month_key]["amount"] += amt
        monthly_data[month_key]["count"] += 1

    def to_list(data):
        return sorted(
            [EarningsDay(date=k, amount=round(v["amount"], 2), count=v["count"]) for k, v in data.items()],
            key=lambda x: x.date, reverse=True
        )[:30]

    withdrawals = sb.table("stored_value").select("*").eq("user_id", user_id).execute()
    hist = []
    for e in all_data:
        hist.append(TransactionHistoryItem(
            type="Delivery Fee",
            date=e["created_at"],
            amount=float(e["amount"])
        ))
    for w in withdrawals.data or []:
        if w.get("amount"):
            # A withdrawal is a deduction from the delivery wallet
            ttype = w.get("transaction_type", "Withdrawal").capitalize()
            hist.append(TransactionHistoryItem(
                type=ttype,
                date=w["created_at"],
                amount=abs(float(w["amount"]))
            ))
    hist.sort(key=lambda x: x.date, reverse=True)

    return EarningsResponse(
        total_earnings=round(total_earnings, 2),
        total_deliveries=total_deliveries,
        wallet_balance=round(wallet_balance, 2),
        daily=to_list(daily_data),
        weekly=to_list(weekly_data),
        monthly=to_list(monthly_data),
        daily_delivery_count=to_list(daily_data),
        weekly_delivery_count=to_list(weekly_data),
        monthly_delivery_count=to_list(monthly_data),
        history=hist
    )


@router.get("/history", response_model=list[DeliveryHistoryItem])
async def get_delivery_history(delivery_user: dict = Depends(require_delivery)):
    """Get delivery history grouped by group_id."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    txns = sb.table("product_transactions").select(
        "*, products(title, price, images)"
    ).eq("delivery_user_id", user_id).in_(
        "status", ["delivered", "undelivered", "ondeliver"]
    ).order("created_at", desc=True).limit(200).execute()

    if not txns.data:
        return []

    user_ids = set()
    for t in txns.data:
        user_ids.add(t["buyer_id"])
        user_ids.add(t["seller_id"])

    users_result = sb.table("users").select("id, full_name").in_("id", list(user_ids)).execute()
    user_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    contacts_result = sb.table("user_contacts").select("user_id, contact_number").in_(
        "user_id", list(user_ids)
    ).execute()
    user_contacts = {c["user_id"]: c["contact_number"] for c in (contacts_result.data or [])}

    groups = {}
    for t in txns.data:
        gid = t.get("group_id") or t["id"]
        prod = t.get("products") or {}
        if gid not in groups:
            groups[gid] = {
                "group_id": gid,
                "buyer_name": user_names.get(t["buyer_id"], "Unknown"),
                "buyer_contact": user_contacts.get(t["buyer_id"], "N/A"),
                "seller_name": user_names.get(t["seller_id"], "Unknown"),
                "delivery_address": t.get("delivery_address", ""),
                "delivery_fee": DELIVERY_FEE,
                "total_amount": 0.0,
                "status": t["status"],
                "created_at": t["created_at"],
                "items": [],
            }
        groups[gid]["items"].append({
            "transaction_id": t["id"],
            "product_title": prod.get("title", ""),
            "product_price": float(prod.get("price", 0)),
            "product_images": prod.get("images", []),
            "quantity": int(t.get("quantity", 1)),
            "amount": float(t["amount"]),
        })
        groups[gid]["total_amount"] += float(t["amount"])

    return [DeliveryHistoryItem(**g) for g in groups.values()]


@router.post("/withdraw")
async def withdraw_earnings(req: WithdrawRequest, delivery_user: dict = Depends(require_delivery)):
    """Withdraw earnings from delivery wallet."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    bal = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    if not bal.data:
        raise HTTPException(status_code=404, detail="Balance not found")

    current = float(bal.data[0]["balance"])
    if current < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    new_bal = current - req.amount
    sb.table("user_balances").update({"balance": new_bal}).eq("user_id", user_id).execute()

    sb.table("stored_value").insert({
        "user_id": user_id,
        "transaction_type": "withdrawal",
        "amount": req.amount,
    }).execute()

    return {"message": f"Withdrew PHP {req.amount:.2f}", "balance": round(new_bal, 2)}
