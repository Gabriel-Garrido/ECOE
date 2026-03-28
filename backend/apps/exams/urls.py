from django.urls import path

from .views import (
    AssignmentDestroyView,
    AssignmentListCreateView,
    ExamCloseView,
    ExamListCreateView,
    ExamPublishView,
    ExamRetrieveUpdateView,
    GradeScaleGenerateView,
    GradeScaleView,
    ImportRubricXlsxView,
    RubricItemListCreateView,
    RubricItemRetrieveUpdateDestroyView,
    StationListCreateView,
    StationRetrieveUpdateView,
    StationToggleActiveView,
    StationVariantListCreateView,
    StationVariantRetrieveUpdateDestroyView,
)

urlpatterns = [
    # Exams
    path("exams/", ExamListCreateView.as_view(), name="exam-list"),
    path("exams/<int:pk>/", ExamRetrieveUpdateView.as_view(), name="exam-detail"),
    path("exams/<int:pk>/publish/", ExamPublishView.as_view(), name="exam-publish"),
    path("exams/<int:pk>/close/", ExamCloseView.as_view(), name="exam-close"),
    # Stations (nested under exam)
    path("exams/<int:exam_id>/stations/", StationListCreateView.as_view(), name="station-list"),
    path("stations/<int:pk>/", StationRetrieveUpdateView.as_view(), name="station-detail"),
    path(
        "stations/<int:pk>/toggle-active/", StationToggleActiveView.as_view(), name="station-toggle"
    ),
    # Rubric items
    path(
        "stations/<int:station_id>/rubric-items/",
        RubricItemListCreateView.as_view(),
        name="rubric-list",
    ),
    path(
        "rubric-items/<int:pk>/",
        RubricItemRetrieveUpdateDestroyView.as_view(),
        name="rubric-detail",
    ),
    # Rubric import from XLSX
    path(
        "stations/<int:station_id>/rubric-items/import-xlsx/",
        ImportRubricXlsxView.as_view(),
        name="rubric-import",
    ),
    # Grade scale
    path("stations/<int:station_id>/grade-scale/", GradeScaleView.as_view(), name="grade-scale"),
    path(
        "stations/<int:station_id>/grade-scale/generate/",
        GradeScaleGenerateView.as_view(),
        name="grade-scale-generate",
    ),
    # Station variants
    path(
        "stations/<int:station_id>/variants/",
        StationVariantListCreateView.as_view(),
        name="variant-list",
    ),
    path(
        "variants/<int:pk>/",
        StationVariantRetrieveUpdateDestroyView.as_view(),
        name="variant-detail",
    ),
    # Assignments
    path(
        "exams/<int:exam_id>/assignments/",
        AssignmentListCreateView.as_view(),
        name="assignment-list",
    ),
    path("assignments/<int:pk>/", AssignmentDestroyView.as_view(), name="assignment-detail"),
]
