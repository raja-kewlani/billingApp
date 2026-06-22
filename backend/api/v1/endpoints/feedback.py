from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Any
from pydantic import UUID4
from core.supabase import get_supabase
from core.security import get_verified_jwt
from core.helpers import _extract_user_id_from_jwt
from models.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter()

@router.get("/", response_model=List[FeedbackResponse])
async def get_feedback(
    firm_id: UUID4,
    jwt: str = Depends(get_verified_jwt)
):
    supabase = await get_supabase()
    # Supabase RLS handles ensuring only authorized users see the feedback
    # (Merchants see their own, CA/CA admin see all for the firm)
    resp = await supabase.table("feedback").select("*").eq("firm_id", str(firm_id)).order("created_at", desc=False).execute()
    return resp.data

@router.post("/", response_model=FeedbackResponse)
async def create_feedback(
    feedback: FeedbackCreate,
    jwt: str = Depends(get_verified_jwt)
):
    supabase = await get_supabase()
    current_uid = _extract_user_id_from_jwt(jwt)
    
    # RLS ensures they can only create for their allowed firms and created_by = auth.uid()
    # We must explicitly pass created_by for Supabase to enforce the policy correctly.
    data = {
        "firm_id": str(feedback.firm_id),
        "created_by": current_uid,
        "description": feedback.description
    }
    resp = await supabase.table("feedback").insert(data).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to create feedback")
    return resp.data[0]

@router.delete("/{feedback_id}")
async def delete_feedback(
    feedback_id: UUID4,
    jwt: str = Depends(get_verified_jwt)
):
    supabase = await get_supabase()
    # RLS ensures only the merchant who created it can delete it
    resp = await supabase.table("feedback").delete().eq("id", str(feedback_id)).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Feedback not found or unauthorized")
    return {"message": "Feedback deleted successfully"}

@router.patch("/{feedback_id}/solve", response_model=FeedbackResponse)
async def solve_feedback(
    feedback_id: UUID4,
    jwt: str = Depends(get_verified_jwt)
):
    supabase = await get_supabase()
    # RLS ensures only CA / CA admin can update
    resp = await supabase.table("feedback").update({"is_solved": True}).eq("id", str(feedback_id)).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Feedback not found or unauthorized")
    return resp.data[0]
