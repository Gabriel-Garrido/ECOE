# Add variant FK to Evaluation, update verbose_names

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("evaluations", "0003_initial"),
        ("exams", "0003_exam_type_variants_passing_score"),
    ]

    operations = [
        # Add variant FK to Evaluation
        migrations.AddField(
            model_name="evaluation",
            name="variant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="evaluations",
                to="exams.stationvariant",
                verbose_name="Variante",
            ),
        ),
        # Update exam FK verbose_name
        migrations.AlterField(
            model_name="evaluation",
            name="exam",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="evaluations",
                to="exams.exam",
                verbose_name="Evaluación",
            ),
        ),
        # Update evaluator FK verbose_name
        migrations.AlterField(
            model_name="evaluation",
            name="evaluator",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="evaluations",
                to="users.user",
                verbose_name="Educador",
            ),
        ),
    ]
