import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../context/AuthContext'
import { login } from '../../api/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const schema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { login: authLogin, user } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      navigate(user.role === 'ADMIN' ? '/admin' : '/evaluador', { replace: true })
    }
  }, [user, navigate])

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      const result = await login(data)
      authLogin(result.access, result.refresh, result.user)
      navigate(result.user.role === 'ADMIN' ? '/admin' : '/evaluador', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Error al iniciar sesión. Verifica tus credenciales.'
      setServerError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
            <span className="text-primary-700 text-2xl font-bold">E</span>
          </div>
          <h1 className="text-white text-2xl font-bold">ECOE MVP</h1>
          <p className="text-primary-200 text-sm mt-1">Sistema de gestión de exámenes ECOE</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-gray-900 text-xl font-semibold mb-6 text-center">Iniciar sesión</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="correo@ejemplo.cl"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            {serverError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{serverError}</p>
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

        <p className="text-center text-primary-200 text-xs mt-6">
          ECOE MVP · Sistema de gestión de exámenes clínicos
        </p>
      </div>
    </div>
  )
}
