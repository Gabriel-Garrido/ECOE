import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../context/AuthContext";
import { login } from "../../api/auth";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import AppLogo from "../../components/AppLogo";
import brandDivider from "@/assets/branding/ui/brand-divider-dark-gray-transparent.png";

const schema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login: authLogin, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      navigate(user.role === "ADMIN" ? "/admin" : "/evaluador", {
        replace: true,
      });
    }
  }, [user, navigate]);

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      const result = await login(data);
      authLogin(result.access, result.refresh, result.user);
      navigate(result.user.role === "ADMIN" ? "/admin" : "/evaluador", {
        replace: true,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al iniciar sesión. Verifica tus credenciales.";
      setServerError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <AppLogo variant="vertical" className="h-36 mb-4" />
          <img
            src={brandDivider}
            alt=""
            className="w-48 opacity-40 mb-3"
            draggable={false}
          />
          <p className="text-gray-400 text-sm tracking-wide">
            Plataforma de evaluaciones clínicas
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-brand-teal text-xl font-semibold mb-6 text-center">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="correo@ejemplo.cl"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            {serverError && (
              <div className="bg-brand-red-light border border-red-200 rounded-lg p-3">
                <p className="text-brand-red text-sm">{serverError}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={isSubmitting}
            >
              Ingresar
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          Quismart · Plataforma de evaluaciones clínicas
        </p>
      </div>
    </div>
  );
}
