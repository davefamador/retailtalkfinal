"""
Application configuration — loads settings from environment variables.
Set these in your HuggingFace Space secrets (Settings > Variables and Secrets).
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Database (direct connection for pgvector queries)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# JWT Auth
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# ML Models — all paths relative to /app/backend inside the container
BERT_MODEL_NAME = os.getenv("BERT_MODEL_NAME", "bert-base-multilingual-uncased")
CLASSIFIER_MODEL_PATH = os.getenv("CLASSIFIER_MODEL_PATH", "trained_model/pytorch_model.bin")
RANKER_MODEL_PATH = os.getenv("RANKER_MODEL_PATH", "trained_model/ranker")
INTENT_MODEL_PATH = os.getenv("INTENT_MODEL_PATH", "trained_model/intent_classifier")
SLOT_MODEL_PATH = os.getenv("SLOT_MODEL_PATH", "trained_model/slot_extractor")

BERT_MAX_LENGTH = 256
BERT_EMBEDDING_DIM = 768
INTENT_MAX_LENGTH = int(os.getenv("INTENT_MAX_LENGTH", "128"))
SLOT_MAX_LENGTH = int(os.getenv("SLOT_MAX_LENGTH", "128"))

# Score blending weights (must sum to 1.0)
RANKER_WEIGHT = float(os.getenv("RANKER_WEIGHT", "0.4"))
CLASSIFIER_WEIGHT = float(os.getenv("CLASSIFIER_WEIGHT", "0.25"))
SIMILARITY_WEIGHT = float(os.getenv("SIMILARITY_WEIGHT", "0.35"))

# Search
SEARCH_TOP_K_CANDIDATES = 50
SEARCH_MAX_RESULTS = 20

# App
APP_NAME = "RetailTalk"
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
