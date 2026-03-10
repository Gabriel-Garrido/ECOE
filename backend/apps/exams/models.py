from decimal import Decimal

from django.db import models


class Exam(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        PUBLISHED = "PUBLISHED", "Publicado"
        CLOSED = "CLOSED", "Cerrado"

    name = models.CharField(max_length=200, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
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
        verbose_name = "ECOE"
        verbose_name_plural = "ECOEs"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class Station(models.Model):
    exam = models.ForeignKey(
        Exam, on_delete=models.CASCADE, related_name="stations", verbose_name="ECOE"
    )
    name = models.CharField(max_length=200, verbose_name="Nombre")
    educator_name = models.CharField(
        max_length=200, blank=True, verbose_name="Nombre del educador"
    )
    weight_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        verbose_name="Ponderación (%)",
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
        result = self.rubric_items.aggregate(
            total=models.Sum("max_points")
        )["total"]
        return result or Decimal("0")


class RubricItem(models.Model):
    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name="rubric_items",
        verbose_name="Estación",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Orden")
    description = models.TextField(verbose_name="Descripción")
    max_points = models.DecimalField(
        max_digits=7, decimal_places=2, verbose_name="Puntaje máximo"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ítem de pauta"
        verbose_name_plural = "Ítems de pauta"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return f"[{self.station.name}] {self.description[:50]}"


class GradeScalePoint(models.Model):
    station = models.ForeignKey(
        Station,
        on_delete=models.CASCADE,
        related_name="grade_scale",
        verbose_name="Estación",
    )
    raw_points = models.DecimalField(
        max_digits=7, decimal_places=2, verbose_name="Puntaje bruto"
    )
    grade = models.DecimalField(
        max_digits=5, decimal_places=4, verbose_name="Nota"
    )

    class Meta:
        verbose_name = "Punto de escala"
        verbose_name_plural = "Puntos de escala"
        ordering = ["raw_points"]
        unique_together = [("station", "raw_points")]

    def __str__(self) -> str:
        return f"{self.station.name}: {self.raw_points} pts → {self.grade}"


class StationAssignment(models.Model):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="assignments",
        verbose_name="ECOE",
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
        verbose_name="Evaluador",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Asignación"
        verbose_name_plural = "Asignaciones"
        unique_together = [("exam", "station", "evaluator")]

    def __str__(self) -> str:
        return f"{self.evaluator.full_name} → {self.station.name} ({self.exam.name})"
