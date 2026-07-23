import os

class Config:
    PL_TRACKER_DB = os.environ.get("PL_TRACKER_DB", "pl_tracker.db")
    PORT = int(os.environ.get("PORT", 5000))
    HOST = os.environ.get("HOST", "0.0.0.0")
    ENV = os.environ.get("FLASK_ENV", "production")
    DEBUG = os.environ.get("FLASK_DEBUG", "False").lower() in ("true", "1")
    SECRET_KEY = os.environ.get("SECRET_KEY", "pl_tracker_secret_key_default")
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    SSL_CERT = os.environ.get("SSL_CERT", None)
    SSL_KEY = os.environ.get("SSL_KEY", None)
