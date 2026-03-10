from .base import *  # noqa: F401, F403
import os

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True

# Use SQLite automatically when no Postgres env vars are configured
_has_pg = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_DB")
if not _has_pg:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
