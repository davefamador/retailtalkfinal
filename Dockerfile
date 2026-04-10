FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && echo 'precedence ::ffff:0:0/96  100' >> /etc/gai.conf

# Install CPU-only PyTorch first (prevents pip from pulling GPU version)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./backend/

# Download large model weights from HuggingFace Model Hub
RUN --mount=type=secret,id=HF_TOKEN,mode=0444,required=false \
    HF_TOKEN=$(cat /run/secrets/HF_TOKEN 2>/dev/null) python backend/download_models.py

# Set up user with ID 1000 as required by HF Spaces
RUN useradd -m -u 1000 user
RUN chmod -R 777 /app
USER user

WORKDIR /app/backend

# HuggingFace Spaces requires port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
