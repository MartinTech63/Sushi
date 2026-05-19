FROM python:3.11-slim

WORKDIR /app

# Copy project (frontend + backend)
COPY . /app

RUN pip install --no-cache-dir -r /app/backend/requirements.txt

ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=/data/sushi.db

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

