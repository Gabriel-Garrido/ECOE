from django.db import models


class Student(models.Model):
    rut = models.CharField(max_length=20, unique=True, verbose_name="RUT")
    full_name = models.CharField(max_length=200, verbose_name="Nombre completo")
    email = models.EmailField(blank=True, verbose_name="Correo electrónico")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Estudiante"
        verbose_name_plural = "Estudiantes"
        ordering = ["full_name"]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.rut})"


class ExamStudent(models.Model):
    exam = models.ForeignKey(
        "exams.Exam",
        on_delete=models.CASCADE,
        related_name="exam_students",
        verbose_name="ECOE",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="exam_students",
        verbose_name="Estudiante",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Estudiante en ECOE"
        verbose_name_plural = "Estudiantes en ECOE"
        unique_together = [("exam", "student")]
        ordering = ["student__full_name"]

    def __str__(self) -> str:
        return f"{self.student.full_name} – {self.exam.name}"
