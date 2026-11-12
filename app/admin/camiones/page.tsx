'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Trash2, Edit, Plus, FileText, Truck, Eye } from 'lucide-react';
import FichaTecnica from '@/components/fleet/FichaTecnica';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { toast } from 'sonner';

export default function AdminCamiones() {
    const router = useRouter();
    const [camiones, setCamiones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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
        setLoading(true);
        try {
            const res = await fetch('/api/camiones');
            if (res.ok) setCamiones(await res.json());
        } finally {
            setLoading(false);
        }
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
                toast.error(errData.error || 'Error al guardar el camión');
                return;
            }

            toast.success(editingId ? 'Camión actualizado correctamente' : 'Nuevo camión registrado');
            closeModal();
            fetchCamiones();
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('Error de conexión con el servidor');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que quieres eliminar este camión?')) return;
        const res = await fetch(`/api/camiones?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success('Camión eliminado');
            fetchCamiones();
        } else {
            toast.error('No se pudo eliminar el camión');
        }
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

    const getStatusColor = (dateStr: string | null) => {
        if (!dateStr) return 'bg-gray-50 text-gray-400 border-gray-200';
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

    const columns: DataTableColumn<any>[] = [
        {
            key: 'matricula',
            header: 'Vehículo',
            sortable: true,
            exportValue: cam => `${cam.matricula} (${cam.marca || ''} ${cam.modelo || ''})`.trim(),
            render: cam => (
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg text-indigo-600">
                        <Truck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-mono font-black text-gray-900 tracking-tighter">{cam.matricula}</p>
                        <p className="text-[11px] font-bold text-gray-400 uppercase truncate max-w-[160px]">
                            {cam.marca} {cam.modelo}
                        </p>
                    </div>
                </div>
            )
        },
        {
            key: 'kmActual',
            header: 'Odómetro (KM)',
            sortable: true,
            align: 'right',
            exportValue: cam => Number(cam.kmActual || 0),
            render: cam => (
                <span className="font-mono font-bold text-slate-700">
                    {(cam.kmActual || 0).toLocaleString('es-ES')} km
                </span>
            )
        },
        {
            key: 'itvVencimiento',
            header: 'ITV',
            sortable: true,
            exportValue: cam => formatDateShort(cam.itvVencimiento),
            render: cam => (
                <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${getStatusColor(
                        cam.itvVencimiento
                    )}`}
                >
                    {formatDateShort(cam.itvVencimiento)}
                </div>
            )
        },
        {
            key: 'seguroVencimiento',
            header: 'Seguro',
            sortable: true,
            exportValue: cam => formatDateShort(cam.seguroVencimiento),
            render: cam => (
                <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${getStatusColor(
                        cam.seguroVencimiento
                    )}`}
                >
                    {formatDateShort(cam.seguroVencimiento)}
                </div>
            )
        },
        {
            key: 'tacografoVencimiento',
            header: 'Tacógrafo',
            sortable: true,
            exportValue: cam => formatDateShort(cam.tacografoVencimiento),
            render: cam => (
                <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${getStatusColor(
                        cam.tacografoVencimiento
                    )}`}
                >
                    {formatDateShort(cam.tacografoVencimiento)}
                </div>
            )
        },
        {
            key: 'adrVencimiento',
            header: 'ADR',
            sortable: true,
            exportValue: cam => formatDateShort(cam.adrVencimiento),
            render: cam => (
                <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-2xs ${getStatusColor(
                        cam.adrVencimiento
                    )}`}
                >
                    {formatDateShort(cam.adrVencimiento)}
                </div>
            )
        },
        {
            key: 'estado',
            header: 'Estado',
            sortable: true,
            exportValue: cam => cam.estado || 'DISPONIBLE',
            render: cam => (
                <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cam.estado === 'TALLER' || cam.estado === 'AVERIADO'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                    }`}
                >
                    {cam.estado || 'DISPONIBLE'}
                </span>
            )
        },
        {
            key: 'actions',
            header: 'Acciones',
            align: 'right',
            render: cam => (
                <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/admin/camiones/${cam.id}`)}
                        title="Abrir Ficha 360° del Camión"
                        className="h-8 px-2.5 border-blue-200 text-blue-600 hover:bg-blue-50 text-xs gap-1"
                    >
                        <Eye className="w-3.5 h-3.5" /> 360°
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingCamionId(cam.id)}
                        title="Editar Ficha Técnica y Vencimientos"
                        className="h-8 w-8 p-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                        <FileText className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(cam)} className="h-8 w-8 p-0">
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(cam.id)} className="h-8 w-8 p-0">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Flota de Camiones (360°)</h1>
                    <p className="text-sm text-slate-500">
                        Control de odómetro, vencimientos legales (ITV, Seguro, Tacógrafo, ADR) y ficha 360° por vehículo.
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Nuevo Camión
                </Button>
            </div>

            <DataTable
                data={camiones}
                columns={columns}
                loading={loading}
                searchPlaceholder="Buscar por matrícula, marca o modelo..."
                searchKeys={['matricula', 'marca', 'modelo', 'estado']}
                filters={[
                    {
                        key: 'estado',
                        label: 'Estado Operativo',
                        options: [
                            { value: 'DISPONIBLE', label: 'Disponible' },
                            { value: 'EN_RUTA', label: 'En Ruta' },
                            { value: 'TALLER', label: 'En Taller' },
                            { value: 'AVERIADO', label: 'Averiado' }
                        ]
                    }
                ]}
                exportFilename="Flota_Camiones_SEL"
                onRowClick={cam => router.push(`/admin/camiones/${cam.id}`)}
            />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>{editingId ? 'Editar Camión' : 'Nuevo Camión'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Matrícula"
                                    value={matricula}
                                    onChange={e => setMatricula(e.target.value)}
                                    required
                                />
                                <Input label="Modelo" value={modelo} onChange={e => setModelo(e.target.value)} />
                                <div className="flex gap-2 justify-end mt-4">
                                    <Button type="button" variant="secondary" onClick={closeModal}>
                                        Cancelar
                                    </Button>
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
                    onClose={() => {
                        setViewingCamionId(null);
                        fetchCamiones();
                    }}
                />
            )}
        </div>
    );
}
