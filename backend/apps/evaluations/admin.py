from django.contrib import admin

from .models import Evaluation, EvaluationItemScore


class EvaluationItemScoreInline(admin.TabularInline):
    model = EvaluationItemScore
    extra = 0
    fields = ["rubric_item", "points", "comment"]
    readonly_fields = ["rubric_item"]


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = [
        "student",
        "station",
        "evaluator",
        "status",
        "total_points",
        "grade",
        "finalized_at",
    ]
    list_filter = ["status", "exam", "station"]
    search_fields = ["student__full_name", "student__rut"]
    inlines = [EvaluationItemScoreInline]
    readonly_fields = ["total_points", "grade", "finalized_at", "created_at", "updated_at"]
