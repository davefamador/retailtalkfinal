"""
Classifier Service — loads the trained QueryProductClassifier model
and classifies (query, product) pairs into E/S/C/I labels.
"""

import os
import torch
import torch.nn as nn
import numpy as np
from config import CLASSIFIER_MODEL_PATH, BERT_EMBEDDING_DIM


class QueryProductClassifier(nn.Module):
    """
    Feed-forward classifier that takes concatenated query + product embeddings
    and classifies into E/S/C/I categories.
    This is a copy of the trained model architecture from the ESCI project.
    Must stay in sync with classification_identification/query_product/classifier_model.py
    """

    def __init__(self, size_pretrained=768, dense_hidden_dim=256, num_dense_layers=2, num_labels=4, dropout_rate=0.1):
        super(QueryProductClassifier, self).__init__()
        self.num_labels = 1 if num_labels <= 2 else num_labels
        self.size_pretrained = size_pretrained * 2  # query + product concatenated
        fc_layers = []
        prev_dim = self.size_pretrained
        self.dropout_embedding = nn.Dropout(dropout_rate)
        for _ in range(num_dense_layers):
            fc_layers.append(nn.Linear(prev_dim, dense_hidden_dim, bias=True))
            fc_layers.append(nn.BatchNorm1d(dense_hidden_dim))
            fc_layers.append(nn.ReLU())
            fc_layers.append(nn.Dropout(dropout_rate))
            prev_dim = dense_hidden_dim
        fc_layers.append(nn.Linear(prev_dim, self.num_labels))
        self.fc = nn.Sequential(*fc_layers)

    def forward(self, query_embedding, product_embedding):
        embedding = torch.cat((query_embedding, product_embedding), 1)
        embedding = self.dropout_embedding(embedding)
        logits = self.fc(embedding).squeeze(-1)
        return logits


# Label mapping
CLASS_ID_TO_LABEL = {
    0: "Exact",
    1: "Substitute",
    2: "Complement",
    3: "Irrelevant",
}

# Priority for sorting (lower = more relevant = shown first)
LABEL_PRIORITY = {
    "Exact": 0,
    "Substitute": 1,
    "Complement": 2,
    "Irrelevant": 3,
}


class ClassifierService:
    """Singleton service that classifies query-product pairs."""

    def __init__(self):
        self.model = None
        self.device = None
        self._loaded = False

    def load(self):
        """Load the trained classifier model. Call once at app startup."""
        if self._loaded:
            return

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        model_path = CLASSIFIER_MODEL_PATH
        if not os.path.exists(model_path):
            print(f"[ClassifierService] WARNING: Model file not found at {model_path}")
            print("[ClassifierService] Search will use similarity-only ranking (no E/S/C/I classification)")
            return

        print(f"[ClassifierService] Loading classifier from {model_path}...")
        self.model = QueryProductClassifier(
            size_pretrained=BERT_EMBEDDING_DIM,
            num_labels=4,
        )
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
        self._loaded = True
        print(f"[ClassifierService] Classifier loaded on {self.device}")

    def classify(self, query_embedding: np.ndarray, product_embedding: np.ndarray) -> dict:
        """
        Classify a single (query, product) pair.
        Returns: {"label": "Exact", "confidence": 0.92, "class_id": 0}
        """
        if not self._loaded:
            return {"label": "Unknown", "confidence": 0.0, "class_id": -1}

        q = torch.tensor(query_embedding).float().unsqueeze(0).to(self.device)
        p = torch.tensor(product_embedding).float().unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(q, p)
            probabilities = torch.softmax(logits, dim=1)
            class_id = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0][class_id].item()

        return {
            "label": CLASS_ID_TO_LABEL[class_id],
            "confidence": round(confidence, 4),
            "class_id": class_id,
        }

    def classify_batch(self, query_embedding: np.ndarray, product_embeddings: np.ndarray) -> list[dict]:
        """
        Classify a query against multiple products at once.
        query_embedding: shape (768,)
        product_embeddings: shape (N, 768)
        Returns list of classification dicts.
        """
        if not self._loaded:
            return [{"label": "Unknown", "confidence": 0.0, "class_id": -1}] * len(product_embeddings)

        n = product_embeddings.shape[0]
        # Repeat query embedding N times to match batch
        q = torch.tensor(np.tile(query_embedding, (n, 1))).float().to(self.device)
        p = torch.tensor(product_embeddings).float().to(self.device)

        with torch.no_grad():
            logits = self.model(q, p)
            probabilities = torch.softmax(logits, dim=1)
            class_ids = torch.argmax(probabilities, dim=1).cpu().numpy()
            confidences = probabilities.max(dim=1).values.cpu().numpy()

        all_probs = probabilities.cpu().numpy()

        results = []
        for i in range(n):
            results.append({
                "label": CLASS_ID_TO_LABEL[int(class_ids[i])],
                "confidence": round(float(confidences[i]), 4),
                "class_id": int(class_ids[i]),
                "exact_prob": round(float(all_probs[i][0]), 4),
                "substitute_prob": round(float(all_probs[i][1]), 4),
                "complement_prob": round(float(all_probs[i][2]), 4),
                "irrelevant_prob": round(float(all_probs[i][3]), 4),
            })
        return results

# Global singleton instance
classifier_service = ClassifierService()
