import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getExams } from "../../api/exams";
import { getStations } from "../../api/stations";
import { getStationEvaluations } from "../../api/evaluations";
import { getExamStudents } from "../../api/students";
import { useAuth } from "../../context/AuthContext";
import { ExamStatusBadge } from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import EmptyState, { ClipboardIcon } from "../../components/ui/EmptyState";
import type { Exam, Station, Evaluation } from "../../types";

export default function MyStationsPage() {
  const { user } = useAuth();

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: () => getExams(),
  });

  const publishedExams = exams.filter(
    (e) => e.status === "PUBLISHED" || e.status === "CLOSED",
  );

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div>
      <div className="mb-6">
        <h1>Mis Estaciones</h1>
        <p className="text-gray-500 text-sm mt-1">
          Hola, {user?.first_name}. Selecciona una estación para evaluar estudiantes.
        </p>
      </div>

      {publishedExams.length === 0 ? (
        <EmptyState
          icon={ClipboardIcon}
          title="No tienes evaluaciones asignadas"
          description="Contacta al coordinador para que te asigne estaciones"
        />
      ) : (
        <div className="space-y-6">
          {publishedExams.map((exam) => (
            <ExamStationsSection key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamStationsSection({ exam }: { exam: Exam }) {
  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["stations", exam.id],
    queryFn: () => getStations(exam.id),
  });

  const { data: examStudents = [] } = useQuery({
    queryKey: ["exam-students", exam.id],
    queryFn: () => getExamStudents(exam.id),
  });

  const activeStations = stations.filter((s) => s.is_active);
  const totalStudents = examStudents.length;

  if (stationsLoading) return <Spinner />;

  if (activeStations.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2>{exam.name}</h2>
        <ExamStatusBadge status={exam.status} />
        <span className="text-sm text-gray-400">{totalStudents} estudiantes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeStations.map((station) => (
          <StationCard
            key={station.id}
            exam={exam}
            station={station}
            totalStudents={totalStudents}
          />
        ))}
      </div>
    </div>
  );
}

function StationCard({
  exam,
  station,
  totalStudents,
}: {
  exam: Exam;
  station: Station;
  totalStudents: number;
}) {
  const { data: evaluations = [] } = useQuery({
    queryKey: ["station-evaluations", station.id],
    queryFn: () => getStationEvaluations(station.id),
  });

  const drafts = evaluations.filter((e: Evaluation) => e.status === "DRAFT").length;
  const finals = evaluations.filter((e: Evaluation) => e.status === "FINAL").length;
  const pending = totalStudents - drafts - finals;
  const progressPercent =
    totalStudents > 0 ? ((drafts + finals) / totalStudents) * 100 : 0;
  const allDone = totalStudents > 0 && finals === totalStudents;

  return (
    <Link
      to={`/evaluador/exams/${exam.id}/stations/${station.id}/evaluaciones`}
      className={`block bg-white rounded-xl border p-5 hover:shadow-md transition-all group ${
        allDone
          ? "border-green-200 bg-green-50/30"
          : "border-gray-200 hover:border-brand-teal/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 bg-brand-teal-light rounded-lg flex items-center justify-center text-brand-teal font-bold text-lg group-hover:bg-brand-teal/20 transition-colors">
          {station.order}
        </div>
        {allDone ? (
          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            Completada
          </span>
        ) : drafts > 0 ? (
          <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
            En progreso
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-gray-900">{station.name}</h3>
      {station.educator_name && (
        <p className="text-gray-500 text-xs mt-0.5">
          {station.educator_name}
        </p>
      )}

      {/* Progress bar */}
      {totalStudents > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  allDone ? "bg-green-500" : "bg-brand-teal"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 tabular-nums">
              {finals}/{totalStudents}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
            {finals > 0 && <span className="text-green-600">{finals} finalizadas</span>}
            {finals > 0 && (drafts > 0 || pending > 0) && <span>·</span>}
            {drafts > 0 && <span className="text-yellow-600">{drafts} en progreso</span>}
            {drafts > 0 && pending > 0 && <span>·</span>}
            {pending > 0 && <span>{pending} pendientes</span>}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-3 flex items-center text-brand-teal text-sm font-medium group-hover:gap-2 transition-all">
        <span>{allDone ? "Ver evaluaciones" : "Evaluar"}</span>
        <svg
          className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform"
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
      </div>
    </Link>
  );
}
