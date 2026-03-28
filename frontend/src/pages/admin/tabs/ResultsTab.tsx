import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getExamResults } from "../../../api/evaluations";
import { downloadResultsXlsx } from "../../../api/exports";
import type { Exam } from "../../../types";
import { ApprovedBadge } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";
import EmptyState, { ChartIcon } from "../../../components/ui/EmptyState";
import { useToast } from "../../../context/ToastContext";

interface Props {
  exam: Exam;
}

export default function ResultsTab({ exam }: Props) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const {
    data: results,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["exam-results", exam.id],
    queryFn: () => getExamResults(exam.id),
    enabled: exam.status !== "DRAFT",
  });

  const handleDownloadXlsx = async () => {
    setDownloading(true);
    try {
      await downloadResultsXlsx(exam.id, exam.name);
    } catch {
      toast.error("Error al descargar el archivo Excel.");
    } finally {
      setDownloading(false);
    }
  };

  if (exam.status === "DRAFT") {
    return (
      <EmptyState
        icon={ChartIcon}
        title="Resultados no disponibles"
        description="Publica la evaluación para ver resultados"
      />
    );
  }

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  if (!results?.students?.length) {
    return (
      <EmptyState
        icon={ChartIcon}
        title="No hay resultados aún"
        description="Los resultados aparecen a medida que los evaluadores finalizan las evaluaciones"
        action={{ label: "Actualizar", onClick: () => refetch() }}
      />
    );
  }

  const stations = results.stations;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2>Resultados</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {results.students.length} estudiantes · {stations.length} estaciones
            activas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Actualizar
          </Button>
          <Button size="sm" loading={downloading} onClick={handleDownloadXlsx}>
            Exportar XLSX
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm min-w-max">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 sticky left-0 bg-gray-50">
                  RUT
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 sticky left-16 bg-gray-50 min-w-[160px]">
                  Nombre
                </th>
                {stations.map((s) => (
                  <th
                    key={s.id}
                    className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap"
                  >
                    Est. {s.order}: {s.name}
                    <span className="text-gray-400 font-normal ml-1">
                      ({s.weight_percent}%)
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  Nota Final
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {results.students.map((r) => (
                <tr
                  key={r.student.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-gray-600 sticky left-0 bg-white">
                    {r.student.rut}
                  </td>
                  <td className="px-4 py-3 font-medium sticky left-16 bg-white">
                    {r.student.full_name}
                  </td>
                  {stations.map((s) => (
                    <td key={s.id} className="px-4 py-3 text-center">
                      {r.station_grades[String(s.id)] ?? (
                        <span className="text-gray-300">–</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold">
                    {r.final_grade ?? <span className="text-gray-300">–</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ApprovedBadge approved={r.approved} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
