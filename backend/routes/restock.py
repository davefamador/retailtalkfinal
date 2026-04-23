"""
Restock routes — staff requests, delivery queue, fulfillment.
Workflow: Staff Request → Manager Approval → Deliveryman Queue → Delivery → Stock Update
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from routes.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/restock", tags=["Restock"])


# --- Helpers ---

async def require_seller(current_user: dict = Depends(get_current_user)):
    """Ensure the current user is a staff member."""
    sb = get_supabase()
    result = sb.table("users").select("role, department_id").eq("id", current_user["sub"]).execute()
    if not result.data or result.data[0].get("role") != "staff":
        raise HTTPException(status_code=403, detail="Staff access required")
    current_user["department_id"] = result.data[0].get("department_id")
    return current_user


async def require_delivery(current_user: dict = Depends(get_current_user)):
    """Ensure the current user is a delivery user."""
    sb = get_supabase()
    result = sb.table("users").select("role").eq("id", current_user["sub"]).execute()
    if not result.data or result.data[0].get("role") != "delivery":
        raise HTTPException(status_code=403, detail="Delivery user access required")
    return current_user


# --- Request Models ---

class RestockRequestCreate(BaseModel):
    product_id: str
    requested_quantity: int
    notes: str = ""


class DeliveryModifyRequest(BaseModel):
    delivery_notes: str = ""


# --- Staff Routes ---

@router.post("/request")
async def create_restock_request(req: RestockRequestCreate, seller: dict = Depends(require_seller)):
    """Staff creates a restock request for one of their products."""
    sb = get_supabase()
    user_id = seller["sub"]
    dept_id = seller.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="You are not assigned to a department. Only department staff can request restocks.")

    if req.requested_quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    # Verify product belongs to this seller or their department
    product = sb.table("products").select("id, seller_id").eq("id", req.product_id).execute()
    if not product.data:
        raise HTTPException(status_code=404, detail="Product not found")
    product_seller_id = product.data[0]["seller_id"]
    if product_seller_id != user_id:
        # Allow if the product belongs to the seller's department manager
        allowed = False
        if dept_id:
            dept = sb.table("departments").select("manager_id").eq("id", dept_id).execute()
            if dept.data and dept.data[0].get("manager_id") == product_seller_id:
                allowed = True
        if not allowed:
            raise HTTPException(status_code=403, detail="You can only request restock for products in your department")

    # Create restock request
    result = sb.table("restock_requests").insert({
        "staff_id": user_id,
        "department_id": dept_id,
        "product_id": req.product_id,
        "requested_quantity": req.requested_quantity,
        "notes": req.notes,
        "status": "pending_manager",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create restock request")

    return {"message": "Restock request submitted for manager approval", "request": result.data[0]}


@router.get("/my-requests")
async def get_my_requests(seller: dict = Depends(require_seller)):
    """List all restock requests created by this staff member."""
    sb = get_supabase()
    user_id = seller["sub"]

    requests = sb.table("restock_requests").select(
        "*, products(title, price, stock, images)"
    ).eq("staff_id", user_id).order("created_at", desc=True).limit(50).execute()

    results = []
    for r in (requests.data or []):
        prod = r.get("products") or {}
        results.append({
            "id": r["id"],
            "product_id": r["product_id"],
            "product_title": prod.get("title", ""),
            "product_images": prod.get("images", []),
            "current_stock": int(prod.get("stock", 0)),
            "requested_quantity": r["requested_quantity"],
            "approved_quantity": r.get("approved_quantity"),
            "notes": r.get("notes", ""),
            "manager_notes": r.get("manager_notes", ""),
            "delivery_notes": r.get("delivery_notes", ""),
            "status": r["status"],
            "created_at": r["created_at"],
        })

    return results


# --- Delivery Routes ---

@router.get("/delivery-queue")
async def get_delivery_queue(delivery_user: dict = Depends(require_delivery)):
    """Get restock requests approved by managers, ready for delivery pickup."""
    sb = get_supabase()

    requests = sb.table("restock_requests").select(
        "*, products(title, price, stock, images)"
    ).eq("status", "approved_manager").is_("delivery_user_id", "null").order("manager_approved_at", desc=False).limit(50).execute()

    # Get staff names and department names
    staff_ids = set()
    dept_ids = set()
    for r in (requests.data or []):
        staff_ids.add(r["staff_id"])
        dept_ids.add(r["department_id"])

    staff_names = {}
    if staff_ids:
        users_result = sb.table("users").select("id, full_name").in_("id", list(staff_ids)).execute()
        staff_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    dept_names = {}
    if dept_ids:
        depts_result = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts_result.data or [])}

    results = []
    for r in (requests.data or []):
        prod = r.get("products") or {}
        qty = r.get("approved_quantity") or r["requested_quantity"]
        results.append({
            "id": r["id"],
            "staff_id": r["staff_id"],
            "staff_name": staff_names.get(r["staff_id"], "Unknown"),
            "department_id": r["department_id"],
            "department_name": dept_names.get(r["department_id"], "Unknown"),
            "product_id": r["product_id"],
            "product_title": prod.get("title", ""),
            "product_images": prod.get("images", []),
            "quantity": qty,
            "notes": r.get("notes", ""),
            "manager_notes": r.get("manager_notes", ""),
            "status": r["status"],
            "manager_approved_at": r.get("manager_approved_at", ""),
            "created_at": r["created_at"],
        })

    return results


@router.post("/{request_id}/accept")
async def accept_restock_delivery(request_id: str, delivery_user: dict = Depends(require_delivery)):
    """Deliveryman accepts a restock request."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    # Verify request is available
    restock = sb.table("restock_requests").select("*").eq("id", request_id).eq("status", "approved_manager").execute()
    if not restock.data:
        raise HTTPException(status_code=404, detail="Restock request not found or not available")

    if restock.data[0].get("delivery_user_id"):
        raise HTTPException(status_code=400, detail="This request is already assigned to another delivery user")

    sb.table("restock_requests").update({
        "status": "accepted_delivery",
        "delivery_user_id": user_id,
        "delivery_accepted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).execute()

    return {"message": "Restock delivery accepted"}


@router.put("/{request_id}/modify")
async def modify_restock_delivery(
    request_id: str,
    req: DeliveryModifyRequest,
    delivery_user: dict = Depends(require_delivery),
):
    """Deliveryman modifies delivery notes on a restock request."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    restock = sb.table("restock_requests").select("*").eq("id", request_id).eq(
        "delivery_user_id", user_id
    ).in_("status", ["accepted_delivery", "in_transit"]).execute()

    if not restock.data:
        raise HTTPException(status_code=404, detail="Restock request not found or not assigned to you")

    sb.table("restock_requests").update({
        "delivery_notes": req.delivery_notes,
    }).eq("id", request_id).execute()

    return {"message": "Delivery notes updated"}


@router.put("/{request_id}/deliver")
async def complete_restock_delivery(request_id: str, delivery_user: dict = Depends(require_delivery)):
    """Mark restock as delivered and increment product stock. Deduct ₱90 delivery fee from admin."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    RESTOCK_DELIVERY_FEE = 90.00

    restock = sb.table("restock_requests").select("*").eq("id", request_id).eq(
        "delivery_user_id", user_id
    ).in_("status", ["accepted_delivery", "in_transit"]).execute()

    if not restock.data:
        raise HTTPException(status_code=404, detail="Restock request not found or not assigned to you")

    r = restock.data[0]
    qty = r.get("approved_quantity") or r["requested_quantity"]

    # Get product info for metadata
    product = sb.table("products").select("stock, title").eq("id", r["product_id"]).execute()
    product_title = product.data[0].get("title", "Product") if product.data else "Product"

    # Increment product stock
    if product.data:
        new_stock = int(product.data[0]["stock"]) + qty
        sb.table("products").update({"stock": new_stock}).eq("id", r["product_id"]).execute()

    # Update restock request
    sb.table("restock_requests").update({
        "status": "delivered",
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).execute()

    # Get delivery person name
    delivery_user_info = sb.table("users").select("full_name").eq("id", user_id).execute()
    delivery_name = delivery_user_info.data[0]["full_name"] if delivery_user_info.data else "Deliveryman"

    # Get admin user
    admin_user = sb.table("users").select("id").eq("role", "admin").limit(1).execute()
    if admin_user.data:
        admin_id = admin_user.data[0]["id"]

        # Deduct ₱90 from admin balance
        admin_bal = sb.table("user_balances").select("balance").eq("user_id", admin_id).execute()
        if admin_bal.data:
            new_admin_bal = float(admin_bal.data[0]["balance"]) - RESTOCK_DELIVERY_FEE
            sb.table("user_balances").update({"balance": new_admin_bal}).eq("user_id", admin_id).execute()

        # Record admin SVF deduction with metadata
        sb.table("stored_value").insert({
            "user_id": admin_id,
            "transaction_type": "restock_payment",
            "amount": RESTOCK_DELIVERY_FEE,
            "metadata": {
                "restock_request_id": request_id,
                "product_title": product_title,
                "quantity": qty,
                "delivery_user_name": delivery_name,
                "delivery_user_id": user_id,
            },
        }).execute()

    # Credit ₱90 to delivery person's balance
    del_bal = sb.table("user_balances").select("balance").eq("user_id", user_id).execute()
    if del_bal.data:
        new_del_bal = float(del_bal.data[0]["balance"]) + RESTOCK_DELIVERY_FEE
        sb.table("user_balances").update({"balance": new_del_bal}).eq("user_id", user_id).execute()

    # Record delivery person SVF deposit
    sb.table("stored_value").insert({
        "user_id": user_id,
        "transaction_type": "restock_earning",
        "amount": RESTOCK_DELIVERY_FEE,
        "metadata": {
            "restock_request_id": request_id,
            "product_title": product_title,
            "quantity": qty,
        },
    }).execute()

    return {"message": f"Restock delivered. {qty} units added to product stock. ₱{RESTOCK_DELIVERY_FEE:.2f} delivery fee processed."}


@router.get("/delivery-history")
async def get_restock_delivery_history(delivery_user: dict = Depends(require_delivery)):
    """Get deliveryman's completed restock delivery history."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    requests = sb.table("restock_requests").select(
        "*, products(title, price, stock, images)"
    ).eq("delivery_user_id", user_id).in_(
        "status", ["delivered", "accepted_delivery", "in_transit"]
    ).order("delivered_at", desc=True).limit(100).execute()

    staff_ids = set()
    dept_ids = set()
    for r in (requests.data or []):
        staff_ids.add(r["staff_id"])
        dept_ids.add(r["department_id"])

    staff_names = {}
    if staff_ids:
        users_result = sb.table("users").select("id, full_name").in_("id", list(staff_ids)).execute()
        staff_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    dept_names = {}
    if dept_ids:
        depts_result = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts_result.data or [])}

    results = []
    for r in (requests.data or []):
        prod = r.get("products") or {}
        qty = r.get("approved_quantity") or r["requested_quantity"]
        results.append({
            "id": r["id"],
            "staff_name": staff_names.get(r["staff_id"], "Unknown"),
            "department_name": dept_names.get(r["department_id"], "Unknown"),
            "product_title": prod.get("title", ""),
            "product_images": prod.get("images", []),
            "quantity": qty,
            "notes": r.get("notes", ""),
            "delivery_notes": r.get("delivery_notes", ""),
            "status": r["status"],
            "delivered_at": r.get("delivered_at", ""),
            "created_at": r["created_at"],
        })

    return results


@router.get("/active-deliveries")
async def get_active_restock_deliveries(delivery_user: dict = Depends(require_delivery)):
    """Get deliveryman's active restock deliveries."""
    sb = get_supabase()
    user_id = delivery_user["sub"]

    requests = sb.table("restock_requests").select(
        "*, products(title, price, stock, images)"
    ).eq("delivery_user_id", user_id).in_(
        "status", ["accepted_delivery", "in_transit"]
    ).order("delivery_accepted_at", desc=False).execute()

    # Get staff names and department names
    staff_ids = set()
    dept_ids = set()
    for r in (requests.data or []):
        staff_ids.add(r["staff_id"])
        dept_ids.add(r["department_id"])

    staff_names = {}
    if staff_ids:
        users_result = sb.table("users").select("id, full_name").in_("id", list(staff_ids)).execute()
        staff_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    dept_names = {}
    if dept_ids:
        depts_result = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts_result.data or [])}

    results = []
    for r in (requests.data or []):
        prod = r.get("products") or {}
        qty = r.get("approved_quantity") or r["requested_quantity"]
        results.append({
            "id": r["id"],
            "staff_name": staff_names.get(r["staff_id"], "Unknown"),
            "department_name": dept_names.get(r["department_id"], "Unknown"),
            "product_title": prod.get("title", ""),
            "product_images": prod.get("images", []),
            "quantity": qty,
            "delivery_notes": r.get("delivery_notes", ""),
            "status": r["status"],
            "delivery_accepted_at": r.get("delivery_accepted_at", ""),
        })

    return results
