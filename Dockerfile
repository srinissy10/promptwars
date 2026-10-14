FROM node:22-slim AS frontend-builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY --from=frontend-builder /frontend/dist ./frontend/dist
COPY run.py ./
COPY config.example.yaml ./config.yaml

RUN mkdir -p /app/data/uploads /app/logs

EXPOSE 8000

CMD ["python", "run.py"]
