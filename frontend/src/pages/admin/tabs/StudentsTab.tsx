import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getExamStudents,
  importStudentsXlsx,
  addStudentToExam,
} from "../../../api/students";
import type { Exam, ImportXlsxResult } from "../../../types";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";
import EmptyState, { UsersIcon } from "../../../components/ui/EmptyState";
import { useToast } from "../../../context/ToastContext";

interface Props {
  exam: Exam;
}

export default function StudentsTab({ exam }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportXlsxResult | null>(null);

  const { data: examStudents = [], isLoading } = useQuery({
    queryKey: ["exam-students", exam.id],
    queryFn: () => getExamStudents(exam.id),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importStudentsXlsx(exam.id, file),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["exam-students", exam.id] });
      setImportResult(result);
      toast.success("Importación completada");
    },
    onError: (e: unknown) => {
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al importar el archivo.",
      );
    },
  });

  const [addForm, setAddForm] = useState({ rut: "", full_name: "", email: "" });
  const addMutation = useMutation({
    mutationFn: () => addStudentToExam(exam.id, addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-students", exam.id] });
      setAddOpen(false);
      setAddForm({ rut: "", full_name: "", email: "" });
      toast.success("Estudiante agregado");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al agregar estudiante.",
      ),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportResult(null);
      importMutation.mutate(file);
    }
    e.target.value = "";
  };

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
        <h2>Estudiantes ({examStudents.length})</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Los estudiantes serán evaluados en todas las estaciones activas
        </p>
        {!isClosed && (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="secondary"
              size="sm"
              loading={importMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              Importar XLSX
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              + Agregar
            </Button>
          </div>
        )}
      </div>

      {/* Import result */}
      {importResult && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium text-sm">
            Importación completada: {importResult.created} creados,{" "}
            {importResult.updated} actualizados.
          </p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 text-red-700 text-xs space-y-0.5">
              {importResult.errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {examStudents.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No hay estudiantes inscritos"
          description="Importa un archivo XLSX con columnas: rut, nombre, correo"
          action={!isClosed ? { label: "Importar XLSX", onClick: () => fileInputRef.current?.click() } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">RUT</th>
                <th className="px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Correo
                </th>
              </tr>
            </thead>
            <tbody>
              {examStudents.map((es) => (
                <tr
                  key={es.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-gray-600">
                    {es.student.rut}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {es.student.full_name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {es.student.email || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add student modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Agregar Estudiante"
      >
        <div className="space-y-4">
          <Input
            label="RUT"
            placeholder="12.345.678-9"
            value={addForm.rut}
            onChange={(e) => setAddForm((f) => ({ ...f, rut: e.target.value }))}
          />
          <Input
            label="Nombre completo"
            placeholder="Nombre Apellido"
            value={addForm.full_name}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, full_name: e.target.value }))
            }
          />
          <Input
            label="Correo electrónico (opcional)"
            type="email"
            value={addForm.email}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, email: e.target.value }))
            }
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              loading={addMutation.isPending}
              disabled={!addForm.rut || !addForm.full_name}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
