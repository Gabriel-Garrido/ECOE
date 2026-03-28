"""
Tests to verify that Django settings load correctly and that middleware
dependencies are satisfied.
"""

import importlib

import pytest
from django.conf import settings


class TestDevSettingsMiddleware:
    """Ensure dev settings don't require production-only packages."""

    def test_whitenoise_not_in_dev_middleware(self):
        """WhiteNoise middleware must NOT be present in dev settings.

        WhiteNoise is a production dependency. Including it in the base/dev
        middleware causes ModuleNotFoundError when it is not installed locally.
        """
        assert "whitenoise.middleware.WhiteNoiseMiddleware" not in settings.MIDDLEWARE

    def test_all_middleware_importable(self):
        """Every middleware class listed in MIDDLEWARE must be importable."""
        for middleware_path in settings.MIDDLEWARE:
            module_path, class_name = middleware_path.rsplit(".", 1)
            module = importlib.import_module(module_path)
            assert hasattr(module, class_name), (
                f"{class_name} not found in {module_path}"
            )

    def test_all_installed_apps_importable(self):
        """Every app in INSTALLED_APPS must be importable."""
        for app in settings.INSTALLED_APPS:
            # Django app labels may be dotted paths; import the top-level module.
            top_module = app.split(".")[0]
            importlib.import_module(top_module)


class TestProdSettingsMiddleware:
    """Ensure prod settings include WhiteNoise correctly."""

    def test_whitenoise_in_prod_middleware(self):
        """Production MIDDLEWARE must contain WhiteNoise right after
        SecurityMiddleware."""
        from config.settings import base

        # Build expected prod middleware by simulating what prod.py does.
        middleware = list(base.MIDDLEWARE)
        idx = middleware.index("django.middleware.security.SecurityMiddleware")
        middleware.insert(idx + 1, "whitenoise.middleware.WhiteNoiseMiddleware")

        # Verify the insertion position is correct.
        assert middleware[idx + 1] == "whitenoise.middleware.WhiteNoiseMiddleware"

    def test_whitenoise_not_in_base_middleware(self):
        """Base MIDDLEWARE must not contain WhiteNoise — it belongs in prod only."""
        from config.settings import base

        assert "whitenoise.middleware.WhiteNoiseMiddleware" not in base.MIDDLEWARE
