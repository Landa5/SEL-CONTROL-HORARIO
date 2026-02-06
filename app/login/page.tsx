'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function LoginPage() {
    const router = useRouter();
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al iniciar sesión');
            }

            // Redirect based on role
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
                default:
                    router.push('/empleado');
                    break;
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-blue-800">Control Horario</CardTitle>
                    <p className="text-center text-gray-500">SUMINISTROS ENERGÉTICOS DE LEVANTE S.A.</p>
                    <p className="text-center text-xs text-gray-300 mt-2">v1.1 Debug</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            label="Usuario"
                            type="text"
                            placeholder="Nombre de usuario"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            required
                        />
                        <Input
                            label="Contraseña"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
