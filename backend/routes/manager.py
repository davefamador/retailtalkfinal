"""
Manager routes — department management, staff CRUD, restock approval.
Only accessible by manager users (role='manager').
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from routes.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/manager", tags=["Manager"])


# --- Helpers ---

async def require_manager(current_user: dict = Depends(get_current_user)):
    """Dependency that ensures the current user is a manager."""
    sb = get_supabase()
    result = sb.table("users").select("role, department_id").eq("id", current_user["sub"]).execute()
    if not result.data or result.data[0].get("role") != "manager":
        raise HTTPException(status_code=403, detail="Manager access required")
    current_user["department_id"] = result.data[0].get("department_id")
    return current_user


# --- Request/Response Models ---

class StaffRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    contact_number: str = ""


class RestockApproveRequest(BaseModel):
    approved_quantity: Optional[int] = None
    manager_notes: str = ""


class RestockRejectRequest(BaseModel):
    manager_notes: str = ""


# --- Routes ---

@router.get("/dashboard")
async def manager_dashboard(manager: dict = Depends(require_manager)):
    """Get manager dashboard stats for their department."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    # Department info
    dept = sb.table("departments").select("*").eq("id", dept_id).execute()
    dept_info = dept.data[0] if dept.data else {}

    # Staff count
    staff = sb.table("users").select("id", count="exact").eq("department_id", dept_id).eq("role", "seller").execute()

    # Products in department (via staff + manager themselves)
    staff_ids_result = sb.table("users").select("id").eq("department_id", dept_id).eq("role", "seller").execute()
    staff_ids = [s["id"] for s in (staff_ids_result.data or [])]
    manager_id = manager["sub"]
    if manager_id not in staff_ids:
        staff_ids.append(manager_id)

    total_products = 0
    total_revenue = 0
    daily_sales = {}
    weekly_sales = {}
    monthly_sales = {}
    buyer_ids = set()
    delivery_ids = set()

    if staff_ids:
        products = sb.table("products").select("id", count="exact").in_("seller_id", staff_ids).execute()
        total_products = products.count or 0

        # Revenue from transactions
        txns = sb.table("product_transactions").select("buyer_id, delivery_user_id, amount, seller_amount, created_at, purchase_type").in_(
            "seller_id", staff_ids
        ).in_("status", ["delivered", "completed"]).execute()

        for t in (txns.data or []):
            amt = float(t.get("seller_amount", 0))
            total_revenue += amt
            if t.get("buyer_id"):
                buyer_ids.add(t["buyer_id"])
            if t.get("delivery_user_id"):
                delivery_ids.add(t["delivery_user_id"])

            try:
                dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
                day_key = dt.strftime("%Y-%m-%d")
                week_start = dt - timedelta(days=dt.weekday())
                week_key = week_start.strftime("%Y-%m-%d")
                month_key = dt.strftime("%Y-%m")
            except Exception:
                day_key = t["created_at"][:10]
                week_key = t["created_at"][:10]
                month_key = t["created_at"][:7]

            for data, key in [(daily_sales, day_key), (weekly_sales, week_key), (monthly_sales, month_key)]:
                if key not in data:
                    data[key] = {"amount": 0, "count": 0}
                data[key]["amount"] += amt
                data[key]["count"] += 1

    def to_list(data):
        return sorted(
            [{"date": k, "amount": round(v["amount"], 2), "count": v["count"]} for k, v in data.items()],
            key=lambda x: x["date"], reverse=True
        )[:30]

    # Pending restock requests
    pending_restocks = sb.table("restock_requests").select("id", count="exact").eq(
        "department_id", dept_id
    ).eq("status", "pending_manager").execute()

    return {
        "department": dept_info,
        "total_staff": staff.count or 0,
        "total_products": total_products,
        "total_revenue": round(total_revenue, 2),
        "pending_restocks": pending_restocks.count or 0,
        "daily_sales": to_list(daily_sales),
        "weekly_sales": to_list(weekly_sales),
        "monthly_sales": to_list(monthly_sales),
        "store_buyers": len(buyer_ids),
        "store_staff": staff.count or 0,
        "store_managers": 1,
        "store_delivery": len(delivery_ids),
    }


@router.get("/staff")
async def list_staff(
    search: str = Query("", description="Search by name or email"),
    manager: dict = Depends(require_manager),
):
    """List all staff in the manager's department."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    query = sb.table("users").select("*").eq(
        "department_id", dept_id
    ).eq("role", "seller")

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")

    result = query.order("created_at", desc=True).execute()

    all_staff_ids = [u["id"] for u in (result.data or [])]

    # Batch-fetch completed transaction stats for all staff
    staff_stats = {}
    if all_staff_ids:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        completed_statuses = ["completed", "delivered"]

        # Fetch completed transactions for all staff (assigned or legacy seller_id)
        txns = sb.table("product_transactions").select(
            "assigned_staff_id, seller_id, status, quantity, purchase_type, created_at"
        ).in_("status", completed_statuses).execute()

        for t in (txns.data or []):
            # Determine which staff this belongs to
            staff_id = t.get("assigned_staff_id") or t.get("seller_id")
            if staff_id not in all_staff_ids:
                continue

            if staff_id not in staff_stats:
                staff_stats[staff_id] = {
                    "total_completed_tasks": 0,
                    "tasks_completed_today": 0,
                    "delivery_items_today": 0,
                }
            stats = staff_stats[staff_id]
            qty = int(t.get("quantity", 1))
            stats["total_completed_tasks"] += 1

            try:
                dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
                day_key = dt.strftime("%Y-%m-%d")
            except Exception:
                day_key = t["created_at"][:10]

            if day_key == today_str:
                stats["tasks_completed_today"] += 1
                stats["delivery_items_today"] += qty

    staff_list = []
    for u in (result.data or []):
        uid = u["id"]
        s = staff_stats.get(uid, {})
        staff_list.append({
            "id": uid,
            "email": u["email"],
            "full_name": u["full_name"],
            "role": u["role"],
            "is_banned": u.get("is_banned", False),
            "created_at": u["created_at"],
            "total_completed_tasks": s.get("total_completed_tasks", 0),
            "tasks_completed_today": s.get("tasks_completed_today", 0),
            "delivery_items_today": s.get("delivery_items_today", 0),
        })

    return staff_list


@router.post("/staff/register")
async def register_staff(req: StaffRegisterRequest, manager: dict = Depends(require_manager)):
    """Manager creates a new staff (seller) account in their department."""
    import bcrypt
    import traceback

    try:
        sb = get_supabase()
        dept_id = manager.get("department_id")
        manager_id = manager["sub"]

        if not dept_id:
            raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

        # Check unique email
        existing_email = sb.table("users").select("id").eq("email", req.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Check unique full_name
        existing_name = sb.table("users").select("id").eq("full_name", req.full_name).execute()
        if existing_name.data:
            raise HTTPException(status_code=400, detail="Full name already taken")

        # Check unique contact_number if provided
        if req.contact_number:
            existing_contact = sb.table("user_contacts").select("user_id").eq("contact_number", req.contact_number).execute()
            if existing_contact.data:
                raise HTTPException(status_code=400, detail="Contact number already registered")

        # Hash password
        password_hash = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # Create user with seller role and department assignment
        result = sb.table("users").insert({
            "email": req.email,
            "password_hash": password_hash,
            "full_name": req.full_name,
            "role": "seller",
            "is_banned": False,
            "department_id": dept_id,
            "manager_id": manager_id,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create staff user")

        user = result.data[0]

        # Create contact if provided
        if req.contact_number:
            sb.table("user_contacts").insert({"user_id": user["id"], "contact_number": req.contact_number}).execute()

        return {
            "message": "Staff registered successfully",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": "seller",
                "department_id": dept_id,
                "contact_number": req.contact_number,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[StaffRegister] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.get("/staff/{user_id}/detail")
async def get_staff_detail(user_id: str, manager: dict = Depends(require_manager)):
    """Get detailed info about a staff member in the manager's department."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    # Verify staff belongs to manager's department
    user_resp = sb.table("users").select("*, user_contacts(contact_number)").eq("id", user_id).execute()
    if not user_resp.data:
        raise HTTPException(status_code=404, detail="User not found")

    u = user_resp.data[0]
    if u.get("department_id") != dept_id:
        raise HTTPException(status_code=403, detail="This user is not in your department")

    contact = ""
    if u.get("user_contacts"):
        if isinstance(u["user_contacts"], list) and len(u["user_contacts"]) > 0:
            contact = u["user_contacts"][0].get("contact_number", "")
        elif isinstance(u["user_contacts"], dict):
            contact = u["user_contacts"].get("contact_number", "")

    # Transactions — use assigned_staff_id for accuracy, fallback to seller_id for legacy
    assigned_txns = sb.table("product_transactions").select("*, products(title, images)").eq(
        "assigned_staff_id", user_id
    ).order("created_at", desc=True).limit(100).execute()

    legacy_txns = sb.table("product_transactions").select("*, products(title, images)").eq(
        "seller_id", user_id
    ).is_("assigned_staff_id", "null").order("created_at", desc=True).limit(100).execute()

    # Merge and deduplicate
    seen_ids = set()
    all_txns = []
    for t in (assigned_txns.data or []) + (legacy_txns.data or []):
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
            all_txns.append(t)
    all_txns.sort(key=lambda x: x["created_at"], reverse=True)

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    completed_statuses = ("completed", "delivered")

    daily_data = {}
    monthly_data = {}
    completed_count = 0
    total_items = 0
    today_tasks = 0
    delivery_items_today = 0
    products_handled = {}

    for t in all_txns:
        amt = float(t["amount"])
        qty = int(t.get("quantity", 1))
        status = t["status"]
        purchase_type = t.get("purchase_type", "delivery")
        is_completed = status in completed_statuses

        try:
            dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
            day_key = dt.strftime("%Y-%m-%d")
            month_key = dt.strftime("%Y-%m")
        except Exception:
            day_key = t["created_at"][:10]
            month_key = t["created_at"][:7]

        # Daily data with delivery breakdown
        if day_key not in daily_data:
            daily_data[day_key] = {"amount": 0, "count": 0, "delivery_items": 0}
        daily_data[day_key]["amount"] += amt
        daily_data[day_key]["count"] += 1
        if is_completed:
            daily_data[day_key]["delivery_items"] += qty

        # Monthly data
        if month_key not in monthly_data:
            monthly_data[month_key] = {"amount": 0, "count": 0}
        monthly_data[month_key]["amount"] += amt
        monthly_data[month_key]["count"] += 1

        # Completion metrics
        if is_completed:
            completed_count += 1
            total_items += qty
            if day_key == today_str:
                today_tasks += 1
                delivery_items_today += qty

            # Track recent products handled
            pid = t["product_id"]
            prod_info = t.get("products") or {}
            if pid not in products_handled:
                products_handled[pid] = {
                    "product_id": pid,
                    "product_title": prod_info.get("title", ""),
                    "product_image": ((prod_info.get("images") or [""])[0]) if prod_info.get("images") else "",
                    "quantity_processed": 0,
                    "last_handled": t["created_at"],
                    "purchase_type": purchase_type,
                }
            products_handled[pid]["quantity_processed"] += qty

    daily = sorted(
        [{"date": k, "amount": round(v["amount"], 2), "count": v["count"],
          "delivery_items": v["delivery_items"]}
         for k, v in daily_data.items()],
        key=lambda x: x["date"], reverse=True
    )[:30]

    monthly = sorted(
        [{"date": k, "amount": round(v["amount"], 2), "count": v["count"]} for k, v in monthly_data.items()],
        key=lambda x: x["date"], reverse=True
    )[:12]

    recent_products_handled = sorted(
        products_handled.values(), key=lambda x: x["last_handled"], reverse=True
    )[:20]

    # Products
    prods = sb.table("products").select("id, title, price, stock, images, is_active, created_at").eq("seller_id", user_id).order("created_at", desc=True).limit(50).execute()
    products = [
        {
            "id": p["id"],
            "title": p["title"],
            "price": float(p["price"]),
            "stock": int(p.get("stock", 0)),
            "image_url": (p.get("images") or [""])[0] if p.get("images") else "",
            "is_active": p["is_active"],
            "created_at": p["created_at"],
        }
        for p in (prods.data or [])
    ]

    return {
        "user": {
            "id": u["id"],
            "email": u["email"],
            "full_name": u["full_name"],
            "role": u["role"],
            "is_banned": u.get("is_banned", False),
            "contact_number": contact,
            "created_at": u["created_at"],
        },
        "report": {
            "total_transactions": len(all_txns),
            "total_amount": round(sum(float(t["amount"]) for t in all_txns), 2),
            "total_completed_tasks": completed_count,
            "total_items_processed": total_items,
            "tasks_completed_today": today_tasks,
            "delivery_items_today": delivery_items_today,
            "daily": daily,
            "monthly": monthly,
        },
        "products": products,
        "recent_products_handled": recent_products_handled,
    }


# --- Restock Approval ---

@router.get("/restock-requests")
async def get_restock_requests(
    status: str = Query("", description="Filter by status. Empty returns all."),
    manager: dict = Depends(require_manager),
):
    """Get restock requests for the manager's department."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    query = sb.table("restock_requests").select(
        "*, products(title, price, stock, images)"
    ).eq("department_id", dept_id)

    if status:
        query = query.eq("status", status)

    requests = query.order("created_at", desc=True).execute()

    # Get staff names
    staff_ids = set(r["staff_id"] for r in (requests.data or []))
    staff_names = {}
    if staff_ids:
        users_result = sb.table("users").select("id, full_name").in_("id", list(staff_ids)).execute()
        staff_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    results = []
    for r in (requests.data or []):
        prod = r.get("products") or {}
        results.append({
            "id": r["id"],
            "staff_id": r["staff_id"],
            "staff_name": staff_names.get(r["staff_id"], "Unknown"),
            "product_id": r["product_id"],
            "product_title": prod.get("title", ""),
            "product_images": prod.get("images", []),
            "product_price": float(prod.get("price", 0)),
            "current_stock": int(prod.get("stock", 0)),
            "requested_quantity": r["requested_quantity"],
            "approved_quantity": r.get("approved_quantity"),
            "notes": r.get("notes", ""),
            "manager_notes": r.get("manager_notes", ""),
            "status": r["status"],
            "created_at": r["created_at"],
        })

    return results


@router.put("/restock-requests/{request_id}/approve")
async def approve_restock(
    request_id: str,
    req: RestockApproveRequest,
    manager: dict = Depends(require_manager),
):
    """Approve a restock request. Moves to deliveryman queue."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    # Verify request belongs to department and is pending
    restock = sb.table("restock_requests").select("*").eq("id", request_id).eq(
        "department_id", dept_id
    ).eq("status", "pending_manager").execute()

    if not restock.data:
        raise HTTPException(status_code=404, detail="Restock request not found or already processed")

    update_data = {
        "status": "approved_manager",
        "manager_approved_at": datetime.now(timezone.utc).isoformat(),
        "manager_notes": req.manager_notes,
    }

    if req.approved_quantity is not None:
        update_data["approved_quantity"] = req.approved_quantity
    else:
        update_data["approved_quantity"] = restock.data[0]["requested_quantity"]

    sb.table("restock_requests").update(update_data).eq("id", request_id).execute()

    return {"message": "Restock request approved and moved to delivery queue"}


@router.put("/restock-requests/{request_id}/reject")
async def reject_restock(
    request_id: str,
    req: RestockRejectRequest,
    manager: dict = Depends(require_manager),
):
    """Reject a restock request."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    restock = sb.table("restock_requests").select("*").eq("id", request_id).eq(
        "department_id", dept_id
    ).eq("status", "pending_manager").execute()

    if not restock.data:
        raise HTTPException(status_code=404, detail="Restock request not found or already processed")

    sb.table("restock_requests").update({
        "status": "rejected_manager",
        "manager_notes": req.manager_notes,
    }).eq("id", request_id).execute()

    return {"message": "Restock request rejected"}


class ChangePasswordRequest(BaseModel):
    new_password: str


@router.put("/staff/{user_id}/change-password")
async def manager_change_staff_password(user_id: str, req: ChangePasswordRequest, manager: dict = Depends(require_manager)):
    """Manager changes a staff member's password."""
    import bcrypt
    sb = get_supabase()
    dept_id = manager.get("department_id")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Verify user belongs to this manager's department
    target = sb.table("users").select("id, role, department_id").eq("id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")
    if target.data[0].get("department_id") != dept_id:
        raise HTTPException(status_code=403, detail="This user is not in your department")

    password_hash = bcrypt.hashpw(req.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    sb.table("users").update({"password_hash": password_hash}).eq("id", user_id).execute()

    return {"message": "Password updated successfully"}


class RestockDirectRequest(BaseModel):
    product_id: str
    quantity: int
    notes: str = ""


@router.post("/restock-direct")
async def create_restock_direct(req: RestockDirectRequest, manager: dict = Depends(require_manager)):
    """Manager directly creates a restock request pre-approved for delivery queue."""
    sb = get_supabase()
    user_id = manager["sub"]
    dept_id = manager.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="You are not assigned to a department")
    if req.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    product = sb.table("products").select("id, seller_id").eq("id", req.product_id).execute()
    if not product.data:
        raise HTTPException(status_code=404, detail="Product not found")

    result = sb.table("restock_requests").insert({
        "staff_id": user_id,
        "department_id": dept_id,
        "product_id": req.product_id,
        "requested_quantity": req.quantity,
        "approved_quantity": req.quantity,
        "notes": req.notes,
        "status": "approved_manager",
        "manager_approved_at": datetime.now(timezone.utc).isoformat(),
        "manager_notes": "Direct restock order by manager",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create restock request")

    return {"message": "Restock order sent to delivery queue", "request": result.data[0]}


# --- Department Products & Transactions ---

@router.get("/products")
async def list_department_products(
    search: str = Query("", description="Search by product title"),
    manager: dict = Depends(require_manager),
):
    """List all products from staff in the manager's department."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    # Get all staff in department + the manager themselves (managers create products)
    staff_result = sb.table("users").select("id, full_name").eq("department_id", dept_id).eq("role", "seller").execute()
    staff_ids = [s["id"] for s in (staff_result.data or [])]
    staff_names = {s["id"]: s["full_name"] for s in (staff_result.data or [])}

    # Include manager's own products (managers create products with their own ID as seller_id)
    manager_id = manager["sub"]
    if manager_id not in staff_ids:
        staff_ids.append(manager_id)
        # Get manager's name for display
        mgr_user = sb.table("users").select("full_name").eq("id", manager_id).execute()
        if mgr_user.data:
            staff_names[manager_id] = mgr_user.data[0]["full_name"]

    if not staff_ids:
        return []

    query = sb.table("products").select("*").in_("seller_id", staff_ids).order("created_at", desc=True)

    if search:
        query = query.ilike("title", f"%{search}%")

    result = query.execute()

    return [
        {
            "id": p["id"],
            "title": p["title"],
            "description": p.get("description", ""),
            "price": float(p["price"]),
            "stock": int(p.get("stock", 0)),
            "images": p.get("images") or [],
            "is_active": p.get("is_active", True),
            "status": p.get("status", "pending"),
            "seller_id": p["seller_id"],
            "seller_name": staff_names.get(p["seller_id"], "Unknown"),
            "created_at": p["created_at"],
        }
        for p in (result.data or [])
    ]


@router.put("/products/{product_id}")
async def update_department_product(product_id: str, req: dict, manager: dict = Depends(require_manager)):
    """Update a product in the manager's department (images, title, price, etc.)."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    # Get all seller IDs in this department + manager themselves
    staff_result = sb.table("users").select("id").eq("department_id", dept_id).eq("role", "seller").execute()
    allowed_ids = [s["id"] for s in (staff_result.data or [])]
    allowed_ids.append(manager["sub"])

    existing = sb.table("products").select("seller_id").eq("id", product_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing.data[0]["seller_id"] not in allowed_ids:
        raise HTTPException(status_code=403, detail="Product not in your department")

    update_data = {k: v for k, v in req.items() if k is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    result = sb.table("products").update(update_data).eq("id", product_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Update failed")
    return {"message": "Product updated successfully"}


@router.get("/transactions")
async def list_department_transactions(
    search: str = Query("", description="Search by buyer or product"),
    manager: dict = Depends(require_manager),
):
    """List all transactions from staff in the manager's department."""
    sb = get_supabase()
    dept_id = manager.get("department_id")

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    # Get all staff in department + manager themselves
    staff_result = sb.table("users").select("id, full_name").eq("department_id", dept_id).eq("role", "seller").execute()
    staff_ids = [s["id"] for s in (staff_result.data or [])]

    # Include manager's own ID (managers can create products with their own seller_id)
    manager_id = manager["sub"]
    if manager_id not in staff_ids:
        staff_ids.append(manager_id)

    if not staff_ids:
        return []

    txns = sb.table("product_transactions").select(
        "*, products(title)"
    ).in_("seller_id", staff_ids).order("created_at", desc=True).limit(100).execute()

    # Get buyer names
    buyer_ids = set(t.get("buyer_id") for t in (txns.data or []) if t.get("buyer_id"))
    all_user_ids = buyer_ids | set(staff_ids)
    user_names = {}
    if all_user_ids:
        users_result = sb.table("users").select("id, full_name").in_("id", list(all_user_ids)).execute()
        user_names = {u["id"]: u["full_name"] for u in (users_result.data or [])}

    results = []
    for t in (txns.data or []):
        product_title = (t.get("products") or {}).get("title", "Unknown")
        if search and search.lower() not in product_title.lower() and search.lower() not in user_names.get(t.get("buyer_id"), "").lower():
            continue
        results.append({
            "id": t["id"],
            "buyer_name": user_names.get(t.get("buyer_id"), "Unknown"),
            "seller_name": user_names.get(t.get("seller_id"), "Unknown"),
            "product_title": product_title,
            "quantity": int(t.get("quantity", 1)),
            "amount": float(t.get("amount", 0)),
            "seller_amount": float(t.get("seller_amount", 0)),
            "delivery_fee": float(t.get("delivery_fee", 0)),
            "purchase_type": t.get("purchase_type", "delivery"),
            "status": t.get("status", ""),
            "created_at": t["created_at"],
        })

    return results


# --- Staff Removal ---

@router.delete("/staff/{user_id}/remove")
async def remove_staff(user_id: str, manager: dict = Depends(require_manager)):
    """Remove a staff member from the manager's department.
    This unassigns them from the department (sets department_id and manager_id to null).
    """
    sb = get_supabase()
    dept_id = manager.get("department_id")
    manager_id = manager["sub"]

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    # Prevent manager from removing themselves
    if user_id == manager_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself from the department")

    # Verify user exists and belongs to this manager's department
    user_resp = sb.table("users").select("id, role, department_id, full_name").eq("id", user_id).execute()
    if not user_resp.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_resp.data[0]
    if user.get("department_id") != dept_id:
        raise HTTPException(status_code=403, detail="This user is not in your department")

    if user.get("role") != "seller":
        raise HTTPException(status_code=400, detail="Can only remove staff (seller) members")

    # Delete only non-financial personal data.
    # Financial records are preserved — their user FKs are set to NULL
    # automatically via ON DELETE SET NULL (migration_v10).
    sb.table("wishlist_items").delete().eq("buyer_id", user_id).execute()
    sb.table("cart_items").delete().eq("buyer_id", user_id).execute()
    sb.table("stored_value").delete().eq("user_id", user_id).execute()
    sb.table("user_balances").delete().eq("user_id", user_id).execute()
    sb.table("user_contacts").delete().eq("user_id", user_id).execute()

    # Permanently delete the user — DB cascades/nullifies all remaining FK references
    sb.table("users").delete().eq("id", user_id).execute()

    return {"message": f"Staff member '{user['full_name']}' has been permanently deleted"}


# --- Product Removal Request ---

@router.post("/products/{product_id}/request-removal")
async def request_product_removal(product_id: str, manager: dict = Depends(require_manager)):
    """Manager requests removal of a product. Sets status to 'pending_removal' for admin approval."""
    sb = get_supabase()
    dept_id = manager.get("department_id")
    manager_id = manager["sub"]

    if not dept_id:
        raise HTTPException(status_code=400, detail="Manager is not assigned to a department")

    # Get all staff IDs in this department + manager
    staff_result = sb.table("users").select("id").eq("department_id", dept_id).eq("role", "seller").execute()
    staff_ids = [s["id"] for s in (staff_result.data or [])]
    if manager_id not in staff_ids:
        staff_ids.append(manager_id)

    prod = sb.table("products").select("id, status, seller_id").eq("id", product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["seller_id"] not in staff_ids:
        raise HTTPException(status_code=403, detail="Product does not belong to your department")

    if prod.data[0]["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved products can be requested for removal")

    sb.table("products").update({
        "status": "pending_removal",
        "removal_requested_by": manager_id,
        "removal_requested_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", product_id).execute()

    return {"message": "Product removal requested. Awaiting admin approval."}
