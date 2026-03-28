import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Layouts (eager — always needed)
import AdminLayout from "./layouts/AdminLayout";
import EvaluatorLayout from "./layouts/EvaluatorLayout";

import Spinner from "./components/ui/Spinner";

// Auth (eager — entry point)
import LoginPage from "./pages/auth/LoginPage";

// Admin pages (lazy)
const ExamsListPage = React.lazy(() => import("./pages/admin/ExamsListPage"));
const ExamDetailPage = React.lazy(() => import("./pages/admin/ExamDetailPage"));
const StationDetailPage = React.lazy(() => import("./pages/admin/StationDetailPage"));
const UsersPage = React.lazy(() => import("./pages/admin/UsersPage"));

// Evaluator pages (lazy)
const MyStationsPage = React.lazy(() => import("./pages/evaluator/MyStationsPage"));
const EvaluationsListPage = React.lazy(() => import("./pages/evaluator/EvaluationsListPage"));
const EvaluateStudentPage = React.lazy(() => import("./pages/evaluator/EvaluateStudentPage"));

function PageSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Spinner size="lg" />
    </div>
  );
}

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "EVALUATOR";
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return (
      <Navigate to={user.role === "ADMIN" ? "/admin" : "/evaluador"} replace />
    );
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "ADMIN" ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/evaluador" replace />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
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
            <Route
              path="exams/:examId/stations/:stationId"
              element={<StationDetailPage />}
            />
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
      </Suspense>
    </BrowserRouter>
  );
}
