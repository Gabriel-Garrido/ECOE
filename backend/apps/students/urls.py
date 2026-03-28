from django.urls import path

from .views import ExamStudentListCreateView, ImportXLSXView

urlpatterns = [
    path(
        "exams/<int:exam_id>/students/", ExamStudentListCreateView.as_view(), name="exam-students"
    ),
    path("exams/<int:exam_id>/students/import-xlsx/", ImportXLSXView.as_view(), name="import-xlsx"),
]
