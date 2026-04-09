"""
Database connection helpers for Supabase.
Uses psycopg (v3) for direct PostgreSQL/pgvector queries (search),
and supabase-py for standard CRUD operations.
"""

import psycopg
from psycopg.rows import dict_row
import numpy as np
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY, DATABASE_URL

# --- Supabase Client (for CRUD operations) ---

_supabase_client: Client = None


def get_supabase() -> Client:
    """Get or create the Supabase client for standard CRUD operations."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client


# --- Direct PostgreSQL connection (for pgvector queries) ---

def get_db_connection():
    """Create a new psycopg3 connection for pgvector queries."""
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    return conn


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


# --- pgvector similarity search ---

def search_similar_products(query_embedding: np.ndarray, top_k: int = 50):
    """
    Find the top_k most similar products to the query embedding
    using pgvector cosine similarity search.
    Returns list of dicts with product info + embedding.
    """
    conn = get_db_connection()
    embedding_str = embedding_to_pgvector(query_embedding)
    
    query = """
        SELECT
            id, seller_id, title, description, price, stock, images,
            embedding::text as embedding_text,
            1 - (embedding <=> %s::vector) as similarity
        FROM products
        WHERE is_active = true AND status = 'approved' AND stock > 0 AND embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    
    try:
        with conn.cursor() as cur:
            cur.execute(query, (embedding_str, embedding_str, top_k))
            rows = cur.fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
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
    Find the top_k most similar products with optional structured filters.
    Extends search_similar_products with WHERE clauses from query rewriting.
    """
    conn = get_db_connection()
    embedding_str = embedding_to_pgvector(query_embedding)
    
    # Build dynamic WHERE clause
    conditions = ["is_active = true", "status = 'approved'", "stock > 0", "embedding IS NOT NULL"]
    filter_params = []

    if price_min is not None:
        conditions.append(f"price > %s")
        filter_params.append(price_min)

    if price_max is not None:
        conditions.append(f"price < %s")
        filter_params.append(price_max)

    if brand:
        conditions.append(f"(title ILIKE %s OR description ILIKE %s)")
        filter_params.append(f"%{brand}%")
        filter_params.append(f"%{brand}%")

    if color:
        conditions.append(f"(title ILIKE %s OR description ILIKE %s)")
        filter_params.append(f"%{color}%")
        filter_params.append(f"%{color}%")

    where_clause = " AND ".join(conditions)

    # Params must match SQL placeholder order:
    # 1) embedding for SELECT similarity, 2) filter params for WHERE,
    # 3) embedding for ORDER BY, 4) top_k for LIMIT
    params = [embedding_str] + filter_params + [embedding_str, top_k]

    query = f"""
        SELECT
            id, seller_id, title, description, price, stock, images,
            embedding::text as embedding_text,
            1 - (embedding <=> %s::vector) as similarity
        FROM products
        WHERE {where_clause}
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """

    try:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
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
    """Store/update the BERT embedding for a product."""
    conn = get_db_connection()
    embedding_str = embedding_to_pgvector(embedding)
    
    query = """
        UPDATE products SET embedding = %s::vector WHERE id = %s
    """
    
    try:
        with conn.cursor() as cur:
            cur.execute(query, (embedding_str, product_id))
        conn.commit()
    finally:
        conn.close()
