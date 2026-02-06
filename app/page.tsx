"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ usuario, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      // Redirección según rol
      switch (data.rol) {
        case 'ADMIN':
          router.push('/admin/dashboard');
          break;
        case 'OFICINA':
          router.push('/oficina/dashboard');
          break;
        case 'MECANICO':
          router.push('/mecanico/dashboard');
          break;
        case 'CONDUCTOR':
        default:
          router.push('/empleado'); // Mantenemos /empleado para conductores temporalmente
          break;
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src="/logo.jpg" alt="SEL Logo" className="h-24 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl">Control Horario</CardTitle>
          <p className="text-sm text-gray-600 font-bold uppercase tracking-widest mt-1">Suministros Energéticos de Levante S.A.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Usuario</label>
              <Input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Accediendo..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
