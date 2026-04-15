"""
Admin routes — dashboard, user management, reports, product management.
Only accessible by admin users (role='admin').
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from routes.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/admin", tags=["Admin"])


# --- Helpers ---

async def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency that ensures the current user is an admin."""
    sb = get_supabase()
    result = sb.table("users").select("role").eq("id", current_user["sub"]).execute()
    if not result.data or result.data[0].get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# --- Request/Response Models ---

class AdminUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_banned: bool
    balance: float
    created_at: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None


class BanRequest(BaseModel):
    is_banned: bool


class UpdateDepartmentRequest(BaseModel):
    department_id: Optional[str] = None  # None means remove from department


class DashboardResponse(BaseModel):
    total_users: int
    total_products: int
    total_orders: int
    total_transaction_orders: int = 0
    total_revenue: float
    total_sales_volume: float
    total_admin_earnings: float = 0
    total_buyers: int = 0
    total_departments: int = 0
    total_managers: int = 0
    total_staff: int = 0
    total_delivery: int = 0


class TransactionDetail(BaseModel):
    id: str
    buyer_name: str
    seller_name: str
    product_title: str
    quantity: int
    amount: float
    seller_amount: float
    admin_commission: float
    delivery_fee: float = 0
    status: str
    purchase_type: str = "delivery"
    product_images: list = []
    created_at: str
    delivery_user_name: Optional[str] = None


class DailyIncome(BaseModel):
    date: str
    income: float
    transactions: int


class TopSeller(BaseModel):
    seller_id: str
    seller_name: str
    total_sales: float
    transaction_count: int


class TopProduct(BaseModel):
    product_id: str
    product_title: str
    times_sold: int
    total_revenue: float


class StoreReport(BaseModel):
    store_id: str
    store_name: str
    expected_revenue: float
    current_revenue: float

class ProductReport(BaseModel):
    product_id: str
    product_title: str
    store_id: str
    store_name: str
    expected_revenue: float
    current_revenue: float

class ReportsResponse(BaseModel):
    total_revenue: float
    total_sales_volume: float
    total_orders: int
    avg_transaction_value: float
    daily_income: list[DailyIncome]
    top_sellers: list[TopSeller]
    top_products: list[TopProduct]
    monthly_income: list[DailyIncome]
    overall_expected_revenue: float = 0.0
    store_reports: list[StoreReport] = []
    product_reports: list[ProductReport] = []


class AdminProductResponse(BaseModel):
    id: str
    seller_id: str
    seller_name: str
    title: str
    description: str
    price: float
    stock: int
    images: list[str]
    is_active: bool
    created_at: str
    department_id: Optional[str] = None
    department_name: Optional[str] = None


class AdminUpdateProductRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    images: Optional[list[str]] = None
    is_active: Optional[bool] = None


# --- Routes ---

@router.get("/dashboard", response_model=DashboardResponse)
async def admin_dashboard(admin: dict = Depends(require_admin)):
    """Get admin dashboard stats."""
    sb = get_supabase()

    users = sb.table("users").select("id", count="exact").execute()
    products = sb.table("products").select("id", count="exact").eq("is_active", True).execute()
    txns = sb.table("product_transactions").select("amount").in_("status", ["completed", "delivered"]).execute()
    all_txns = sb.table("product_transactions").select("id", count="exact").execute()

    total_volume = sum(float(t.get("amount", 0)) for t in txns.data) if txns.data else 0

    # Admin earnings = total credited to admin from successful transactions
    earnings = sb.table("admin_earnings").select("amount").execute()
    total_admin_earnings = sum(float(e["amount"]) for e in (earnings.data or []))

    # Role counts
    buyers_count = sb.table("users").select("id", count="exact").eq("role", "buyer").execute()
    managers_count = sb.table("users").select("id", count="exact").eq("role", "manager").execute()
    staff_count = sb.table("users").select("id", count="exact").eq("role", "seller").execute()
    delivery_count = sb.table("users").select("id", count="exact").eq("role", "delivery").execute()
    departments_count = sb.table("departments").select("id", count="exact").execute()

    return DashboardResponse(
        total_users=users.count or 0,
        total_products=products.count or 0,
        total_orders=len(txns.data) if txns.data else 0,
        total_transaction_orders=all_txns.count or 0,
        total_revenue=round(total_volume, 2),
        total_sales_volume=round(total_volume, 2),
        total_admin_earnings=round(total_admin_earnings, 2),
        total_buyers=buyers_count.count or 0,
        total_departments=departments_count.count or 0,
        total_managers=managers_count.count or 0,
        total_staff=staff_count.count or 0,
        total_delivery=delivery_count.count or 0,
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    search: str = Query("", description="Search by name or email"),
    role: str = Query("", description="Filter by role (buyer, seller, manager, delivery)"),
    department_id: str = Query("", description="Filter by department ID"),
    admin: dict = Depends(require_admin),
):
    """List all users. Supports search, role filter, and department filter."""
    sb = get_supabase()

    query = sb.table("users").select("*")

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")
    if role:
        query = query.eq("role", role)
    if department_id:
        query = query.eq("department_id", department_id)

    users = query.order("created_at", desc=True).execute()

    # Get department names for users with department_id
    dept_ids = set(u.get("department_id") for u in (users.data or []) if u.get("department_id"))
    dept_names = {}
    if dept_ids:
        depts = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts.data or [])}

    result = []
    for u in users.data:
        result.append(AdminUserResponse(
            id=u["id"],
            email=u["email"],
            full_name=u["full_name"],
            role=u["role"],
            is_banned=u.get("is_banned", False),
            balance=0.0,
            created_at=u["created_at"],
            department_id=u.get("department_id"),
            department_name=dept_names.get(u.get("department_id", ""), None),
        ))
    return result


@router.put("/users/{user_id}/ban")
async def ban_user(user_id: str, req: BanRequest, admin: dict = Depends(require_admin)):
    """Ban or unban a user. Admins cannot be banned."""
    sb = get_supabase()

    target = sb.table("users").select("role").eq("id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")
    if target.data[0].get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot ban an admin account")

    sb.table("users").update({"is_banned": req.is_banned}).eq("id", user_id).execute()
    return {"message": f"User {'banned' if req.is_banned else 'unbanned'} successfully"}


@router.put("/users/{user_id}/department")
async def update_user_department(user_id: str, req: UpdateDepartmentRequest, admin: dict = Depends(require_admin)):
    """Assign or remove a user from a department/store. Only for seller and manager roles."""
    sb = get_supabase()

    target = sb.table("users").select("id, role, department_id").eq("id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = target.data[0]
    if user["role"] not in ("seller", "manager"):
        raise HTTPException(status_code=400, detail="Only staff (seller) and manager users can be assigned to a store")

    if req.department_id:
        dept = sb.table("departments").select("id, manager_id").eq("id", req.department_id).execute()
        if not dept.data:
            raise HTTPException(status_code=404, detail="Store not found")
        # If assigning a manager, ensure the department doesn't already have a different manager
        if user["role"] == "manager" and dept.data[0].get("manager_id") and dept.data[0]["manager_id"] != user_id:
            raise HTTPException(status_code=400, detail="This store already has a manager assigned")

    # Remove from old department if was a manager there
    if user["role"] == "manager" and user.get("department_id"):
        sb.table("departments").update({"manager_id": None}).eq("manager_id", user_id).execute()

    # Update user's department
    sb.table("users").update({"department_id": req.department_id}).eq("id", user_id).execute()

    # If assigning a manager to a new department, set them as the department's manager
    if user["role"] == "manager" and req.department_id:
        sb.table("departments").update({"manager_id": user_id}).eq("id", req.department_id).execute()

    if req.department_id:
        return {"message": "User assigned to store successfully"}
    return {"message": "User removed from store successfully"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    """Permanently delete a user and all their associated data."""
    sb = get_supabase()

    target = sb.table("users").select("role, id").eq("id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")
    if target.data[0].get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete an admin account")
    if user_id == admin["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Delete only non-financial personal data.
    # Financial records (product_transactions, delivery_earnings, salary_payments,
    # admin_withdrawals, products) are preserved — their user FKs are set to NULL
    # automatically via ON DELETE SET NULL (migration_v10).
    sb.table("wishlist_items").delete().eq("buyer_id", user_id).execute()
    sb.table("cart_items").delete().eq("buyer_id", user_id).execute()
    sb.table("stored_value").delete().eq("user_id", user_id).execute()
    sb.table("user_balances").delete().eq("user_id", user_id).execute()
    sb.table("user_contacts").delete().eq("user_id", user_id).execute()

    # Finally delete the user — DB cascades/nullifies all remaining FK references
    sb.table("users").delete().eq("id", user_id).execute()

    return {"message": "User permanently deleted"}


class ChangePasswordRequest(BaseModel):
    new_password: str


@router.put("/users/{user_id}/change-password")
async def admin_change_user_password(user_id: str, req: ChangePasswordRequest, admin: dict = Depends(require_admin)):
    """Admin changes any user's password."""
    import bcrypt
    sb = get_supabase()

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    target = sb.table("users").select("role").eq("id", user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    password_hash = bcrypt.hashpw(req.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    sb.table("users").update({"password_hash": password_hash}).eq("id", user_id).execute()

    return {"message": "Password updated successfully"}


@router.get("/transactions", response_model=list[TransactionDetail])
async def list_transactions(
    search: str = Query("", description="Search by buyer or seller name"),
    txn_type: str = Query("", description="Filter by purchase_type (delivery/walk-in)"),
    status: str = Query("", description="Filter by transaction status"),
    date_range: str = Query("", description="day, week, month, or specific"),
    specific_date: str = Query("", description="YYYY-MM-DD if date_range is specific"),
    admin: dict = Depends(require_admin),
):
    """List all product transactions with search and filters support."""
    sb = get_supabase()

    q = sb.table("product_transactions").select(
        "*, products(title, images)"
    ).order("created_at", desc=True)

    if txn_type:
        q = q.eq("purchase_type", txn_type)
    if status:
        q = q.eq("status", status)

    # Basic date filters locally since we fetch all matching
    txns = q.execute()

    if not txns.data:
        return []

    # Local date filtering
    filtered_data = []
    from datetime import datetime, timedelta
    
    today = datetime.now()
    if date_range == "day":
        start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "week":
        start = today - timedelta(days=today.weekday())
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "month":
        start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif date_range == "specific" and specific_date:
        try:
            start = datetime.strptime(specific_date, "%Y-%m-%d")
        except:
            start = None
    else:
        start = None

    for t in txns.data:
        try:
            dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            if start:
                if date_range == "specific":
                    # For specific date, must match exactly the day
                    if dt.date() != start.date():
                        continue
                else:
                    if dt < start:
                        continue
            filtered_data.append(t)
        except:
            filtered_data.append(t)

    txns.data = filtered_data

    # Get all user IDs we need names for
    user_ids = set()
    delivery_user_ids = set()
    for t in txns.data:
        user_ids.add(t["buyer_id"])
        user_ids.add(t["seller_id"])
        if t.get("delivery_user_id"):
            delivery_user_ids.add(t["delivery_user_id"])
            user_ids.add(t["delivery_user_id"])

    users_result = sb.table("users").select("id, full_name, department_id").in_("id", list(user_ids)).execute()
    user_map = {u["id"]: u for u in users_result.data} if users_result.data else {}

    # Batch-lookup department names for sellers with department_id
    dept_ids = set()
    for u in (users_result.data or []):
        if u.get("department_id"):
            dept_ids.add(u["department_id"])

    dept_names = {}
    if dept_ids:
        depts = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts.data or [])}

    def get_display_name(user_id):
        u = user_map.get(user_id)
        if not u:
            return "Unknown"
        dept_id = u.get("department_id")
        if dept_id and dept_id in dept_names:
            return dept_names[dept_id]
        return u.get("full_name", "Unknown")

    results = []
    for t in txns.data:
        buyer_name = user_map.get(t["buyer_id"], {}).get("full_name", "Unknown")
        seller_name = get_display_name(t["seller_id"])
        product_title = ""
        if t.get("products"):
            product_title = t["products"].get("title", "") if isinstance(t["products"], dict) else ""

        if search:
            search_lower = search.lower()
            if (search_lower not in buyer_name.lower() and
                search_lower not in seller_name.lower() and
                search_lower not in product_title.lower()):
                continue

        product_images = []
        if t.get("products") and isinstance(t["products"], dict):
            product_images = t["products"].get("images", []) or []

        delivery_uid = t.get("delivery_user_id")
        delivery_user_name = user_map.get(delivery_uid, {}).get("full_name") if delivery_uid else None

        results.append(TransactionDetail(
            id=t["id"],
            buyer_name=buyer_name,
            seller_name=seller_name,
            product_title=product_title,
            quantity=int(t.get("quantity", 1)),
            amount=float(t["amount"]),
            seller_amount=float(t.get("seller_amount", 0)),
            admin_commission=float(t.get("admin_commission", 0)),
            delivery_fee=float(t.get("delivery_fee", 0)),
            status=t["status"],
            purchase_type=t.get("purchase_type", "delivery"),
            product_images=product_images,
            created_at=t["created_at"],
            delivery_user_name=delivery_user_name,
        ))

    return results


@router.get("/reports", response_model=ReportsResponse)
async def admin_reports(admin: dict = Depends(require_admin)):
    """Detailed admin reports with data for graphs."""
    sb = get_supabase()

    txns = sb.table("product_transactions").select(
        "*, products(title)"
    ).in_("status", ["completed", "delivered"]).order("created_at", desc=True).execute()

    if not txns.data:
        return ReportsResponse(
            total_revenue=0, total_sales_volume=0, total_orders=0,
            avg_transaction_value=0, daily_income=[], top_sellers=[],
            top_products=[], monthly_income=[],
        )

    products_res = sb.table("products").select("id, title, seller_id, price, stock, is_active, status").execute()
    
    overall_expected_revenue = 0.0
    store_expected = {}
    product_expected = {}
    
    for p in (products_res.data or []):
        if not p.get("is_active") or p.get("status") != "approved":
            continue
            
        p_revenue = float(p.get("price", 0)) * int(p.get("stock", 0))
        overall_expected_revenue += p_revenue
        
        sid = p.get("seller_id")
        if sid:
            if sid not in store_expected:
                store_expected[sid] = 0.0
            store_expected[sid] += p_revenue
            
        product_expected[p.get("id")] = {
            "title": p.get("title", "Unknown"),
            "seller_id": sid,
            "expected_revenue": p_revenue
        }

    seller_ids = set(t["seller_id"] for t in txns.data)
    if products_res.data:
        seller_ids.update(p["seller_id"] for p in products_res.data if p.get("seller_id"))
        
    users_result = sb.table("users").select("id, full_name, department_id").in_("id", list(seller_ids)).execute()
    user_map = {u["id"]: u for u in users_result.data} if users_result.data else {}

    # Batch-lookup department names
    dept_ids = set()
    for u in (users_result.data or []):
        if u.get("department_id"):
            dept_ids.add(u["department_id"])

    dept_names = {}
    if dept_ids:
        depts = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts.data or [])}

    def get_seller_display_name(seller_id):
        u = user_map.get(seller_id)
        if not u:
            return "Unknown"
        dept_id = u.get("department_id")
        if dept_id and dept_id in dept_names:
            return dept_names[dept_id]
        return u.get("full_name", "Unknown")

    # Admin income comes from admin_earnings (credited on successful transactions)
    earnings_data = sb.table("admin_earnings").select("amount, created_at").order("created_at", desc=True).execute()

    total_income = 0
    daily_data = {}
    monthly_data = {}
    for e in (earnings_data.data or []):
        e_amount = float(e["amount"])
        total_income += e_amount
        try:
            dt = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
            day_key = dt.strftime("%Y-%m-%d")
            month_key = dt.strftime("%Y-%m")
        except Exception:
            day_key = e["created_at"][:10]
            month_key = e["created_at"][:7]

        if day_key not in daily_data:
            daily_data[day_key] = {"income": 0, "count": 0}
        daily_data[day_key]["income"] += e_amount
        daily_data[day_key]["count"] += 1

        if month_key not in monthly_data:
            monthly_data[month_key] = {"income": 0, "count": 0}
        monthly_data[month_key]["income"] += e_amount
        monthly_data[month_key]["count"] += 1

    # Sales volume and top sellers/products from transactions
    total_volume = 0
    seller_data = {}
    product_data = {}

    for t in txns.data:
        amount = float(t["amount"])
        total_volume += amount

        sid = t["seller_id"]
        if sid not in seller_data:
            seller_data[sid] = {"name": get_seller_display_name(sid), "total": 0, "count": 0}
        seller_data[sid]["total"] += amount
        seller_data[sid]["count"] += 1

        pid = t["product_id"]
        ptitle = ""
        if t.get("products"):
            ptitle = t["products"].get("title", "") if isinstance(t["products"], dict) else ""
        if pid not in product_data:
            product_data[pid] = {"title": ptitle, "count": 0, "revenue": 0}
        product_data[pid]["count"] += 1
        product_data[pid]["revenue"] += amount

    daily_income = sorted([
        DailyIncome(date=k, income=round(v["income"], 2), transactions=v["count"])
        for k, v in daily_data.items()
    ], key=lambda x: x.date, reverse=True)[:30]

    monthly_income = sorted([
        DailyIncome(date=k, income=round(v["income"], 2), transactions=v["count"])
        for k, v in monthly_data.items()
    ], key=lambda x: x.date, reverse=True)[:12]

    top_sellers = sorted([
        TopSeller(seller_id=k, seller_name=v["name"], total_sales=round(v["total"], 2), transaction_count=v["count"])
        for k, v in seller_data.items()
    ], key=lambda x: x.total_sales, reverse=True)[:10]

    top_products = sorted([
        TopProduct(product_id=k, product_title=v["title"], times_sold=v["count"], total_revenue=round(v["revenue"], 2))
        for k, v in product_data.items()
    ], key=lambda x: x.total_revenue, reverse=True)[:10]

    avg_val = total_volume / len(txns.data) if txns.data else 0

    store_reports = []
    all_store_ids = set(seller_data.keys()).union(store_expected.keys())
    for sid in all_store_ids:
        store_reports.append(StoreReport(
            store_id=sid,
            store_name=get_seller_display_name(sid),
            expected_revenue=round(store_expected.get(sid, 0.0), 2),
            current_revenue=round(seller_data.get(sid, {}).get("total", 0.0), 2)
        ))
        
    product_reports = []
    all_product_ids = set(product_data.keys()).union(product_expected.keys())
    for pid in all_product_ids:
        pd = product_expected.get(pid, {})
        title = pd.get("title") or product_data.get(pid, {}).get("title", "Unknown")
        sid = pd.get("seller_id") or "Unknown"
        
        product_reports.append(ProductReport(
            product_id=pid,
            product_title=title,
            store_id=sid,
            store_name=get_seller_display_name(sid) if sid != "Unknown" else "Unknown",
            expected_revenue=round(pd.get("expected_revenue", 0.0), 2),
            current_revenue=round(product_data.get(pid, {}).get("revenue", 0.0), 2)
        ))

    return ReportsResponse(
        total_revenue=round(total_income, 2),
        total_sales_volume=round(total_volume, 2),
        total_orders=len(txns.data),
        avg_transaction_value=round(avg_val, 2),
        daily_income=daily_income,
        top_sellers=top_sellers,
        top_products=top_products,
        monthly_income=monthly_income,
        overall_expected_revenue=round(overall_expected_revenue, 2),
        store_reports=store_reports,
        product_reports=product_reports
    )


# --- Product Management ---

@router.get("/products", response_model=list[AdminProductResponse])
async def list_admin_products(
    search: str = Query("", description="Search by product title"),
    admin: dict = Depends(require_admin),
):
    """List all products for admin management."""
    sb = get_supabase()

    if search:
        products = sb.table("products").select("*, users!products_seller_id_fkey(full_name, department_id)").eq(
            "is_active", True
        ).ilike("title", f"%{search}%").order("created_at", desc=True).limit(200).execute()
    else:
        products = sb.table("products").select("*, users!products_seller_id_fkey(full_name, department_id)").eq(
            "is_active", True
        ).order("created_at", desc=True).limit(200).execute()

    # Batch-lookup department names
    dept_ids = set()
    for p in products.data:
        user_info = p.get("users") or {}
        dept_id = user_info.get("department_id")
        if dept_id:
            dept_ids.add(dept_id)

    dept_names = {}
    if dept_ids:
        depts = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts.data or [])}

    results = []
    for p in products.data:
        user_info = p.get("users") or {}
        dept_id = user_info.get("department_id")
        if dept_id and dept_id in dept_names:
            seller_name = dept_names[dept_id]
        else:
            seller_name = user_info.get("full_name", "")

        results.append(AdminProductResponse(
            id=p["id"],
            seller_id=p["seller_id"],
            seller_name=seller_name,
            title=p["title"],
            description=p.get("description", ""),
            price=float(p["price"]),
            stock=int(p.get("stock", 0)),
            images=p.get("images") or [],
            is_active=p["is_active"],
            created_at=p["created_at"],
            department_id=dept_id,
            department_name=dept_names.get(dept_id) if dept_id else None,
        ))
    return results


@router.put("/products/{product_id}", response_model=AdminProductResponse)
async def admin_update_product(
    product_id: str,
    req: AdminUpdateProductRequest,
    admin: dict = Depends(require_admin),
):
    """Admin can update product title, price, stock, and active status."""
    sb = get_supabase()

    existing = sb.table("products").select("id").eq("id", product_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = {k: v for k, v in req.model_dump().items() if k in req.model_fields_set}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = sb.table("products").update(update_data).eq("id", product_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update product")

    # Re-fetch with seller name
    p_result = sb.table("products").select("*, users!products_seller_id_fkey(full_name, department_id)").eq("id", product_id).execute()
    p = p_result.data[0]

    user_info = p.get("users") or {}
    dept_id = user_info.get("department_id")
    seller_name = user_info.get("full_name", "")
    if dept_id:
        dept_resp = sb.table("departments").select("name").eq("id", dept_id).execute()
        if dept_resp.data:
            seller_name = dept_resp.data[0]["name"]

    return AdminProductResponse(
        id=p["id"],
        seller_id=p["seller_id"],
        seller_name=seller_name,
        title=p["title"],
        description=p.get("description", ""),
        price=float(p["price"]),
        stock=int(p.get("stock", 0)),
        images=p.get("images") or [],
        is_active=p["is_active"],
        created_at=p["created_at"],
        department_id=dept_id,
        department_name=seller_name if dept_id else None,
    )


# --- User Detail (Clickable Panel) ---

@router.get("/users/{user_id}/detail")
async def get_user_detail(user_id: str, admin: dict = Depends(require_admin)):
    """Get full user detail for admin slide panel: report, history, transactions."""
    sb = get_supabase()

    # 1. User info
    user_resp = sb.table("users").select("*, user_balances(balance), user_contacts(contact_number)").eq("id", user_id).execute()
    if not user_resp.data:
        raise HTTPException(status_code=404, detail="User not found")

    u = user_resp.data[0]
    bal = 0.0
    if u.get("user_balances"):
        if isinstance(u["user_balances"], list) and len(u["user_balances"]) > 0:
            bal = float(u["user_balances"][0].get("balance", 0))
        elif isinstance(u["user_balances"], dict):
            bal = float(u["user_balances"].get("balance", 0))

    contact = ""
    if u.get("user_contacts"):
        if isinstance(u["user_contacts"], list) and len(u["user_contacts"]) > 0:
            contact = u["user_contacts"][0].get("contact_number", "")
        elif isinstance(u["user_contacts"], dict):
            contact = u["user_contacts"].get("contact_number", "")

    # 2. Transactions — for sellers, also fetch by assigned_staff_id for full coverage
    bought = sb.table("product_transactions").select("*, products(title, images)").eq("buyer_id", user_id).order("created_at", desc=True).limit(50).execute()
    sold = sb.table("product_transactions").select("*, products(title, images)").eq("seller_id", user_id).order("created_at", desc=True).limit(50).execute()
    delivered = sb.table("product_transactions").select("*, products(title, images)").eq("delivery_user_id", user_id).order("created_at", desc=True).limit(50).execute()

    # For sellers, also fetch transactions assigned to them
    assigned_txns_data = []
    if u["role"] == "seller":
        try:
            assigned = sb.table("product_transactions").select("*, products(title, images)").eq(
                "assigned_staff_id", user_id
            ).order("created_at", desc=True).limit(100).execute()
            assigned_txns_data = assigned.data or []
        except Exception:
            assigned_txns_data = []

    # Merge and deduplicate
    all_txns = (bought.data or []) + (sold.data or []) + (delivered.data or []) + assigned_txns_data
    seen = set()
    transactions = []
    raw_txns = []  # Keep raw data for seller infographics
    for t in all_txns:
        if t["id"] not in seen:
            seen.add(t["id"])
            raw_txns.append(t)
            transactions.append({
                "id": t["id"],
                "product_title": (t.get("products") or {}).get("title", ""),
                "amount": float(t["amount"]),
                "quantity": int(t.get("quantity", 1)),
                "status": t["status"],
                "role_in_txn": "buyer" if t["buyer_id"] == user_id else ("seller" if t["seller_id"] == user_id else "delivery"),
                "created_at": t["created_at"],
            })
    transactions.sort(key=lambda x: x["created_at"], reverse=True)
    raw_txns.sort(key=lambda x: x["created_at"], reverse=True)

    # 3. Report: daily/weekly/monthly breakdown
    daily_data = {}
    monthly_data = {}
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    completed_statuses = ("completed", "delivered")

    # Seller-specific counters
    completed_count = 0
    total_items = 0
    today_tasks = 0
    delivery_items_today = 0
    products_handled = {}

    for t in raw_txns:
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

        if day_key not in daily_data:
            daily_data[day_key] = {"amount": 0, "count": 0, "delivery_items": 0}
        daily_data[day_key]["amount"] += amt
        daily_data[day_key]["count"] += 1
        if is_completed:
            daily_data[day_key]["delivery_items"] += qty

        if month_key not in monthly_data:
            monthly_data[month_key] = {"amount": 0, "count": 0}
        monthly_data[month_key]["amount"] += amt
        monthly_data[month_key]["count"] += 1

        # Seller-specific metrics
        if u["role"] == "seller" and is_completed:
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
    )[:20] if u["role"] == "seller" else []

    # 4. SVF history
    svf = sb.table("stored_value").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()

    # 5. Seller products (if user is a seller)
    seller_products = []
    if u["role"] == "seller":
        prods = sb.table("products").select("id, title, price, stock, images, is_active, created_at").eq("seller_id", user_id).order("created_at", desc=True).limit(50).execute()
        seller_products = [
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
            "balance": bal,
            "contact_number": contact,
            "created_at": u["created_at"],
        },
        "report": {
            "total_transactions": len(transactions),
            "total_amount": round(sum(t["amount"] for t in transactions), 2),
            "total_completed_tasks": completed_count,
            "total_items_processed": total_items,
            "tasks_completed_today": today_tasks,
            "delivery_items_today": delivery_items_today,
            "daily": daily,
            "monthly": monthly,
        },
        "transactions": transactions[:50],
        "seller_products": seller_products,
        "recent_products_handled": recent_products_handled,
        "svf_history": [
            {
                "id": s["id"],
                "type": s["transaction_type"],
                "amount": float(s["amount"]),
                "created_at": s["created_at"],
            }
            for s in (svf.data or [])
        ],
    }


# --- Admin: Product approval (pending / approved / unapproved) ---

@router.get("/pending-products")
async def admin_get_pending_products(admin: dict = Depends(require_admin)):
    """Get all products with status 'pending', with seller info."""
    sb = get_supabase()
    prods = sb.table("products").select("*").eq("status", "pending").order("created_at", desc=True).execute()

    results = []
    for p in (prods.data or []):
        seller = sb.table("users").select("full_name, email, department_id").eq("id", p["seller_id"]).execute()
        seller_info = seller.data[0] if seller.data else {}

        seller_name = seller_info.get("full_name", "Unknown")
        dept_id = seller_info.get("department_id")
        if dept_id:
            dept_resp = sb.table("departments").select("name").eq("id", dept_id).execute()
            if dept_resp.data:
                seller_name = dept_resp.data[0]["name"]

        results.append({
            "id": p["id"],
            "title": p["title"],
            "description": p.get("description", ""),
            "price": float(p["price"]),
            "stock": p["stock"],
            "images": p.get("images", []),
            "seller_id": p["seller_id"],
            "seller_name": seller_name,
            "seller_email": seller_info.get("email", ""),
            "status": p["status"],
            "created_at": p["created_at"],
        })

    return results


@router.put("/products/{product_id}/approve")
async def admin_approve_product(
    product_id: str,
    admin: dict = Depends(require_admin),
):
    """Approve a product (pending → approved) so it can be listed and sold."""
    sb = get_supabase()

    prod = sb.table("products").select("status").eq("id", product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Can only approve products with status 'pending'. Current: {prod.data[0]['status']}")

    sb.table("products").update({"status": "approved"}).eq("id", product_id).execute()
    return {"message": "Product approved"}


@router.put("/products/{product_id}/unapprove")
async def admin_unapprove_product(
    product_id: str,
    admin: dict = Depends(require_admin),
):
    """Unapprove a product (pending → unapproved)."""
    sb = get_supabase()

    prod = sb.table("products").select("status").eq("id", product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Can only unapprove products with status 'pending'. Current: {prod.data[0]['status']}")

    sb.table("products").update({"status": "unapproved"}).eq("id", product_id).execute()
    return {"message": "Product unapproved"}


# --- Delivery User Registration ---

class DeliveryRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    contact_number: str


@router.post("/delivery/register")
async def admin_register_delivery(
    req: DeliveryRegisterRequest,
    admin: dict = Depends(require_admin),
):
    """Admin-only: register a new delivery user with unique name, email, and contact."""
    import bcrypt
    import traceback

    try:
        sb = get_supabase()

        # Check unique email
        existing_email = sb.table("users").select("id").eq("email", req.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Check unique full_name
        existing_name = sb.table("users").select("id").eq("full_name", req.full_name).execute()
        if existing_name.data:
            raise HTTPException(status_code=400, detail="Full name already taken")

        # Check unique contact_number
        existing_contact = sb.table("user_contacts").select("user_id").eq("contact_number", req.contact_number).execute()
        if existing_contact.data:
            raise HTTPException(status_code=400, detail="Contact number already registered")

        # Hash password
        password_hash = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # Create user with delivery role
        result = sb.table("users").insert({
            "email": req.email,
            "password_hash": password_hash,
            "full_name": req.full_name,
            "role": "delivery",
            "is_banned": False,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create delivery user")

        user = result.data[0]

        # Create balance
        sb.table("user_balances").insert({"user_id": user["id"], "balance": 0.00}).execute()

        # Create contact
        sb.table("user_contacts").insert({"user_id": user["id"], "contact_number": req.contact_number}).execute()

        return {
            "message": "Delivery user registered successfully",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": "delivery",
                "contact_number": req.contact_number,
            },
        }

    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        print(f"[DeliveryRegister] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


# --- Department CRUD ---

class DepartmentCreateRequest(BaseModel):
    name: str
    description: str = ""


class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/departments")
async def create_department(req: DepartmentCreateRequest, admin: dict = Depends(require_admin)):
    """Create a new department."""
    sb = get_supabase()

    existing = sb.table("departments").select("id").eq("name", req.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Department name already exists")

    result = sb.table("departments").insert({
        "name": req.name,
        "description": req.description,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create department")

    return {"message": "Department created", "department": result.data[0]}


@router.get("/departments")
async def list_departments(admin: dict = Depends(require_admin)):
    """List all departments with manager info and staff count."""
    sb = get_supabase()

    depts = sb.table("departments").select("*").order("created_at", desc=True).execute()

    results = []
    for d in (depts.data or []):
        # Get manager name
        manager_name = ""
        if d.get("manager_id"):
            mgr = sb.table("users").select("full_name").eq("id", d["manager_id"]).execute()
            if mgr.data:
                manager_name = mgr.data[0]["full_name"]

        # Staff count
        staff = sb.table("users").select("id", count="exact").eq("department_id", d["id"]).eq("role", "seller").execute()

        # Products count (via staff + manager)
        staff_ids_result = sb.table("users").select("id").eq("department_id", d["id"]).eq("role", "seller").execute()
        staff_ids = [s["id"] for s in (staff_ids_result.data or [])]
        # Include manager's own products/transactions
        if d.get("manager_id") and d["manager_id"] not in staff_ids:
            staff_ids.append(d["manager_id"])

        product_count = 0
        low_stock_count = 0
        if staff_ids:
            prods = sb.table("products").select("id, stock").in_("seller_id", staff_ids).eq("is_active", True).execute()
            product_count = len(prods.data) if prods.data else 0
            low_stock_count = sum(1 for p in (prods.data or []) if int(p.get("stock", 0)) < 5)

        # Revenue and order counts from completed transactions
        total_revenue = 0
        total_orders = 0
        delivery_orders = 0
        if staff_ids:
            txns = sb.table("product_transactions").select(
                "seller_amount"
            ).in_("seller_id", staff_ids).in_("status", ["delivered", "completed"]).execute()
            for t in (txns.data or []):
                total_revenue += float(t.get("seller_amount", 0))
                total_orders += 1
                delivery_orders += 1

        results.append({
            "id": d["id"],
            "name": d["name"],
            "description": d.get("description", ""),
            "manager_id": d.get("manager_id"),
            "manager_name": manager_name,
            "staff_count": staff.count or 0,
            "product_count": product_count,
            "low_stock_count": low_stock_count,
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "delivery_orders": delivery_orders,
            "created_at": d["created_at"],
        })

    return results


@router.get("/departments/{dept_id}")
async def get_department_detail(dept_id: str, admin: dict = Depends(require_admin)):
    """Get detailed department info with sales data for graphs."""
    sb = get_supabase()

    dept = sb.table("departments").select("*").eq("id", dept_id).execute()
    if not dept.data:
        raise HTTPException(status_code=404, detail="Department not found")

    d = dept.data[0]

    # Manager info
    manager_name = ""
    if d.get("manager_id"):
        mgr = sb.table("users").select("full_name, email").eq("id", d["manager_id"]).execute()
        if mgr.data:
            manager_name = mgr.data[0]["full_name"]

    # Staff in department
    staff_result = sb.table("users").select("id, full_name, email, is_banned, created_at").eq(
        "department_id", dept_id
    ).eq("role", "seller").order("created_at", desc=True).execute()
    staff_ids = [s["id"] for s in (staff_result.data or [])]
    # Include manager's own products/transactions
    if d.get("manager_id") and d["manager_id"] not in staff_ids:
        staff_ids.append(d["manager_id"])

    # Products with revenue data
    product_count = 0
    low_stock_count = 0
    department_products = []
    if staff_ids:
        prods = sb.table("products").select("id, title, images, price, stock, is_active").in_("seller_id", staff_ids).eq("is_active", True).execute()
        product_count = len(prods.data) if prods.data else 0
        low_stock_count = sum(1 for p in (prods.data or []) if int(p.get("stock", 0)) < 5)

        # Get revenue per product from completed transactions
        if prods.data:
            prod_ids = [p["id"] for p in prods.data]
            prod_txns = sb.table("product_transactions").select(
                "product_id, amount"
            ).in_("product_id", prod_ids).in_("status", ["delivered", "completed"]).execute()
            prod_revenue = {}
            for pt in (prod_txns.data or []):
                pid = pt["product_id"]
                prod_revenue[pid] = prod_revenue.get(pid, 0) + float(pt["amount"])

            for p in prods.data:
                department_products.append({
                    "id": p["id"],
                    "title": p["title"],
                    "images": p.get("images", []),
                    "price": float(p["price"]),
                    "stock": int(p.get("stock", 0)),
                    "total_revenue": round(prod_revenue.get(p["id"], 0), 2),
                })
            # Sort by revenue descending
            department_products.sort(key=lambda x: x["total_revenue"], reverse=True)

    # Pending restock requests for this department (include in-delivery)
    pending_restocks = []
    restock_result = sb.table("restock_requests").select(
        "*, products(title, images, stock)"
    ).eq("department_id", dept_id).in_("status", ["pending_manager", "approved_manager", "accepted_delivery", "in_transit"]).order("created_at", desc=True).limit(20).execute()
    if restock_result.data:
        rs_staff_ids = set(r["staff_id"] for r in restock_result.data)
        # Also collect delivery user IDs
        rs_delivery_ids = set(r["delivery_user_id"] for r in restock_result.data if r.get("delivery_user_id"))
        all_user_ids = rs_staff_ids | rs_delivery_ids
        rs_users = sb.table("users").select("id, full_name, role").in_("id", list(all_user_ids)).execute() if all_user_ids else None
        rs_user_map = {u["id"]: {"name": u["full_name"], "role": u.get("role", "")} for u in (rs_users.data or [])} if rs_users else {}
        for r in restock_result.data:
            prod_info = r.get("products") or {}
            requester = rs_user_map.get(r["staff_id"], {"name": "Unknown", "role": ""})
            delivery_info = rs_user_map.get(r.get("delivery_user_id", ""), {"name": "", "role": ""})
            pending_restocks.append({
                "id": r["id"],
                "product_title": prod_info.get("title", ""),
                "product_images": prod_info.get("images", []),
                "current_stock": int(prod_info.get("stock", 0)),
                "requested_quantity": r["requested_quantity"],
                "approved_quantity": r.get("approved_quantity"),
                "status": r["status"],
                "requested_by": requester["name"],
                "requested_by_role": requester["role"],
                "delivery_user_name": delivery_info["name"],
                "created_at": r["created_at"],
            })

    # Transaction data for sales graphs
    daily_sales = {}
    weekly_sales = {}
    monthly_sales = {}
    delivery_earnings = {}
    total_revenue = 0
    total_orders = 0
    delivery_order_count = 0

    if staff_ids:
        txns = sb.table("product_transactions").select(
            "amount, seller_amount, created_at"
        ).in_("seller_id", staff_ids).in_("status", ["delivered", "completed"]).execute()

        for t in (txns.data or []):
            amt = float(t.get("seller_amount", 0))
            total_revenue += amt
            total_orders += 1
            delivery_order_count += 1

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

            # Delivery earnings breakdown by month
            if month_key not in delivery_earnings:
                delivery_earnings[month_key] = {"amount": 0, "count": 0}
            delivery_earnings[month_key]["amount"] += amt
            delivery_earnings[month_key]["count"] += 1

    def to_list(data):
        return sorted(
            [{"date": k, "amount": round(v["amount"], 2), "count": v["count"]} for k, v in data.items()],
            key=lambda x: x["date"], reverse=True
        )[:30]

    return {
        "department": {
            "id": d["id"],
            "name": d["name"],
            "description": d.get("description", ""),
            "manager_id": d.get("manager_id"),
            "manager_name": manager_name,
            "created_at": d["created_at"],
        },
        "staff": staff_result.data or [],
        "total_staff": len(staff_result.data or []),
        "total_products": product_count,
        "low_stock_count": low_stock_count,
        "products": department_products,
        "pending_restocks": pending_restocks,
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "delivery_orders": delivery_order_count,
        "daily_sales": to_list(daily_sales),
        "weekly_sales": to_list(weekly_sales),
        "monthly_sales": to_list(monthly_sales),
        "delivery_earnings": to_list(delivery_earnings),
    }


@router.put("/departments/{dept_id}")
async def update_department(dept_id: str, req: DepartmentUpdateRequest, admin: dict = Depends(require_admin)):
    """Update a department's name or description."""
    sb = get_supabase()

    existing = sb.table("departments").select("id").eq("id", dept_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    sb.table("departments").update(update_data).eq("id", dept_id).execute()
    return {"message": "Department updated"}


@router.delete("/departments/{dept_id}")
async def delete_department(dept_id: str, admin: dict = Depends(require_admin)):
    """Delete a department only if no staff or manager are still assigned."""
    sb = get_supabase()
    dept = sb.table("departments").select("id, name, manager_id").eq("id", dept_id).execute()
    if not dept.data:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check if any staff (sellers) are still assigned
    staff = sb.table("users").select("id").eq("department_id", dept_id).execute()
    if staff.data:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this store while staff or managers are still assigned. Remove all members first."
        )

    sb.table("departments").delete().eq("id", dept_id).execute()
    return {"message": f"Store '{dept.data[0]['name']}' deleted"}


# --- Admin Delete Product ---

@router.delete("/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(require_admin)):
    """Soft-delete a product (set is_active=False). Admin can delete any product regardless of ownership."""
    sb = get_supabase()
    existing = sb.table("products").select("id, title").eq("id", product_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")
    sb.table("products").update({"is_active": False}).eq("id", product_id).execute()
    return {"message": "Product deleted successfully"}


# --- Admin Create Product for Department ---

class AdminCreateProductRequest(BaseModel):
    title: str
    description: str = ""
    price: float
    images: list = []


@router.post("/departments/{dept_id}/products")
async def admin_create_product_for_dept(
    dept_id: str, req: AdminCreateProductRequest, admin: dict = Depends(require_admin)
):
    """Admin creates a product for a specific department/store with stock=0 and auto-approved."""
    from models.bert_service import bert_service
    from database import store_product_embedding

    sb = get_supabase()

    # Verify department exists
    dept = sb.table("departments").select("id, manager_id, name").eq("id", dept_id).execute()
    if not dept.data:
        raise HTTPException(status_code=404, detail="Department not found")

    # Validate fields
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="Product title is required")
    if req.price <= 0:
        raise HTTPException(status_code=400, detail="Price must be greater than 0")
    if not req.images or len(req.images) == 0:
        raise HTTPException(status_code=400, detail="At least one product image is required")
    if len(req.images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")

    # Use the department's manager as the seller_id so the product belongs to the store.
    # Fall back to admin if the department has no manager assigned yet.
    manager_id = dept.data[0].get("manager_id")
    seller_id = manager_id if manager_id else admin["sub"]

    result = sb.table("products").insert({
        "seller_id": seller_id,
        "title": req.title.strip(),
        "description": (req.description or "").strip(),
        "price": req.price,
        "stock": 0,
        "images": req.images,
        "status": "approved",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create product")

    product = result.data[0]

    # Compute BERT embedding
    try:
        if bert_service._loaded:
            embedding = bert_service.compute_embedding(req.title)
            store_product_embedding(product["id"], embedding)
    except Exception as e:
        print(f"[Admin] Warning: Failed to compute embedding: {e}")

    return {
        "message": f"Product created for {dept.data[0]['name']}",
        "product": {
            "id": product["id"],
            "title": product["title"],
            "price": float(product["price"]),
            "stock": 0,
            "status": "approved",
        },
    }


# --- Manager Registration ---

class ManagerRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    contact_number: str = ""
    department_id: str


@router.post("/managers/register")
async def admin_register_manager(req: ManagerRegisterRequest, admin: dict = Depends(require_admin)):
    """Admin-only: register a new manager and assign to a department."""
    import bcrypt
    import traceback

    try:
        sb = get_supabase()

        # Verify department exists
        dept = sb.table("departments").select("id, manager_id").eq("id", req.department_id).execute()
        if not dept.data:
            raise HTTPException(status_code=404, detail="Department not found")

        if dept.data[0].get("manager_id"):
            raise HTTPException(status_code=400, detail="This department already has a manager assigned")

        # Check unique email
        existing_email = sb.table("users").select("id").eq("email", req.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Check unique full_name
        existing_name = sb.table("users").select("id").eq("full_name", req.full_name).execute()
        if existing_name.data:
            raise HTTPException(status_code=400, detail="Full name already taken")

        # Hash password
        password_hash = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # Create user with manager role
        result = sb.table("users").insert({
            "email": req.email,
            "password_hash": password_hash,
            "full_name": req.full_name,
            "role": "manager",
            "is_banned": False,
            "department_id": req.department_id,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create manager")

        user = result.data[0]

        # Create contact if provided
        if req.contact_number:
            sb.table("user_contacts").insert({"user_id": user["id"], "contact_number": req.contact_number}).execute()

        # Assign manager to department
        sb.table("departments").update({"manager_id": user["id"]}).eq("id", req.department_id).execute()

        return {
            "message": "Manager registered and assigned to department",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": "manager",
                "department_id": req.department_id,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ManagerRegister] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


# --- Product Removal Approval ---

@router.get("/pending-removals")
async def admin_get_pending_removals(admin: dict = Depends(require_admin)):
    """Get all products with status 'pending_removal'."""
    sb = get_supabase()
    prods = sb.table("products").select("*").eq("status", "pending_removal").order("removal_requested_at", desc=True).execute()

    results = []
    for p in (prods.data or []):
        seller = sb.table("users").select("full_name, email, department_id").eq("id", p["seller_id"]).execute()
        seller_info = seller.data[0] if seller.data else {}

        seller_name = seller_info.get("full_name", "Unknown")
        dept_id = seller_info.get("department_id")
        dept_name = ""
        if dept_id:
            dept_resp = sb.table("departments").select("name").eq("id", dept_id).execute()
            if dept_resp.data:
                dept_name = dept_resp.data[0]["name"]
                seller_name = dept_name

        requester_name = ""
        if p.get("removal_requested_by"):
            req_user = sb.table("users").select("full_name").eq("id", p["removal_requested_by"]).execute()
            if req_user.data:
                requester_name = req_user.data[0]["full_name"]

        results.append({
            "id": p["id"],
            "title": p["title"],
            "description": p.get("description", ""),
            "price": float(p["price"]),
            "stock": p["stock"],
            "images": p.get("images", []),
            "seller_id": p["seller_id"],
            "seller_name": seller_name,
            "department_name": dept_name,
            "status": p["status"],
            "removal_requested_by": p.get("removal_requested_by"),
            "requester_name": requester_name,
            "removal_requested_at": p.get("removal_requested_at"),
            "created_at": p["created_at"],
        })

    return results


@router.put("/products/{product_id}/approve-removal")
async def admin_approve_removal(product_id: str, admin: dict = Depends(require_admin)):
    """Approve a product removal request. Deactivates the product."""
    sb = get_supabase()

    prod = sb.table("products").select("status").eq("id", product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["status"] != "pending_removal":
        raise HTTPException(status_code=400, detail="Product is not pending removal")

    sb.table("products").update({
        "is_active": False,
        "status": "unapproved",
    }).eq("id", product_id).execute()

    return {"message": "Product removal approved. Product has been deactivated."}


@router.put("/products/{product_id}/reject-removal")
async def admin_reject_removal(product_id: str, admin: dict = Depends(require_admin)):
    """Reject a product removal request. Product returns to approved status."""
    sb = get_supabase()

    prod = sb.table("products").select("status").eq("id", product_id).execute()
    if not prod.data:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod.data[0]["status"] != "pending_removal":
        raise HTTPException(status_code=400, detail="Product is not pending removal")

    sb.table("products").update({
        "status": "approved",
        "removal_requested_by": None,
        "removal_requested_at": None,
    }).eq("id", product_id).execute()

    return {"message": "Product removal rejected. Product remains active."}


# --- Deliveries Management ---

class DeliveryStatsDay(BaseModel):
    date: str
    count: int

class Deliveryman(BaseModel):
    user_id: str
    full_name: str
    email: str
    contact_number: str = ""
    total_deliveries: int = 0
    avg_delivery_time: Optional[float] = None
    completed_count: int = 0

class PickupHistoryItem(BaseModel):
    transaction_id: str
    deliveryman_name: str
    amount: float
    status: str
    picked_up_at: str

class DeliveriesStatsResponse(BaseModel):
    total_deliveries: int
    deliveries_by_day: list[dict]
    deliveries_by_month: list[dict]
    deliverymen: list[Deliveryman]
    pickup_history: list[PickupHistoryItem]


@router.get("/deliveries/stats", response_model=DeliveriesStatsResponse)
async def get_deliveries_stats(admin: dict = Depends(require_admin)):
    """Get all deliveries stats including avg delivery time and breakdown by deliveryman."""
    sb = get_supabase()

    # Get all delivery transactions (filter out empty delivery_user_id locally)
    all_txns = sb.table("product_transactions").select(
        "*"
    ).order("created_at", desc=False).execute()
    
    if all_txns.data:
        txns_data = [t for t in all_txns.data if t.get("delivery_user_id")]
    else:
        txns_data = []
        
    class AttrDict:
        def __init__(self, d):
            self.data = d
    txns = AttrDict(txns_data)

    if not txns.data:
        return DeliveriesStatsResponse(
            total_deliveries=0,
            deliveries_by_day=[],
            deliveries_by_month=[],
            deliverymen=[],
            pickup_history=[]
        )

    # Get deliveryman contact info
    deliveryman_ids = list(set(t["delivery_user_id"] for t in txns.data if t["delivery_user_id"]))
    contacts = {}
    if deliveryman_ids:
        contacts_result = sb.table("user_contacts").select("user_id, contact_number").in_("user_id", deliveryman_ids).execute()
        contacts = {c["user_id"]: c["contact_number"] for c in (contacts_result.data or [])}

    # Get user details for deliverymen
    user_details = {}
    if deliveryman_ids:
        users_result = sb.table("users").select("id, full_name, email").in_("id", deliveryman_ids).execute()
        user_details = {u["id"]: u for u in (users_result.data or [])}

    # Calculate stats
    from datetime import datetime, timedelta
    today = datetime.now(timezone.utc)
    
    last_14_days = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(13, -1, -1)]
    days_dict = {day: {"date": day} for day in last_14_days}

    current_year = today.year
    months_dict = {}
    for i in range(1, 13):
        m_str = f"{current_year}-{i:02d}"
        months_dict[m_str] = {"date": datetime(current_year, i, 1).strftime("%b")}

    deliverymen_map = {}

    for t in txns.data:
        delivery_user_id = t.get("delivery_user_id")
        if not delivery_user_id:
            continue

        # Initialize deliveryman entry
        if delivery_user_id not in deliverymen_map:
            user_info = user_details.get(delivery_user_id, {})
            deliverymen_map[delivery_user_id] = {
                "user_id": delivery_user_id,
                "full_name": user_info.get("full_name", "Unknown"),
                "email": user_info.get("email", ""),
                "contact_number": contacts.get(delivery_user_id, ""),
                "total_deliveries": 0,
                "completed_count": 0
            }

        deliverymen_map[delivery_user_id]["total_deliveries"] += 1

        if t.get("status") == "delivered":
            deliverymen_map[delivery_user_id]["completed_count"] += 1

        dm_name = deliverymen_map[delivery_user_id]["full_name"]

        # Count by date
        created_date = t["created_at"].split("T")[0]
        if created_date in days_dict:
            days_dict[created_date][dm_name] = days_dict[created_date].get(dm_name, 0) + 1

        # Count by month
        created = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
        month_key = created.strftime("%Y-%m")
        if month_key in months_dict:
            months_dict[month_key][dm_name] = months_dict[month_key].get(dm_name, 0) + 1

    days_list = list(days_dict.values())
    months_list = list(months_dict.values())

    pickup_history = []

    # Build deliverymen list
    deliverymen_list = []
    for user_id, data in deliverymen_map.items():
        deliverymen_list.append(Deliveryman(
            user_id=user_id,
            full_name=data["full_name"],
            email=data["email"],
            contact_number=data["contact_number"],
            total_deliveries=data["total_deliveries"],
            completed_count=data["completed_count"]
        ))

    for t in txns.data:
        if t.get("delivery_user_id") and t.get("picked_up_at"):
            dm_name = deliverymen_map[t["delivery_user_id"]]["full_name"] if t["delivery_user_id"] in deliverymen_map else "Unknown"
            pickup_history.append(PickupHistoryItem(
                transaction_id=t["id"],
                deliveryman_name=dm_name,
                amount=float(t.get("amount", 0)),
                status=t.get("status", ""),
                picked_up_at=t["picked_up_at"]
            ))

    pickup_history.sort(key=lambda x: x.picked_up_at, reverse=True)

    return DeliveriesStatsResponse(
        total_deliveries=len(txns.data),
        deliveries_by_day=days_list,
        deliveries_by_month=months_list,
        deliverymen=deliverymen_list,
        pickup_history=pickup_history[:100]
    )


# --- Admin Restock Request ---

class AdminRestockRequestCreate(BaseModel):
    product_id: str
    requested_quantity: int
    notes: str = ""


@router.post("/restock-request")
async def admin_create_restock_request(req: AdminRestockRequestCreate, admin: dict = Depends(require_admin)):
    """
    Admin creates a restock request that bypasses manager approval.
    Status is set directly to 'approved_manager' so delivery can pick it up.
    """
    sb = get_supabase()
    admin_id = admin["sub"]

    if req.requested_quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    # Get the product and its department
    product = sb.table("products").select("id, seller_id, title").eq("id", req.product_id).execute()
    if not product.data:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get seller's department_id
    seller_id = product.data[0]["seller_id"]
    seller = sb.table("users").select("department_id").eq("id", seller_id).execute()
    department_id = seller.data[0].get("department_id") if seller.data else None

    if not department_id:
        raise HTTPException(status_code=400, detail="Product does not belong to a department")

    # Get admin name
    admin_user = sb.table("users").select("full_name").eq("id", admin_id).execute()
    admin_name = admin_user.data[0]["full_name"] if admin_user.data else "Admin"

    now = datetime.now(timezone.utc).isoformat()

    # Create restock request with status 'approved_manager' (bypasses manager)
    result = sb.table("restock_requests").insert({
        "staff_id": admin_id,
        "department_id": department_id,
        "product_id": req.product_id,
        "requested_quantity": req.requested_quantity,
        "approved_quantity": req.requested_quantity,
        "notes": req.notes,
        "status": "approved_manager",
        "manager_approved_at": now,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create restock request")

    return {
        "message": f"Restock request created by {admin_name} and marked as To Be Delivered",
        "request": result.data[0],
        "requested_by": admin_name,
    }


@router.get("/restock-requests")
async def admin_get_restock_requests(
    department_id: str = Query("", description="Filter by department ID"),
    status: str = Query("", description="Filter by status"),
    admin: dict = Depends(require_admin),
):
    """Get restock requests, optionally filtered by department and status."""
    sb = get_supabase()

    query = sb.table("restock_requests").select(
        "*, products(title, price, stock, images)"
    ).order("created_at", desc=True).limit(100)

    if department_id:
        query = query.eq("department_id", department_id)
    if status:
        query = query.eq("status", status)

    requests = query.execute()

    # Get staff names
    staff_ids = set()
    for r in (requests.data or []):
        staff_ids.add(r["staff_id"])

    staff_names = {}
    if staff_ids:
        users_result = sb.table("users").select("id, full_name, role").in_("id", list(staff_ids)).execute()
        staff_names = {u["id"]: {"name": u["full_name"], "role": u.get("role", "")} for u in (users_result.data or [])}

    results = []
    for r in (requests.data or []):
        prod = r.get("products") or {}
        staff_info = staff_names.get(r["staff_id"], {"name": "Unknown", "role": ""})
        results.append({
            "id": r["id"],
            "product_id": r["product_id"],
            "product_title": prod.get("title", ""),
            "product_images": prod.get("images", []),
            "current_stock": int(prod.get("stock", 0)),
            "requested_quantity": r["requested_quantity"],
            "approved_quantity": r.get("approved_quantity"),
            "notes": r.get("notes", ""),
            "requested_by": staff_info["name"],
            "requested_by_role": staff_info["role"],
            "status": r["status"],
            "created_at": r["created_at"],
        })

    return results


# --- Salary Management ---

class SetSalaryRequest(BaseModel):
    salary: float


class PayIndividualRequest(BaseModel):
    recipient_id: str
    amount: float


class PayGroupRequest(BaseModel):
    amount_per_person: Optional[float] = None  # If None, uses each person's fixed salary


@router.get("/salaries")
async def admin_get_salaries(admin: dict = Depends(require_admin)):
    """Get salary overview: all departments with managers, staff, their salaries, and payment history."""
    sb = get_supabase()
    admin_id = admin["sub"]

    # Admin balance
    admin_bal = sb.table("user_balances").select("balance").eq("user_id", admin_id).execute()
    admin_balance = float(admin_bal.data[0]["balance"]) if admin_bal.data else 0.0

    # Get all departments
    depts = sb.table("departments").select("id, name, manager_id").execute()
    dept_list = depts.data or []

    # Get all managers and staff (sellers)
    managers = sb.table("users").select("id, full_name, email, role, department_id, salary").eq("role", "manager").execute()
    staff = sb.table("users").select("id, full_name, email, role, department_id, salary").eq("role", "seller").execute()

    manager_map = {}
    for m in (managers.data or []):
        manager_map[m["id"]] = m

    # Build per-department data
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    # Get salary payments for current month
    payments_this_month = sb.table("salary_payments").select("*").eq("payment_month", current_month).order("created_at", desc=True).execute()
    payments_data = payments_this_month.data or []

    # Build paid amounts per recipient this month
    paid_this_month = {}
    for p in payments_data:
        rid = p["recipient_id"]
        paid_this_month[rid] = paid_this_month.get(rid, 0) + float(p["amount"])

    # Build department list
    departments_result = []
    total_salaries = 0.0

    for dept in dept_list:
        dept_managers = []
        dept_staff = []

        # Find manager for this dept
        if dept.get("manager_id") and dept["manager_id"] in manager_map:
            mgr = manager_map[dept["manager_id"]]
            salary_val = float(mgr.get("salary", 0))
            paid_val = paid_this_month.get(mgr["id"], 0)
            dept_managers.append({
                "id": mgr["id"],
                "full_name": mgr["full_name"],
                "email": mgr["email"],
                "role": "manager",
                "salary": salary_val,
                "paid_this_month": paid_val,
                "remaining": max(salary_val - paid_val, 0),
            })
            total_salaries += max(salary_val - paid_val, 0)

        # Find staff for this dept
        for s in (staff.data or []):
            if s.get("department_id") == dept["id"]:
                salary_val = float(s.get("salary", 0))
                paid_val = paid_this_month.get(s["id"], 0)
                dept_staff.append({
                    "id": s["id"],
                    "full_name": s["full_name"],
                    "email": s["email"],
                    "role": "seller",
                    "salary": salary_val,
                    "paid_this_month": paid_val,
                    "remaining": max(salary_val - paid_val, 0),
                })
                total_salaries += max(salary_val - paid_val, 0)

        dept_total = sum(m["remaining"] for m in dept_managers) + sum(s["remaining"] for s in dept_staff)

        departments_result.append({
            "id": dept["id"],
            "name": dept["name"],
            "managers": dept_managers,
            "staff": dept_staff,
            "total_remaining": dept_total,
        })

    # Next pay date: 1st of next month
    if now.month == 12:
        next_pay = datetime(now.year + 1, 1, 1)
    else:
        next_pay = datetime(now.year, now.month + 1, 1)

    # Recent payment history (last 50)
    recent_payments = sb.table("salary_payments").select("*").order("created_at", desc=True).limit(50).execute()
    # Get recipient names
    recipient_ids = set(p["recipient_id"] for p in (recent_payments.data or []))
    recipient_names = {}
    if recipient_ids:
        rn = sb.table("users").select("id, full_name").in_("id", list(recipient_ids)).execute()
        recipient_names = {u["id"]: u["full_name"] for u in (rn.data or [])}

    payment_history = []
    for p in (recent_payments.data or []):
        payment_history.append({
            "id": p["id"],
            "recipient_id": p["recipient_id"],
            "recipient_name": recipient_names.get(p["recipient_id"], "Unknown"),
            "amount": float(p["amount"]),
            "payment_month": p["payment_month"],
            "notes": p.get("notes", ""),
            "created_at": p["created_at"],
        })

    return {
        "admin_balance": admin_balance,
        "total_salaries_remaining": round(total_salaries, 2),
        "current_month": current_month,
        "next_pay_date": next_pay.strftime("%B %d, %Y"),
        "departments": departments_result,
        "payment_history": payment_history,
    }


@router.put("/salaries/set/{user_id}")
async def admin_set_salary(user_id: str, req: SetSalaryRequest, admin: dict = Depends(require_admin)):
    """Set or update the fixed salary for a staff member or manager."""
    if req.salary < 0:
        raise HTTPException(status_code=400, detail="Salary cannot be negative")

    sb = get_supabase()

    # Verify user exists and is staff or manager
    user = sb.table("users").select("id, role").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    if user.data[0]["role"] not in ("seller", "manager"):
        raise HTTPException(status_code=400, detail="Can only set salary for staff or managers")

    sb.table("users").update({"salary": req.salary}).eq("id", user_id).execute()

    return {"message": f"Salary updated to PHP {req.salary:.2f}"}


@router.post("/salaries/pay-all")
async def admin_pay_all_salaries(admin: dict = Depends(require_admin)):
    """Pay all staff and managers their remaining salary for the current month."""
    sb = get_supabase()
    admin_id = admin["sub"]

    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    # Get admin balance
    admin_bal = sb.table("user_balances").select("balance").eq("user_id", admin_id).execute()
    if not admin_bal.data:
        raise HTTPException(status_code=400, detail="Admin balance not found")
    admin_balance = float(admin_bal.data[0]["balance"])

    # Get all managers and staff with salary > 0
    recipients = sb.table("users").select("id, full_name, role, department_id, salary").in_(
        "role", ["seller", "manager"]
    ).execute()

    if not recipients.data:
        raise HTTPException(status_code=400, detail="No staff or managers found")

    # Get payments already made this month
    payments = sb.table("salary_payments").select("recipient_id, amount").eq("payment_month", current_month).execute()
    paid_map = {}
    for p in (payments.data or []):
        rid = p["recipient_id"]
        paid_map[rid] = paid_map.get(rid, 0) + float(p["amount"])

    # Calculate remaining for each
    to_pay = []
    total_needed = 0
    for r in recipients.data:
        salary = float(r.get("salary", 0))
        if salary <= 0:
            continue
        paid = paid_map.get(r["id"], 0)
        remaining = max(salary - paid, 0)
        if remaining > 0:
            to_pay.append({"user": r, "amount": remaining})
            total_needed += remaining

    if not to_pay:
        raise HTTPException(status_code=400, detail="No remaining salaries to pay this month")

    if admin_balance < total_needed:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Need PHP {total_needed:.2f}, have PHP {admin_balance:.2f}"
        )

    # Deduct from admin
    new_admin_balance = admin_balance - total_needed
    sb.table("user_balances").update({"balance": new_admin_balance}).eq("user_id", admin_id).execute()

    # Credit each recipient and record payments
    paid_count = 0
    for item in to_pay:
        user = item["user"]
        amount = item["amount"]

        # Credit recipient balance
        rec_bal = sb.table("user_balances").select("balance").eq("user_id", user["id"]).execute()
        if rec_bal.data:
            new_bal = float(rec_bal.data[0]["balance"]) + amount
            sb.table("user_balances").update({"balance": new_bal}).eq("user_id", user["id"]).execute()
        else:
            sb.table("user_balances").insert({"user_id": user["id"], "balance": amount}).execute()

        # Record salary payment
        sb.table("salary_payments").insert({
            "admin_id": admin_id,
            "recipient_id": user["id"],
            "department_id": user.get("department_id"),
            "amount": amount,
            "payment_month": current_month,
            "notes": "Bulk pay all",
        }).execute()

        # Record in SVF history for recipient
        sb.table("stored_value").insert({
            "user_id": user["id"],
            "transaction_type": "deposit",
            "amount": amount,
        }).execute()

        paid_count += 1

    # Record admin withdrawal in SVF
    sb.table("stored_value").insert({
        "user_id": admin_id,
        "transaction_type": "withdrawal",
        "amount": total_needed,
    }).execute()

    return {
        "message": f"Successfully paid {paid_count} people a total of PHP {total_needed:.2f}",
        "total_paid": total_needed,
        "recipients_count": paid_count,
        "new_admin_balance": new_admin_balance,
    }


@router.post("/salaries/pay-store/{department_id}")
async def admin_pay_store_salaries(department_id: str, admin: dict = Depends(require_admin)):
    """Pay all remaining salaries for a specific store/department."""
    sb = get_supabase()
    admin_id = admin["sub"]

    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    # Verify department exists
    dept = sb.table("departments").select("id, name, manager_id").eq("id", department_id).execute()
    if not dept.data:
        raise HTTPException(status_code=404, detail="Department not found")

    # Get admin balance
    admin_bal = sb.table("user_balances").select("balance").eq("user_id", admin_id).execute()
    if not admin_bal.data:
        raise HTTPException(status_code=400, detail="Admin balance not found")
    admin_balance = float(admin_bal.data[0]["balance"])

    # Get staff in this department
    staff = sb.table("users").select("id, full_name, role, department_id, salary").eq(
        "department_id", department_id
    ).in_("role", ["seller", "manager"]).execute()

    # Also include manager via departments.manager_id
    manager_id = dept.data[0].get("manager_id")
    all_recipients = list(staff.data or [])
    if manager_id:
        mgr = sb.table("users").select("id, full_name, role, department_id, salary").eq("id", manager_id).execute()
        if mgr.data:
            existing_ids = {r["id"] for r in all_recipients}
            if mgr.data[0]["id"] not in existing_ids:
                all_recipients.append(mgr.data[0])

    if not all_recipients:
        raise HTTPException(status_code=400, detail="No staff or managers in this department")

    # Get existing payments this month
    recipient_ids = [r["id"] for r in all_recipients]
    payments = sb.table("salary_payments").select("recipient_id, amount").eq(
        "payment_month", current_month
    ).in_("recipient_id", recipient_ids).execute()

    paid_map = {}
    for p in (payments.data or []):
        rid = p["recipient_id"]
        paid_map[rid] = paid_map.get(rid, 0) + float(p["amount"])

    to_pay = []
    total_needed = 0
    for r in all_recipients:
        salary = float(r.get("salary", 0))
        if salary <= 0:
            continue
        paid = paid_map.get(r["id"], 0)
        remaining = max(salary - paid, 0)
        if remaining > 0:
            to_pay.append({"user": r, "amount": remaining})
            total_needed += remaining

    if not to_pay:
        raise HTTPException(status_code=400, detail="No remaining salaries to pay in this department")

    if admin_balance < total_needed:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Need PHP {total_needed:.2f}, have PHP {admin_balance:.2f}"
        )

    # Deduct from admin
    new_admin_balance = admin_balance - total_needed
    sb.table("user_balances").update({"balance": new_admin_balance}).eq("user_id", admin_id).execute()

    paid_count = 0
    for item in to_pay:
        user = item["user"]
        amount = item["amount"]

        rec_bal = sb.table("user_balances").select("balance").eq("user_id", user["id"]).execute()
        if rec_bal.data:
            new_bal = float(rec_bal.data[0]["balance"]) + amount
            sb.table("user_balances").update({"balance": new_bal}).eq("user_id", user["id"]).execute()
        else:
            sb.table("user_balances").insert({"user_id": user["id"], "balance": amount}).execute()

        sb.table("salary_payments").insert({
            "admin_id": admin_id,
            "recipient_id": user["id"],
            "department_id": department_id,
            "amount": amount,
            "payment_month": current_month,
            "notes": f"Store pay: {dept.data[0]['name']}",
        }).execute()

        sb.table("stored_value").insert({
            "user_id": user["id"],
            "transaction_type": "deposit",
            "amount": amount,
        }).execute()

        paid_count += 1

    sb.table("stored_value").insert({
        "user_id": admin_id,
        "transaction_type": "withdrawal",
        "amount": total_needed,
    }).execute()

    return {
        "message": f"Paid {paid_count} people in {dept.data[0]['name']} — PHP {total_needed:.2f}",
        "total_paid": total_needed,
        "recipients_count": paid_count,
        "new_admin_balance": new_admin_balance,
    }


@router.post("/salaries/pay-individual")
async def admin_pay_individual(req: PayIndividualRequest, admin: dict = Depends(require_admin)):
    """Pay a specific amount to a specific staff member or manager."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    sb = get_supabase()
    admin_id = admin["sub"]

    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    # Verify recipient
    recipient = sb.table("users").select("id, full_name, role, department_id, salary").eq("id", req.recipient_id).execute()
    if not recipient.data:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if recipient.data[0]["role"] not in ("seller", "manager"):
        raise HTTPException(status_code=400, detail="Can only pay staff or managers")

    # Get admin balance
    admin_bal = sb.table("user_balances").select("balance").eq("user_id", admin_id).execute()
    if not admin_bal.data:
        raise HTTPException(status_code=400, detail="Admin balance not found")
    admin_balance = float(admin_bal.data[0]["balance"])

    if admin_balance < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Need PHP {req.amount:.2f}, have PHP {admin_balance:.2f}"
        )

    # Deduct from admin
    new_admin_balance = admin_balance - req.amount
    sb.table("user_balances").update({"balance": new_admin_balance}).eq("user_id", admin_id).execute()

    # Credit recipient
    rec_bal = sb.table("user_balances").select("balance").eq("user_id", req.recipient_id).execute()
    if rec_bal.data:
        new_bal = float(rec_bal.data[0]["balance"]) + req.amount
        sb.table("user_balances").update({"balance": new_bal}).eq("user_id", req.recipient_id).execute()
    else:
        sb.table("user_balances").insert({"user_id": req.recipient_id, "balance": req.amount}).execute()

    # Record payment
    sb.table("salary_payments").insert({
        "admin_id": admin_id,
        "recipient_id": req.recipient_id,
        "department_id": recipient.data[0].get("department_id"),
        "amount": req.amount,
        "payment_month": current_month,
        "notes": f"Individual payment to {recipient.data[0]['full_name']}",
    }).execute()

    # SVF records
    sb.table("stored_value").insert({
        "user_id": req.recipient_id,
        "transaction_type": "deposit",
        "amount": req.amount,
    }).execute()

    sb.table("stored_value").insert({
        "user_id": admin_id,
        "transaction_type": "withdrawal",
        "amount": req.amount,
    }).execute()

    return {
        "message": f"Paid PHP {req.amount:.2f} to {recipient.data[0]['full_name']}",
        "new_admin_balance": new_admin_balance,
    }
