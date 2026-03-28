from rest_framework import permissions

from apps.users.models import User


class IsAdmin(permissions.BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return bool(
            request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN
        )


class IsAssignedEvaluatorOrAdmin(permissions.BasePermission):
    """
    Allow access if the user is admin, or is an evaluator assigned to
    the relevant station in the relevant exam.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == User.Role.ADMIN:
            return True
        # Evaluator: further checked in get_queryset or has_object_permission
        return request.user.role == User.Role.EVALUATOR

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN:
            return True
        # For Station objects: check assignment
        from apps.exams.models import Station, StationAssignment

        if isinstance(obj, Station):
            return StationAssignment.objects.filter(
                exam=obj.exam, station=obj, evaluator=request.user
            ).exists()
        return False
