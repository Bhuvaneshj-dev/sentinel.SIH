FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ /app/backend/
COPY --from=frontend /src/frontend/dist /app/frontend/dist
RUN useradd --create-home sentinel && mkdir /data && chown sentinel:sentinel /data
USER sentinel
ENV PYTHONPATH=/app/backend SENTINEL_DB=/data/sentinel.db
EXPOSE 8000
CMD ["uvicorn", "sentinel.app:app", "--host", "0.0.0.0", "--port", "8000", "--ws-max-size", "32768"]
