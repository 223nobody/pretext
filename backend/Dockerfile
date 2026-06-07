FROM python:3.12-slim

WORKDIR /app
ENV CACHE_DIR=/app/cache
ENV UPLOAD_DIR=/app/uploads

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN mkdir -p /app/cache /app/uploads

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
