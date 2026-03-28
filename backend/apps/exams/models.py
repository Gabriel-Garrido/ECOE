from decimal import Decimal

from django.db import models


class Exam(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        PUBLISHED = "PUBLISHED", "Publicado"
        CLOSED = "CLOSED", "Cerrado"

    class ExamType(models.TextChoices):
        ECOE = "ECOE", "ECOE/OSCE"
        ABP = "ABP", "ABP"
        SIMULATED = "SIMULATED", "Escenario Simulado"
        OTHER = "OTHER", "Otro"

    name = models.CharField(max_length=200, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    exam_type = models.CharField(
        max_length=20,
        choices=ExamType.choices,
        default=ExamType.ECOE,
        verbose_name="Tipo de evaluación",
    )
    start_date = models.DateField(null=True, blank=True, verbose_name="Fecha inicio")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name="Estado"
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="created_exams",
        verbose_name="Creado por",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Evaluación clínica"
        verbose_name_plural = "Evaluaciones clínicas"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class Station(models.Model):
    exam = models.ForeignKey(
        Exam, on_delete=models.CASCADE, related_name="stations", verbose_name="Evaluación"
    )
    name = models.CharField(max_length=200, verbose_name="Nombre")
    educator_name = models.CharField(max_length=200, blank=True, verbose_name="Nombre del educador")
    weight_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Ponderación (%)",
    )
    passing_score_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("60"),
        verbose_name="Porcentaje de exigencia",
        help_text="Porcentaje del puntaje máximo requerido para aprobar (ej: 60 = 60%)",
    )
    is_active = models.BooleanField(default=True, verbose_name="Activa")
    order = models.PositiveIntegerField(default=0, verbose_name="Orden")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Estación"
        verbose_name_plural = "Estaciones"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.exam.name} – {self.name}"

    @property
    def max_points_total(self) -> Decimal:
        result = self.rubric_items.aggregate(total=models.Sum("max_points"))["total"]
        return result or Decimal("0")


class StationVariant(models.Model):
    """
    A variant of a station. The parent station is the logical unit in the exam;
    each variant may have a different question/scenario but counts as the same station.
    Variants can optionally have their own rubric items and grade scale.
    If they don't, they inherit the parent station's.
    """

    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name="variants",
        verbose_name="Estación",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="Nombre de la variante",
        help_text="Ej: Variante A, Caso 1, etc.",
    )
    description = models.TextField(blank=True, verbose_name="Descripción / Pregunta")
    uses_own_rubric = models.BooleanField(
        default=False,
        verbose_name="Usa pauta propia",
        help_text="Si es falso, usa la pauta de la estación padre.",
    )
    uses_own_scale = models.BooleanField(
        default=False,
        verbose_name="Usa escala propia",
        help_text="Si es falso, usa la escala de la estación padre.",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Orden")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Variante de estación"
        verbose_name_plural = "Variantes de estación"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"{self.station.name} – {self.name}"

    @property
    def effective_rubric_items(self):
        """Return this variant's rubric items if it has its own, else the parent station's."""
        if self.uses_own_rubric:
            return self.rubric_items.all()
        return self.station.rubric_items.all()

    @property
    def effective_grade_scale(self):
        """Return this variant's grade scale if it has its own, else the parent station's."""
        if self.uses_own_scale:
            return self.grade_scale.all()
        return self.station.grade_scale.all()

    @property
    def max_points_total(self) -> Decimal:
        if self.uses_own_rubric:
            result = self.rubric_items.aggregate(total=models.Sum("max_points"))["total"]
            return result or Decimal("0")
        return self.station.max_points_total


class RubricItem(models.Model):
    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name="rubric_items",
        verbose_name="Estación",
        null=True,
        blank=True,
    )
    variant = models.ForeignKey(
        StationVariant,
        on_delete=models.CASCADE,
        related_name="rubric_items",
        verbose_name="Variante",
        null=True,
        blank=True,
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Orden")
    description = models.TextField(verbose_name="Descripción")
    max_points = models.DecimalField(max_digits=7, decimal_places=2, verbose_name="Puntaje máximo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ítem de pauta"
        verbose_name_plural = "Ítems de pauta"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        parent = self.station.name if self.station else (self.variant.name if self.variant else "?")
        return f"[{parent}] {self.description[:50]}"


class GradeScalePoint(models.Model):
    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name="grade_scale",
        verbose_name="Estación",
        null=True,
        blank=True,
    )
    variant = models.ForeignKey(
        StationVariant,
        on_delete=models.CASCADE,
        related_name="grade_scale",
        verbose_name="Variante",
        null=True,
        blank=True,
    )
    raw_points = models.DecimalField(max_digits=7, decimal_places=2, verbose_name="Puntaje bruto")
    grade = models.DecimalField(max_digits=5, decimal_places=4, verbose_name="Nota")

    class Meta:
        verbose_name = "Punto de escala"
        verbose_name_plural = "Puntos de escala"
        ordering = ["raw_points"]

    def __str__(self) -> str:
        parent = self.station.name if self.station else (self.variant.name if self.variant else "?")
        return f"{parent}: {self.raw_points} pts → {self.grade}"


class StationAssignment(models.Model):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="assignments",
        verbose_name="Evaluación",
    )
    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name="assignments",
        verbose_name="Estación",
    )
    evaluator = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="assignments",
        verbose_name="Educador",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Asignación"
        verbose_name_plural = "Asignaciones"
        unique_together = [("exam", "station", "evaluator")]

    def __str__(self) -> str:
        return f"{self.evaluator.full_name} → {self.station.name} ({self.exam.name})"
