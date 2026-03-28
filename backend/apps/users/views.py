from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    MyProfileSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN
        )


class AuthLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate

        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        user = authenticate(request, username=email, password=password)
        if not user:
            return Response(
                {"detail": "Credenciales inválidas."}, status=status.HTTP_401_UNAUTHORIZED
            )
        if not user.is_active:
            return Response({"detail": "Usuario inactivo."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class MyProfileView(generics.RetrieveAPIView):
    serializer_class = MyProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.all().order_by("first_name", "last_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer


class UserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)
