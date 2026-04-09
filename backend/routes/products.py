"""
Product routes — create, list, update, delete products.
When a product is created, its BERT embedding is computed and stored.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import uuid
import base64

from database import get_supabase, store_product_embedding
from models.bert_service import bert_service
from routes.auth import get_current_user
from config import SUPABASE_URL

router = APIRouter(prefix="/products", tags=["Products"])


# --- Request/Response Models ---

class CreateProductRequest(BaseModel):
    title: str
    description: str = ""
    price: float
    stock: int = 1
    images: list[str] = []  # Array of image URLs or data URIs
    tracking_number: Optional[str] = None  # Parcel tracking number


class UpdateProductRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    images: Optional[list[str]] = None
    is_active: Optional[bool] = None
    tracking_number: Optional[str] = None


class ProductResponse(BaseModel):
    id: str
    seller_id: str
    title: str
    description: str
    price: float
    stock: int = 0
    images: list[str] = []
    tracking_number: Optional[str] = None
    is_active: bool
    status: str = "pending"
    created_at: str
    seller_name: Optional[str] = None


def build_product_response(p, seller_name=""):
    """Helper to build ProductResponse from DB row."""
    return ProductResponse(
        id=p["id"],
        seller_id=p["seller_id"],
        title=p["title"],
        description=p["description"] or "",
        price=float(p["price"]),
        stock=int(p.get("stock", 0)),
        images=p.get("images") or [],
        tracking_number=p.get("tracking_number"),
        is_active=p["is_active"],
        status=p.get("status", "pending"),
        created_at=p["created_at"],
        seller_name=seller_name,
    )


# --- Image Upload Endpoint ---

@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a product image to Supabase Storage. Returns the public URL."""
    sb = get_supabase()

    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed. Use JPEG, PNG, WebP, or GIF.")

    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")

    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{current_user['sub']}/{uuid.uuid4().hex}.{ext}"

    # Upload to Supabase Storage
    try:
        sb.storage.from_("product-images").upload(
            filename,
            contents,
            file_options={"content-type": file.content_type},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

    # Get public URL
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/product-images/{filename}"

    return {"url": public_url, "filename": filename}


# --- Routes ---

@router.post("/", response_model=ProductResponse)
async def create_product(req: CreateProductRequest, current_user: dict = Depends(get_current_user)):
    """
    Create a new product listing.
    Automatically computes BERT embedding if the model is loaded.
    """
    sb = get_supabase()

    # Verify user is a manager (only managers can create products)
    user_result = sb.table("users").select("role, department_id").eq("id", current_user["sub"]).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = user_result.data[0]["role"]
    if user_role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create products")

    # Validate required fields
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="Product title is required")
    if req.price <= 0:
        raise HTTPException(status_code=400, detail="Price must be greater than 0")
    if req.stock < 1:
        raise HTTPException(status_code=400, detail="Stock must be at least 1")
    if not req.images or len(req.images) == 0:
        raise HTTPException(status_code=400, detail="At least one product image is required")
    if len(req.images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")

    # Insert the product
    result = sb.table("products").insert({
        "seller_id": current_user["sub"],
        "title": req.title.strip(),
        "description": req.description.strip(),
        "price": req.price,
        "stock": req.stock,
        "images": req.images,
        "tracking_number": req.tracking_number,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create product")

    product = result.data[0]

    # Compute and store BERT embedding (if model loaded)
    try:
        if bert_service._loaded:
            embedding = bert_service.compute_embedding(req.title)
            store_product_embedding(product["id"], embedding)
            print(f"[Products] Embedding computed for product: {product['id']}")
    except Exception as e:
        print(f"[Products] Warning: Failed to compute embedding: {e}")

    return build_product_response(product)


@router.post("/backfill-embeddings")
async def backfill_embeddings():
    """
    Compute and store BERT embeddings for all products that are missing them.
    Use this after adding products directly to the database.
    """
    if not bert_service._loaded:
        raise HTTPException(status_code=503, detail="BERT model not loaded. Cannot compute embeddings.")

    sb = get_supabase()
    # Fetch all products without embeddings
    result = sb.table("products").select("id, title").is_("embedding", "null").execute()

    if not result.data:
        return {"message": "All products already have embeddings.", "updated": 0}

    updated = 0
    errors = []
    for p in result.data:
        try:
            embedding = bert_service.compute_embedding(p["title"])
            store_product_embedding(p["id"], embedding)
            updated += 1
            print(f"[Backfill] Embedded: {p['id']} — {p['title']}")
        except Exception as e:
            errors.append({"id": p["id"], "title": p["title"], "error": str(e)})
            print(f"[Backfill] Failed: {p['id']} — {e}")

    return {
        "message": f"Backfill complete. {updated}/{len(result.data)} products updated.",
        "updated": updated,
        "total": len(result.data),
        "errors": errors,
    }


@router.get("/", response_model=list[ProductResponse])
async def list_products(limit: int = 50, offset: int = 0):
    """List all active products with stock > 0 (public, no auth required)."""
    sb = get_supabase()
    result = (
        sb.table("products")
        .select("*, users!products_seller_id_fkey(full_name, department_id)")
        .eq("is_active", True)
        .eq("status", "approved")
        .gt("stock", 0)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    # Collect department IDs to batch-lookup department names
    dept_ids = set()
    for p in result.data:
        user_info = p.get("users") or {}
        dept_id = user_info.get("department_id")
        if dept_id:
            dept_ids.add(dept_id)

    dept_names = {}
    if dept_ids:
        depts = sb.table("departments").select("id, name").in_("id", list(dept_ids)).execute()
        dept_names = {d["id"]: d["name"] for d in (depts.data or [])}

    products = []
    for p in result.data:
        user_info = p.get("users") or {}
        dept_id = user_info.get("department_id")
        if dept_id and dept_id in dept_names:
            seller_name = dept_names[dept_id]
        else:
            seller_name = user_info.get("full_name", "")
        products.append(build_product_response(p, seller_name))
    return products


@router.get("/my", response_model=list[ProductResponse])
async def list_my_products(current_user: dict = Depends(get_current_user)):
    """List products owned by the current user or their department (includes all, even out of stock)."""
    sb = get_supabase()
    user_id = current_user["sub"]

    # Check if user is a seller in a department — if so, also include products from their manager
    user_info = sb.table("users").select("role, department_id, manager_id").eq("id", user_id).execute()
    seller_ids = [user_id]

    if user_info.data and user_info.data[0].get("department_id"):
        dept_id = user_info.data[0]["department_id"]
        # Find the manager of this department (they create products for the department)
        dept = sb.table("departments").select("manager_id").eq("id", dept_id).execute()
        if dept.data and dept.data[0].get("manager_id"):
            manager_id = dept.data[0]["manager_id"]
            if manager_id not in seller_ids:
                seller_ids.append(manager_id)

    result = sb.table("products").select("*").in_("seller_id", seller_ids).order("created_at", desc=True).execute()

    return [build_product_response(p) for p in result.data]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    """Get a single product by ID (public)."""
    sb = get_supabase()
    result = sb.table("products").select("*, users!products_seller_id_fkey(full_name, department_id)").eq("id", product_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Product not found")

    p = result.data[0]
    user_info = p.get("users") or {}
    dept_id = user_info.get("department_id")
    seller_name = user_info.get("full_name", "")
    if dept_id:
        dept_resp = sb.table("departments").select("name").eq("id", dept_id).execute()
        if dept_resp.data:
            seller_name = dept_resp.data[0]["name"]
    return build_product_response(p, seller_name)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, req: UpdateProductRequest, current_user: dict = Depends(get_current_user)):
    """Update a product. Only the owner can update."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("products").select("seller_id").eq("id", product_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing.data[0]["seller_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not your product")

    # Build update dict (only non-None fields)
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate images limit
    if req.images is not None and len(req.images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")

    result = sb.table("products").update(update_data).eq("id", product_id).execute()
    p = result.data[0]

    # Re-compute embedding if title changed
    if req.title:
        try:
            if bert_service._loaded:
                embedding = bert_service.compute_embedding(req.title)
                store_product_embedding(product_id, embedding)
        except Exception as e:
            print(f"[Products] Warning: Failed to recompute embedding: {e}")

    return build_product_response(p)


@router.delete("/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    """Soft-delete a product (set is_active=False). Only the owner can delete."""
    sb = get_supabase()

    existing = sb.table("products").select("seller_id").eq("id", product_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Product not found")
    if existing.data[0]["seller_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not your product")

    sb.table("products").update({"is_active": False}).eq("id", product_id).execute()
    return {"message": "Product deleted successfully"}
