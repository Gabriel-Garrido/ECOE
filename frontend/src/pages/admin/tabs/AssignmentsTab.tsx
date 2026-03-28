import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAssignments,
  createAssignment,
  deleteAssignment,
} from "../../../api/assignments";
import { getStations } from "../../../api/stations";
import { getUsers } from "../../../api/users";
import type { Exam } from "../../../types";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import EmptyState, { LinkIcon } from "../../../components/ui/EmptyState";
import { useToast } from "../../../context/ToastContext";

interface Props {
  exam: Exam;
}

export default function AssignmentsTab({ exam }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ station: "", evaluator: "" });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments", exam.id],
    queryFn: () => getAssignments(exam.id),
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["stations", exam.id],
    queryFn: () => getStations(exam.id),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const evaluators = users.filter((u) => u.role === "EVALUATOR" && u.is_active);

  const createMutation = useMutation({
    mutationFn: () =>
      createAssignment(exam.id, {
        station: Number(form.station),
        evaluator: Number(form.evaluator),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", exam.id] });
      setAddOpen(false);
      setForm({ station: "", evaluator: "" });
      toast.success("Evaluador asignado");
    },
    onError: (e: unknown) =>
      toast.error(
        (
          e as {
            response?: {
              data?: { detail?: string; non_field_errors?: string[] };
            };
          }
        )?.response?.data?.non_field_errors?.[0] ||
          (e as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ||
          "Error al crear asignación.",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["assignments", exam.id] }),
  });

  const isClosed = exam.status === "CLOSED";

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2>Asignaciones de Evaluadores</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cada estación activa necesita al menos un evaluador asignado
          </p>
        </div>
        {!isClosed && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            + Asignar evaluador
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No hay asignaciones"
          description="Asigna evaluadores a las estaciones para que puedan evaluar"
          action={!isClosed ? { label: "+ Asignar evaluador", onClick: () => setAddOpen(true) } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">
                  Estación
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Evaluador
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Correo
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium">{a.station_name}</td>
                  <td className="px-4 py-3">{a.evaluator_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {a.evaluator_email}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isClosed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("¿Eliminar esta asignación?"))
                            deleteMutation.mutate(a.id);
                        }}
                      >
                        Eliminar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Asignar Evaluador"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Estación</label>
            <select
              className="input"
              value={form.station}
              onChange={(e) =>
                setForm((f) => ({ ...f, station: e.target.value }))
              }
            >
              <option value="">Seleccionar estación...</option>
              {stations
                .filter((s) => s.is_active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Evaluador</label>
            <select
              className="input"
              value={form.evaluator}
              onChange={(e) =>
                setForm((f) => ({ ...f, evaluator: e.target.value }))
              }
            >
              <option value="">Seleccionar evaluador...</option>
              {evaluators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.station || !form.evaluator}
            >
              Asignar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
