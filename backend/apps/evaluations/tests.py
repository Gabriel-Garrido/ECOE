"""
Tests for ECOE evaluations: grade calculation, permissions, finalize workflow.
"""
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.evaluations.services import calculate_grade
from apps.exams.models import Exam, GradeScalePoint, RubricItem, Station, StationAssignment
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
    return StationAssignment.objects.create(
        exam=exam, station=station, evaluator=evaluator_user
    )


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
        self, evaluator_client, station, assignment, exam_student, student, rubric_items, grade_scale
    ):
        """Finalize fails if any rubric item has no points."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        url = f"/api/v1/evaluations/{eval_id}/finalize/"
        response = evaluator_client.post(url)
        assert response.status_code == 400
        assert "incomplete_items" in response.data

    def test_finalize_succeeds_with_all_items_scored(
        self, evaluator_client, admin_client, station, assignment,
        exam_student, student, rubric_items, grade_scale
    ):
        """Finalize succeeds when all items have points; grade is calculated."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        # Score all items
        item_scores = [
            {"id": s["id"], "points": s["rubric_item_max_points"]}
            for s in eval_data["item_scores"]
        ]  # Full marks: 3+3+4 = 10 → grade 7.0

        patch_url = f"/api/v1/evaluations/{eval_id}/"
        patch_res = evaluator_client.patch(
            patch_url, {"item_scores": item_scores}, format="json"
        )
        assert patch_res.status_code == 200

        finalize_url = f"/api/v1/evaluations/{eval_id}/finalize/"
        fin_res = evaluator_client.post(finalize_url)
        assert fin_res.status_code == 200
        assert fin_res.data["status"] == "FINAL"
        assert fin_res.data["grade_display"] == "7.00"
        assert fin_res.data["total_points"] is not None

    def test_evaluator_cannot_edit_finalized_evaluation(
        self, evaluator_client, admin_client, station, assignment,
        exam_student, student, rubric_items, grade_scale
    ):
        """Evaluator cannot PATCH a FINAL evaluation."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        # Score and finalize via admin
        item_scores = [
            {"id": s["id"], "points": "0"}
            for s in eval_data["item_scores"]
        ]
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
        self, evaluator_client, admin_client, station, assignment,
        exam_student, student, rubric_items, grade_scale
    ):
        """Admin can reopen a finalized evaluation."""
        eval_data = self._create_draft(evaluator_client, station, student)
        eval_id = eval_data["id"]

        item_scores = [
            {"id": s["id"], "points": "1"}
            for s in eval_data["item_scores"]
        ]
        evaluator_client.patch(
            f"/api/v1/evaluations/{eval_id}/",
            {"item_scores": item_scores},
            format="json",
        )
        evaluator_client.post(f"/api/v1/evaluations/{eval_id}/finalize/")

        reopen_res = admin_client.post(f"/api/v1/evaluations/{eval_id}/reopen/")
        assert reopen_res.status_code == 200
        assert reopen_res.data["status"] == "DRAFT"
