import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getExams } from "../../api/exams";
import { getStations } from "../../api/stations";
import { useAuth } from "../../context/AuthContext";
import { ExamStatusBadge } from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import EmptyState, { ClipboardIcon } from "../../components/ui/EmptyState";
import type { Exam } from "../../types";

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
          Hola, {user?.first_name}. Selecciona una estación para comenzar a evaluar estudiantes.
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
  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["my-stations", exam.id],
    queryFn: () => getStations(exam.id),
  });

  const activeStations = stations.filter((s) => s.is_active);

  if (isLoading) return <Spinner />;

  if (activeStations.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2>{exam.name}</h2>
        <ExamStatusBadge status={exam.status} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeStations.map((station) => (
          <Link
            key={station.id}
            to={`/evaluador/exams/${exam.id}/stations/${station.id}/evaluaciones`}
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-teal/40 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 bg-brand-teal-light rounded-lg flex items-center justify-center text-brand-teal font-bold text-lg group-hover:bg-brand-teal/20 transition-colors">
                {station.order}
              </div>
              <span className="text-brand-teal text-sm font-medium">
                {station.weight_percent}%
              </span>
            </div>
            <h3 className="mt-3 text-gray-900">{station.name}</h3>
            {station.educator_name && (
              <p className="text-gray-500 text-xs mt-1">
                {station.educator_name}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
              <span>{station.rubric_items_count} ítems</span>
              <span>·</span>
              <span>Máx. {station.max_points_total} pts</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
