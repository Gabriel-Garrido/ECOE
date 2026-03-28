import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getExamStudents } from "../../api/students";
import {
  getStationEvaluations,
  getOrCreateDraftEvaluation,
} from "../../api/evaluations";
import { getStations } from "../../api/stations";
import { getExam } from "../../api/exams";
import { EvalStatusBadge } from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import Breadcrumb from "../../components/ui/Breadcrumb";
import { useToast } from "../../context/ToastContext";

export default function EvaluationsListPage() {
  const { examId, stationId } = useParams<{
    examId: string;
    stationId: string;
  }>();
  const examIdNum = Number(examId);
  const stationIdNum = Number(stationId);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: exam } = useQuery({
    queryKey: ["exam", examIdNum],
    queryFn: () => getExam(examIdNum),
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["stations", examIdNum],
    queryFn: () => getStations(examIdNum),
  });
  const station = stations.find((s) => s.id === stationIdNum);

  const { data: examStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["exam-students", examIdNum],
    queryFn: () => getExamStudents(examIdNum),
    enabled: !!examIdNum,
  });

  const { data: evaluations = [], isLoading: evalsLoading } = useQuery({
    queryKey: ["station-evaluations", stationIdNum],
    queryFn: () => getStationEvaluations(stationIdNum),
    enabled: !!stationIdNum,
    refetchInterval: 15_000,
  });

  const evalByStudent = Object.fromEntries(
    evaluations.map((e) => [e.student, e]),
  );

  const startEvalMutation = useMutation({
    mutationFn: (studentId: number) =>
      getOrCreateDraftEvaluation(stationIdNum, studentId),
    onSuccess: (evaluation) => {
      navigate(`/evaluador/evaluaciones/${evaluation.id}`);
    },
    onError: () => toast.error("Error al iniciar la evaluación."),
  });

  const isLoading = studentsLoading || evalsLoading;

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Mis Estaciones", to: "/evaluador/mis-estaciones" },
          { label: station?.name || "Estación" },
        ]}
      />

      <div className="mb-6">
        <h1>{station?.name || "Estación"}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {exam?.name} · {examStudents.length} estudiantes
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Presiona "Evaluar" para iniciar o "Continuar" para retomar. Las evaluaciones finalizadas no se pueden editar.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Sin iniciar",
            count: examStudents.filter((es) => !evalByStudent[es.student.id])
              .length,
            color: "bg-gray-100 text-gray-700",
          },
          {
            label: "En progreso",
            count: evaluations.filter((e) => e.status === "DRAFT").length,
            color: "bg-yellow-100 text-yellow-800",
          },
          {
            label: "Finalizadas",
            count: evaluations.filter((e) => e.status === "FINAL").length,
            color: "bg-green-100 text-green-800",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl p-4 text-center ${stat.color}`}
          >
            <div className="text-2xl font-bold">{stat.count}</div>
            <div className="text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Students list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">
                Estudiante
              </th>
              <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
                RUT
              </th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                Nota
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {examStudents.map((es) => {
              const evaluation = evalByStudent[es.student.id];
              const status = evaluation?.status;
              return (
                <tr
                  key={es.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium">
                    {es.student.full_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500 hidden sm:table-cell">
                    {es.student.rut}
                  </td>
                  <td className="px-4 py-3">
                    {status ? (
                      <EvalStatusBadge status={status} />
                    ) : (
                      <span className="text-xs text-gray-400">Sin iniciar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    {evaluation?.grade_display || (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {evaluation ? (
                      <Link to={`/evaluador/evaluaciones/${evaluation.id}`}>
                        <Button variant="secondary" size="sm">
                          {status === "FINAL" ? "Ver" : "Continuar"}
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        loading={startEvalMutation.isPending}
                        onClick={() => startEvalMutation.mutate(es.student.id)}
                      >
                        Evaluar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
