"""
BERT Embedding Service — computes text embeddings using a pretrained BERT model.
Loaded once at startup, reused for all requests.
"""

import torch
import torch.nn.functional as F
import numpy as np
from transformers import BertModel, BertTokenizer
from config import BERT_MODEL_NAME, BERT_MAX_LENGTH


class BertEmbeddingService:
    """Singleton service that computes BERT embeddings for text."""

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self._loaded = False

    def load(self):
        """Load the BERT model and tokenizer. Call once at app startup."""
        if self._loaded:
            return

        print(f"[BertService] Loading BERT model: {BERT_MODEL_NAME}...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = BertModel.from_pretrained(BERT_MODEL_NAME)
        self.tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_NAME)
        self.model.to(self.device)
        self.model.eval()
        self._loaded = True
        print(f"[BertService] Model loaded on {self.device}")

    def _pool_summary(self, last_hidden_states, pool_op="max"):
        """Pool the BERT output into a single vector per input."""
        num_features = last_hidden_states.size()[1]
        hidden_p = last_hidden_states.permute(0, 2, 1)
        pool_fn = F.max_pool1d if pool_op == "max" else F.avg_pool1d
        return pool_fn(hidden_p, kernel_size=num_features).squeeze(-1)

    def compute_embedding(self, text: str) -> np.ndarray:
        """
        Compute a single BERT embedding for the given text.
        Returns a numpy array of shape (768,).
        """
        if not self._loaded:
            raise RuntimeError("BertService not loaded. Call load() first.")

        # Tokenize
        tokens = self.tokenizer(
            text,
            padding="max_length",
            truncation=True,
            max_length=BERT_MAX_LENGTH,
            return_attention_mask=True,
            return_tensors="pt",
        )

        # Move to device
        inputs = {
            "input_ids": tokens["input_ids"].to(self.device),
            "attention_mask": tokens["attention_mask"].to(self.device),
            "token_type_ids": tokens["token_type_ids"].to(self.device),
        }

        # Forward pass
        with torch.no_grad():
            output = self.model(**inputs)
            embedding = self._pool_summary(output[0])

        return embedding.detach().cpu().numpy().squeeze(0)  # shape: (768,)

    def compute_embeddings_batch(self, texts: list[str]) -> np.ndarray:
        """
        Compute BERT embeddings for a batch of texts.
        Returns numpy array of shape (N, 768).
        """
        if not self._loaded:
            raise RuntimeError("BertService not loaded. Call load() first.")

        tokens = self.tokenizer(
            texts,
            padding="max_length",
            truncation=True,
            max_length=BERT_MAX_LENGTH,
            return_attention_mask=True,
            return_tensors="pt",
        )

        inputs = {
            "input_ids": tokens["input_ids"].to(self.device),
            "attention_mask": tokens["attention_mask"].to(self.device),
            "token_type_ids": tokens["token_type_ids"].to(self.device),
        }

        with torch.no_grad():
            output = self.model(**inputs)
            embeddings = self._pool_summary(output[0])

        return embeddings.detach().cpu().numpy()  # shape: (N, 768)


# Global singleton instance
bert_service = BertEmbeddingService()
