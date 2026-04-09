"""
Slot Extraction Service — runs the trained SlotExtractor (NER) model
for real-time inference on user queries.

Loaded once at startup, reused for all search requests.
Extracts: PRODUCT1, PRODUCT2, BRAND, COLOR, PRICE_MIN, PRICE_MAX,
          PRICE_MOD, RATING_MIN, RATING_MOD, CONN, SIZE, etc.
"""

import os
import json
import torch
import torch.nn as nn
import numpy as np
from transformers import BertModel, BertTokenizerFast
from config import SLOT_MODEL_PATH, BERT_MODEL_NAME, SLOT_MAX_LENGTH


class SlotExtractor(nn.Module):
    """
    BERT + token-level classification head for NER/slot extraction.
    Must match the architecture used during training.
    """

    def __init__(self, bert_model_name="bert-base-multilingual-uncased", num_tags=20):
        super().__init__()
        self.bert = BertModel.from_pretrained(bert_model_name)
        self.dropout = nn.Dropout(0.3)
        self.classifier = nn.Linear(768, num_tags)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        sequence_output = outputs.last_hidden_state
        sequence_output = self.dropout(sequence_output)
        logits = self.classifier(sequence_output)
        return logits


class SlotService:
    """Singleton service for slot/entity extraction at inference time."""

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self.tag2id = {}
        self.id2tag = {}
        self._loaded = False

    def load(self):
        """Load the trained slot extractor. Call once at app startup."""
        if self._loaded:
            return

        model_dir = SLOT_MODEL_PATH

        model_path = os.path.join(model_dir, "model.pt")
        tag_map_path = os.path.join(model_dir, "tag_map.json")
        config_path = os.path.join(model_dir, "config.json")

        if not os.path.exists(model_path):
            print(f"[SlotService] WARNING: Model not found at {model_path}")
            print("[SlotService] Slot extraction will be unavailable.")
            return

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load tag map
        if os.path.exists(tag_map_path):
            with open(tag_map_path, "r") as f:
                self.tag2id = json.load(f)
        elif os.path.exists(config_path):
            with open(config_path, "r") as f:
                config = json.load(f)
            tag_names = config.get("tag_names", [])
            self.tag2id = {tag: i for i, tag in enumerate(tag_names)}
        else:
            print("[SlotService] WARNING: No tag_map.json or config.json found")
            return

        self.id2tag = {v: k for k, v in self.tag2id.items()}
        num_tags = len(self.tag2id)

        print(f"[SlotService] Loading slot extractor ({num_tags} tags)...")
        self.model = SlotExtractor(
            bert_model_name=BERT_MODEL_NAME,
            num_tags=num_tags,
        )

        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

        self.tokenizer = BertTokenizerFast.from_pretrained(BERT_MODEL_NAME)
        self._loaded = True
        print(f"[SlotService] Slot extractor loaded on {self.device}")
        print(f"[SlotService] Tags: {sorted(self.tag2id.keys())}")

    def extract(self, query: str) -> dict:
        """
        Extract slots/entities from a query using BIO tagging.

        Returns:
            {
                "slots": {
                    "PRODUCT1": "shoes",
                    "BRAND": "Nike",
                    "COLOR": "blue",
                    "PRICE_MAX": "3000"
                },
                "tagged_tokens": [
                    ("blue", "B-COLOR"),
                    ("Nike", "B-BRAND"),
                    ("shoes", "B-PRODUCT1"),
                    ("under", "B-PRICE_MOD"),
                    ("3000", "B-PRICE_MAX")
                ]
            }
        """
        if not self._loaded:
            return {"slots": {}, "tagged_tokens": []}

        # Tokenize
        words = query.split()
        encoding = self.tokenizer(
            words,
            is_split_into_words=True,
            padding="max_length",
            truncation=True,
            max_length=SLOT_MAX_LENGTH,
            return_tensors="pt",
        )

        input_ids = encoding["input_ids"].to(self.device)
        attention_mask = encoding["attention_mask"].to(self.device)
        word_ids = encoding.word_ids(batch_index=0)

        # Predict
        with torch.no_grad():
            logits = self.model(input_ids, attention_mask)
            preds = torch.argmax(logits, dim=-1).cpu().numpy()[0]

        # Decode: map subword predictions back to words
        # Only take the first subword prediction for each word
        word_tags = {}
        for token_idx, word_idx in enumerate(word_ids):
            if word_idx is None:
                continue  # [CLS], [SEP], [PAD]
            if word_idx not in word_tags:
                tag_id = int(preds[token_idx])
                word_tags[word_idx] = self.id2tag.get(tag_id, "O")

        # Build tagged tokens list
        tagged_tokens = []
        for word_idx, word in enumerate(words):
            tag = word_tags.get(word_idx, "O")
            tagged_tokens.append((word, tag))

        # Merge BIO tags into slot dict
        slots = self._merge_bio_tags(words, tagged_tokens)

        return {
            "slots": slots,
            "tagged_tokens": tagged_tokens,
        }

    def _merge_bio_tags(self, words: list, tagged_tokens: list) -> dict:
        """
        Merge BIO-tagged tokens into a slot dictionary.

        Example:
            [("blue", "B-COLOR"), ("Nike", "B-BRAND"), ("running", "B-PRODUCT1"),
             ("shoes", "I-PRODUCT1")]
            -> {"COLOR": "blue", "BRAND": "Nike", "PRODUCT1": "running shoes"}
        """
        slots = {}
        current_entity = None
        current_tokens = []

        for word, tag in tagged_tokens:
            if tag.startswith("B-"):
                # Save previous entity
                if current_entity and current_tokens:
                    slot_key = current_entity
                    slot_value = " ".join(current_tokens)
                    # Handle multiple entities of same type (e.g., PRODUCT1, PRODUCT2)
                    if slot_key in slots:
                        slots[slot_key] += " " + slot_value
                    else:
                        slots[slot_key] = slot_value

                current_entity = tag[2:]  # Strip "B-"
                current_tokens = [word]

            elif tag.startswith("I-"):
                entity_type = tag[2:]
                if entity_type == current_entity:
                    current_tokens.append(word)
                else:
                    # Mismatched I-tag: save current, start new
                    if current_entity and current_tokens:
                        slot_key = current_entity
                        slot_value = " ".join(current_tokens)
                        if slot_key in slots:
                            slots[slot_key] += " " + slot_value
                        else:
                            slots[slot_key] = slot_value
                    current_entity = entity_type
                    current_tokens = [word]
            else:
                # O tag: save current entity
                if current_entity and current_tokens:
                    slot_key = current_entity
                    slot_value = " ".join(current_tokens)
                    if slot_key in slots:
                        slots[slot_key] += " " + slot_value
                    else:
                        slots[slot_key] = slot_value
                current_entity = None
                current_tokens = []

        # Save last entity
        if current_entity and current_tokens:
            slot_key = current_entity
            slot_value = " ".join(current_tokens)
            if slot_key in slots:
                slots[slot_key] += " " + slot_value
            else:
                slots[slot_key] = slot_value

        return slots


# Global singleton
slot_service = SlotService()
