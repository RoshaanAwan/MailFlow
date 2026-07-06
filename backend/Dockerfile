# MailFlow backend — Docker image for Hugging Face Spaces (Docker Space).
# HF Spaces send traffic to port 7860, so the app listens there.
FROM python:3.11-slim

# Faster, cleaner Python in containers.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first (better layer caching).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source.
COPY . .

# HF Spaces expects the container to listen on 7860.
ENV PORT=7860
EXPOSE 7860

# Start the API. Honors $PORT (defaults to 7860).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
