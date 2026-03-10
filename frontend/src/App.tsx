import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Layouts
import AdminLayout from './layouts/AdminLayout'
import EvaluatorLayout from './layouts/EvaluatorLayout'

// Admin pages
import ExamsListPage from './pages/admin/ExamsListPage'
import ExamDetailPage from './pages/admin/ExamDetailPage'
import StationDetailPage from './pages/admin/StationDetailPage'
import UsersPage from './pages/admin/UsersPage'

// Evaluator pages
import MyStationsPage from './pages/evaluator/MyStationsPage'
import EvaluationsListPage from './pages/evaluator/EvaluationsListPage'
import EvaluateStudentPage from './pages/evaluator/EvaluateStudentPage'

import Spinner from './components/ui/Spinner'

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: 'ADMIN' | 'EVALUATOR'
}) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/evaluador'} replace />
  }

  return <>{children}</>
}

function RootRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'ADMIN' ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/evaluador" replace />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ExamsListPage />} />
          <Route path="exams" element={<ExamsListPage />} />
          <Route path="exams/:examId" element={<ExamDetailPage />} />
          <Route path="exams/:examId/stations/:stationId" element={<StationDetailPage />} />
          <Route path="usuarios" element={<UsersPage />} />
        </Route>

        {/* Evaluator routes */}
        <Route
          path="/evaluador"
          element={
            <ProtectedRoute requiredRole="EVALUATOR">
              <EvaluatorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MyStationsPage />} />
          <Route path="mis-estaciones" element={<MyStationsPage />} />
          <Route
            path="exams/:examId/stations/:stationId/evaluaciones"
            element={<EvaluationsListPage />}
          />
          <Route
            path="evaluaciones/:evaluationId"
            element={<EvaluateStudentPage />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
