import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getExamAudits } from '../../../api/evaluations'
import Spinner from '../../../components/ui/Spinner'

interface Props {
  examId: number
}

const ACTION_LABELS: Record<string, string> = {
  PUBLISH_EXAM: 'Publicar ECOE',
  CLOSE_EXAM: 'Cerrar ECOE',
  FINALIZE_EVALUATION: 'Finalizar evaluación',
  REOPEN_EVALUATION: 'Reabrir evaluación',
  IMPORT_STUDENTS: 'Importar estudiantes',
}

export default function AuditTab({ examId }: Props) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['exam-audits', examId],
    queryFn: () => getExamAudits(examId),
  })

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">No hay registros de auditoría.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4">Registro de Auditoría</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="px-4 py-3 font-medium text-gray-600">Usuario</th>
              <th className="px-4 py-3 font-medium text-gray-600">Acción</th>
              <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('es-CL')}
                </td>
                <td className="px-4 py-3">{log.actor_name}</td>
                <td className="px-4 py-3 font-medium">
                  {ACTION_LABELS[log.action] || log.action}
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                  {Object.entries(log.payload_json)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
