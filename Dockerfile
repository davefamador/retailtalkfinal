FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (prevents pip from pulling GPU version)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./backend/

# Download large model weights from HuggingFace Model Hub
# HF_TOKEN is passed as a build secret from Space settings
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}
RUN python backend/download_models.py

# HuggingFace Spaces runs as non-root user — fix permissions
RUN chmod -R 777 /app

WORKDIR /app/backend

# HuggingFace Spaces requires port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
