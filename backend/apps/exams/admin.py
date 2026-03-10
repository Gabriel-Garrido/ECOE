from django.contrib import admin

from .models import Exam, GradeScalePoint, RubricItem, Station, StationAssignment


class RubricItemInline(admin.TabularInline):
    model = RubricItem
    extra = 0
    fields = ["order", "description", "max_points"]


class GradeScalePointInline(admin.TabularInline):
    model = GradeScalePoint
    extra = 0
    fields = ["raw_points", "grade"]


class StationInline(admin.TabularInline):
    model = Station
    extra = 0
    fields = ["order", "name", "weight_percent", "is_active"]


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ["name", "status", "start_date", "created_by", "created_at"]
    list_filter = ["status"]
    search_fields = ["name"]
    inlines = [StationInline]


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ["name", "exam", "order", "weight_percent", "is_active"]
    list_filter = ["exam", "is_active"]
    inlines = [RubricItemInline, GradeScalePointInline]


@admin.register(StationAssignment)
class StationAssignmentAdmin(admin.ModelAdmin):
    list_display = ["evaluator", "station", "exam"]
    list_filter = ["exam"]
