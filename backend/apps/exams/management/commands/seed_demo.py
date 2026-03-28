"""
seed_demo management command.
Creates admin user, evaluator, demo evaluation with 2 stations, rubric items,
grade scale, station variants, 3 students, and assignments.

Usage: python manage.py seed_demo [--reset]
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Crea datos de demo para Quismart"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Elimina datos previos antes de crear el seed",
        )

    def handle(self, *args, **options):
        from apps.exams.models import (
            Exam,
            RubricItem,
            Station,
            StationAssignment,
            StationVariant,
        )
        from apps.students.models import ExamStudent, Student
        from apps.users.models import User

        if options["reset"]:
            self.stdout.write("Eliminando datos previos...")
            Exam.objects.filter(name__startswith="Demo ").delete()
            User.objects.filter(email__in=["admin@quismart.cl", "educador@quismart.cl"]).delete()
            Student.objects.filter(
                rut__in=["11.111.111-1", "22.222.222-2", "33.333.333-3"]
            ).delete()

        with transaction.atomic():
            # ── Admin (Coordinador) user ───────────────────────────────────
            admin, created = User.objects.get_or_create(
                email="admin@quismart.cl",
                defaults={
                    "first_name": "Admin",
                    "last_name": "Quismart",
                    "role": User.Role.ADMIN,
                    "is_staff": True,
                    "is_superuser": True,
                    "username": "admin@quismart.cl",
                },
            )
            if created:
                admin.set_password("admin123")
                admin.save()
                self.stdout.write(
                    self.style.SUCCESS("[OK] Coordinador creado: admin@quismart.cl / admin123")
                )
            else:
                self.stdout.write("  Coordinador ya existe: admin@quismart.cl")

            # ── Educador user ─────────────────────────────────────────────
            evaluator, created = User.objects.get_or_create(
                email="educador@quismart.cl",
                defaults={
                    "first_name": "María",
                    "last_name": "González",
                    "role": User.Role.EVALUATOR,
                    "username": "educador@quismart.cl",
                },
            )
            if created:
                evaluator.set_password("eval123")
                evaluator.save()
                self.stdout.write(
                    self.style.SUCCESS("[OK] Educador creado: educador@quismart.cl / eval123")
                )
            else:
                self.stdout.write("  Educador ya existe: educador@quismart.cl")

            # ── Exam ECOE ─────────────────────────────────────────────────
            exam, created = Exam.objects.get_or_create(
                name="Demo ECOE 2024",
                defaults={
                    "description": "Evaluación ECOE de demostración con datos de ejemplo.",
                    "status": Exam.Status.DRAFT,
                    "exam_type": Exam.ExamType.ECOE,
                    "created_by": admin,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS("[OK] Evaluación ECOE creada: Demo ECOE 2024"))
            else:
                self.stdout.write("  Evaluación ya existe: Demo ECOE 2024")

            # ── Station 1: Anamnesis (60% exigencia, 2 variantes) ──────────
            station1, _ = Station.objects.get_or_create(
                exam=exam,
                name="Anamnesis",
                defaults={
                    "educator_name": "Dr. Carlos Pérez",
                    "weight_percent": Decimal("50.00"),
                    "passing_score_percent": Decimal("60.00"),
                    "is_active": True,
                    "order": 1,
                },
            )

            rubric_items_1 = [
                (1, "Saludo y presentación adecuada al paciente", Decimal("2.0")),
                (2, "Identifica motivo de consulta principal", Decimal("3.0")),
                (
                    3,
                    "Explora historia de la enfermedad actual (inicio, duración, evolución)",
                    Decimal("3.0"),
                ),
                (4, "Investiga antecedentes médicos relevantes", Decimal("2.0")),
            ]  # Total max = 10.0

            for order, desc, max_pts in rubric_items_1:
                RubricItem.objects.get_or_create(
                    station=station1,
                    order=order,
                    defaults={"description": desc, "max_points": max_pts},
                )

            self._generate_scale(
                station1, Decimal("0"), Decimal("10"), Decimal("1.0"), Decimal("7.0"), Decimal("1")
            )

            # Variantes de la estación 1
            variant_a, _ = StationVariant.objects.get_or_create(
                station=station1,
                name="Variante A – Paciente adulto",
                defaults={
                    "description": "Escenario con paciente adulto mayor de 60 años.",
                    "order": 1,
                },
            )
            variant_b, _ = StationVariant.objects.get_or_create(
                station=station1,
                name="Variante B – Paciente pediátrico",
                defaults={"description": "Escenario con paciente entre 8 y 14 años.", "order": 2},
            )
            self.stdout.write("  [OK] 2 variantes creadas para Anamnesis")

            # ── Station 2: Examen Físico (70% exigencia) ───────────────────
            station2, _ = Station.objects.get_or_create(
                exam=exam,
                name="Examen Físico",
                defaults={
                    "educator_name": "Dra. Ana Torres",
                    "weight_percent": Decimal("50.00"),
                    "passing_score_percent": Decimal("70.00"),
                    "is_active": True,
                    "order": 2,
                },
            )

            rubric_items_2 = [
                (1, "Realiza exploración de signos vitales correctamente", Decimal("2.0")),
                (
                    2,
                    "Examina abdomen con técnica adecuada (inspección, auscultación, percusión, palpación)",
                    Decimal("3.0"),
                ),
                (3, "Examina sistema cardiovascular (corazón y pulsos)", Decimal("3.0")),
                (4, "Interpreta hallazgos y comunica al paciente", Decimal("2.0")),
            ]  # Total max = 10.0

            for order, desc, max_pts in rubric_items_2:
                RubricItem.objects.get_or_create(
                    station=station2,
                    order=order,
                    defaults={"description": desc, "max_points": max_pts},
                )

            self._generate_scale(
                station2, Decimal("0"), Decimal("10"), Decimal("1.0"), Decimal("7.0"), Decimal("1")
            )

            # ── Students ──────────────────────────────────────────────────
            students_data = [
                ("11.111.111-1", "Valentina Martínez López", "v.martinez@universidad.cl"),
                ("22.222.222-2", "Diego Hernández Mora", "d.hernandez@universidad.cl"),
                ("33.333.333-3", "Camila Rojas Soto", "c.rojas@universidad.cl"),
            ]

            for rut, name, email in students_data:
                student, created = Student.objects.get_or_create(
                    rut=rut,
                    defaults={"full_name": name, "email": email},
                )
                ExamStudent.objects.get_or_create(exam=exam, student=student)
                if created:
                    self.stdout.write(f"  [OK] Estudiante: {name}")

            # ── Assignments ───────────────────────────────────────────────
            StationAssignment.objects.get_or_create(
                exam=exam, station=station1, evaluator=evaluator
            )
            StationAssignment.objects.get_or_create(
                exam=exam, station=station2, evaluator=evaluator
            )
            self.stdout.write("  [OK] Educador asignado a ambas estaciones")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("SEED DEMO COMPLETADO – Quismart"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write("Credenciales de acceso:")
        self.stdout.write("  Coordinador: admin@quismart.cl      / admin123")
        self.stdout.write("  Educador:    educador@quismart.cl   / eval123")
        self.stdout.write("")
        self.stdout.write("La evaluación 'Demo ECOE 2024' está en estado BORRADOR.")
        self.stdout.write("  Estación 1 – Anamnesis:     exigencia 60%, 2 variantes")
        self.stdout.write("  Estación 2 – Examen Físico: exigencia 70%")
        self.stdout.write("Para publicarla: UI como coordinador -> 'Publicar'.")
        self.stdout.write("O via API: POST /api/v1/exams/{id}/publish/")
        self.stdout.write("")

    def _generate_scale(
        self,
        station,
        min_raw: Decimal,
        max_raw: Decimal,
        min_grade: Decimal,
        max_grade: Decimal,
        step: Decimal,
    ):
        """Generate linear grade scale points for a station."""
        from apps.exams.models import GradeScalePoint

        if station.grade_scale.exists():
            return  # Don't overwrite existing scale

        points = []
        current = min_raw
        while current <= max_raw:
            if max_raw == min_raw:
                grade = max_grade
            else:
                grade = min_grade + (current - min_raw) / (max_raw - min_raw) * (
                    max_grade - min_grade
                )
            points.append(GradeScalePoint(station=station, raw_points=current, grade=grade))
            current += step

        if not points or points[-1].raw_points < max_raw:
            points.append(GradeScalePoint(station=station, raw_points=max_raw, grade=max_grade))

        GradeScalePoint.objects.bulk_create(points, ignore_conflicts=True)
        self.stdout.write(
            f"  [OK] Escala generada para {station.name}: {len(points)} puntos "
            f"({min_raw}->{min_grade} ... {max_raw}->{max_grade})"
        )
