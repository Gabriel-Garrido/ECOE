# Generated manually for new features: exam_type, passing_score_percent, StationVariant, variant FK

from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("exams", "0002_initial"),
    ]

    operations = [
        # --- Exam.exam_type ---
        migrations.AddField(
            model_name="exam",
            name="exam_type",
            field=models.CharField(
                choices=[
                    ("ECOE", "ECOE/OSCE"),
                    ("ABP", "ABP"),
                    ("SIMULATED", "Escenario Simulado"),
                    ("OTHER", "Otro"),
                ],
                default="ECOE",
                max_length=20,
                verbose_name="Tipo de evaluación",
            ),
        ),
        # --- Station.passing_score_percent ---
        migrations.AddField(
            model_name="station",
            name="passing_score_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("60"),
                help_text="Porcentaje del puntaje máximo requerido para aprobar (ej: 60 = 60%)",
                max_digits=5,
                verbose_name="Porcentaje de exigencia",
            ),
        ),
        # --- Exam Meta update ---
        migrations.AlterModelOptions(
            name="exam",
            options={
                "ordering": ["-created_at"],
                "verbose_name": "Evaluación clínica",
                "verbose_name_plural": "Evaluaciones clínicas",
            },
        ),
        # --- StationVariant model ---
        migrations.CreateModel(
            name="StationVariant",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        help_text="Ej: Variante A, Caso 1, etc.",
                        max_length=200,
                        verbose_name="Nombre de la variante",
                    ),
                ),
                (
                    "description",
                    models.TextField(blank=True, verbose_name="Descripción / Pregunta"),
                ),
                (
                    "uses_own_rubric",
                    models.BooleanField(
                        default=False,
                        help_text="Si es falso, usa la pauta de la estación padre.",
                        verbose_name="Usa pauta propia",
                    ),
                ),
                (
                    "uses_own_scale",
                    models.BooleanField(
                        default=False,
                        help_text="Si es falso, usa la escala de la estación padre.",
                        verbose_name="Usa escala propia",
                    ),
                ),
                ("order", models.PositiveIntegerField(default=0, verbose_name="Orden")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "station",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="variants",
                        to="exams.station",
                        verbose_name="Estación",
                    ),
                ),
            ],
            options={
                "verbose_name": "Variante de estación",
                "verbose_name_plural": "Variantes de estación",
                "ordering": ["order", "id"],
            },
        ),
        # --- RubricItem: make station nullable, add variant FK ---
        migrations.AlterField(
            model_name="rubricitem",
            name="station",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="rubric_items",
                to="exams.station",
                verbose_name="Estación",
            ),
        ),
        migrations.AddField(
            model_name="rubricitem",
            name="variant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="rubric_items",
                to="exams.stationvariant",
                verbose_name="Variante",
            ),
        ),
        # --- GradeScalePoint: make station nullable, add variant FK, update unique_together ---
        migrations.AlterField(
            model_name="gradescalepoint",
            name="station",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="grade_scale",
                to="exams.station",
                verbose_name="Estación",
            ),
        ),
        migrations.AddField(
            model_name="gradescalepoint",
            name="variant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="grade_scale",
                to="exams.stationvariant",
                verbose_name="Variante",
            ),
        ),
        # Remove old unique_together and let ordering handle it
        migrations.AlterUniqueTogether(
            name="gradescalepoint",
            unique_together=set(),
        ),
        # --- StationAssignment: update verbose_name on evaluator FK ---
        migrations.AlterField(
            model_name="stationassignment",
            name="evaluator",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="assignments",
                to="users.user",
                verbose_name="Educador",
            ),
        ),
        # --- Station: update exam FK verbose_name ---
        migrations.AlterField(
            model_name="station",
            name="exam",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="stations",
                to="exams.exam",
                verbose_name="Evaluación",
            ),
        ),
    ]
