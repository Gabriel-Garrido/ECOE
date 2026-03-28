import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getStations } from "../api/stations";
import { getExamStudents } from "../api/students";
import { getAssignments } from "../api/assignments";

interface Props {
  examId: number;
  onNavigateTab: (tabId: string) => void;
}

interface ChecklistStep {
  id: string;
  label: string;
  completed: boolean;
  tabId: string;
}

export default function ExamSetupChecklist({ examId, onNavigateTab }: Props) {
  const { data: stations = [] } = useQuery({
    queryKey: ["stations", examId],
    queryFn: () => getStations(examId),
    enabled: !!examId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["exam-students", examId],
    queryFn: () => getExamStudents(examId),
    enabled: !!examId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", examId],
    queryFn: () => getAssignments(examId),
    enabled: !!examId,
  });

  const activeStations = stations.filter((s) => s.is_active);
  const weightSum = activeStations.reduce(
    (sum, s) => sum + (parseFloat(s.weight_percent) || 0),
    0,
  );
  const assignedStationIds = new Set(assignments.map((a) => a.station));

  const steps: ChecklistStep[] = [
    {
      id: "stations",
      label: `Crear estaciones (${stations.length} creadas)`,
      completed: stations.length > 0,
      tabId: "stations",
    },
    {
      id: "rubrics",
      label: "Configurar pautas en todas las estaciones",
      completed:
        activeStations.length > 0 &&
        activeStations.every((s) => s.rubric_items_count > 0),
      tabId: "stations",
    },
    {
      id: "scales",
      label: "Configurar escalas de notas",
      completed:
        activeStations.length > 0 &&
        activeStations.every((s) => s.grade_scale_count > 0),
      tabId: "stations",
    },
    {
      id: "students",
      label: `Inscribir estudiantes (${students.length} inscritos)`,
      completed: students.length > 0,
      tabId: "students",
    },
    {
      id: "assignments",
      label: "Asignar evaluadores a estaciones activas",
      completed:
        activeStations.length > 0 &&
        activeStations.every((s) => assignedStationIds.has(s.id)),
      tabId: "assignments",
    },
    {
      id: "weights",
      label: `Ponderaciones suman 100% (actualmente ${weightSum.toFixed(2)}%)`,
      completed: Math.abs(weightSum - 100) < 0.01,
      tabId: "stations",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  return (
    <div className="bg-gradient-to-r from-brand-teal-light to-brand-yellow-light rounded-xl border border-brand-teal/20 p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-dark">
            Preparación para publicar
          </h3>
          <p className="text-xs text-brand-teal mt-0.5">
            Completa todos los pasos para poder publicar la evaluación
          </p>
        </div>
        <span className="text-sm font-medium text-brand-teal">
          {completedCount}/{steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-brand-teal/20 rounded-full h-1.5 mb-4">
        <div
          className="bg-brand-teal h-1.5 rounded-full transition-all"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => onNavigateTab(step.tabId)}
            className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg hover:bg-white/50 transition-colors group"
          >
            {step.completed ? (
              <svg
                className="h-5 w-5 text-green-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
            )}
            <span
              className={`text-sm ${
                step.completed
                  ? "text-gray-500 line-through"
                  : "text-gray-800"
              }`}
            >
              {step.label}
            </span>
            {!step.completed && (
              <svg
                className="h-4 w-4 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
