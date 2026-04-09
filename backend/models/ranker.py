"""
Ranker Service — loads the trained CrossEncoder model and scores
(query, product_title) pairs for relevance ranking.
Loaded once at startup, reused for all requests.
"""

import os
import torch
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from config import RANKER_MODEL_PATH


class RankerService:
    """Singleton service that scores query-product relevance using a CrossEncoder."""

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self._loaded = False

    def load(self):
        """Load the trained CrossEncoder model and tokenizer. Call once at app startup."""
        if self._loaded:
            return

        model_path = RANKER_MODEL_PATH
        if not os.path.exists(model_path):
            print(f"[RankerService] WARNING: Model not found at {model_path}")
            print("[RankerService] Search will use classification-only ranking (no CrossEncoder re-ranking)")
            return

        print(f"[RankerService] Loading CrossEncoder from {model_path}...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path).to(self.device)
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model.eval()
        self._loaded = True
        print(f"[RankerService] CrossEncoder loaded on {self.device}")

    def rank(self, query: str, product_titles: list[str], batch_size: int = 64) -> np.ndarray:
        """
        Score a query against multiple product titles using the CrossEncoder.
        Returns a numpy array of relevance scores, shape (N,).
        Higher score = more relevant.
        """
        if not self._loaded:
            # Return neutral scores if model not loaded
            return np.zeros(len(product_titles))

        n = len(product_titles)
        scores = np.zeros(n)

        with torch.no_grad():
            for i in range(0, n, batch_size):
                j = min(i + batch_size, n)
                batch_titles = product_titles[i:j]
                batch_queries = [query] * len(batch_titles)

                features = self.tokenizer(
                    batch_queries,
                    batch_titles,
                    padding=True,
                    truncation=True,
                    return_tensors="pt",
                ).to(self.device)

                logits = self.model(**features).logits
                scores[i:j] = logits.squeeze(-1).cpu().numpy()

        return scores

    def normalize_scores(self, scores: np.ndarray) -> np.ndarray:
        """Normalize scores to [0, 1] range using min-max normalization."""
        if len(scores) == 0:
            return scores
        min_s = scores.min()
        max_s = scores.max()
        if max_s - min_s < 1e-8:
            return np.ones_like(scores)  # All same score → all 1.0
        return (scores - min_s) / (max_s - min_s)


# Global singleton instance
ranker_service = RankerService()
