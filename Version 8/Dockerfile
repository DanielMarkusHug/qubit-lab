FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /srv/qaoa-rqp-api
RUN mkdir -p data

COPY ["Version 8/requirements.txt", "./requirements.txt"]
RUN pip install --no-cache-dir -r requirements.txt

COPY ["Version 8/app", "./app"]
COPY ["Version 8/config", "./config"]
COPY ["Version 8/scripts", "./scripts"]
COPY ["qaoa_optimizer_V6_1_core.py", "./qaoa_optimizer_V6_1_core.py"]

EXPOSE 8080

CMD ["gunicorn", "--config", "app/gunicorn_conf.py", "app.main:app"]
