"""
you must have pip install hf before doing this thing
Downloads model weights from HuggingFace Model Hub into the aimodels/ folder.
Runs automatically on startup if any file is missing.
Skips files that already exist — safe to call on every restart.
"""

import os
from huggingface_hub import hf_hub_download
from huggingface_hub.errors import RemoteEntryNotFoundError, RepositoryNotFoundError

REPO_ID = "dashm/retailtalk-models"
TOKEN = os.getenv("HF_TOKEN") or None

# (hub_filename, local_filename_inside_aimodels)
FILES = [
    ("pytorch_model.bin",        "pytorch_model.bin"),
    ("ranker/model.safetensors", "ranker/model.safetensors"),
    ("ranker/config.json",                   "ranker/config.json"),
    ("ranker/tokenizer.json",                "ranker/tokenizer.json"),
    ("ranker/tokenizer_config.json",         "ranker/tokenizer_config.json"),
    ("ranker/special_tokens_map.json",       "ranker/special_tokens_map.json"),
    ("ranker/vocab.txt",                     "ranker/vocab.txt"),
    ("intent_classifier/model.pt", "intent_classifier/model.pt"),
    ("slot_extractor/model.pt",    "slot_extractor/model.pt"),
]

# aimodels/ lives next to this file's parent (project root/aimodels)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AIMODELS_DIR = os.path.join(BASE_DIR, "aimodels")


def download_models():
    os.makedirs(AIMODELS_DIR, exist_ok=True)
    all_present = True

    for hub_filename, local_name in FILES:
        local_path = os.path.join(AIMODELS_DIR, local_name)
        if os.path.exists(local_path):
            print(f"[skip] {local_name} already exists")
            continue

        all_present = False
        print(f"[download] {hub_filename} -> aimodels/{local_name}")
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            hf_hub_download(
                repo_id=REPO_ID,
                filename=hub_filename,
                local_dir=AIMODELS_DIR,
                local_dir_use_symlinks=False,
                token=TOKEN,
            )
            if os.path.exists(local_path):
                print(f"[done] {local_name}")
            else:
                print(f"[warn] {local_name} downloaded but not found at expected path")
        except (RemoteEntryNotFoundError, RepositoryNotFoundError) as e:
            print(f"[miss] {hub_filename} not found on Hub — service will run without it")

    if all_present:
        print("[OK] All models already present, skipping download.")
    else:
        print("[OK] Model download step finished.")


if __name__ == "__main__":
    download_models()
