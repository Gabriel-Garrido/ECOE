from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions

from apps.exams.models import Exam
from apps.users.models import User

from .models import AuditLog
from .serializers import AuditLogSerializer


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN
        )


class ExamAuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        exam = get_object_or_404(Exam, pk=self.kwargs["exam_id"])
        from django.db.models import Q
        from apps.evaluations.models import Evaluation

        eval_ids = list(Evaluation.objects.filter(exam=exam).values_list("id", flat=True))

        return AuditLog.objects.filter(
            Q(entity_type="Exam", entity_id=exam.id)
            | Q(entity_type="Evaluation", entity_id__in=eval_ids)
        ).order_by("-created_at")
