"""
Contact routes — manage user contact numbers.
Required for buyers (before checkout) and delivery users (before accepting deliveries).
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_supabase
from routes.auth import get_current_user

router = APIRouter(prefix="/contacts", tags=["Contacts"])


class ContactRequest(BaseModel):
    contact_number: str
    delivery_address: Optional[str] = None


class ContactResponse(BaseModel):
    user_id: str
    contact_number: str
    delivery_address: str = ""


@router.get("/me", response_model=ContactResponse)
async def get_my_contact(current_user: dict = Depends(get_current_user)):
    """Get the current user's contact number and delivery address."""
    sb = get_supabase()
    result = sb.table("user_contacts").select("*").eq("user_id", current_user["sub"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No contact number set")
    row = result.data[0]
    return ContactResponse(
        user_id=row["user_id"],
        contact_number=row["contact_number"],
        delivery_address=row.get("delivery_address", ""),
    )


@router.put("/me", response_model=ContactResponse)
async def set_my_contact(req: ContactRequest, current_user: dict = Depends(get_current_user)):
    """Set or update the current user's contact number and delivery address."""
    if not req.contact_number or len(req.contact_number.strip()) < 7:
        raise HTTPException(status_code=400, detail="Please enter a valid contact number")

    sb = get_supabase()
    user_id = current_user["sub"]
    clean_number = req.contact_number.strip()
    address = (req.delivery_address or "").strip()

    # Upsert: try update first, then insert if not found
    existing = sb.table("user_contacts").select("user_id").eq("user_id", user_id).execute()
    if existing.data:
        sb.table("user_contacts").update({
            "contact_number": clean_number,
            "delivery_address": address,
        }).eq("user_id", user_id).execute()
    else:
        sb.table("user_contacts").insert({
            "user_id": user_id,
            "contact_number": clean_number,
            "delivery_address": address,
        }).execute()

    return ContactResponse(user_id=user_id, contact_number=clean_number, delivery_address=address)
