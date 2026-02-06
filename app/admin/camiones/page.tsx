'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Trash2, Edit, Plus, FileText, Calendar, ShieldAlert, Truck } from 'lucide-react';
import FichaTecnica from '@/components/fleet/FichaTecnica';
import { format } from 'date-fns';

export default function AdminCamiones() {
    const [camiones, setCamiones] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewingCamionId, setViewingCamionId] = useState<number | null>(null);

    // Form
    const [matricula, setMatricula] = useState('');
    const [modelo, setModelo] = useState('');

    useEffect(() => {
        fetchCamiones();
    }, []);

    const fetchCamiones = async () => {
        const res = await fetch('/api/camiones');
        if (res.ok) setCamiones(await res.json());
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const body: any = { matricula, modelo };
        if (editingId) body.id = editingId;

        const method = editingId ? 'PUT' : 'POST';
        try {
            const res = await fetch('/api/camiones', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json();
                alert(errData.error || 'Error al guardar el camión');
                return; // Keep modal open
            }

            closeModal();
            fetchCamiones();
        } catch (error) {
            console.error('Submit error:', error);
            alert('Error de conexión con el servidor');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que quieres eliminar este camión?')) return;
        await fetch(`/api/camiones?id=${id}`, { method: 'DELETE' });
        fetchCamiones();
    };

    const openEdit = (cam: any) => {
        setEditingId(cam.id);
        setMatricula(cam.matricula);
        setModelo(cam.modelo || '');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingId(null);
        setMatricula('');
        setModelo('');
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Gestión de Camiones</h1>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nuevo Camión</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="p-4 text-[10px] font-black uppercase text-gray-400">Vehículo</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-gray-400">ITV</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-gray-400">Seguro</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-gray-400">Tacógrafo</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-gray-400">ADR</th>
                                    <th className="p-4 text-right text-[10px] font-black uppercase text-gray-400">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {camiones.map(cam => {
                                    const getStatusColor = (dateStr: string | null) => {
                                        if (!dateStr) return 'bg-gray-50 text-gray-400';
                                        const date = new Date(dateStr);
                                        const now = new Date();
                                        const threshold = new Date();
                                        threshold.setDate(threshold.getDate() + 40);

                                        if (date < now) return 'bg-red-100 text-red-700 border-red-200';
                                        if (date < threshold) return 'bg-orange-100 text-orange-700 border-orange-200';
                                        return 'bg-blue-50 text-blue-700 border-blue-100';
                                    };

                                    const formatDateShort = (dateStr: string | null) => {
                                        if (!dateStr) return '---';
                                        return format(new Date(dateStr), 'dd/MM/yy');
                                    };

                                    return (
                                        <tr key={cam.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-gray-100 rounded-lg text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                        <Truck className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-mono font-black text-gray-900 tracking-tighter">{cam.matricula}</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[100px]">{cam.marca} {cam.modelo}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-bold border shadow-sm ${getStatusColor(cam.itvVencimiento)}`}>
                                                    {formatDateShort(cam.itvVencimiento)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-bold border shadow-sm ${getStatusColor(cam.seguroVencimiento)}`}>
                                                    {formatDateShort(cam.seguroVencimiento)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-bold border shadow-sm ${getStatusColor(cam.tacografoVencimiento)}`}>
                                                    {formatDateShort(cam.tacografoVencimiento)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-bold border shadow-sm ${getStatusColor(cam.adrVencimiento)}`}>
                                                    {formatDateShort(cam.adrVencimiento)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right space-x-1">
                                                <Button size="sm" variant="outline" onClick={() => setViewingCamionId(cam.id)} className="h-8 w-8 p-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"><FileText className="w-4 h-4" /></Button>
                                                <Button size="sm" variant="secondary" onClick={() => openEdit(cam)} className="h-8 w-8 p-0"><Edit className="w-4 h-4" /></Button>
                                                <Button size="sm" variant="danger" onClick={() => handleDelete(cam.id)} className="h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>{editingId ? 'Editar Camión' : 'Nuevo Camión'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input label="Matrícula" value={matricula} onChange={e => setMatricula(e.target.value)} required />
                                <Input label="Modelo" value={modelo} onChange={e => setModelo(e.target.value)} />
                                <div className="flex gap-2 justify-end mt-4">
                                    <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
                                    <Button type="submit">Guardar</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Ficha Técnica Modal */}
            {viewingCamionId && (
                <FichaTecnica
                    camionId={viewingCamionId}
                    onClose={() => setViewingCamionId(null)}
                />
            )}
        </div>
    );
}
