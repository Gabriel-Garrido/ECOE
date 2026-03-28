from django.db import models


class Evaluation(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        FINAL = "FINAL", "Final"

    exam = models.ForeignKey(
        "exams.Exam",
        on_delete=models.CASCADE,
        related_name="evaluations",
        verbose_name="Evaluación",
    )
    station = models.ForeignKey(
        "exams.Station",
        on_delete=models.CASCADE,
        related_name="evaluations",
        verbose_name="Estación",
    )
    variant = models.ForeignKey(
        "exams.StationVariant",
        on_delete=models.SET_NULL,
        related_name="evaluations",
        verbose_name="Variante",
        null=True,
        blank=True,
    )
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.CASCADE,
        related_name="evaluations",
        verbose_name="Estudiante",
    )
    evaluator = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="evaluations",
        verbose_name="Educador",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name="Estado",
    )
    total_points = models.DecimalField(
        max_digits=8, decimal_places=4, null=True, blank=True, verbose_name="Total puntos"
    )
    grade = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name="Nota",
    )
    general_comment = models.TextField(blank=True, verbose_name="Observación general")
    finalized_at = models.DateTimeField(null=True, blank=True, verbose_name="Fecha finalización")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Evaluación"
        verbose_name_plural = "Evaluaciones"
        constraints = [
            models.UniqueConstraint(
                fields=["exam", "station", "student"],
                condition=models.Q(status="FINAL"),
                name="unique_final_evaluation",
            )
        ]

    def __str__(self) -> str:
        return f"{self.student.full_name} – {self.station.name} ({self.status})"


class EvaluationItemScore(models.Model):
    evaluation = models.ForeignKey(
        Evaluation,
        on_delete=models.CASCADE,
        related_name="item_scores",
        verbose_name="Evaluación",
    )
    rubric_item = models.ForeignKey(
        "exams.RubricItem",
        on_delete=models.CASCADE,
        related_name="scores",
        verbose_name="Ítem",
    )
    points = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Puntaje",
    )
    comment = models.TextField(blank=True, verbose_name="Observación")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Puntaje por ítem"
        verbose_name_plural = "Puntajes por ítem"
        unique_together = [("evaluation", "rubric_item")]
        ordering = ["rubric_item__order", "rubric_item__id"]

    def __str__(self) -> str:
        return f"{self.evaluation} – {self.rubric_item.description[:30]} = {self.points}"
