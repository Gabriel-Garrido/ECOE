import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getExams, createExam, publishExam, closeExam } from "../../api/exams";
import Button from "../../components/ui/Button";
import { ExamStatusBadge } from "../../components/ui/Badge";
import EmptyState, { ClipboardIcon } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Spinner from "../../components/ui/Spinner";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useToast } from "../../context/ToastContext";

const EXAM_TYPE_LABELS: Record<string, string> = {
  ECOE: "ECOE/OSCE",
  ABP: "ABP",
  SIMULATED: "Escenario Simulado",
  OTHER: "Otro",
};

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  exam_type: z.enum(["ECOE", "ABP", "SIMULATED", "OTHER"]).optional(),
  start_date: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function ExamsListPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "publish" | "close"; examId: number } | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: () => getExams(),
  });

  const createMutation = useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      setCreateOpen(false);
      reset();
      toast.success("Evaluación creada exitosamente");
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al crear la evaluación.",
      );
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishExam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Evaluación publicada");
    },
    onError: (e: unknown) => {
      toast.error(
        (
          e as { response?: { data?: { errors?: string[]; detail?: string } } }
        )?.response?.data?.errors?.join(". ") ||
          (e as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ||
          "Error al publicar.",
      );
    },
  });

  const closeMutation = useMutation({
    mutationFn: closeExam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Evaluación cerrada");
    },
    onError: () => toast.error("Error al cerrar la evaluación."),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = (data: FormData) => {
    setError("");
    createMutation.mutate({
      name: data.name,
      description: data.description || "",
      exam_type: data.exam_type || "ECOE",
      start_date: data.start_date || null,
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Evaluaciones</h1>
          <p className="text-gray-500 text-sm mt-1">
            Crea y gestiona evaluaciones clínicas. Cada evaluación tiene estaciones, estudiantes y evaluadores.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Nueva evaluación</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={ClipboardIcon}
          title="No hay evaluaciones creadas aún"
          description="Crea tu primera evaluación clínica para comenzar"
          action={{ label: "Crear primera evaluación", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-600">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Tipo
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Fecha
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Estaciones
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Estudiantes
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr
                  key={exam.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/exams/${exam.id}`}
                      className="font-medium text-brand-teal hover:text-brand-teal-dark hover:underline"
                    >
                      {exam.name}
                    </Link>
                    {exam.description && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate max-w-xs">
                        {exam.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600 text-xs">
                    {EXAM_TYPE_LABELS[exam.exam_type] || exam.exam_type}
                  </td>
                  <td className="px-4 py-4">
                    <ExamStatusBadge status={exam.status} />
                  </td>
                  <td className="px-4 py-4 text-gray-500 hidden md:table-cell">
                    {exam.start_date || "-"}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 hidden md:table-cell">
                    {exam.stations_count}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 hidden md:table-cell">
                    {exam.students_count}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        to={`/admin/exams/${exam.id}`}
                        className="inline-flex items-center justify-center font-medium rounded-lg transition-colors px-3 py-1.5 text-sm bg-white hover:bg-gray-50 text-neutral-gray-dark border border-gray-300"
                      >
                        Ver
                      </Link>
                      {exam.status === "DRAFT" && (
                        <Button
                          size="sm"
                          loading={publishMutation.isPending}
                          onClick={() => setConfirmAction({ type: "publish", examId: exam.id })}
                        >
                          Publicar
                        </Button>
                      )}
                      {exam.status === "PUBLISHED" && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirmAction({ type: "close", examId: exam.id })}
                        >
                          Cerrar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva Evaluación"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-gray-500">
            Después de crear la evaluación, podrás agregar estaciones, cargar pautas, inscribir estudiantes y asignar evaluadores.
          </p>
          <Input
            label="Nombre"
            error={errors.name?.message}
            {...register("name")}
          />
          <div>
            <label className="label">Tipo de evaluación</label>
            <select className="input" {...register("exam_type")}>
              <option value="ECOE">ECOE/OSCE</option>
              <option value="ABP">ABP</option>
              <option value="SIMULATED">Escenario Simulado</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Descripción de la evaluación..."
              {...register("description")}
            />
          </div>
          <Input
            label="Fecha de inicio (opcional)"
            type="date"
            {...register("start_date")}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={isSubmitting || createMutation.isPending}
            >
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmAction?.type === "publish"}
        onConfirm={() => {
          if (confirmAction) publishMutation.mutate(confirmAction.examId);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
        title="Publicar Evaluación"
        message="¿Publicar esta evaluación? Los evaluadores podrán comenzar a evaluar."
        confirmLabel="Publicar"
      />
      <ConfirmDialog
        isOpen={confirmAction?.type === "close"}
        onConfirm={() => {
          if (confirmAction) closeMutation.mutate(confirmAction.examId);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
        title="Cerrar Evaluación"
        message="¿Cerrar esta evaluación? Esta acción es irreversible."
        confirmLabel="Cerrar"
        confirmVariant="danger"
      />
    </div>
  );
}
