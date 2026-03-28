import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExam, publishExam, closeExam } from "../../api/exams";
import { getStations } from "../../api/stations";
import { getExamStudents } from "../../api/students";
import { getAssignments } from "../../api/assignments";
import Button from "../../components/ui/Button";
import { ExamStatusBadge } from "../../components/ui/Badge";
import Breadcrumb from "../../components/ui/Breadcrumb";
import Spinner from "../../components/ui/Spinner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import ExamSetupChecklist from "../../components/ExamSetupChecklist";
import StationsTab from "./tabs/StationsTab";
import StudentsTab from "./tabs/StudentsTab";
import AssignmentsTab from "./tabs/AssignmentsTab";
import ResultsTab from "./tabs/ResultsTab";
import AuditTab from "./tabs/AuditTab";

const EXAM_TYPE_LABELS: Record<string, string> = {
  ECOE: "ECOE/OSCE",
  ABP: "ABP",
  SIMULATED: "Escenario Simulado",
  OTHER: "Otro",
};

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const id = Number(examId);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("stations");
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: () => getExam(id),
    enabled: !!id,
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["stations", id],
    queryFn: () => getStations(id),
    enabled: !!id,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["exam-students", id],
    queryFn: () => getExamStudents(id),
    enabled: !!id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", id],
    queryFn: () => getAssignments(id),
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: () => publishExam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam", id] });
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Evaluación publicada exitosamente");
    },
    onError: (e: unknown) => {
      const errs = (e as { response?: { data?: { errors?: string[] } } })
        ?.response?.data?.errors;
      toast.error(errs?.join(". ") || "Error al publicar.");
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeExam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam", id] });
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Evaluación cerrada");
    },
    onError: () => toast.error("Error al cerrar la evaluación."),
  });

  // Compute tab metadata
  const activeStations = stations.filter((s) => s.is_active);
  const weightSum = activeStations.reduce(
    (sum, s) => sum + (parseFloat(s.weight_percent) || 0),
    0,
  );
  const assignedStationIds = new Set(assignments.map((a) => a.station));
  const hasUnassignedStations = activeStations.some(
    (s) => !assignedStationIds.has(s.id),
  );
  const hasWeightIssue =
    stations.length > 0 && Math.abs(weightSum - 100) >= 0.01;
  const hasMissingRubrics = activeStations.some(
    (s) => s.rubric_items_count === 0,
  );

  const isDraft = exam?.status === "DRAFT";

  const tabsWithMeta = [
    {
      id: "stations",
      label: "Estaciones",
      count: stations.length,
      warning: isDraft && (hasWeightIssue || hasMissingRubrics),
    },
    {
      id: "students",
      label: "Estudiantes",
      count: students.length,
      warning: isDraft && students.length === 0,
    },
    {
      id: "assignments",
      label: "Asignaciones",
      count: assignments.length,
      warning: isDraft && hasUnassignedStations,
    },
    {
      id: "results",
      label: "Resultados",
      count: null,
      warning: false,
    },
    {
      id: "audit",
      label: "Auditoría",
      count: null,
      warning: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Evaluación no encontrada.</p>
        <Link
          to="/admin/exams"
          className="text-brand-teal hover:underline mt-2 block"
        >
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Evaluaciones", to: "/admin/exams" },
          { label: exam.name },
        ]}
      />

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1>{exam.name}</h1>
              <ExamStatusBadge status={exam.status} />
            </div>
            {exam.description && (
              <p className="text-gray-500 mt-1 text-sm">{exam.description}</p>
            )}
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span className="font-medium">
                {EXAM_TYPE_LABELS[exam.exam_type] || exam.exam_type}
              </span>
              {exam.start_date && <span>Fecha: {exam.start_date}</span>}
              <span>{exam.stations_count} estaciones</span>
              <span>{exam.students_count} estudiantes</span>
            </div>
          </div>
          <div className="flex gap-2">
            {exam.status === "DRAFT" && (
              <Button
                onClick={() => setPublishConfirm(true)}
                loading={publishMutation.isPending}
              >
                Publicar
              </Button>
            )}
            {exam.status === "PUBLISHED" && (
              <Button
                variant="danger"
                onClick={() => setCloseConfirm(true)}
                loading={closeMutation.isPending}
              >
                Cerrar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Setup checklist (DRAFT only) */}
      {exam.status === "DRAFT" && (
        <ExamSetupChecklist examId={id} onNavigateTab={setActiveTab} />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {tabsWithMeta.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? "border-brand-teal text-brand-teal"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1.5 text-xs text-gray-400">
                  ({tab.count})
                </span>
              )}
              {tab.warning && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-amber-400 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "stations" && <StationsTab exam={exam} />}
        {activeTab === "students" && <StudentsTab exam={exam} />}
        {activeTab === "assignments" && <AssignmentsTab exam={exam} />}
        {activeTab === "results" && <ResultsTab exam={exam} />}
        {activeTab === "audit" && <AuditTab examId={id} />}
      </div>

      <ConfirmDialog
        isOpen={publishConfirm}
        onConfirm={() => {
          setPublishConfirm(false);
          publishMutation.mutate();
        }}
        onCancel={() => setPublishConfirm(false)}
        title="Publicar Evaluación"
        message="¿Publicar esta evaluación? Los evaluadores podrán comenzar a evaluar."
        confirmLabel="Publicar"
      />
      <ConfirmDialog
        isOpen={closeConfirm}
        onConfirm={() => {
          setCloseConfirm(false);
          closeMutation.mutate();
        }}
        onCancel={() => setCloseConfirm(false)}
        title="Cerrar Evaluación"
        message="¿Cerrar esta evaluación? Solo el coordinador podrá exportar resultados."
        confirmLabel="Cerrar"
        confirmVariant="danger"
      />
    </div>
  );
}
