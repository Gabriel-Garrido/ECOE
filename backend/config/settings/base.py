"""
Django base settings for ecoe-mvp project.
"""

from datetime import timedelta
from pathlib import Path

from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY", default="dev-insecure-secret-key-change-me")

DEBUG = False

ALLOWED_HOSTS: list[str] = []

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.users",
    "apps.exams",
    "apps.students",
    "apps.evaluations",
    "apps.exports",
    "apps.audit",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
def _build_db_config():
    """
    Return DATABASES dict.  Priority:
    1. DATABASE_URL  (Render managed DB, injected at runtime only)
    2. Individual POSTGRES_* env vars  (local dev with Docker)
    3. SQLite fallback  (build phase / local dev without DB)
    """
    from urllib.parse import urlparse

    db_url = config("DATABASE_URL", default="")
    if db_url:
        r = urlparse(db_url)
        if r.scheme in ("postgres", "postgresql") and r.hostname:
            return {
                "default": {
                    "ENGINE": "django.db.backends.postgresql",
                    "NAME": r.path.lstrip("/").split("?")[0],
                    "USER": r.username or "",
                    "PASSWORD": r.password or "",
                    "HOST": r.hostname,
                    "PORT": str(r.port) if r.port else "5432",
                }
            }

    pg_name = config("POSTGRES_DB", default="")
    if pg_name:
        return {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": pg_name,
                "USER": config("POSTGRES_USER", default="ecoe_user"),
                "PASSWORD": config("POSTGRES_PASSWORD", default="ecoe_pass"),
                "HOST": config("DB_HOST", default="localhost"),
                "PORT": config("DB_PORT", default="5432"),
            }
        }

    # No DB available (build phase) — use SQLite so collectstatic/migrate
    # can run without a real database connection.
    return {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


DATABASES = _build_db_config()

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "users.User"

LANGUAGE_CODE = "es"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in config("CORS_ALLOWED_ORIGINS", default="http://localhost:5173").split(",")
    if o.strip()
]

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    "COERCE_DECIMAL_TO_STRING": False,
}

# JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# drf-spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "Quismart Clinical Assessment API",
    "DESCRIPTION": (
        "API para gestion de evaluaciones clinicas: ECOE/OSCE, ABP y escenarios simulados. "
        "Soporta multiples tipos de evaluacion, variantes de estacion, "
        "importacion de pautas desde Excel y porcentaje de exigencia configurable."
    ),
    "VERSION": "2.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}
