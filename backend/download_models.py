"""
Downloads large model weights from HuggingFace Model Hub at build time.
Run once during Docker build — weights are baked into the image.
Requires HF_TOKEN env var if the model repo is private.
"""

import os
from huggingface_hub import hf_hub_download

REPO_ID = "dashm/retailtalk-models"
TOKEN = os.getenv("HF_TOKEN", None)

files = [
    ("trained_model/intent_classifier/model.pt",  "intent_classifier/model.pt"),
    ("trained_model/slot_extractor/model.pt",      "slot_extractor/model.pt"),
    ("trained_model/ranker/model.safetensors",     "ranker/model.safetensors"),
    ("trained_model/pytorch_model.bin",            "pytorch_model.bin"),
]

base_dir = os.path.dirname(os.path.abspath(__file__))

for local_rel, hub_filename in files:
    local_path = os.path.join(base_dir, local_rel)
    if os.path.exists(local_path):
        print(f"[skip] {local_rel} already exists")
        continue
    print(f"[download] {hub_filename} -> {local_rel}")
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    hf_hub_download(
        repo_id=REPO_ID,
        filename=hub_filename,
        local_dir=os.path.join(base_dir, "trained_model"),
        token=TOKEN,
    )
    print(f"[done] {local_rel}")

print("[OK] All models downloaded.")
