from decimal import ROUND_HALF_UP, Decimal

from rest_framework import serializers

from .models import Evaluation, EvaluationItemScore


class EvaluationItemScoreSerializer(serializers.ModelSerializer):
    rubric_item_description = serializers.CharField(
        source="rubric_item.description", read_only=True
    )
    rubric_item_max_points = serializers.DecimalField(
        source="rubric_item.max_points",
        max_digits=7,
        decimal_places=2,
        read_only=True,
        coerce_to_string=True,
    )
    rubric_item_order = serializers.IntegerField(source="rubric_item.order", read_only=True)
    points_display = serializers.SerializerMethodField()

    class Meta:
        model = EvaluationItemScore
        fields = [
            "id",
            "evaluation",
            "rubric_item",
            "rubric_item_description",
            "rubric_item_max_points",
            "rubric_item_order",
            "points",
            "points_display",
            "comment",
        ]
        read_only_fields = [
            "id",
            "evaluation",
            "rubric_item_description",
            "rubric_item_max_points",
            "rubric_item_order",
        ]

    def get_points_display(self, obj) -> str | None:
        if obj.points is None:
            return None
        return str(obj.points.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    def validate_points(self, value):
        if value is None:
            return value
        if value < Decimal("0"):
            raise serializers.ValidationError("El puntaje no puede ser negativo.")
        # Max points validation done at view level since we need rubric_item context
        return value


class EvaluationSerializer(serializers.ModelSerializer):
    item_scores = EvaluationItemScoreSerializer(many=True, read_only=True)
    grade_display = serializers.SerializerMethodField()
    total_points_display = serializers.SerializerMethodField()
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_rut = serializers.CharField(source="student.rut", read_only=True)
    station_name = serializers.CharField(source="station.name", read_only=True)
    variant_name = serializers.SerializerMethodField()
    evaluator_name = serializers.CharField(source="evaluator.full_name", read_only=True)
    items_completed = serializers.SerializerMethodField()
    items_total = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            "id",
            "exam",
            "station",
            "variant",
            "student",
            "evaluator",
            "status",
            "total_points",
            "total_points_display",
            "grade",
            "grade_display",
            "general_comment",
            "finalized_at",
            "created_at",
            "updated_at",
            "item_scores",
            "student_name",
            "student_rut",
            "station_name",
            "variant_name",
            "evaluator_name",
            "items_completed",
            "items_total",
        ]
        read_only_fields = [
            "id",
            "exam",
            "station",
            "variant",
            "student",
            "evaluator",
            "status",
            "total_points",
            "grade",
            "finalized_at",
            "created_at",
            "updated_at",
        ]

    def get_grade_display(self, obj) -> str | None:
        if obj.grade is None:
            return None
        return str(obj.grade.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    def get_variant_name(self, obj) -> str | None:
        if obj.variant:
            return obj.variant.name
        return None

    def get_total_points_display(self, obj) -> str | None:
        if obj.total_points is None:
            return None
        return str(obj.total_points.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    def get_items_completed(self, obj) -> int:
        return sum(1 for s in obj.item_scores.all() if s.points is not None)

    def get_items_total(self, obj) -> int:
        return obj.item_scores.count()
