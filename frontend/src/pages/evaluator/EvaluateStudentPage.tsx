import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEvaluation,
  updateEvaluation,
  finalizeEvaluation,
} from "../../api/evaluations";
import { downloadEvaluationPdf } from "../../api/exports";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { EvalStatusBadge, ApprovedBadge } from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import Breadcrumb from "../../components/ui/Breadcrumb";

const DEBOUNCE_MS = 1500;

export default function EvaluateStudentPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const evalId = Number(evaluationId);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [localScores, setLocalScores] = useState<
    Record<number, { points: string; comment: string }>
  >({});
  const [generalComment, setGeneralComment] = useState("");
  const [_isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: evaluation, isLoading } = useQuery({
    queryKey: ["evaluation", evalId],
    queryFn: () => getEvaluation(evalId),
    enabled: !!evalId,
  });

  // Initialize local state from server data
  useEffect(() => {
    if (evaluation) {
      setGeneralComment(evaluation.general_comment || "");
      const scores: Record<number, { points: string; comment: string }> = {};
      for (const score of evaluation.item_scores) {
        scores[score.id] = {
          points: score.points ?? "",
          comment: score.comment || "",
        };
      }
      setLocalScores(scores);
    }
  }, [evaluation]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateEvaluation>[1]) =>
      updateEvaluation(evalId, data),
    onSuccess: (updated) => {
      qc.setQueryData(["evaluation", evalId], updated);
      setSaveStatus("saved");
      setIsDirty(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("idle");
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeEvaluation(evalId),
    onSuccess: (updated) => {
      qc.setQueryData(["evaluation", evalId], updated);
      setFinalizeOpen(false);
      toast.success("Evaluación finalizada exitosamente");
    },
    onError: (e: unknown) => {
      const errs = (
        e as {
          response?: {
            data?: { incomplete_items?: { description: string }[] };
          };
        }
      )?.response?.data?.incomplete_items;
      toast.error(
        errs
          ? `Ítems incompletos: ${errs.map((i) => i.description).join(", ")}`
          : "Error al finalizar.",
      );
    },
  });

  // Auto-save debounced
  const triggerSave = useCallback(
    (
      scores: Record<number, { points: string; comment: string }>,
      comment: string,
    ) => {
      if (!evaluation || evaluation.status === "FINAL") return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSaveStatus("saving");
        const itemScores = Object.entries(scores).map(([id, v]) => ({
          id: Number(id),
          points: v.points === "" ? null : v.points,
          comment: v.comment,
        }));
        updateMutation.mutate({
          item_scores: itemScores,
          general_comment: comment,
        });
      }, DEBOUNCE_MS);
    },
    [evaluation, updateMutation],
  );

  const handleScoreChange = (
    scoreId: number,
    field: "points" | "comment",
    value: string,
  ) => {
    if (evaluation?.status === "FINAL" && user?.role !== "ADMIN") return;
    const updated = {
      ...localScores,
      [scoreId]: { ...localScores[scoreId], [field]: value },
    };
    setLocalScores(updated);
    setIsDirty(true);
    triggerSave(updated, generalComment);
  };

  const handleCommentChange = (value: string) => {
    if (evaluation?.status === "FINAL" && user?.role !== "ADMIN") return;
    setGeneralComment(value);
    setIsDirty(true);
    triggerSave(localScores, value);
  };

  const handlePdfDownload = async () => {
    if (!evaluation) return;
    setPdfLoading(true);
    try {
      await downloadEvaluationPdf(evalId, evaluation.student_name);
    } catch {
      toast.error("Error al generar el PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const isFinal = evaluation?.status === "FINAL";
  const canEdit = !isFinal || user?.role === "ADMIN";

  const allItemsComplete =
    evaluation?.item_scores.every((s) => {
      const local = localScores[s.id];
      return local?.points !== "" && local?.points !== undefined;
    }) ?? false;

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  if (!evaluation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Evaluación no encontrada.</p>
        <Link
          to="/evaluador/mis-estaciones"
          className="text-brand-teal hover:underline mt-2 block"
        >
          Volver
        </Link>
      </div>
    );
  }

  const sortedScores = [...evaluation.item_scores].sort(
    (a, b) =>
      a.rubric_item_order - b.rubric_item_order ||
      a.rubric_item - b.rubric_item,
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <Breadcrumb
        items={[
          { label: "Mis Estaciones", to: "/evaluador/mis-estaciones" },
          { label: evaluation.station_name, to: `/evaluador/exams/${evaluation.exam}/stations/${evaluation.station}/evaluaciones` },
          { label: evaluation.student_name },
        ]}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg">{evaluation.student_name}</h1>
              <EvalStatusBadge status={evaluation.status} />
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              {evaluation.station_name} · {evaluation.items_completed}/
              {evaluation.items_total} ítems completados
            </p>
          </div>
          {isFinal && (
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {evaluation.grade_display}
              </div>
              <div className="text-sm text-gray-500">
                {evaluation.total_points_display} pts
              </div>
              <ApprovedBadge
                approved={
                  evaluation.grade !== null
                    ? parseFloat(evaluation.grade) >= 4.0
                    : null
                }
              />
            </div>
          )}
        </div>
        {!isFinal && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-brand-teal h-1.5 rounded-full transition-all"
                style={{
                  width: `${evaluation.items_total > 0 ? (evaluation.items_completed / evaluation.items_total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {evaluation.items_completed}/{evaluation.items_total}
            </span>
            {saveStatus === "saving" && (
              <span className="text-xs text-gray-400 animate-pulse">
                Guardando...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-green-600">✓ Guardado</span>
            )}
          </div>
        )}
      </div>

      {/* Rubric items */}
      <div className="space-y-3 mb-4">
        {sortedScores.map((score, idx) => {
          const local = localScores[score.id] ?? {
            points: score.points ?? "",
            comment: score.comment,
          };
          const maxPts = parseFloat(score.rubric_item_max_points);
          const pts = parseFloat(local.points);
          const isValid =
            local.points === "" || (!isNaN(pts) && pts >= 0 && pts <= maxPts);

          return (
            <div
              key={score.id}
              className={`bg-white rounded-xl border p-4 shadow-sm ${
                local.points !== "" && isValid
                  ? "border-green-200"
                  : local.points !== "" && !isValid
                    ? "border-red-200"
                    : "border-gray-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-gray-400 text-sm pt-0.5 w-6 flex-shrink-0 text-center">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    {score.rubric_item_description}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Puntaje (máx. {score.rubric_item_max_points})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={score.rubric_item_max_points}
                        step="0.01"
                        className={`w-28 input py-2 text-base ${!isValid && local.points !== "" ? "border-red-400" : ""}`}
                        value={local.points}
                        disabled={!canEdit}
                        onChange={(e) =>
                          handleScoreChange(score.id, "points", e.target.value)
                        }
                        placeholder="0.00"
                      />
                      {!isValid && local.points !== "" && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Debe estar entre 0 y {score.rubric_item_max_points}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-xs text-gray-500 mb-1 block">
                      Observación (opcional)
                    </label>
                    <textarea
                      className="input text-sm min-h-[60px] resize-none"
                      placeholder="Observación sobre este ítem..."
                      value={local.comment}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleScoreChange(score.id, "comment", e.target.value)
                      }
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* General comment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <label className="label">Observación general</label>
        <textarea
          className="input min-h-[100px] resize-y"
          placeholder="Observaciones generales sobre la evaluación..."
          value={generalComment}
          disabled={!canEdit}
          onChange={(e) => handleCommentChange(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end">
        {isFinal && (
          <Button
            variant="secondary"
            loading={pdfLoading}
            onClick={handlePdfDownload}
          >
            Descargar PDF
          </Button>
        )}
        {!isFinal && (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                navigate(-1);
              }}
            >
              Volver
            </Button>
            <Button
              onClick={() => setFinalizeOpen(true)}
              disabled={!allItemsComplete}
            >
              Finalizar evaluación
            </Button>
            {!allItemsComplete && (
              <p className="text-xs text-gray-400 mt-1 w-full text-right">
                Completa todos los ítems para poder finalizar
              </p>
            )}
          </>
        )}
        {isFinal && (
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Volver
          </Button>
        )}
      </div>

      {/* Finalize confirmation modal */}
      <Modal
        isOpen={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        title="Finalizar Evaluación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Al finalizar, no podrás editar esta evaluación. ¿Confirmas la
            finalización?
          </p>
          <div className="bg-brand-teal-light rounded-lg p-3 text-sm text-brand-teal">
            <p>
              <strong>{evaluation.student_name}</strong>
            </p>
            <p>Estación: {evaluation.station_name}</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setFinalizeOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => finalizeMutation.mutate()}
              loading={finalizeMutation.isPending}
            >
              Confirmar y finalizar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
