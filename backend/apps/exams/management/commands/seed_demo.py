"""
seed_demo management command.
Creates admin user, evaluator, demo ECOE with 2 stations, rubric items, grade scale, 3 students, assignments.

Usage: python manage.py seed_demo
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Crea datos de demo para ECOE MVP"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Elimina datos previos antes de crear el seed",
        )

    def handle(self, *args, **options):
        from apps.evaluations.models import Evaluation, EvaluationItemScore
        from apps.exams.models import Exam, GradeScalePoint, RubricItem, Station, StationAssignment
        from apps.students.models import ExamStudent, Student
        from apps.users.models import User

        if options["reset"]:
            self.stdout.write("Eliminando datos previos...")
            Exam.objects.filter(name__startswith="ECOE Demo").delete()
            User.objects.filter(email__in=["admin@ecoe.cl", "evaluador@ecoe.cl"]).delete()
            Student.objects.filter(rut__in=["11.111.111-1", "22.222.222-2", "33.333.333-3"]).delete()

        with transaction.atomic():
            # ── Admin user ────────────────────────────────────────────────
            admin, created = User.objects.get_or_create(
                email="admin@ecoe.cl",
                defaults={
                    "first_name": "Admin",
                    "last_name": "ECOE",
                    "role": User.Role.ADMIN,
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
            if created:
                admin.set_password("admin123")
                admin.save()
                self.stdout.write(self.style.SUCCESS("[OK] Admin creado: admin@ecoe.cl / admin123"))
            else:
                self.stdout.write("  Admin ya existe: admin@ecoe.cl")

            # ── Evaluator user ────────────────────────────────────────────
            evaluator, created = User.objects.get_or_create(
                email="evaluador@ecoe.cl",
                defaults={
                    "first_name": "María",
                    "last_name": "González",
                    "role": User.Role.EVALUATOR,
                },
            )
            if created:
                evaluator.set_password("eval123")
                evaluator.save()
                self.stdout.write(
                    self.style.SUCCESS("[OK] Evaluador creado: evaluador@ecoe.cl / eval123")
                )
            else:
                self.stdout.write("  Evaluador ya existe: evaluador@ecoe.cl")

            # ── Exam ──────────────────────────────────────────────────────
            exam, created = Exam.objects.get_or_create(
                name="ECOE Demo 2024",
                defaults={
                    "description": "Examen ECOE de demostración con datos de ejemplo.",
                    "status": Exam.Status.DRAFT,
                    "created_by": admin,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS("[OK] ECOE creado: ECOE Demo 2024"))
            else:
                self.stdout.write("  ECOE ya existe: ECOE Demo 2024")

            # ── Station 1: Anamnesis ───────────────────────────────────────
            station1, _ = Station.objects.get_or_create(
                exam=exam,
                name="Anamnesis",
                defaults={
                    "educator_name": "Dr. Carlos Pérez",
                    "weight_percent": Decimal("50.00"),
                    "is_active": True,
                    "order": 1,
                },
            )

            rubric_items_1 = [
                (1, "Saludo y presentación adecuada al paciente", Decimal("2.0")),
                (2, "Identifica motivo de consulta principal", Decimal("3.0")),
                (3, "Explora historia de la enfermedad actual (inicio, duración, evolución)", Decimal("3.0")),
                (4, "Investiga antecedentes médicos relevantes", Decimal("2.0")),
            ]  # Total max = 10.0

            for order, desc, max_pts in rubric_items_1:
                RubricItem.objects.get_or_create(
                    station=station1,
                    order=order,
                    defaults={"description": desc, "max_points": max_pts},
                )

            # Generate linear grade scale for station 1: 0→1.0, 10→7.0
            self._generate_scale(station1, Decimal("0"), Decimal("10"), Decimal("1.0"), Decimal("7.0"), Decimal("1"))

            # ── Station 2: Examen Físico ───────────────────────────────────
            station2, _ = Station.objects.get_or_create(
                exam=exam,
                name="Examen Físico",
                defaults={
                    "educator_name": "Dra. Ana Torres",
                    "weight_percent": Decimal("50.00"),
                    "is_active": True,
                    "order": 2,
                },
            )

            rubric_items_2 = [
                (1, "Realiza exploración de signos vitales correctamente", Decimal("2.0")),
                (2, "Examina abdomen con técnica adecuada (inspección, auscultación, percusión, palpación)", Decimal("3.0")),
                (3, "Examina sistema cardiovascular (corazón y pulsos)", Decimal("3.0")),
                (4, "Interpreta hallazgos y comunica al paciente", Decimal("2.0")),
            ]  # Total max = 10.0

            for order, desc, max_pts in rubric_items_2:
                RubricItem.objects.get_or_create(
                    station=station2,
                    order=order,
                    defaults={"description": desc, "max_points": max_pts},
                )

            self._generate_scale(station2, Decimal("0"), Decimal("10"), Decimal("1.0"), Decimal("7.0"), Decimal("1"))

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
            self.stdout.write("  [OK] Evaluador asignado a ambas estaciones")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("SEED DEMO COMPLETADO"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write("Credenciales de acceso:")
        self.stdout.write("  Admin:     admin@ecoe.cl     / admin123")
        self.stdout.write("  Evaluador: evaluador@ecoe.cl / eval123")
        self.stdout.write("")
        self.stdout.write("El ECOE 'ECOE Demo 2024' está en estado BORRADOR.")
        self.stdout.write("Para publicarlo: ve a la UI como admin y haz clic en 'Publicar'.")
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
            f"({min_raw}→{min_grade} ... {max_raw}→{max_grade})"
        )
