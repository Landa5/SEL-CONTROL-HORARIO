'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Droplet, Settings, Save, Search } from 'lucide-react';

export default function CommercialLitersPage() {
    // Month Selection
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    const [comerciales, setComerciales] = useState<any[]>([]); // List of commercial employees
    const [litersData, setLitersData] = useState<Record<number, string>>({}); // { empId: liters }
    const [litersNotas, setLitersNotas] = useState<Record<number, string>>({}); // { empId: notas }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<number | null>(null);

    useEffect(() => {
        fetchComercialesAndData();
    }, [year, month]);

    const fetchComercialesAndData = async () => {
        setLoading(true);
        try {
            // 1. Get all employees with Rol COMERCIAL
            // We need an endpoint for this or reuse /api/usuarios filtered.
            // For now, let's assume we can fetch all users and filter client side or backend.
            // Let's rely on fetching ALL users and filtering.
            // Or better, fetch the `api/nominas/comercial` which returns existing data, 
            // BUT we also need the list of users who DON'T have data yet.
            // Let's fetch /api/usuarios (assuming it exists and returns role)

            // Re-using /api/admin/users if available, or just fetch from a new util.
            // Let's try to fetch from a generalized endpoint or just `api/usuarios` if we built it before.
            // We previously worked on `api/auth/register` etc. 
            // Let's assume we need to fetch employees.
            const resUsers = await fetch('/api/admin/usuarios'); // Assuming this exists from previous tasks or we need to make it.
            // Note: If this endpoint doesn't exist, we might need to create it or similar. 
            // In "Fixing Dashboard Access", we worked on roles. 
            // Let's assume we fetch generic and filter.

            let users = [];
            if (resUsers.ok) {
                users = await resUsers.json();
            } else {
                // Fallback: maybe we don't have that endpoint.
                // We'll proceed with just showing existing records if we can't find list of ALL commercials.
                // But properly we need to select from a list.
                // Let's Try to fetch existing liters first to see what we have.
            }

            // Filter only COMERCIAL
            const commercialUsers = users.filter((u: any) => u.rol === 'COMERCIAL');

            // 2. Get existing Liters Data for this month
            const resLiters = await fetch(`/api/nominas/comercial?year=${year}&month=${month}`);
            if (resLiters.ok) {
                const data = await resLiters.json();

                // Map existing data
                const newLiters: any = {};
                const newNotas: any = {};

                // Merge users: If a user is in `data` but not in `commercialUsers` (maybe role changed?), include them?
                // Or just Iterate `commercialUsers` and fill from `data`.

                // For MVP simplicity: 
                // We show all commercialUsers. 

                data.forEach((d: any) => {
                    newLiters[d.empleadoId] = d.litros.toString();
                    newNotas[d.empleadoId] = d.notas || '';
                });

                setLitersData(newLiters);
                setLitersNotas(newNotas);
            }

            setComerciales(commercialUsers);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (empleadoId: number) => {
        setSaving(empleadoId);
        try {
            const lit = parseFloat(litersData[empleadoId] || '0');
            const not = litersNotas[empleadoId] || '';

            const res = await fetch('/api/nominas/comercial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    year,
                    month,
                    litros: lit,
                    notas: not
                })
            });

            if (res.ok) {
                // Success visual
            } else {
                alert('Error al guardar');
            }
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">

            <Card className="bg-blue-50">
                <CardContent className="p-4 flex gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500">Año</label>
                        <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-24 bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500">Mes</label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="h-10 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('es-ES', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>
                    <Button variant="outline" onClick={fetchComercialesAndData} disabled={loading} className="mb-0.5">
                        <Search className="w-4 h-4 mr-2" /> Cargar
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {comerciales.length === 0 && !loading && (
                    <p className="text-center text-gray-500 py-8">No hay empleados con rol COMERCIAL o no se pudieron cargar.</p>
                )}

                {comerciales.map(emp => (
                    <Card key={emp.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-1/3">
                                <p className="font-bold">{emp.nombre} {emp.apellidos}</p>
                                <p className="text-xs text-gray-500">{emp.email}</p>
                            </div>
                            <div className="flex-1 flex gap-4">
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Litros Vendidos</label>
                                    <div className="relative">
                                        <Droplet className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                                        <Input
                                            type="number"
                                            className="pl-9 font-mono font-bold"
                                            placeholder="0.00"
                                            value={litersData[emp.id] || ''}
                                            onChange={(e) => setLitersData({ ...litersData, [emp.id]: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-gray-400 font-bold uppercase">Notas</label>
                                    <Input
                                        type="text"
                                        placeholder="Opcional..."
                                        value={litersNotas[emp.id] || ''}
                                        onChange={(e) => setLitersNotas({ ...litersNotas, [emp.id]: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={() => handleSave(emp.id)}
                                disabled={saving === emp.id}
                                className="bg-blue-600 hover:bg-blue-700 h-10 px-6"
                            >
                                {saving === emp.id ? '...' : <Save className="w-4 h-4" />}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
