import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRubricItems,
  createRubricItem,
  deleteRubricItem,
  getGradeScale,
  updateGradeScale,
  generateGradeScale,
  importRubricXlsx,
  getStationVariants,
  createStationVariant,
  deleteStationVariant,
} from "../../api/stations";
import { getStations } from "../../api/stations";
import { getExam } from "../../api/exams";
import type { GradeScalePoint, ImportXlsxResult, StationVariant } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import Breadcrumb from "../../components/ui/Breadcrumb";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../context/ToastContext";

/** Normalize decimal input: replace comma with dot for consistent parsing */
function normalizeDecimal(value: string): string {
  return value.replace(",", ".");
}

export default function StationDetailPage() {
  const { examId, stationId } = useParams<{
    examId: string;
    stationId: string;
  }>();
  const examIdNum = Number(examId);
  const stationIdNum = Number(stationId);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [scaleRows, setScaleRows] = useState<GradeScalePoint[]>([]);
  const [scaleDirty, setScaleDirty] = useState(false);
  const [scaleSaveStatus, setScaleSaveStatus] = useState<
    "idle" | "saved" | "error"
  >("idle");
  const [newItemForm, setNewItemForm] = useState({
    description: "",
    max_points: "",
  });
  const [genParams, setGenParams] = useState({
    min_raw: "0",
    max_raw: "",
    min_grade: "1.0",
    max_grade: "7.0",
    step_raw: "1",
  });
  const [importResult, setImportResult] = useState<ImportXlsxResult | null>(
    null,
  );
  const [variantOpen, setVariantOpen] = useState(false);
  const [variantForm, setVariantForm] = useState({ name: "", description: "" });
  const rubricFileRef = useRef<HTMLInputElement>(null);
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: stations = [] } = useQuery({
    queryKey: ["stations", examIdNum],
    queryFn: () => getStations(examIdNum),
  });
  const station = stations.find((s) => s.id === stationIdNum);

  const { data: exam } = useQuery({
    queryKey: ["exam", examIdNum],
    queryFn: () => getExam(examIdNum),
    enabled: !!examIdNum,
  });

  const { data: rubricItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["rubric-items", stationIdNum],
    queryFn: () => getRubricItems(stationIdNum),
    enabled: !!stationIdNum,
  });

  const { data: gradeScale = [], isLoading: scaleLoading } = useQuery({
    queryKey: ["grade-scale", stationIdNum],
    queryFn: () => getGradeScale(stationIdNum),
    enabled: !!stationIdNum,
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["station-variants", stationIdNum],
    queryFn: () => getStationVariants(stationIdNum),
    enabled: !!stationIdNum,
  });

  // Sync server data to local state only when user has not made local edits
  useEffect(() => {
    if (gradeScale.length && !scaleDirty) {
      setScaleRows(gradeScale);
    }
  }, [gradeScale, scaleDirty]);

  const addItemMutation = useMutation({
    mutationFn: () =>
      createRubricItem(stationIdNum, {
        description: newItemForm.description,
        max_points: newItemForm.max_points,
        order: rubricItems.length + 1,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rubric-items", stationIdNum] });
      qc.invalidateQueries({ queryKey: ["stations", examIdNum] });
      setAddItemOpen(false);
      setNewItemForm({ description: "", max_points: "" });
      toast.success("Ítem agregado");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al agregar ítem.",
      ),
  });

  const deleteItemMutation = useMutation({
    mutationFn: deleteRubricItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rubric-items", stationIdNum] });
      qc.invalidateQueries({ queryKey: ["stations", examIdNum] });
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "No se puede eliminar: hay evaluaciones con este ítem.",
      ),
  });

  const importRubricMutation = useMutation({
    mutationFn: (file: File) => importRubricXlsx(stationIdNum, file),
    onSuccess: (result: ImportXlsxResult) => {
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["rubric-items", stationIdNum] });
      qc.invalidateQueries({ queryKey: ["stations", examIdNum] });
      toast.success("Pauta importada");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al importar pauta.",
      ),
  });

  const _showSaveStatus = (status: "saved" | "error", durationMs = 3000) => {
    setScaleSaveStatus(status);
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    saveStatusTimer.current = setTimeout(
      () => setScaleSaveStatus("idle"),
      durationMs,
    );
  };

  const saveScaleMutation = useMutation({
    mutationFn: (rows: GradeScalePoint[]) =>
      updateGradeScale(
        stationIdNum,
        rows.map((r) => ({ raw_points: r.raw_points, grade: r.grade })),
      ),
    onSuccess: (data) => {
      // Update local state with server response and mark clean
      setScaleRows(data);
      setScaleDirty(false);
      // Update query cache directly to avoid re-fetch overwriting local state
      qc.setQueryData(["grade-scale", stationIdNum], data);
      qc.invalidateQueries({ queryKey: ["stations", examIdNum] });
      _showSaveStatus("saved");
      toast.success("Escala guardada exitosamente");
    },
    onError: () => {
      _showSaveStatus("error", 4000);
      toast.error("Error al guardar la escala. Revisa los valores ingresados.");
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateGradeScale(stationIdNum, {
        min_raw: genParams.min_raw,
        max_raw:
          genParams.max_raw ||
          String(rubricItems.reduce((s, i) => s + parseFloat(i.max_points), 0)),
        min_grade: genParams.min_grade,
        max_grade: genParams.max_grade,
        step_raw: genParams.step_raw,
      }),
    onSuccess: (data: GradeScalePoint[]) => {
      qc.setQueryData(["grade-scale", stationIdNum], data);
      setScaleRows(data);
      setScaleDirty(false);
      setGenerateOpen(false);
      qc.invalidateQueries({ queryKey: ["stations", examIdNum] });
      _showSaveStatus("saved");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al generar escala.",
      ),
  });

  const addVariantMutation = useMutation({
    mutationFn: () =>
      createStationVariant(stationIdNum, {
        name: variantForm.name,
        description: variantForm.description,
        order: variants.length + 1,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["station-variants", stationIdNum] });
      setVariantOpen(false);
      setVariantForm({ name: "", description: "" });
      toast.success("Variante creada");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al crear variante.",
      ),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: deleteStationVariant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["station-variants", stationIdNum] });
      toast.success("Variante eliminada");
    },
    onError: () => toast.error("Error al eliminar variante."),
  });

  const maxPointsTotal = rubricItems.reduce(
    (s, i) => s + parseFloat(i.max_points),
    0,
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Evaluaciones", to: "/admin/exams" },
          { label: exam?.name || "Evaluación", to: `/admin/exams/${examId}` },
          { label: station?.name || "Estación" },
        ]}
      />

      <h1 className="mb-1">{station?.name} – Pauta y Escala de Notas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configura los ítems de evaluación, la escala de notas y las variantes de esta estación.
      </p>

      {/* Section: Rubric Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2>Pauta de Evaluación</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Puntaje máximo total: <strong>{maxPointsTotal.toFixed(2)}</strong>{" "}
              pts
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={rubricFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importRubricMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => rubricFileRef.current?.click()}
              loading={importRubricMutation.isPending}
            >
              Importar XLSX
            </Button>
            <Button size="sm" onClick={() => setAddItemOpen(true)}>
              + Agregar ítem
            </Button>
          </div>
        </div>

        {importResult && (
          <div className="mb-4 p-3 rounded-lg bg-brand-teal-light border border-brand-teal/20 text-sm">
            <div className="flex items-center justify-between">
              <p>
                Importación: <strong>{importResult.created}</strong> creados,{" "}
                <strong>{importResult.updated}</strong> actualizados
                {importResult.errors.length > 0 && (
                  <span className="text-red-600 ml-2">
                    ({importResult.errors.length} errores)
                  </span>
                )}
              </p>
              <button
                onClick={() => setImportResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 text-red-600 text-xs space-y-0.5">
                {importResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500">
          <strong className="text-gray-700">Importar desde Excel:</strong> El archivo debe tener columnas <code className="bg-white px-1 rounded">descripcion</code> y <code className="bg-white px-1 rounded">puntaje</code>. Opcionalmente puede incluir <code className="bg-white px-1 rounded">orden</code>. Los ítems se agregarán a los existentes.
        </div>

        {itemsLoading ? (
          <Spinner />
        ) : rubricItems.length === 0 ? (
          <EmptyState
            title="No hay ítems de evaluación"
            description="Agrega el primer ítem o importa desde un archivo Excel"
            action={{ label: "+ Agregar ítem", onClick: () => setAddItemOpen(true) }}
          />
        ) : (
          <div className="space-y-2">
            {rubricItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-start gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <span className="text-gray-400 text-sm pt-0.5 w-6 flex-shrink-0">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm">{item.description}</p>
                </div>
                <span className="text-sm font-medium text-gray-600 flex-shrink-0">
                  {item.max_points} pts
                </span>
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar este ítem?"))
                      deleteItemMutation.mutate(item.id);
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Grade Scale */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2>Escala de Notas</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Define la conversión de puntaje bruto a nota (1.0–7.0)
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setGenParams((p) => ({
                  ...p,
                  max_raw: String(maxPointsTotal),
                }));
                setGenerateOpen(true);
              }}
            >
              Generar escala
            </Button>
            {scaleRows.length > 0 && (
              <Button
                size="sm"
                onClick={() => saveScaleMutation.mutate(scaleRows)}
                loading={saveScaleMutation.isPending}
                disabled={!scaleDirty}
              >
                Guardar escala
              </Button>
            )}
            {scaleSaveStatus === "saved" && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Escala guardada
              </span>
            )}
            {scaleSaveStatus === "error" && (
              <span className="text-red-600 text-sm font-medium">
                Error al guardar
              </span>
            )}
          </div>
        </div>

        {scaleLoading ? (
          <Spinner />
        ) : scaleRows.length === 0 ? (
          <EmptyState
            title="No hay escala de notas"
            description="Genera una escala lineal o agrégala manualmente"
            action={{ label: "Generar escala", onClick: () => { setGenParams((p) => ({ ...p, max_raw: String(maxPointsTotal) })); setGenerateOpen(true); } }}
          />
        ) : (
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-3 py-2 font-medium text-gray-600">
                    Puntaje Bruto
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-600">Nota</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {scaleRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-24 input py-1 text-sm"
                        value={row.raw_points}
                        placeholder="0.00"
                        onChange={(e) => {
                          const val = normalizeDecimal(e.target.value);
                          const newRows = [...scaleRows];
                          newRows[idx] = { ...row, raw_points: val };
                          setScaleRows(newRows);
                          setScaleDirty(true);
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-20 input py-1 text-sm"
                        value={row.grade}
                        placeholder="1.0 – 7.0"
                        onChange={(e) => {
                          const val = normalizeDecimal(e.target.value);
                          const newRows = [...scaleRows];
                          newRows[idx] = { ...row, grade: val };
                          setScaleRows(newRows);
                          setScaleDirty(true);
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => {
                          setScaleRows((r) => r.filter((_, i) => i !== idx));
                          setScaleDirty(true);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {scaleRows.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              setScaleRows((r) => [...r, { id: 0, raw_points: "", grade: "" }]);
              setScaleDirty(true);
            }}
          >
            + Agregar fila
          </Button>
        )}
      </div>

      {/* Add item modal */}
      <Modal
        isOpen={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        title="Agregar Ítem"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Descripción del ítem</label>
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Describe lo que el alumno debe demostrar..."
              value={newItemForm.description}
              onChange={(e) =>
                setNewItemForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <Input
            label="Puntaje máximo"
            type="number"
            min="0.01"
            step="0.01"
            value={newItemForm.max_points}
            onChange={(e) =>
              setNewItemForm((f) => ({ ...f, max_points: e.target.value }))
            }
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setAddItemOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addItemMutation.mutate()}
              loading={addItemMutation.isPending}
              disabled={!newItemForm.description || !newItemForm.max_points}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generate scale modal */}
      <Modal
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generar Escala Lineal"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Puntaje mínimo (raw)"
              type="number"
              value={genParams.min_raw}
              onChange={(e) =>
                setGenParams((p) => ({ ...p, min_raw: e.target.value }))
              }
            />
            <Input
              label="Puntaje máximo (raw)"
              type="number"
              value={genParams.max_raw}
              onChange={(e) =>
                setGenParams((p) => ({ ...p, max_raw: e.target.value }))
              }
              helpText={`Total pauta: ${maxPointsTotal.toFixed(2)}`}
            />
            <Input
              label="Nota mínima"
              type="number"
              min="1"
              max="7"
              step="0.1"
              value={genParams.min_grade}
              onChange={(e) =>
                setGenParams((p) => ({ ...p, min_grade: e.target.value }))
              }
            />
            <Input
              label="Nota máxima"
              type="number"
              min="1"
              max="7"
              step="0.1"
              value={genParams.max_grade}
              onChange={(e) =>
                setGenParams((p) => ({ ...p, max_grade: e.target.value }))
              }
            />
            <Input
              label="Paso (raw)"
              type="number"
              min="0.1"
              step="0.1"
              value={genParams.step_raw}
              onChange={(e) =>
                setGenParams((p) => ({ ...p, step_raw: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setGenerateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
            >
              Generar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Section: Station Variants */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2>Variantes de la Estación</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Crea versiones alternativas del caso clínico para evitar que los estudiantes memoricen las preguntas.
            </p>
          </div>
          <Button size="sm" onClick={() => setVariantOpen(true)}>
            + Agregar variante
          </Button>
        </div>

        {variants.length === 0 ? (
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-500 text-center">
            <p className="mb-1">No hay variantes configuradas.</p>
            <p className="text-xs">Si siempre usas el mismo caso clínico, no necesitas variantes. Agrégalas solo si quieres rotar el contenido entre estudiantes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {variants.map((v, idx) => (
              <div
                key={v.id}
                className="flex items-start gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <span className="text-gray-400 text-sm pt-0.5 w-6 flex-shrink-0">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{v.name}</p>
                  {v.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{v.description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar esta variante?"))
                      deleteVariantMutation.mutate(v.id);
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add variant modal */}
      <Modal
        isOpen={variantOpen}
        onClose={() => setVariantOpen(false)}
        title="Agregar Variante"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Cada variante representa una versión alternativa del caso clínico. Los estudiantes pueden recibir variantes distintas para evitar que se pasen las respuestas.
          </p>
          <Input
            label="Nombre de la variante"
            placeholder='Ej: "Caso A", "Variante 2"'
            value={variantForm.name}
            onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div>
            <label className="label">Descripción del caso (opcional)</label>
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Describe el escenario clínico de esta variante..."
              value={variantForm.description}
              onChange={(e) => setVariantForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setVariantOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addVariantMutation.mutate()}
              loading={addVariantMutation.isPending}
              disabled={!variantForm.name}
            >
              Crear variante
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
