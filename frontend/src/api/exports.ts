import { apiClient } from './client'

export const downloadResultsXlsx = async (examId: number, examName: string): Promise<void> => {
  const response = await apiClient.get(`/exams/${examId}/exports/results.xlsx`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `resultados_${examName.replace(/\s+/g, '_')}_${examId}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const downloadEvaluationPdf = async (
  evalId: number,
  studentName: string
): Promise<void> => {
  const response = await apiClient.get(`/evaluations/${evalId}/exports/evaluation.pdf`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `evaluacion_${studentName.replace(/\s+/g, '_')}_${evalId}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
