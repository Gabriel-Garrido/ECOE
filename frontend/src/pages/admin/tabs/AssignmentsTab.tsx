import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAssignments, createAssignment, deleteAssignment } from '../../../api/assignments'
import { getStations } from '../../../api/stations'
import { getUsers } from '../../../api/users'
import type { Exam } from '../../../types'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import Spinner from '../../../components/ui/Spinner'

interface Props {
  exam: Exam
}

export default function AssignmentsTab({ exam }: Props) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ station: '', evaluator: '' })

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', exam.id],
    queryFn: () => getAssignments(exam.id),
  })

  const { data: stations = [] } = useQuery({
    queryKey: ['stations', exam.id],
    queryFn: () => getStations(exam.id),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const evaluators = users.filter((u) => u.role === 'EVALUATOR' && u.is_active)

  const createMutation = useMutation({
    mutationFn: () =>
      createAssignment(exam.id, {
        station: Number(form.station),
        evaluator: Number(form.evaluator),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', exam.id] })
      setAddOpen(false)
      setForm({ station: '', evaluator: '' })
    },
    onError: (e: unknown) =>
      alert(
        (e as { response?: { data?: { detail?: string; non_field_errors?: string[] } } })
          ?.response?.data?.non_field_errors?.[0] ||
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Error al crear asignación.'
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', exam.id] }),
  })

  const isClosed = exam.status === 'CLOSED'

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2>Asignaciones de Evaluadores</h2>
        {!isClosed && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            + Asignar evaluador
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No hay asignaciones. Asigna evaluadores a las estaciones.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Estación</th>
                <th className="px-4 py-3 font-medium text-gray-600">Evaluador</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Correo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
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
                          if (confirm('¿Eliminar esta asignación?'))
                            deleteMutation.mutate(a.id)
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
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Asignar Evaluador">
        <div className="space-y-4">
          <div>
            <label className="label">Estación</label>
            <select
              className="input"
              value={form.station}
              onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, evaluator: e.target.value }))}
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
  )
}
