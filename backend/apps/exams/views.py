from decimal import Decimal
import unicodedata

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action
from apps.users.models import User

from .models import Exam, GradeScalePoint, RubricItem, Station, StationAssignment, StationVariant
from .permissions import IsAdmin
from .serializers import (
    ExamCreateUpdateSerializer,
    ExamSerializer,
    GradeScalePointSerializer,
    RubricItemSerializer,
    StationAssignmentSerializer,
    StationSerializer,
    StationVariantSerializer,
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
        qs = Exam.objects.select_related("created_by").prefetch_related("stations", "exam_students")
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
                {"detail": "Solo los coordinadores pueden crear evaluaciones."},
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
                {"detail": "No se puede editar una evaluación cerrada."},
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
                {"detail": "Solo se puede publicar una evaluación en estado Borrador."},
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
            errors.append("La evaluación debe tener al menos una estación activa.")
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
                errors.append(f"La estación '{station.name}' no tiene ítems de pauta.")
            if not station.grade_scale.exists():
                errors.append(f"La estación '{station.name}' no tiene escala de notas.")
            if not station.assignments.exists():
                errors.append(f"La estación '{station.name}' no tiene evaluador asignado.")

        if not exam.exam_students.exists():
            errors.append("La evaluación no tiene estudiantes inscritos.")

        return errors


class ExamCloseView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        exam = get_object_or_404(Exam, pk=pk)
        if exam.status != Exam.Status.PUBLISHED:
            return Response(
                {"detail": "Solo se puede cerrar una evaluación publicada."},
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
            assigned_ids = StationAssignment.objects.filter(exam=exam, evaluator=user).values_list(
                "station_id", flat=True
            )
            qs = qs.filter(id__in=assigned_ids)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role != User.Role.ADMIN:
            raise permissions.PermissionDenied()
        exam = self.get_exam()
        if exam.status == Exam.Status.CLOSED:
            raise permissions.PermissionDenied("Evaluación cerrada.")
        serializer.save(exam=exam)


class StationRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = StationSerializer
    permission_classes = [IsAdmin]
    queryset = Station.objects.all()

    def update(self, request, *args, **kwargs):
        station = self.get_object()
        if station.exam.status == Exam.Status.CLOSED:
            return Response(
                {"detail": "No se puede editar estaciones de una evaluación cerrada."},
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
                {"detail": "No se puede modificar estaciones de una evaluación cerrada."},
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
            raise permissions.PermissionDenied("Evaluación cerrada.")
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
            return Response({"detail": "Evaluación cerrada."}, status=status.HTTP_400_BAD_REQUEST)
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
            return Response({"detail": "Evaluación cerrada."}, status=status.HTTP_400_BAD_REQUEST)

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
            return Response({"detail": "Evaluación cerrada."}, status=status.HTTP_400_BAD_REQUEST)

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
        return StationAssignment.objects.filter(exam=self.get_exam()).select_related(
            "station", "evaluator"
        )

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


# --- Rubric Import from XLSX ---


class ImportRubricXlsxView(APIView):
    """
    Import rubric items from an XLSX file.

    Accepts a file upload with columns for: description/item, max_points/puntaje, order (optional).
    Reuses the flexible header-detection pattern from student import.
    """

    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser]

    # Flexible column name matching (same pattern as student import)
    DESC_KEYS = [
        "descripcion",
        "description",
        "item",
        "criterio",
        "indicador",
        "nombre",
        "pregunta",
        "enunciado",
    ]
    POINTS_KEYS = [
        "puntaje",
        "max_points",
        "puntaje_maximo",
        "puntaje maximo",
        "max_pts",
        "maximo",
        "puntos",
        "score",
        "max",
    ]
    ORDER_KEYS = ["orden", "order", "nro", "numero"]

    def _find_column(self, headers: list[str], keys: list[str]) -> int | None:
        """Find column index matching any of the given keys (case-insensitive, accent-insensitive)."""

        def normalize(s: str) -> str:
            return (
                unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower().strip()
            )

        for idx, h in enumerate(headers):
            if not h:
                continue
            h_norm = normalize(str(h))
            for key in keys:
                if key in h_norm or h_norm in key:
                    return idx
        return None

    def post(self, request, station_id):
        station = get_object_or_404(Station, pk=station_id)
        if station.exam.status == Exam.Status.CLOSED:
            return Response({"detail": "Evaluacion cerrada."}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "Se requiere un archivo XLSX."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            import openpyxl

            wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
        except Exception:
            return Response(
                {"detail": "No se pudo leer el archivo. Asegurate de que sea un XLSX valido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            return Response(
                {"detail": "El archivo debe tener al menos una fila de encabezado y una de datos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        headers = [str(c).strip() if c else "" for c in rows[0]]
        desc_col = self._find_column(headers, self.DESC_KEYS)
        points_col = self._find_column(headers, self.POINTS_KEYS)
        order_col = self._find_column(headers, self.ORDER_KEYS)

        if desc_col is None:
            return Response(
                {"detail": f"No se encontro columna de descripcion. Encabezados: {headers}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if points_col is None:
            return Response(
                {"detail": f"No se encontro columna de puntaje maximo. Encabezados: {headers}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        errors_list = []
        existing_count = station.rubric_items.count()

        for row_idx, row in enumerate(rows[1:], start=2):
            try:
                desc_val = row[desc_col] if desc_col < len(row) else None
                pts_val = row[points_col] if points_col < len(row) else None
                order_val = (
                    row[order_col] if order_col is not None and order_col < len(row) else None
                )

                if not desc_val or str(desc_val).strip() == "":
                    continue  # Skip empty rows

                description = str(desc_val).strip()

                if pts_val is None or str(pts_val).strip() == "":
                    errors_list.append(f"Fila {row_idx}: falta puntaje maximo.")
                    continue

                max_points = Decimal(str(pts_val).strip())
                if max_points <= 0:
                    errors_list.append(f"Fila {row_idx}: puntaje debe ser mayor a 0.")
                    continue

                if order_val is not None and str(order_val).strip():
                    order = int(str(order_val).strip())
                else:
                    order = existing_count + created + 1

                RubricItem.objects.create(
                    station=station,
                    description=description,
                    max_points=max_points,
                    order=order,
                )
                created += 1

            except (ValueError, TypeError) as e:
                errors_list.append(f"Fila {row_idx}: {str(e)}")

        log_action(
            request.user,
            "IMPORT_RUBRIC",
            "Station",
            station.id,
            {"created": created, "errors": len(errors_list)},
        )

        return Response(
            {"created": created, "errors": errors_list},
            status=status.HTTP_200_OK,
        )


# --- Station Variant Views ---


class StationVariantListCreateView(generics.ListCreateAPIView):
    serializer_class = StationVariantSerializer
    permission_classes = [IsAdmin]

    def get_station(self):
        return get_object_or_404(Station, pk=self.kwargs["station_id"])

    def get_queryset(self):
        return StationVariant.objects.filter(station=self.get_station())

    def perform_create(self, serializer):
        station = self.get_station()
        if station.exam.status == Exam.Status.CLOSED:
            raise permissions.PermissionDenied("Evaluacion cerrada.")
        serializer.save(station=station)


class StationVariantRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StationVariantSerializer
    permission_classes = [IsAdmin]
    queryset = StationVariant.objects.all()

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        variant = self.get_object()
        if variant.station.exam.status == Exam.Status.CLOSED:
            return Response({"detail": "Evaluacion cerrada."}, status=status.HTTP_400_BAD_REQUEST)
        # Check no evaluations reference this variant
        if variant.evaluations.filter(status="FINAL").exists():
            return Response(
                {"detail": "No se puede eliminar: hay evaluaciones finalizadas con esta variante."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
