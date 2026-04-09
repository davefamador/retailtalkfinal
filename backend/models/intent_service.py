"""
Intent Classification Service — runs the trained IntentClassifier model
for real-time inference on user queries.

Loaded once at startup, reused for all search requests.
Intents: single_search, multi_search, filtered_search, free_form (multi-label)
"""

import os
import json
import torch
import torch.nn as nn
import numpy as np
from transformers import BertModel, BertTokenizer
from config import INTENT_MODEL_PATH, BERT_MODEL_NAME, INTENT_MAX_LENGTH


class IntentClassifier(nn.Module):
    """
    BERT + classification head for multi-label intent classification.
    Must match the architecture used during training.
    """

    def __init__(self, bert_model_name="bert-base-multilingual-uncased", num_intents=4):
        super().__init__()
        self.bert = BertModel.from_pretrained(bert_model_name)
        self.dropout = nn.Dropout(0.3)
        self.fc1 = nn.Linear(768, 256)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(256, num_intents)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        cls_output = outputs.last_hidden_state[:, 0, :]  # [CLS] token
        x = self.dropout(cls_output)
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        logits = self.fc2(x)
        return logits


class IntentService:
    """Singleton service for intent classification at inference time."""

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self.label_names = []
        self._loaded = False

    def load(self):
        """Load the trained intent classifier. Call once at app startup."""
        if self._loaded:
            return

        model_dir = INTENT_MODEL_PATH

        model_path = os.path.join(model_dir, "model.pt")
        label_map_path = os.path.join(model_dir, "label_map.json")
        config_path = os.path.join(model_dir, "config.json")

        if not os.path.exists(model_path):
            print(f"[IntentService] WARNING: Model not found at {model_path}")
            print("[IntentService] Intent classification will be unavailable.")
            return

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load config for label names
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                config = json.load(f)
            self.label_names = config.get("label_names", [])
            num_intents = config.get("num_intents", 4)
        elif os.path.exists(label_map_path):
            with open(label_map_path, "r") as f:
                label_map = json.load(f)
            self.label_names = sorted(label_map.keys(), key=lambda k: label_map[k])
            num_intents = len(self.label_names)
        else:
            self.label_names = ["single_search", "multi_search", "filtered_search", "free_form"]
            num_intents = 4

        print(f"[IntentService] Loading intent classifier ({num_intents} intents)...")
        self.model = IntentClassifier(
            bert_model_name=BERT_MODEL_NAME,
            num_intents=num_intents,
        )

        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

        self.tokenizer = BertTokenizer.from_pretrained(BERT_MODEL_NAME)
        self._loaded = True
        print(f"[IntentService] Intent classifier loaded on {self.device}")
        print(f"[IntentService] Labels: {self.label_names}")

    def predict(self, query: str, threshold: float = 0.5) -> dict:
        """
        Classify a query's intents (multi-label).

        Returns:
            {
                "intents": ["single_search", "filtered_search"],
                "probabilities": {
                    "single_search": 0.92,
                    "multi_search": 0.03,
                    "filtered_search": 0.87,
                    "free_form": 0.01
                }
            }
        """
        if not self._loaded:
            return {"intents": [], "probabilities": {}}

        tokens = self.tokenizer(
            query,
            padding="max_length",
            truncation=True,
            max_length=INTENT_MAX_LENGTH,
            return_tensors="pt",
        )

        input_ids = tokens["input_ids"].to(self.device)
        attention_mask = tokens["attention_mask"].to(self.device)

        with torch.no_grad():
            logits = self.model(input_ids, attention_mask)
            probs = torch.sigmoid(logits).cpu().numpy()[0]

        probabilities = {
            name: round(float(probs[i]), 4) for i, name in enumerate(self.label_names)
        }
        active_intents = [
            name for i, name in enumerate(self.label_names) if probs[i] > threshold
        ]

        return {
            "intents": active_intents,
            "probabilities": probabilities,
        }


# Global singleton
intent_service = IntentService()
