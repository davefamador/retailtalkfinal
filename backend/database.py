"""
Database connection helpers for Supabase.
Uses Supabase RPC for pgvector similarity search (works over HTTPS),
and supabase-py for standard CRUD operations.
"""

import os
import numpy as np
from supabase import create_client, Client

# --- Supabase Client (for CRUD operations) ---

_supabase_client: Client = None


def get_supabase() -> Client:
    """Get or create the Supabase client for standard CRUD operations."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"].strip(),
            os.environ["SUPABASE_KEY"].strip(),
        )
    return _supabase_client


def close_db_pool():
    """Placeholder for shutdown compatibility."""
    pass


# --- Helper: embedding <-> database conversion ---

def embedding_to_pgvector(embedding: np.ndarray) -> str:
    """Convert a numpy embedding to pgvector string format: '[0.1,0.2,...]'"""
    return "[" + ",".join(f"{x:.8f}" for x in embedding.tolist()) + "]"


def pgvector_to_embedding(pgvector_str: str) -> np.ndarray:
    """Convert a pgvector string back to numpy array."""
    values = pgvector_str.strip("[]").split(",")
    return np.array([float(v) for v in values], dtype=np.float32)


# --- pgvector similarity search (via Supabase RPC) ---

def search_similar_products(query_embedding: np.ndarray, top_k: int = 50):
    """
    Find the top_k most similar products to the query embedding
    using pgvector cosine similarity search via Supabase RPC.
    """
    sb = get_supabase()
    embedding_list = query_embedding.tolist()

    response = sb.rpc("search_products_by_embedding", {
        "query_embedding": embedding_list,
        "match_count": top_k,
    }).execute()

    results = []
    for row in response.data:
        results.append({
            "id": str(row["id"]),
            "seller_id": str(row["seller_id"]),
            "title": row["title"],
            "description": row["description"],
            "price": float(row["price"]),
            "stock": int(row["stock"]),
            "images": row["images"] or [],
            "embedding": pgvector_to_embedding(row["embedding_text"]),
            "similarity": float(row["similarity"]),
        })

    return results


def search_similar_products_filtered(
    query_embedding: np.ndarray,
    top_k: int = 50,
    price_min: float = None,
    price_max: float = None,
    brand: str = None,
    color: str = None,
):
    """
    Find the top_k most similar products with optional structured filters
    via Supabase RPC.
    """
    sb = get_supabase()
    embedding_list = query_embedding.tolist()

    response = sb.rpc("search_products_by_embedding_filtered", {
        "query_embedding": embedding_list,
        "match_count": top_k,
        "filter_price_min": price_min,
        "filter_price_max": price_max,
        "filter_brand": brand,
        "filter_color": color,
    }).execute()

    results = []
    for row in response.data:
        results.append({
            "id": str(row["id"]),
            "seller_id": str(row["seller_id"]),
            "title": row["title"],
            "description": row["description"],
            "price": float(row["price"]),
            "stock": int(row["stock"]),
            "images": row["images"] or [],
            "embedding": pgvector_to_embedding(row["embedding_text"]),
            "similarity": float(row["similarity"]),
        })

    return results


def store_product_embedding(product_id: str, embedding: np.ndarray):
    """Store/update the BERT embedding for a product via Supabase RPC."""
    sb = get_supabase()
    embedding_str = embedding_to_pgvector(embedding)

    sb.rpc("update_product_embedding", {
        "p_product_id": product_id,
        "p_embedding": embedding_str,
    }).execute()
