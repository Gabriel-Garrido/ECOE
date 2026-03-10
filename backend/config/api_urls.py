from django.urls import include, path

urlpatterns = [
    # Auth
    path("", include("apps.users.urls")),
    # Exams, stations, rubrics, scale, assignments
    path("", include("apps.exams.urls")),
    # Students
    path("", include("apps.students.urls")),
    # Evaluations
    path("", include("apps.evaluations.urls")),
    # Exports (xlsx, pdf)
    path("", include("apps.exports.urls")),
    # Audit
    path("", include("apps.audit.urls")),
]
