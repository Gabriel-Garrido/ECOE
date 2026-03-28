"""
Tests for clinical evaluation assessments: grade calculation, permissions,
finalize workflow, passing score percent, station variants, rubric import.
"""

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.evaluations.services import calculate_grade, is_station_approved
from apps.exams.models import (
    Exam,
    GradeScalePoint,
    RubricItem,
    Station,
    StationAssignment,
    StationVariant,
)
from apps.students.models import ExamStudent, Student
from apps.users.models import User


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.cl",
        password="admin1234",
        first_name="Admin",
        last_name="Test",
        role=User.Role.ADMIN,
    )


@pytest.fixture
def evaluator_user(db):
    return User.objects.create_user(
        email="eval@test.cl",
        password="eval1234",
        first_name="Evaluador",
        last_name="Test",
        role=User.Role.EVALUATOR,
    )


@pytest.fixture
def other_evaluator(db):
    return User.objects.create_user(
        email="other@test.cl",
        password="other1234",
        first_name="Otro",
        last_name="Evaluador",
        role=User.Role.EVALUATOR,
    )


@pytest.fixture
def exam(db, admin_user):
    return Exam.objects.create(
        name="ECOE Test",
        status=Exam.Status.PUBLISHED,
        created_by=admin_user,
    )


@pytest.fixture
def station(db, exam):
    st = Station.objects.create(
        exam=exam,
        name="Anamnesis",
        weight_percent=Decimal("100"),
        order=1,
    )
    return st


@pytest.fixture
def rubric_items(db, station):
    items = []
    for i, pts in enumerate([Decimal("3"), Decimal("3"), Decimal("4")], start=1):
        items.append(
            RubricItem.objects.create(
                station=station, order=i, description=f"Ítem {i}", max_points=pts
            )
        )
    return items  # total max = 10


@pytest.fixture
def grade_scale(db, station):
    """Linear scale: 0→1.0, 1→1.6, 2→2.2, ..., 10→7.0 (step 1)"""
    points = []
    for raw in range(0, 11):
        grade = Decimal("1.0") + Decimal(str(raw)) * Decimal("0.6")
        points.append(
            GradeScalePoint(
                station=station,
                raw_points=Decimal(str(raw)),
                grade=grade,
            )
        )
    GradeScalePoint.objects.bulk_create(points)
    return points


@pytest.fixture
def student(db):
    return Student.objects.create(rut="12345678-9", full_name="Ana García", email="ana@test.cl")


@pytest.fixture
def exam_student(db, exam, student):
    return ExamStudent.objects.create(exam=exam, student=student)


@pytest.fixture
def assignment(db, exam, station, evaluator_user):
    return StationAssignment.objects.create(exam=exam, station=station, evaluator=evaluator_user)


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def evaluator_client(evaluator_user):
    client = APIClient()
    client.force_authenticate(user=evaluator_user)
    return client


@pytest.fixture
def other_evaluator_client(other_evaluator):
    client = APIClient()
    client.force_authenticate(user=other_evaluator)
    return client


# ─── Grade Calculation Tests ──────────────────────────────────────────────────


class TestGradeCalculation:
    def test_exact_match(self, db, station, grade_scale):
        """Exact match in scale returns that grade directly."""
        grade = calculate_grade(station, Decimal("5"))
        # 5 → 1.0 + 5*0.6 = 4.0
        assert grade == Decimal("4.0000")

    def test_exact_match_zero(self, db, station, grade_scale):
        grade = calculate_grade(station, Decimal("0"))
        assert grade == Decimal("1.0000")

    def test_exact_match_max(self, db, station, grade_scale):
        grade = calculate_grade(station, Decimal("10"))
        assert grade == Decimal("7.0000")

    def test_interpolation(self, db, station, grade_scale):
        """Interpolation between 5 (4.0) and 6 (4.6): 5.5 → 4.3"""
        grade = calculate_grade(station, Decimal("5.5"))
        expected = Decimal("4.3")  # 4.0 + 0.5 * 0.6 = 4.3
        assert grade == expected.quantize(Decimal("0.0001"))

    def test_interpolation_quarter(self, db, station, grade_scale):
        """5.25 → 4.0 + 0.25*0.6 = 4.15"""
        grade = calculate_grade(station, Decimal("5.25"))
        expected = Decimal("4.15").quantize(Decimal("0.0001"))
        assert grade == expected

    def test_below_minimum_clamps(self, db, station, grade_scale):
        """Score below min raw_points → min grade."""
        grade = calculate_grade(station, Decimal("-1"))
        assert grade == Decimal("1.0000")

    def test_above_maximum_clamps(self, db, station, grade_scale):
        """Score above max raw_points → max grade."""
        grade = calculate_grade(station, Decimal("15"))
        assert grade == Decimal("7.0000")

    def test_no_scale_raises(self, db, station):
        """No scale defined → ValueError."""
        with pytest.raises(ValueError):
            calculate_grade(station, Decimal("5"))


# ─── Permission Tests ─────────────────────────────────────────────────────────


class TestPermissions:
    def test_evaluator_cannot_see_unassigned_station_evaluations(
        self, other_evaluator_client, station, exam_student, rubric_items, grade_scale
    ):
        """Evaluator without assignment cannot list evaluations."""
        url = f"/api/v1/stations/{station.id}/evaluations/"
        response = other_evaluator_client.get(url)
        assert response.status_code == 403

    def test_evaluator_can_see_assigned_station_evaluations(
        self, evaluator_client, station, assignment, exam_student, rubric_items, grade_scale
    ):
        """Evaluator WITH assignment can list evaluations."""
        url = f"/api/v1/stations/{station.id}/evaluations/"
        response = evaluator_client.get(url)
        assert response.status_code == 200

    def test_admin_can_see_all_evaluations(
        self, admin_client, station, exam_student, rubric_items, grade_scale
    ):
        """Admin can list all evaluations regardless of assignment."""
        url = f"/api/v1/stations/{station.id}/evaluations/"
        response = admin_client.get(url)
        assert response.status_code == 200


# ─── Finalize Tests ───────────────────────────────────────────────────────────


class TestFinalizeEvaluation:
    def _create_draft(self, evaluator_client, station, student):
        url = f"/api/v1/stations/{station.id}/evaluations/"
        res = evaluator_client.post(url, {"student_id": student.id}, format="json")
        assert res.status_code in (200, 201)
        return res.data

    def test_finalize_fails_when_items_incomplete(
        self,
        evaluator_client,
        station,
        assignment,
        exam_student,
        student,
        rubric_items,
        grade_scale,
    ):
        """Finalize fails if any rubric item has no points."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        url = f"/api/v1/evaluations/{eval_id}/finalize/"
        response = evaluator_client.post(url)
        assert response.status_code == 400
        assert "incomplete_items" in response.data

    def test_finalize_succeeds_with_all_items_scored(
        self,
        evaluator_client,
        admin_client,
        station,
        assignment,
        exam_student,
        student,
        rubric_items,
        grade_scale,
    ):
        """Finalize succeeds when all items have points; grade is calculated."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        # Score all items
        item_scores = [
            {"id": s["id"], "points": s["rubric_item_max_points"]} for s in eval_data["item_scores"]
        ]  # Full marks: 3+3+4 = 10 → grade 7.0

        patch_url = f"/api/v1/evaluations/{eval_id}/"
        patch_res = evaluator_client.patch(patch_url, {"item_scores": item_scores}, format="json")
        assert patch_res.status_code == 200

        finalize_url = f"/api/v1/evaluations/{eval_id}/finalize/"
        fin_res = evaluator_client.post(finalize_url)
        assert fin_res.status_code == 200
        assert fin_res.data["status"] == "FINAL"
        assert fin_res.data["grade_display"] == "7.00"
        assert fin_res.data["total_points"] is not None

    def test_evaluator_cannot_edit_finalized_evaluation(
        self,
        evaluator_client,
        admin_client,
        station,
        assignment,
        exam_student,
        student,
        rubric_items,
        grade_scale,
    ):
        """Evaluator cannot PATCH a FINAL evaluation."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        # Score and finalize via admin
        item_scores = [{"id": s["id"], "points": "0"} for s in eval_data["item_scores"]]
        evaluator_client.patch(
            f"/api/v1/evaluations/{eval_id}/",
            {"item_scores": item_scores},
            format="json",
        )
        evaluator_client.post(f"/api/v1/evaluations/{eval_id}/finalize/")

        # Try to edit as evaluator
        res = evaluator_client.patch(
            f"/api/v1/evaluations/{eval_id}/",
            {"general_comment": "Intentando editar"},
            format="json",
        )
        assert res.status_code == 403

    def test_admin_can_reopen_finalized_evaluation(
        self,
        evaluator_client,
        admin_client,
        station,
        assignment,
        exam_student,
        student,
        rubric_items,
        grade_scale,
    ):
        """Admin can reopen a finalized evaluation."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        item_scores = [{"id": s["id"], "points": "1"} for s in eval_data["item_scores"]]
        evaluator_client.patch(
            f"/api/v1/evaluations/{eval_id}/",
            {"item_scores": item_scores},
            format="json",
        )
        evaluator_client.post(f"/api/v1/evaluations/{eval_id}/finalize/")

        reopen_res = admin_client.post(f"/api/v1/evaluations/{eval_id}/reopen/")
        assert reopen_res.status_code == 200
        assert reopen_res.data["status"] == "DRAFT"


# ─── Passing Score Percent Tests ─────────────────────────────────────────────


class TestPassingScorePercent:
    def test_default_passing_score_percent(self, db, station):
        """Station defaults to 60% passing score."""
        assert station.passing_score_percent == Decimal("60")

    def test_custom_passing_score_percent(self, db, exam, admin_user):
        """Station can have a custom passing score percent."""
        st = Station.objects.create(
            exam=exam,
            name="Custom",
            weight_percent=Decimal("100"),
            passing_score_percent=Decimal("70"),
            order=2,
        )
        assert st.passing_score_percent == Decimal("70")

    def test_is_station_approved_pass(self, db, station, rubric_items, grade_scale):
        """Student passes with 6/10 pts at 60% threshold."""
        assert is_station_approved(station, Decimal("6")) is True

    def test_is_station_approved_fail(self, db, station, rubric_items, grade_scale):
        """Student fails with 5/10 pts at 60% threshold."""
        assert is_station_approved(station, Decimal("5")) is False

    def test_is_station_approved_exact_threshold(self, db, station, rubric_items, grade_scale):
        """Student passes at exactly the threshold (6.0 pts at 60% of 10)."""
        assert is_station_approved(station, Decimal("6.0")) is True

    def test_is_station_approved_custom_percent(self, db, exam, admin_user):
        """Custom 70% threshold: 7/10 required to pass."""
        st = Station.objects.create(
            exam=exam,
            name="Hard",
            weight_percent=Decimal("100"),
            passing_score_percent=Decimal("70"),
            order=3,
        )
        for i in range(1, 4):
            RubricItem.objects.create(
                station=st,
                order=i,
                description=f"Item {i}",
                max_points=Decimal("3") if i < 3 else Decimal("4"),
            )
        assert is_station_approved(st, Decimal("7")) is True
        assert is_station_approved(st, Decimal("6.9")) is False

    def test_passing_score_percent_in_api(self, admin_client, station):
        """API returns passing_score_percent for stations."""
        url = f"/api/v1/stations/{station.id}/"
        response = admin_client.get(url)
        assert response.status_code == 200
        assert "passing_score_percent" in response.data

    def test_update_passing_score_percent(self, admin_client, station):
        """Admin can update passing_score_percent."""
        url = f"/api/v1/stations/{station.id}/"
        response = admin_client.patch(url, {"passing_score_percent": "75.00"}, format="json")
        assert response.status_code == 200
        station.refresh_from_db()
        assert station.passing_score_percent == Decimal("75.00")


# ─── Station Variant Tests ───────────────────────────────────────────────────


class TestStationVariants:
    def test_create_variant(self, admin_client, station):
        """Admin can create a station variant."""
        url = f"/api/v1/stations/{station.id}/variants/"
        res = admin_client.post(
            url,
            {
                "name": "Variante A",
                "description": "Caso clínico alternativo",
                "uses_own_rubric": False,
                "uses_own_scale": False,
            },
            format="json",
        )
        assert res.status_code == 201
        assert res.data["name"] == "Variante A"
        assert res.data["station"] == station.id

    def test_list_variants(self, admin_client, station):
        """Can list variants for a station."""
        StationVariant.objects.create(station=station, name="V-A", order=1)
        StationVariant.objects.create(station=station, name="V-B", order=2)
        url = f"/api/v1/stations/{station.id}/variants/"
        res = admin_client.get(url)
        assert res.status_code == 200
        assert res.data["count"] == 2

    def test_update_variant(self, admin_client, station):
        """Admin can update a variant."""
        variant = StationVariant.objects.create(station=station, name="V-A", order=1)
        url = f"/api/v1/variants/{variant.id}/"
        res = admin_client.patch(url, {"name": "Variante Actualizada"}, format="json")
        assert res.status_code == 200
        assert res.data["name"] == "Variante Actualizada"

    def test_delete_variant(self, admin_client, station):
        """Admin can delete a variant with no final evaluations."""
        variant = StationVariant.objects.create(station=station, name="V-A", order=1)
        url = f"/api/v1/variants/{variant.id}/"
        res = admin_client.delete(url)
        assert res.status_code == 204

    def test_variant_count_in_station_api(self, admin_client, station):
        """Station API includes variants_count."""
        StationVariant.objects.create(station=station, name="V-A", order=1)
        url = f"/api/v1/stations/{station.id}/"
        res = admin_client.get(url)
        assert res.status_code == 200
        assert res.data["variants_count"] == 1

    def test_variant_with_own_rubric(self, admin_client, station, rubric_items):
        """Variant with uses_own_rubric=True can have its own rubric items."""
        variant = StationVariant.objects.create(
            station=station, name="V-Own", order=1, uses_own_rubric=True
        )
        RubricItem.objects.create(
            variant=variant,
            order=1,
            description="Variant-specific item",
            max_points=Decimal("5"),
        )
        assert variant.rubric_items.count() == 1
        assert variant.uses_own_rubric is True


# ─── Rubric Import Tests ─────────────────────────────────────────────────────


class TestRubricImport:
    def _make_xlsx(self, rows, tmp_path):
        """Create a simple XLSX file from a list of rows."""
        import openpyxl

        wb = openpyxl.Workbook()
        ws = wb.active
        for row in rows:
            ws.append(row)
        file_path = tmp_path / "rubric.xlsx"
        wb.save(file_path)
        return file_path

    def test_import_rubric_success(self, admin_client, station, tmp_path):
        """Import rubric items from XLSX with description and max_points."""
        xlsx_path = self._make_xlsx(
            [
                ["Descripción", "Puntaje Máximo", "Orden"],
                ["Saludo al paciente", 2, 1],
                ["Anamnesis completa", 3, 2],
                ["Examen físico", 5, 3],
            ],
            tmp_path,
        )

        with open(xlsx_path, "rb") as f:
            url = f"/api/v1/stations/{station.id}/rubric-items/import-xlsx/"
            res = admin_client.post(url, {"file": f}, format="multipart")

        assert res.status_code == 200
        assert res.data["created"] == 3
        assert len(res.data["errors"]) == 0
        assert station.rubric_items.count() == 3

    def test_import_rubric_missing_points(self, admin_client, station, tmp_path):
        """Import with missing max_points generates error."""
        xlsx_path = self._make_xlsx(
            [
                ["Descripción", "Puntaje Máximo"],
                ["Saludo al paciente", None],
                ["Anamnesis completa", 3],
            ],
            tmp_path,
        )

        with open(xlsx_path, "rb") as f:
            url = f"/api/v1/stations/{station.id}/rubric-items/import-xlsx/"
            res = admin_client.post(url, {"file": f}, format="multipart")

        assert res.status_code == 200
        assert res.data["created"] == 1
        assert len(res.data["errors"]) == 1  # Row 2 has no points

    def test_import_rubric_no_file(self, admin_client, station):
        """Import with no file returns 400."""
        url = f"/api/v1/stations/{station.id}/rubric-items/import-xlsx/"
        res = admin_client.post(url, {}, format="multipart")
        assert res.status_code == 400

    def test_import_rubric_flexible_headers(self, admin_client, station, tmp_path):
        """Import with alternative header names (item, puntaje)."""
        xlsx_path = self._make_xlsx(
            [
                ["Item", "Puntaje"],
                ["Criterio A", 4],
                ["Criterio B", 6],
            ],
            tmp_path,
        )

        with open(xlsx_path, "rb") as f:
            url = f"/api/v1/stations/{station.id}/rubric-items/import-xlsx/"
            res = admin_client.post(url, {"file": f}, format="multipart")

        assert res.status_code == 200
        assert res.data["created"] == 2


# ─── Role and Naming Tests ───────────────────────────────────────────────────


class TestRolesAndNaming:
    def test_admin_role_display_is_coordinador(self, admin_user):
        """ADMIN role displays as 'Coordinador'."""
        assert admin_user.get_role_display() == "Coordinador"

    def test_evaluator_role_display_is_educador(self, evaluator_user):
        """EVALUATOR role displays as 'Educador'."""
        assert evaluator_user.get_role_display() == "Educador"

    def test_exam_type_default_is_ecoe(self, exam):
        """Exam defaults to ECOE type."""
        assert exam.exam_type == "ECOE"

    def test_exam_type_choices(self, admin_client, admin_user):
        """Can create exams with different types."""
        url = "/api/v1/exams/"
        for etype in ["ECOE", "ABP", "SIMULATED", "OTHER"]:
            res = admin_client.post(
                url,
                {
                    "name": f"Test {etype}",
                    "exam_type": etype,
                },
                format="json",
            )
            assert res.status_code == 201, f"Failed for type {etype}: {res.data}"


# ─── Evaluation Workflow Regression Tests ────────────────────────────────────


class TestEvaluationWorkflowRegression:
    def _create_and_finalize(self, evaluator_client, station, student, rubric_items):
        """Helper: create, score all items at max, finalize."""
        url = f"/api/v1/stations/{station.id}/evaluations/"
        res = evaluator_client.post(url, {"student_id": student.id}, format="json")
        eval_id = res.data["id"]

        item_scores = [
            {"id": s["id"], "points": s["rubric_item_max_points"]} for s in res.data["item_scores"]
        ]
        evaluator_client.patch(
            f"/api/v1/evaluations/{eval_id}/",
            {"item_scores": item_scores},
            format="json",
        )
        fin_res = evaluator_client.post(f"/api/v1/evaluations/{eval_id}/finalize/")
        return fin_res

    def test_full_workflow_with_results(
        self,
        evaluator_client,
        admin_client,
        station,
        assignment,
        exam,
        exam_student,
        student,
        rubric_items,
        grade_scale,
    ):
        """Full workflow: create -> score -> finalize -> results API works."""
        fin_res = self._create_and_finalize(evaluator_client, station, student, rubric_items)
        assert fin_res.status_code == 200
        assert fin_res.data["status"] == "FINAL"

        # Check results endpoint
        results_url = f"/api/v1/exams/{exam.id}/results/"
        results_res = admin_client.get(results_url)
        assert results_res.status_code == 200
        assert len(results_res.data["students"]) == 1
        assert results_res.data["students"][0]["approved"] is True
