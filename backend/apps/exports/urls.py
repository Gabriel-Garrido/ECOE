from django.urls import path

from .views import EvaluationPdfView, ExamResultsXlsxView

urlpatterns = [
    path(
        "exams/<int:exam_id>/exports/results.xlsx",
        ExamResultsXlsxView.as_view(),
        name="export-results-xlsx",
    ),
    path(
        "evaluations/<int:evaluation_id>/exports/evaluation.pdf",
        EvaluationPdfView.as_view(),
        name="export-evaluation-pdf",
    ),
]
