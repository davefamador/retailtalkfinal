"""
RetailTalk — FastAPI Backend Entry Point

This is the main file that starts the API server.
Run with: uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import APP_NAME, DEBUG
from database import close_db_pool
from routes import auth, products, search, transactions, admin, insights, contacts, cart, delivery, manager, restock, wishlist

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # --- Startup ---
    print(f"[START] Starting {APP_NAME} backend...")

    # Load ML models
    from models.bert_service import bert_service
    from models.classifier import classifier_service
    from models.ranker import ranker_service
    from models.intent_service import intent_service
    from models.slot_service import slot_service
    from models.query_rewriter import query_rewriter

    print("[ML] Loading BERT model...")
    bert_service.load()
    print("[ML] Loading classifier model...")
    classifier_service.load()
    print("[ML] Loading ranker model (optional)...")
    ranker_service.load()
    print("[ML] Loading intent classifier (optional)...")
    intent_service.load()
    print("[ML] Loading slot extractor (optional)...")
    slot_service.load()

    # Initialize query rewriter with loaded services
    query_rewriter.init(intent_service, slot_service)
    print("[ML] Query rewriter initialized")

    print(f"[OK] {APP_NAME} backend ready!")

    yield

    # --- Shutdown ---
    print("[STOP] Shutting down...")
    close_db_pool()


# Create FastAPI app
app = FastAPI(
    title=f"{APP_NAME} API",
    description=(
        "An NLP for querying e-commerce product. "
        "Uses BERT embeddings + CrossEncoder ranking + QueryProductClassifier to "
        "find, rank, and classify product search results "
        "as Exact / Substitute / Complement / Irrelevant."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route groups
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(search.router)
app.include_router(transactions.router)
app.include_router(admin.router)
app.include_router(insights.router)
app.include_router(contacts.router)
app.include_router(cart.router)
app.include_router(delivery.router)
app.include_router(manager.router)
app.include_router(restock.router)
app.include_router(wishlist.router)


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    from models.bert_service import bert_service
    from models.classifier import classifier_service
    from models.ranker import ranker_service
    from models.intent_service import intent_service
    from models.slot_service import slot_service
    return {
        "app": APP_NAME,
        "status": "running",
        "ml_status": {
            "bert": "loaded" if bert_service._loaded else "not loaded",
            "classifier": "loaded" if classifier_service._loaded else "not loaded",
            "ranker": "loaded" if ranker_service._loaded else "not loaded",
            "intent": "loaded" if intent_service._loaded else "not loaded",
            "slot": "loaded" if slot_service._loaded else "not loaded",
        },
    }

