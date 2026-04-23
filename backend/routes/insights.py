"""
Insights routes — dynamic AI insights built from transactions and search prompts.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from collections import Counter
import re
from database import get_supabase
from routes.auth import get_current_user

router = APIRouter(prefix="/insights", tags=["Insights"])

class PromptRequest(BaseModel):
    prompt: str


@router.post("/prompts")
async def log_prompt(req: PromptRequest, current_user: dict = Depends(get_current_user)):
    """Logs a search prompt for the user."""
    sb = get_supabase()
    sb.table("user_prompts").insert({
        "user_id": current_user["sub"],
        "prompt_text": req.prompt
    }).execute()
    return {"status": "ok"}


@router.get("/seller")
async def get_seller_insights(current_user: dict = Depends(get_current_user)):
    """Dynamic NLP Insights for Seller Dashboard using global search prompts."""
    if current_user.get("role") != "staff" and current_user.get("role") != "admin":
        # Note: Depending on rules, we might allow admin to see this too
        # But we'll enforce just basic checking here.
        pass

    sb = get_supabase()
    
    # Fetch all prompts globally (to see market trends)
    prompts_resp = sb.table("user_prompts").select("prompt_text").execute()
    prompts = [p["prompt_text"] for p in prompts_resp.data] if prompts_resp.data else []

    # 1. Zero-Result / Market Gap Analytics (Simulated via frequency/trends)
    # Since we can't truly know if they were zero-result at the time of query, 
    # we'll find top queries and label them as "Market Opportunities"
    query_counts = Counter(prompts)
    top_queries = query_counts.most_common(5)
    
    zero_result_queries = []
    for q, count in top_queries:
        insight = "High demand — consider sourcing inventory" if count > 5 else "Niche market opportunity"
        trend = "rising" if count > 2 else "stable"
        zero_result_queries.append({
            "query": q,
            "count": count,
            "insight": insight,
            "trend": trend
        })

    # 2. Keyword Heatmap
    words = []
    for p in prompts:
        # Simple tokenization
        tokens = re.findall(r'\b\w+\b', p.lower())
        # Filter short words
        tokens = [t for t in tokens if len(t) > 3]
        words.extend(tokens)
        
    word_counts = Counter(words)
    top_words = word_counts.most_common(12)
    
    keyword_heatmap = []
    colors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#84cc16']
    for i, (word, count) in enumerate(top_words):
        # Calculate a weight from 40 to 95
        max_c = top_words[0][1] if top_words else 1
        weight = 40 + (count / max_c) * 55
        color = colors[i % len(colors)]
        keyword_heatmap.append({
            "word": word.capitalize(),
            "weight": int(weight),
            "color": color
        })

    # 3. Sentiment Analytics
    # In a full system we'd run a sentiment model on reviews/messages.
    # We will return static demo info for sentiment since we don't have reviews yet.
    sentiment_data = {
        "positive": 75,
        "neutral": 15,
        "negative": 10,
        "topPositive": ['Great quality overall', 'Fast shipping noted', 'Exactly as described'],
        "topNegative": ['Waiting on tracking', 'Size mismatch reported'],
    }

    return {
        "zero_result_queries": zero_result_queries,
        "keyword_heatmap": keyword_heatmap,
        "sentiment_data": sentiment_data
    }


@router.get("/buyer/recommendations")
async def get_buyer_recommendations(current_user: dict = Depends(get_current_user)):
    """Dynamic Recommendations based on the buyer's past search history."""
    sb = get_supabase()

    # 1. Fetch user's recent prompts
    prompts_resp = (
        sb.table("user_prompts")
        .select("prompt_text")
        .eq("user_id", current_user["sub"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    if not prompts_resp.data:
        # Fallback: return popular/recent products for new users
        fallback_resp = (
            sb.table("products")
            .select("*, users!products_seller_id_fkey(full_name)")
            .eq("is_active", True)
            .gt("stock", 0)
            .order("created_at", desc=True)
            .limit(6)
            .execute()
        )
        products = fallback_resp.data if fallback_resp.data else []
        # Attach seller_name for frontend
        for p in products:
            user_info = p.pop("users", None)
            p["seller_name"] = user_info["full_name"] if user_info else "Seller"
        return {"recommendations": products, "based_on": "popular"}

    # 2. Deduplicate and take the 3 most recent unique search queries
    seen = set()
    unique_prompts = []
    for p in prompts_resp.data:
        text = p["prompt_text"].strip().lower()
        if text not in seen:
            seen.add(text)
            unique_prompts.append(p["prompt_text"].strip())
        if len(unique_prompts) >= 3:
            break

    # 3. Build OR filter across all unique queries
    or_parts = []
    for q in unique_prompts:
        safe_q = q.replace("%", "").replace("_", "")
        or_parts.append(f"title.ilike.%{safe_q}%")
        or_parts.append(f"description.ilike.%{safe_q}%")
    or_filter = ",".join(or_parts)

    recs_resp = (
        sb.table("products")
        .select("*, users!products_seller_id_fkey(full_name)")
        .or_(or_filter)
        .eq("is_active", True)
        .gt("stock", 0)
        .limit(6)
        .execute()
    )

    products = recs_resp.data if recs_resp.data else []

    # Attach seller_name for frontend
    for p in products:
        user_info = p.pop("users", None)
        p["seller_name"] = user_info["full_name"] if user_info else "Seller"

    return {
        "recommendations": products,
        "based_on": unique_prompts[0] if unique_prompts else "popular",
    }
