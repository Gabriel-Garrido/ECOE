import React from "react";
import { Outlet, useNavigate, Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLogo from "../components/AppLogo";

export default function EvaluatorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-neutral-dark text-white shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/evaluador/mis-estaciones" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <AppLogo variant="horizontal" className="h-8 hidden sm:block" darkBg />
            <AppLogo variant="square" className="h-8 w-8 rounded sm:hidden" />
          </Link>
          <div className="flex items-center gap-4">
            <NavLink
              to="/evaluador/mis-estaciones"
              className={({ isActive }) =>
                isActive
                  ? "text-brand-yellow text-sm font-medium transition-colors"
                  : "text-gray-300 hover:text-white text-sm font-medium transition-colors"
              }
            >
              Mis Estaciones
            </NavLink>
            <div className="h-4 w-px bg-white/20" />
            <span className="text-gray-400 text-sm hidden sm:block">
              {user?.full_name}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Salir
            </button>
          </div>
        </div>
        {/* Yellow accent line */}
        <div className="h-0.5 bg-brand-yellow" />
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
