"""
pytest configuration for ecoe-mvp backend.
DJANGO_SETTINGS_MODULE is set in pytest.ini → config.settings.dev
pytest-django handles database setup automatically.
Each test that needs DB must use the `db` fixture (via @pytest.mark.django_db
or by requesting it as a parameter — see tests.py fixtures).
"""
