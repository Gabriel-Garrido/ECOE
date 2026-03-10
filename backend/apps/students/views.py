import openpyxl
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.utils import log_action
from apps.exams.models import Exam
from apps.users.models import User

from .models import ExamStudent, Student
from .serializers import ExamStudentSerializer, StudentManualCreateSerializer, StudentSerializer

# Flexible XLSX header detection
RUT_KEYS = {"rut", "run", "r.u.t", "r.u.n"}
NAME_KEYS = {"nombre", "full_name", "nombre completo", "apellido y nombre", "nombre y apellido", "nombres"}
EMAIL_KEYS = {"correo", "email", "e-mail", "correo electronico", "correo electrónico", "mail"}


def _find_column(headers: list[str], keys: set[str]) -> int | None:
    for i, h in enumerate(headers):
        if h.strip().lower().replace(".", "").replace(" ", " ") in keys:
            return i
        # fuzzy: check if any key is contained in header
        h_clean = h.strip().lower()
        for k in keys:
            if k in h_clean or h_clean in k:
                return i
    return None


class ExamStudentListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exam_id):
        exam = get_object_or_404(Exam, pk=exam_id)
        exam_students = ExamStudent.objects.filter(exam=exam).select_related("student")
        serializer = ExamStudentSerializer(exam_students, many=True)
        return Response(serializer.data)

    def post(self, request, exam_id):
        """Manually add a student to an exam."""
        if request.user.role != User.Role.ADMIN:
            return Response(status=status.HTTP_403_FORBIDDEN)

        exam = get_object_or_404(Exam, pk=exam_id)
        if exam.status == "CLOSED":
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        rut = request.data.get("rut", "").strip()
        if not rut:
            return Response(
                {"detail": "El campo 'rut' es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student, _ = Student.objects.update_or_create(
            rut=rut,
            defaults={
                "full_name": request.data.get("full_name", "").strip(),
                "email": request.data.get("email", "").strip(),
            },
        )
        ExamStudent.objects.get_or_create(exam=exam, student=student)
        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)


class ImportXLSXView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request, exam_id):
        if request.user.role != User.Role.ADMIN:
            return Response(status=status.HTTP_403_FORBIDDEN)

        exam = get_object_or_404(Exam, pk=exam_id)
        if exam.status == "CLOSED":
            return Response(
                {"detail": "ECOE cerrado."}, status=status.HTTP_400_BAD_REQUEST
            )

        file = request.FILES.get("file")
        if not file:
            return Response(
                {"detail": "Se requiere el campo 'file'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
        except Exception as e:
            return Response(
                {"detail": f"No se pudo leer el archivo Excel: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return Response(
                {"detail": "El archivo está vacío."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Detect header row (first row with content)
        headers = [str(c).strip() if c is not None else "" for c in rows[0]]
        rut_col = _find_column(headers, RUT_KEYS)
        name_col = _find_column(headers, NAME_KEYS)
        email_col = _find_column(headers, EMAIL_KEYS)

        if rut_col is None:
            return Response(
                {
                    "detail": (
                        "No se encontró columna de RUT. "
                        "Se esperan encabezados: rut, RUT, run, etc."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if name_col is None:
            return Response(
                {
                    "detail": (
                        "No se encontró columna de nombre. "
                        "Se esperan encabezados: nombre, full_name, nombre completo, etc."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        updated_count = 0
        errors = []

        for row_idx, row in enumerate(rows[1:], start=2):
            rut = str(row[rut_col]).strip() if row[rut_col] is not None else ""
            full_name = str(row[name_col]).strip() if row[name_col] is not None else ""
            email = ""
            if email_col is not None and row[email_col] is not None:
                email = str(row[email_col]).strip()

            if not rut or rut.lower() in ("none", "nan", ""):
                continue
            if not full_name:
                errors.append(f"Fila {row_idx}: nombre vacío para RUT '{rut}'.")
                continue

            student, created = Student.objects.update_or_create(
                rut=rut,
                defaults={"full_name": full_name, "email": email},
            )
            ExamStudent.objects.get_or_create(exam=exam, student=student)
            if created:
                created_count += 1
            else:
                updated_count += 1

        log_action(
            request.user,
            "IMPORT_STUDENTS",
            "Exam",
            exam.id,
            {"created": created_count, "updated": updated_count, "errors": len(errors)},
        )

        return Response(
            {
                "created": created_count,
                "updated": updated_count,
                "errors": errors,
            }
        )
