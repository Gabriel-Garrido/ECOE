from decimal import Decimal

from rest_framework import serializers


from .models import Exam, GradeScalePoint, RubricItem, Station, StationAssignment, StationVariant


class GradeScalePointSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeScalePoint
        fields = ["id", "raw_points", "grade"]

    def validate_grade(self, value):
        if value < Decimal("1.0") or value > Decimal("7.0"):
            raise serializers.ValidationError("La nota debe estar entre 1.0 y 7.0.")
        return value

    def validate_raw_points(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("El puntaje bruto no puede ser negativo.")
        return value


class RubricItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RubricItem
        fields = ["id", "station", "variant", "order", "description", "max_points"]
        read_only_fields = ["id", "station", "variant"]

    def validate_max_points(self, value):
        if value <= Decimal("0"):
            raise serializers.ValidationError("El puntaje máximo debe ser mayor a 0.")
        return value


class StationVariantSerializer(serializers.ModelSerializer):
    rubric_items_count = serializers.SerializerMethodField()
    max_points_total = serializers.SerializerMethodField()

    class Meta:
        model = StationVariant
        fields = [
            "id",
            "station",
            "name",
            "description",
            "uses_own_rubric",
            "uses_own_scale",
            "order",
            "rubric_items_count",
            "max_points_total",
        ]
        read_only_fields = ["id", "station"]

    def get_rubric_items_count(self, obj) -> int:
        return obj.effective_rubric_items.count()

    def get_max_points_total(self, obj) -> str:
        return str(obj.max_points_total)


class StationSerializer(serializers.ModelSerializer):
    rubric_items_count = serializers.SerializerMethodField()
    max_points_total = serializers.SerializerMethodField()
    variants_count = serializers.SerializerMethodField()
    grade_scale_count = serializers.SerializerMethodField()

    class Meta:
        model = Station
        fields = [
            "id",
            "exam",
            "name",
            "educator_name",
            "weight_percent",
            "passing_score_percent",
            "is_active",
            "order",
            "rubric_items_count",
            "max_points_total",
            "variants_count",
            "grade_scale_count",
        ]
        read_only_fields = ["id", "exam"]

    def get_rubric_items_count(self, obj) -> int:
        return obj.rubric_items.count()

    def get_max_points_total(self, obj) -> str:
        return str(obj.max_points_total)

    def get_variants_count(self, obj) -> int:
        return obj.variants.count()

    def get_grade_scale_count(self, obj) -> int:
        return obj.grade_scale.count()

    def validate_weight_percent(self, value):
        if value < Decimal("0") or value > Decimal("100"):
            raise serializers.ValidationError("La ponderación debe estar entre 0 y 100.")
        return value

    def validate_passing_score_percent(self, value):
        if value < Decimal("0") or value > Decimal("100"):
            raise serializers.ValidationError(
                "El porcentaje de exigencia debe estar entre 0 y 100."
            )
        return value


class StationAssignmentSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source="station.name", read_only=True)
    evaluator_name = serializers.CharField(source="evaluator.full_name", read_only=True)
    evaluator_email = serializers.CharField(source="evaluator.email", read_only=True)

    class Meta:
        model = StationAssignment
        fields = [
            "id",
            "exam",
            "station",
            "evaluator",
            "station_name",
            "evaluator_name",
            "evaluator_email",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "exam",
            "created_at",
            "station_name",
            "evaluator_name",
            "evaluator_email",
        ]

    def validate(self, data):
        exam = self.context.get("exam")
        station = data.get("station")
        evaluator = data.get("evaluator")

        if station and station.exam != exam:
            raise serializers.ValidationError(
                {"station": "La estación no pertenece a esta evaluación."}
            )

        from apps.users.models import User

        if evaluator and evaluator.role != User.Role.EVALUATOR:
            raise serializers.ValidationError(
                {"evaluator": "El usuario debe tener rol de Educador."}
            )
        return data


class ExamSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    stations_count = serializers.SerializerMethodField()
    students_count = serializers.SerializerMethodField()
    exam_type_display = serializers.CharField(source="get_exam_type_display", read_only=True)

    class Meta:
        model = Exam
        fields = [
            "id",
            "name",
            "description",
            "exam_type",
            "exam_type_display",
            "start_date",
            "status",
            "created_by",
            "created_by_name",
            "stations_count",
            "students_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_by", "created_at", "updated_at"]

    def get_stations_count(self, obj) -> int:
        return obj.stations.count()

    def get_students_count(self, obj) -> int:
        return obj.exam_students.count()


class ExamCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = ["id", "name", "description", "exam_type", "start_date"]
        read_only_fields = ["id"]
