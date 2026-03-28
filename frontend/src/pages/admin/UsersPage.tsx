import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createUser, updateUser } from "../../api/users";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import { useToast } from "../../context/ToastContext";

export default function UsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role: "EVALUATOR",
  });
  const [error, setError] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      setForm({
        email: "",
        first_name: "",
        last_name: "",
        password: "",
        role: "EVALUATOR",
      });
      toast.success("Usuario creado exitosamente");
    },
    onError: (e: unknown) => {
      setError(
        (e as { response?: { data?: { email?: string[]; detail?: string } } })
          ?.response?.data?.email?.[0] ||
          (e as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ||
          "Error al crear usuario.",
      );
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateUser(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestión de cuentas de evaluadores
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Nuevo evaluador</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-3 font-medium text-gray-600">Correo</th>
              <th className="px-4 py-3 font-medium text-gray-600">Rol</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-50 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium">{user.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === "ADMIN" ? "teal" : "gray"}>
                    {user.role === "ADMIN" ? "Admin" : "Evaluador"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_active ? "green" : "red"}>
                    {user.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {user.role !== "ADMIN" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: user.id,
                          is_active: !user.is_active,
                        })
                      }
                    >
                      {user.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo Evaluador"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={form.first_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, first_name: e.target.value }))
              }
            />
            <Input
              label="Apellido"
              value={form.last_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, last_name: e.target.value }))
              }
            />
          </div>
          <Input
            label="Correo electrónico"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
          <div>
            <label className="label">Rol</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="EVALUATOR">Evaluador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setError("");
                createMutation.mutate(form);
              }}
              loading={createMutation.isPending}
              disabled={!form.email || !form.first_name || !form.password}
            >
              Crear
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
