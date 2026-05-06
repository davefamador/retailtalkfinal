---
title: RetailTalk
emoji: 🛍️
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# RetailTalk — Installation Guide

A smart shopping website that understands what you mean, not just what you type.

---

## Steps

| Step | Description | Instructions |
|------|-------------|--------------|
| 1 | **Get access approvals** | Send your GitHub username to the RetailTalk maintainer. Request access to: the RetailTalk repository, the Supabase project, and the Hugging Face model repo (`dashm/retailtalk-models`). Accept all invitation emails. Confirm you can open the repo and Hugging Face model page in your browser before moving on. |
| 2 | **Install required tools** | Install Git from https://git-scm.com/downloads. Install Python 3.11 from https://www.python.org/downloads/ — on the first installer screen, tick **"Add Python to PATH"**. Install Node.js version 18 or newer from https://nodejs.org/ (click the LTS button). Install VS Code from https://code.visualstudio.com/. Restart your computer. Verify setup by opening a terminal and running: `python --version`, `node -v`, and `npm -v`. Each should show a version number. |
| 3 | **Clone RetailTalk locally** | Open a terminal. Run: `git clone https://github.com/Dashm/RetailTalk.git`. Then run: `cd RetailTalk`. Open the folder in VS Code by running: `code .` |
| 4 | **Set up the Python backend environment** | Navigate to the backend: `cd RetailTalk/backend`. Create a virtual environment: `python -m venv venv`. Activate it — Windows: `venv\Scripts\activate`, Mac/Linux: `source venv/bin/activate`. You should see `(venv)` appear at the start of the line. Install dependencies: `pip install -r requirements.txt`. Install PyTorch (CPU): `pip install torch --index-url https://download.pytorch.org/whl/cpu`. |
| 5 | **Configure backend environment** | Copy the example file: `cp .env.example .env`. Open `.env` and fill in the required values: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, and `JWT_SECRET`. Get Supabase credentials from Project Settings → API in your Supabase dashboard. Double-check there are no extra spaces or quotes around values. If you do not have the values yet, pause here and request them from the maintainer. |
| 6 | **Download ML model weights** | Run: `python download_models.py`. If the Hugging Face repo is private, set your token first — Windows: `set HF_TOKEN=hf_your_token_here`, Mac/Linux: `export HF_TOKEN=hf_your_token_here` — then re-run. Confirm these files exist under `trained_model/` before continuing: `pytorch_model.bin`, `intent_classifier/model.pt`, `slot_extractor/model.pt`, `ranker/model.safetensors`. |
| 7 | **Start the backend** | Run: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`. Watch the terminal — all 5 ML models must log `[OK]` before the server is ready. Open `http://localhost:8000/docs` to confirm the API is up. If a model fails to load, re-check Step 6. |
| 8 | **Set up and start the frontend** | Open a new terminal. Navigate to: `cd RetailTalk/frontend`. Install dependencies: `npm install`. Copy the env example: `cp .env.example .env.local`. Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`. Run: `npm run dev`. Open the local URL shown in terminal (usually `localhost:3000`). Confirm the app renders without errors. |
| 9 | **Validate login and core flows** | Test email/password registration and login. Confirm a user session is created and your role dashboard opens. Run a search query (e.g. "blue Nike shoes under 2000") and confirm results appear with ESCI labels. Test a data-backed page (Cart, Wishlist, Admin) to confirm Supabase connectivity. If authentication fails, re-check environment values and your Supabase service access. |
| 10 | **Run local quality checks** | In the frontend folder, run: `npm run build`. Fix any build errors before creating a branch or PR. Confirm the backend starts cleanly with no import or model-load errors on a fresh `uvicorn` run. |
| 11 | **Start contributing with Git flow** | Return to the root folder. Create a branch: `git checkout -b feature/your-task-name`. Make changes and commit in small logical chunks. Push the branch and open a PR to `main`. Add test notes and screenshots in the PR description. |
| 12 | **Final pre-PR checklist** | Ensure no secrets are committed (`.env`, `.env.local`, HF tokens). Re-run the frontend build. Pull the latest `main` and resolve any conflicts. Confirm a reviewer can reproduce your setup and changes quickly. |
| 13 | **Keep secrets safe** | Never commit `.env` or `.env.local` files, private keys, or HF tokens. This repo already ignores local env files but always double-check your staged files with `git diff --staged` before pushing. |

---

## Something went wrong?

| What you see | What to do |
|---|---|
| **"python is not recognized"** | Reinstall Python 3.11 and tick **"Add Python to PATH"** on the first installer screen. |
| **"node is not recognized"** | Go back and install Node.js from https://nodejs.org/ (Step 2). |
| **pip install fails** | Make sure `(venv)` is showing at the start of your line. If not, activate the venv first (Step 4). |
| **Backend starts but a model fails to load** | Re-run `python download_models.py` and confirm all 4 model files exist (Step 6). |
| **Login does not work** | The `.env` file is missing or has wrong values. Re-check Step 5. |
| **Port 3000 already in use** | Restart your computer and try again, or close other local development servers. |
| **Port 8000 already in use** | Another backend is running. Close it or restart your computer. |
| **Nothing downloaded after 30+ minutes** | Check your internet connection. The first run downloads approximately 2 GB of data. |

---

## What's inside the project

```
RetailTalk/
├── backend/      The "brain" — understands your search and finds products
├── frontend/     The website you see in your browser
├── database/     The shopping database structure
├── train/        Data and notebooks used to teach the AI
└── run.bat       One-click launcher (for quick demo use)
```

### AI models included
- **BERT multilingual embeddings** — understands meaning across languages
- **Intent classifier** — figures out what you are trying to do
- **Slot extractor** — picks out brands, prices, and categories from your search
- **CrossEncoder ranker** — ranks the best matching products
- **ESCI classifier** — labels each result as Exact / Substitute / Complement / Irrelevant
