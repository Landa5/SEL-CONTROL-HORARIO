'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Calendar, Plus, Trash2, Check, X, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminFiestas() {
    const [fiestas, setFiestas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newFiesta, setNewFiesta] = useState({
        fecha: '',
        nombre: '',
        ambito: '',
        esAnual: true
    });

    useEffect(() => {
        fetchFiestas();
    }, []);

    const fetchFiestas = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/fiestas');
        if (res.ok) setFiestas(await res.json());
        setLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch('/api/admin/fiestas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFiesta)
        });
        if (res.ok) {
            setNewFiesta({ fecha: '', nombre: '', ambito: '', esAnual: true });
            fetchFiestas();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este festivo?')) return;
        const res = await fetch(`/api/admin/fiestas/${id}`, { method: 'DELETE' });
        if (res.ok) fetchFiestas();
    };

    const toggleActiva = async (fiesta: any) => {
        const res = await fetch(`/api/admin/fiestas/${fiesta.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activa: !fiesta.activa })
        });
        if (res.ok) fetchFiestas();
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Fiestas Locales</h1>
            </div>

            <Card className="bg-white border-blue-100 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-blue-600" />
                        Nueva Fiesta Local
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha</label>
                            <Input
                                type="date"
                                value={newFiesta.fecha}
                                onChange={e => setNewFiesta({ ...newFiesta, fecha: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                            <Input
                                placeholder="Ej: San Isidro"
                                value={newFiesta.nombre}
                                onChange={e => setNewFiesta({ ...newFiesta, nombre: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Ámbito / Centro</label>
                            <Input
                                placeholder="Ej: Municipio"
                                value={newFiesta.ambito}
                                onChange={e => setNewFiesta({ ...newFiesta, ambito: e.target.value })}
                            />
                        </div>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10">
                            Añadir Festivo
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="bg-white border-blue-100 shadow-md overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        Festivos Configurados
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Nombre</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Ámbito</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Repetición</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Estado</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Cargando...</td></tr>
                                ) : fiestas.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">No hay festivos configurados</td></tr>
                                ) : (
                                    fiestas.map((fiesta) => (
                                        <tr key={fiesta.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                                                {format(new Date(fiesta.fecha), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                                                {fiesta.nombre}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {fiesta.ambito || 'General'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold">
                                                {fiesta.esAnual ?
                                                    <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Anual</span> :
                                                    <span className="text-gray-400 bg-gray-50 px-2 py-1 rounded">Única vez</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => toggleActiva(fiesta)}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${fiesta.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}
                                                >
                                                    {fiesta.activa ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                    {fiesta.activa ? 'Activa' : 'Inactiva'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(fiesta.id)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
