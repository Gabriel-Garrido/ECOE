from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action
from apps.users.models import User

from .models import Exam, GradeScalePoint, RubricItem, Station, StationAssignment
from .permissions import IsAdmin, IsAdminOrReadOnly
from .serializers import (
    ExamCreateUpdateSerializer,
    ExamSerializer,
    GradeScalePointSerializer,
    RubricItemSerializer,
    StationAssignmentSerializer,
    StationSerializer,
)


# ─── Exam Views ────────────────────────────────────────────────────────────────


class ExamListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ExamCreateUpdateSerializer
        return ExamSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Exam.objects.select_related("created_by").prefetch_related(
            "stations", "exam_students"
        )
        if user.role == User.Role.ADMIN:
            status_filter = self.request.query_params.get("status")
            if status_filter:
                qs = qs.filter(status=status_filter)
            return qs
        # Evaluator: only exams where they have assignments
        exam_ids = StationAssignment.objects.filter(evaluator=user).values_list(
            "exam_id", flat=True
        )
        return qs.filter(id__in=exam_ids)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        if request.user.role != User.Role.ADMIN:
            return Response(
                {"detail": "Solo los administradores pueden crear ECOEs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class ExamRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return ExamCreateUpdateSerializer
        return ExamSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.ADMIN:
            return Exam.objects.all()
        exam_ids = StationAssignment.objects.filter(evaluator=user).values_list(
            "exam_id", flat=True
        )
        return Exam.objects.filter(id__in=exam_ids)

    def update(self, request, *args, **kwargs):
        if request.user.role != User.Role.ADMIN:
            return Response(status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        if exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "No se puede editar un ECOE cerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


class ExamPublishView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        exam = get_object_or_404(Exam, pk=pk)
        if exam.status != Exam.Status.DRAFT:
            return Response(
                {"detail": "Solo se puede publicar un ECOE en estado Borrador."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        errors = self._validate_publish(exam)
        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        exam.status = Exam.Status.PUBLISHED
        exam.save()
        log_action(request.user, "PUBLISH_EXAM", "Exam", exam.id, {"name": exam.name})
        return Response(ExamSerializer(exam).data)

    def _validate_publish(self, exam) -> list[str]:
        errors = []
        active_stations = exam.stations.filter(is_active=True)

        if not active_stations.exists():
            errors.append("El ECOE debe tener al menos una estación activa.")
            return errors

        # Check weight sum
        total_weight = sum(s.weight_percent for s in active_stations)
        if abs(total_weight - Decimal("100")) > Decimal("0.01"):
            errors.append(
                f"La suma de ponderaciones de estaciones activas debe ser 100% "
                f"(actual: {total_weight}%)."
            )

        for station in active_stations:
            if not station.rubric_items.exists():
                errors.append(
                    f"La estación '{station.name}' no tiene ítems de pauta."
                )
            if not station.grade_scale.exists():
                errors.append(
                    f"La estación '{station.name}' no tiene escala de notas."
                )
            if not station.assignments.exists():
                errors.append(
                    f"La estación '{station.name}' no tiene evaluador asignado."
                )

        if not exam.exam_students.exists():
            errors.append("El ECOE no tiene estudiantes inscritos.")

        return errors


class ExamCloseView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        exam = get_object_or_404(Exam, pk=pk)
        if exam.status != Exam.Status.PUBLISHED:
            return Response(
                {"detail": "Solo se puede cerrar un ECOE publicado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        exam.status = Exam.Status.CLOSED
        exam.save()
        log_action(request.user, "CLOSE_EXAM", "Exam", exam.id, {"name": exam.name})
        return Response(ExamSerializer(exam).data)


# ─── Station Views ─────────────────────────────────────────────────────────────


class StationListCreateView(generics.ListCreateAPIView):
    serializer_class = StationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_exam(self):
        return get_object_or_404(Exam, pk=self.kwargs["exam_id"])

    def get_queryset(self):
        exam = self.get_exam()
        user = self.request.user
        qs = Station.objects.filter(exam=exam).prefetch_related("rubric_items")
        if user.role == User.Role.EVALUATOR:
            assigned_ids = StationAssignment.objects.filter(
                exam=exam, evaluator=user
            ).values_list("station_id", flat=True)
            qs = qs.filter(id__in=assigned_ids)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role != User.Role.ADMIN:
            raise permissions.PermissionDenied()
        exam = self.get_exam()
        if exam.status == Exam.Status.CLOSED:
            raise permissions.PermissionDenied("ECOE cerrado.")
        serializer.save(exam=exam)


class StationRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = StationSerializer
    permission_classes = [IsAdmin]
    queryset = Station.objects.all()

    def update(self, request, *args, **kwargs):
        station = self.get_object()
        if station.exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "No se puede editar estaciones de un ECOE cerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


class StationToggleActiveView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        station = get_object_or_404(Station, pk=pk)
        if station.exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "No se puede modificar estaciones de un ECOE cerrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        station.is_active = not station.is_active
        station.save()
        return Response(StationSerializer(station).data)


# ─── RubricItem Views ──────────────────────────────────────────────────────────


class RubricItemListCreateView(generics.ListCreateAPIView):
    serializer_class = RubricItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_station(self):
        return get_object_or_404(Station, pk=self.kwargs["station_id"])

    def get_queryset(self):
        return RubricItem.objects.filter(station=self.get_station())

    def perform_create(self, serializer):
        if self.request.user.role != User.Role.ADMIN:
            raise permissions.PermissionDenied()
        station = self.get_station()
        if station.exam.status == Exam.Status.CLOSED:
            raise permissions.PermissionDenied("ECOE cerrado.")
        serializer.save(station=station)


class RubricItemRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RubricItemSerializer
    permission_classes = [IsAdmin]
    queryset = RubricItem.objects.all()

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        if item.station.exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )
        # Check no evaluations have scores for this item
        if item.scores.filter(evaluation__status="FINAL").exists():
            return Response(
                {"detail": "No se puede eliminar: hay evaluaciones finalizadas con este ítem."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ─── GradeScale Views ──────────────────────────────────────────────────────────


class GradeScaleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_station(self, station_id):
        return get_object_or_404(Station, pk=station_id)

    def get(self, request, station_id):
        station = self.get_station(station_id)
        scale = station.grade_scale.all()
        serializer = GradeScalePointSerializer(scale, many=True)
        return Response(serializer.data)

    def put(self, request, station_id):
        if request.user.role != User.Role.ADMIN:
            return Response(status=status.HTTP_403_FORBIDDEN)
        station = self.get_station(station_id)
        if station.exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data
        if not isinstance(data, list):
            return Response(
                {"detail": "Se espera una lista de puntos de escala."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = GradeScalePointSerializer(data=data, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            station.grade_scale.all().delete()
            for point_data in serializer.validated_data:
                GradeScalePoint.objects.create(station=station, **point_data)

        result = GradeScalePointSerializer(station.grade_scale.all(), many=True)
        return Response(result.data)


class GradeScaleGenerateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, station_id):
        station = get_object_or_404(Station, pk=station_id)
        if station.exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        min_raw = Decimal(str(request.data.get("min_raw", "0")))
        max_raw = Decimal(str(request.data.get("max_raw", str(station.max_points_total))))
        min_grade = Decimal(str(request.data.get("min_grade", "1.0")))
        max_grade = Decimal(str(request.data.get("max_grade", "7.0")))
        step_raw = request.data.get("step_raw")

        if max_raw <= min_raw:
            return Response(
                {"detail": "max_raw debe ser mayor que min_raw."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if step_raw:
            step = Decimal(str(step_raw))
        else:
            step = Decimal("1")

        points = []
        current = min_raw
        while current <= max_raw:
            if max_raw == min_raw:
                grade = max_grade
            else:
                grade = min_grade + (current - min_raw) / (max_raw - min_raw) * (
                    max_grade - min_grade
                )
            points.append({"raw_points": current, "grade": grade})
            current += step

        # Ensure max_raw is included
        if not points or points[-1]["raw_points"] < max_raw:
            points.append({"raw_points": max_raw, "grade": max_grade})

        with transaction.atomic():
            station.grade_scale.all().delete()
            for p in points:
                GradeScalePoint.objects.create(
                    station=station,
                    raw_points=p["raw_points"],
                    grade=p["grade"],
                )

        result = GradeScalePointSerializer(station.grade_scale.all(), many=True)
        return Response(result.data, status=status.HTTP_201_CREATED)


# ─── Assignment Views ──────────────────────────────────────────────────────────


class AssignmentListCreateView(generics.ListCreateAPIView):
    serializer_class = StationAssignmentSerializer
    permission_classes = [IsAdmin]

    def get_exam(self):
        return get_object_or_404(Exam, pk=self.kwargs["exam_id"])

    def get_queryset(self):
        return StationAssignment.objects.filter(
            exam=self.get_exam()
        ).select_related("station", "evaluator")

    def perform_create(self, serializer):
        exam = self.get_exam()
        serializer.save(exam=exam)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["exam"] = self.get_exam()
        return ctx


class AssignmentDestroyView(generics.DestroyAPIView):
    permission_classes = [IsAdmin]
    queryset = StationAssignment.objects.all()
