from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action
from apps.exams.models import Exam, Station, StationAssignment
from apps.students.models import Student
from apps.users.models import User

from .models import Evaluation, EvaluationItemScore
from .serializers import EvaluationSerializer
from .services import calculate_final_grade, calculate_grade


class IsAdminOrAssignedEvaluator(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class EvaluationListCreateView(APIView):
    """
    GET  /stations/{station_id}/evaluations/ - list evaluations for the station
    POST /stations/{station_id}/evaluations/ - get or create a DRAFT for a student
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_station(self, station_id):
        return get_object_or_404(Station, pk=station_id)

    def _check_access(self, request, station):
        if request.user.role == User.Role.ADMIN:
            return True
        return StationAssignment.objects.filter(
            exam=station.exam, station=station, evaluator=request.user
        ).exists()

    def get(self, request, station_id):
        station = self.get_station(station_id)
        if not self._check_access(request, station):
            return Response(status=status.HTTP_403_FORBIDDEN)

        qs = Evaluation.objects.filter(station=station).select_related(
            "student", "evaluator"
        ).prefetch_related("item_scores__rubric_item")

        if request.user.role == User.Role.EVALUATOR:
            qs = qs.filter(evaluator=request.user)

        serializer = EvaluationSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request, station_id):
        """Get or create a DRAFT evaluation for a given student."""
        station = self.get_station(station_id)
        if not self._check_access(request, station):
            return Response(status=status.HTTP_403_FORBIDDEN)

        if station.exam.status == "CLOSED":
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        student_id = request.data.get("student_id")
        if not student_id:
            return Response(
                {"detail": "Se requiere 'student_id'."}, status=status.HTTP_400_BAD_REQUEST
            )

        student = get_object_or_404(Student, pk=student_id)

        # Check student is enrolled in exam
        if not station.exam.exam_students.filter(student=student).exists():
            return Response(
                {"detail": "El estudiante no está inscrito en este ECOE."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Enforce 1 evaluator per (exam, station, student) - only FINAL restricts
        # Allow get or create DRAFT
        with transaction.atomic():
            evaluation, created = Evaluation.objects.get_or_create(
                exam=station.exam,
                station=station,
                student=student,
                defaults={
                    "evaluator": request.user,
                    "status": Evaluation.Status.DRAFT,
                },
            )

            # If evaluation exists but is FINAL, only admin can view/touch it
            if not created and evaluation.status == Evaluation.Status.FINAL:
                if request.user.role != User.Role.ADMIN:
                    # Return the FINAL evaluation for viewing
                    serializer = EvaluationSerializer(evaluation)
                    return Response(serializer.data)

            # Create EvaluationItemScore entries for all rubric items (idempotent)
            rubric_items = station.rubric_items.all()
            for item in rubric_items:
                EvaluationItemScore.objects.get_or_create(
                    evaluation=evaluation, rubric_item=item
                )

        evaluation.refresh_from_db()
        # Prefetch for serializer
        evaluation = (
            Evaluation.objects.filter(pk=evaluation.pk)
            .prefetch_related("item_scores__rubric_item")
            .select_related("student", "evaluator", "station", "exam")
            .first()
        )
        serializer = EvaluationSerializer(evaluation)
        resp_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=resp_status)


class EvaluationRetrieveUpdateView(APIView):
    """
    GET   /evaluations/{id}/
    PATCH /evaluations/{id}/  - update scores + general_comment
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_evaluation(self, pk):
        return get_object_or_404(
            Evaluation.objects.prefetch_related(
                "item_scores__rubric_item"
            ).select_related("student", "evaluator", "station", "exam"),
            pk=pk,
        )

    def _check_access(self, request, evaluation):
        if request.user.role == User.Role.ADMIN:
            return True
        return (
            evaluation.evaluator == request.user
            and StationAssignment.objects.filter(
                exam=evaluation.exam,
                station=evaluation.station,
                evaluator=request.user,
            ).exists()
        )

    def get(self, request, pk):
        evaluation = self.get_evaluation(pk)
        if not self._check_access(request, evaluation):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(EvaluationSerializer(evaluation).data)

    def patch(self, request, pk):
        evaluation = self.get_evaluation(pk)
        if not self._check_access(request, evaluation):
            return Response(status=status.HTTP_403_FORBIDDEN)

        if evaluation.exam.status == "CLOSED":
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Only admin can edit FINAL evaluations
        if evaluation.status == Evaluation.Status.FINAL and request.user.role != User.Role.ADMIN:
            return Response(
                {"detail": "Solo el administrador puede editar evaluaciones finalizadas."},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            # Update general_comment if provided
            if "general_comment" in request.data:
                evaluation.general_comment = request.data["general_comment"]
                evaluation.save(update_fields=["general_comment", "updated_at"])

            # Update item scores: expects {"item_scores": [{"id": X, "points": Y, "comment": Z}]}
            item_scores_data = request.data.get("item_scores", [])
            errors = []
            for score_data in item_scores_data:
                score_id = score_data.get("id")
                if not score_id:
                    continue
                try:
                    score = EvaluationItemScore.objects.get(
                        id=score_id, evaluation=evaluation
                    )
                    points = score_data.get("points")
                    if points is not None:
                        points_dec = Decimal(str(points))
                        if points_dec < Decimal("0"):
                            errors.append(
                                f"Ítem {score_id}: el puntaje no puede ser negativo."
                            )
                            continue
                        if points_dec > score.rubric_item.max_points:
                            errors.append(
                                f"Ítem {score_id}: el puntaje ({points_dec}) supera "
                                f"el máximo ({score.rubric_item.max_points})."
                            )
                            continue
                        score.points = points_dec
                    elif "points" in score_data and score_data["points"] is None:
                        score.points = None

                    if "comment" in score_data:
                        score.comment = score_data["comment"] or ""
                    score.save()
                except EvaluationItemScore.DoesNotExist:
                    errors.append(f"Ítem {score_id}: no encontrado.")

            if errors:
                return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        evaluation.refresh_from_db()
        evaluation = (
            Evaluation.objects.filter(pk=evaluation.pk)
            .prefetch_related("item_scores__rubric_item")
            .select_related("student", "evaluator", "station", "exam")
            .first()
        )
        return Response(EvaluationSerializer(evaluation).data)


class FinalizeEvaluationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        evaluation = get_object_or_404(
            Evaluation.objects.prefetch_related(
                "item_scores__rubric_item"
            ).select_related("station", "exam", "student"),
            pk=pk,
        )

        # Check access
        if request.user.role == User.Role.EVALUATOR:
            if evaluation.evaluator != request.user:
                return Response(status=status.HTTP_403_FORBIDDEN)

        if evaluation.status == Evaluation.Status.FINAL:
            return Response(
                {"detail": "La evaluación ya está finalizada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if evaluation.exam.status == "CLOSED":
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate all items have points
        incomplete = [
            s for s in evaluation.item_scores.all() if s.points is None
        ]
        if incomplete:
            return Response(
                {
                    "detail": "Todos los ítems deben tener puntaje antes de finalizar.",
                    "incomplete_items": [
                        {
                            "id": s.id,
                            "description": s.rubric_item.description,
                        }
                        for s in incomplete
                    ],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Calculate total_points
            total = sum(s.points for s in evaluation.item_scores.all())
            evaluation.total_points = total

            # Calculate grade
            evaluation.grade = calculate_grade(evaluation.station, total)

            evaluation.status = Evaluation.Status.FINAL
            evaluation.finalized_at = timezone.now()
            evaluation.save()

        log_action(
            request.user,
            "FINALIZE_EVALUATION",
            "Evaluation",
            evaluation.id,
            {
                "student": evaluation.student.full_name,
                "station": evaluation.station.name,
                "total_points": str(total),
                "grade": str(evaluation.grade),
            },
        )

        evaluation.refresh_from_db()
        evaluation = (
            Evaluation.objects.filter(pk=evaluation.pk)
            .prefetch_related("item_scores__rubric_item")
            .select_related("student", "evaluator", "station", "exam")
            .first()
        )
        return Response(EvaluationSerializer(evaluation).data)


class ReopenEvaluationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != User.Role.ADMIN:
            return Response(status=status.HTTP_403_FORBIDDEN)

        evaluation = get_object_or_404(Evaluation, pk=pk)

        if evaluation.status != Evaluation.Status.FINAL:
            return Response(
                {"detail": "Solo se pueden reabrir evaluaciones finalizadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if evaluation.exam.status == "CLOSED":
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        evaluation.status = Evaluation.Status.DRAFT
        evaluation.finalized_at = None
        evaluation.save()

        log_action(
            request.user,
            "REOPEN_EVALUATION",
            "Evaluation",
            evaluation.id,
            {
                "student": evaluation.student.full_name,
                "station": evaluation.station.name,
                "reason": request.data.get("reason", ""),
            },
        )

        return Response(EvaluationSerializer(evaluation).data)


class ExamResultsView(APIView):
    """
    GET /exams/{exam_id}/results/
    Returns consolidated grade table for all students in the exam.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exam_id):
        exam = get_object_or_404(Exam, pk=exam_id)

        # Evaluators can only see results if assigned in the exam
        if request.user.role == User.Role.EVALUATOR:
            if not StationAssignment.objects.filter(
                exam=exam, evaluator=request.user
            ).exists():
                return Response(status=status.HTTP_403_FORBIDDEN)

        active_stations = list(
            exam.stations.filter(is_active=True).order_by("order", "id")
        )
        results = calculate_final_grade(exam)

        return Response(
            {
                "exam": {
                    "id": exam.id,
                    "name": exam.name,
                    "status": exam.status,
                },
                "stations": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "weight_percent": str(s.weight_percent),
                        "order": s.order,
                    }
                    for s in active_stations
                ],
                "students": [
                    {
                        "student": {
                            "id": r["student"].id,
                            "rut": r["student"].rut,
                            "full_name": r["student"].full_name,
                            "email": r["student"].email,
                        },
                        "station_grades": {
                            str(k): str(v) for k, v in r["station_grades"].items()
                        },
                        "final_grade": str(r["final_grade"])
                        if r["final_grade"] is not None
                        else None,
                        "approved": r["approved"],
                    }
                    for r in results
                ],
            }
        )
