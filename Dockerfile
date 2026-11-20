FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py ./
COPY templates ./templates
COPY dist ./dist
RUN useradd --create-home garden && mkdir /data && chown garden:garden /data
USER garden
ENV DATA_DIR=/data COOKIE_SECURE=true PORT=8000
EXPOSE 8000
CMD ["sh","-c","exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --threads 4 --timeout 60 'server:create_app()'"]
