from django.urls import path

from .views import (
    EvaluationListCreateView,
    EvaluationRetrieveUpdateView,
    ExamResultsView,
    FinalizeEvaluationView,
    ReopenEvaluationView,
)

urlpatterns = [
    path(
        "stations/<int:station_id>/evaluations/",
        EvaluationListCreateView.as_view(),
        name="evaluation-list",
    ),
    path(
        "evaluations/<int:pk>/",
        EvaluationRetrieveUpdateView.as_view(),
        name="evaluation-detail",
    ),
    path(
        "evaluations/<int:pk>/finalize/",
        FinalizeEvaluationView.as_view(),
        name="evaluation-finalize",
    ),
    path(
        "evaluations/<int:pk>/reopen/",
        ReopenEvaluationView.as_view(),
        name="evaluation-reopen",
    ),
    path(
        "exams/<int:exam_id>/results/",
        ExamResultsView.as_view(),
        name="exam-results",
    ),
]
