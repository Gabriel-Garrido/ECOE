from django.contrib import admin

from .models import ExamStudent, Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["full_name", "rut", "email"]
    search_fields = ["full_name", "rut", "email"]


@admin.register(ExamStudent)
class ExamStudentAdmin(admin.ModelAdmin):
    list_display = ["student", "exam"]
    list_filter = ["exam"]
