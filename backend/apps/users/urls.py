from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AuthLoginView, MyProfileView, UserListCreateView, UserRetrieveUpdateView

urlpatterns = [
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("users/me/", MyProfileView.as_view(), name="users-me"),
    path("users/", UserListCreateView.as_view(), name="users-list"),
    path("users/<int:pk>/", UserRetrieveUpdateView.as_view(), name="users-detail"),
]
