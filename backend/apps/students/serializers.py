from rest_framework import serializers

from .models import ExamStudent, Student


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = ["id", "rut", "full_name", "email", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_rut(self, value):
        return value.strip()

    def validate_full_name(self, value):
        return value.strip()


class ExamStudentSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(), write_only=True, source="student"
    )

    class Meta:
        model = ExamStudent
        fields = ["id", "exam", "student", "student_id", "created_at"]
        read_only_fields = ["id", "exam", "created_at"]


class StudentManualCreateSerializer(serializers.ModelSerializer):
    """Create a student and optionally link to an exam."""

    class Meta:
        model = Student
        fields = ["id", "rut", "full_name", "email"]
        read_only_fields = ["id"]
