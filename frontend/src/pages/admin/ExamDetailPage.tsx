import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExam, publishExam, closeExam } from '../../api/exams'
import Button from '../../components/ui/Button'
import { ExamStatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import StationsTab from './tabs/StationsTab'
import StudentsTab from './tabs/StudentsTab'
import AssignmentsTab from './tabs/AssignmentsTab'
import ResultsTab from './tabs/ResultsTab'
import AuditTab from './tabs/AuditTab'

const TABS = [
  { id: 'stations', label: 'Estaciones' },
  { id: 'students', label: 'Estudiantes' },
  { id: 'assignments', label: 'Asignaciones' },
  { id: 'results', label: 'Resultados' },
  { id: 'audit', label: 'Auditoría' },
]

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>()
  const id = Number(examId)
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('stations')

  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => getExam(id),
    enabled: !!id,
  })

  const publishMutation = useMutation({
    mutationFn: () => publishExam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam', id] }),
    onError: (e: unknown) => {
      const errs =
        (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors
      alert(errs?.join('\n') || 'Error al publicar.')
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => closeExam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam', id] }),
    onError: () => alert('Error al cerrar.'),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">ECOE no encontrado.</p>
        <Link to="/admin/exams" className="text-primary-600 hover:underline mt-2 block">
          Volver a la lista
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/admin/exams" className="hover:text-primary-600">ECOEs</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{exam.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1>{exam.name}</h1>
              <ExamStatusBadge status={exam.status} />
            </div>
            {exam.description && (
              <p className="text-gray-500 mt-1 text-sm">{exam.description}</p>
            )}
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              {exam.start_date && <span>Fecha: {exam.start_date}</span>}
              <span>{exam.stations_count} estaciones</span>
              <span>{exam.students_count} estudiantes</span>
            </div>
          </div>
          <div className="flex gap-2">
            {exam.status === 'DRAFT' && (
              <Button
                onClick={() => {
                  if (confirm('¿Publicar este ECOE?')) publishMutation.mutate()
                }}
                loading={publishMutation.isPending}
              >
                Publicar ECOE
              </Button>
            )}
            {exam.status === 'PUBLISHED' && (
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm('¿Cerrar este ECOE? Solo Admin podrá exportar resultados.'))
                    closeMutation.mutate()
                }}
                loading={closeMutation.isPending}
              >
                Cerrar ECOE
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'stations' && <StationsTab exam={exam} />}
        {activeTab === 'students' && <StudentsTab exam={exam} />}
        {activeTab === 'assignments' && <AssignmentsTab exam={exam} />}
        {activeTab === 'results' && <ResultsTab exam={exam} />}
        {activeTab === 'audit' && <AuditTab examId={id} />}
      </div>
    </div>
  )
}
