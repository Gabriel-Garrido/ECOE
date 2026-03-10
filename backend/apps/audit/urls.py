from django.urls import path

from .views import ExamAuditLogListView

urlpatterns = [
    path("exams/<int:exam_id>/audits/", ExamAuditLogListView.as_view(), name="exam-audits"),
]
