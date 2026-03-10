import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getExams, createExam, publishExam, closeExam } from '../../api/exams'
import type { Exam } from '../../types'
import Button from '../../components/ui/Button'
import { ExamStatusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  start_date: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ExamsListPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [error, setError] = useState('')

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => getExams(),
  })

  const createMutation = useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] })
      setCreateOpen(false)
      reset()
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Error al crear el ECOE.'
      )
    },
  })

  const publishMutation = useMutation({
    mutationFn: publishExam,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
    onError: (e: unknown) => {
      alert(
        (e as { response?: { data?: { errors?: string[]; detail?: string } } })?.response?.data
          ?.errors?.join('\n') ||
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Error al publicar.'
      )
    },
  })

  const closeMutation = useMutation({
    mutationFn: closeExam,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
    onError: () => alert('Error al cerrar el ECOE.'),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => {
    setError('')
    createMutation.mutate({
      name: data.name,
      description: data.description || '',
      start_date: data.start_date || null,
    })
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>ECOEs</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de exámenes ECOE/OSCE</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Nuevo ECOE</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500">No hay ECOEs creados aún.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            Crear primer ECOE
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Estaciones</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Estudiantes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/exams/${exam.id}`}
                      className="font-medium text-primary-700 hover:text-primary-900 hover:underline"
                    >
                      {exam.name}
                    </Link>
                    {exam.description && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate max-w-xs">
                        {exam.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <ExamStatusBadge status={exam.status} />
                  </td>
                  <td className="px-4 py-4 text-gray-500 hidden md:table-cell">
                    {exam.start_date || '-'}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 hidden md:table-cell">
                    {exam.stations_count}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 hidden md:table-cell">
                    {exam.students_count}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/admin/exams/${exam.id}`}>
                        <Button variant="secondary" size="sm">Ver</Button>
                      </Link>
                      {exam.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          loading={publishMutation.isPending}
                          onClick={() => {
                            if (confirm('¿Publicar este ECOE?')) publishMutation.mutate(exam.id)
                          }}
                        >
                          Publicar
                        </Button>
                      )}
                      {exam.status === 'PUBLISHED' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (confirm('¿Cerrar este ECOE? Esta acción es irreversible.'))
                              closeMutation.mutate(exam.id)
                          }}
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
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo ECOE">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre del ECOE" error={errors.name?.message} {...register('name')} />
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              className="input min-h-[80px] resize-y"
              placeholder="Descripción del examen..."
              {...register('description')}
            />
          </div>
          <Input
            label="Fecha de inicio (opcional)"
            type="date"
            {...register('start_date')}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending}>
              Crear ECOE
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
