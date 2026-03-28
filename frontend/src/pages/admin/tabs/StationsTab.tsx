import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  getStations,
  createStation,
  updateStation,
  toggleStation,
} from "../../../api/stations";
import type { Exam, Station } from "../../../types";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import Spinner from "../../../components/ui/Spinner";
import Badge from "../../../components/ui/Badge";
import EmptyState, { ClipboardIcon } from "../../../components/ui/EmptyState";
import { useToast } from "../../../context/ToastContext";

interface Props {
  exam: Exam;
}

export default function StationsTab({ exam }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [_editStation, setEditStation] = useState<Station | null>(null);

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["stations", exam.id],
    queryFn: () => getStations(exam.id),
  });

  const createMutation = useMutation({
    mutationFn: (d: {
      name: string;
      educator_name?: string;
      weight_percent: string;
      order: number;
    }) => createStation(exam.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stations", exam.id] });
      setCreateOpen(false);
      toast.success("Estación creada");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { name?: string[]; detail?: string } } })
          ?.response?.data?.name?.[0] || "Error al crear estación.",
      ),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Station> }) =>
      updateStation(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stations", exam.id] });
      setEditStation(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleStation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stations", exam.id] }),
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
          <h2>Estaciones</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cada estación representa un punto de evaluación. La suma de ponderaciones activas debe ser 100%.
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Ponderación total activa:{" "}
            <span className="font-medium">
              {stations
                .filter((s) => s.is_active)
                .reduce((sum, s) => sum + parseFloat(s.weight_percent), 0)
                .toFixed(2)}
              %
            </span>{" "}
            (debe ser 100% para publicar)
          </p>
        </div>
        {!isClosed && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            + Agregar estación
          </Button>
        )}
      </div>

      {stations.length === 0 ? (
        <EmptyState
          icon={ClipboardIcon}
          title="No hay estaciones"
          description="Agrega la primera estación de evaluación"
          action={!isClosed ? { label: "+ Agregar estación", onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Ord.</th>
                <th className="px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Educador
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Ponderación
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Ítems
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr
                  key={station.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-500">{station.order}</td>
                  <td className="px-4 py-3 font-medium">{station.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {station.educator_name || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {!isClosed ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={station.weight_percent}
                          className="w-20 input py-1 text-center"
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== station.weight_percent) {
                              updateMutation.mutate({
                                id: station.id,
                                data: { weight_percent: val },
                              });
                            }
                          }}
                        />
                        <span className="text-gray-400">%</span>
                      </span>
                    ) : (
                      <span>{station.weight_percent}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {station.is_active ? (
                      <Badge variant="green">Activa</Badge>
                    ) : (
                      <Badge variant="gray">Inactiva</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">
                    {station.rubric_items_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link
                        to={`/admin/exams/${exam.id}/stations/${station.id}`}
                      >
                        <Button variant="secondary" size="sm">
                          Pauta
                        </Button>
                      </Link>
                      {!isClosed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMutation.mutate(station.id)}
                          loading={toggleMutation.isPending}
                        >
                          {station.is_active ? "Desactivar" : "Activar"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva Estación"
      >
        <StationForm
          onSubmit={(d) => {
            createMutation.mutate({
              ...d,
              order: stations.length + 1,
            });
          }}
          loading={createMutation.isPending}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}

function StationForm({
  onSubmit,
  loading,
  onCancel,
  defaultValues,
}: {
  onSubmit: (d: {
    name: string;
    educator_name?: string;
    weight_percent: string;
  }) => void;
  loading: boolean;
  onCancel: () => void;
  defaultValues?: Partial<{
    name: string;
    educator_name: string;
    weight_percent: string;
  }>;
}) {
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <form
      onSubmit={handleSubmit((d) =>
        onSubmit({
          name: d.name as string,
          educator_name: d.educator_name as string | undefined,
          weight_percent: (d.weight_percent as string) || "0",
        }),
      )}
      className="space-y-4"
    >
      <Input
        label="Nombre de la estación"
        {...register("name", { required: true })}
      />
      <Input
        label="Nombre del educador (opcional)"
        {...register("educator_name")}
      />
      <Input
        label="Ponderación (%)"
        type="number"
        min="0"
        max="100"
        step="0.01"
        {...register("weight_percent")}
        helpText="Porcentaje que representa esta estación en la nota final"
      />
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Guardar
        </Button>
      </div>
    </form>
  );
}
