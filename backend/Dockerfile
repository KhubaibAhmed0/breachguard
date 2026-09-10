# Build Stage
FROM python:3.12-slim AS builder

WORKDIR /install

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final Production Minimal Image
FROM python:3.12-slim AS runner

# Security: Dedicated unprivileged non-root system user
RUN groupadd -g 10001 breachguard && \
    useradd -u 10001 -g breachguard -s /bin/false -m appuser

# Install only minimal runtime shared libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source code with unprivileged ownership
COPY --chown=appuser:breachguard . .

# Security: Drop root, run strictly as non-root user
USER appuser

ENV PORT=7860 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 7860

# Health check verifies local API availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:7860/api/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860} --workers 2 --no-server-header"]
