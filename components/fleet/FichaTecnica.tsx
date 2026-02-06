'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Truck, Wrench, AlertTriangle, Calendar, History, Clock, Save, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FichaTecnicaProps {
    camionId: number;
    onClose: () => void;
}

export default function FichaTecnica({ camionId, onClose }: FichaTecnicaProps) {
    const router = useRouter();
    const [camion, setCamion] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'info' | 'mantenimientos' | 'averias'>('info');

    // Metadata Edit Form
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        fetchCamionDetail();
    }, [camionId]);

    const fetchCamionDetail = async () => {
        setLoading(true);
        const res = await fetch(`/api/camiones?id=${camionId}`);
        if (res.ok) {
            const data = await res.json();
            setCamion(data);
            setFormData({
                marca: data.marca || '',
                modelo: data.modelo || '',
                nVin: data.nVin || '',
                anio: data.anio || '',
                anioCisterna: data.anioCisterna || '',
                itvVencimiento: data.itvVencimiento ? data.itvVencimiento.split('T')[0] : '',
                seguroVencimiento: data.seguroVencimiento ? data.seguroVencimiento.split('T')[0] : '',
                tacografoVencimiento: data.tacografoVencimiento ? data.tacografoVencimiento.split('T')[0] : '',
                adrVencimiento: data.adrVencimiento ? data.adrVencimiento.split('T')[0] : '',
            });
        }
        setLoading(false);
    };

    const handleSaveMetadata = async () => {
        try {
            const res = await fetch('/api/camiones/metadata', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: camionId, ...formData })
            });
            if (res.ok) {
                setEditMode(false);
                await fetchCamionDetail();
                alert('Ficha técnica actualizada correctamente');
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'No se pudo guardar'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión al guardar los datos');
        }
    };

    if (loading) return <div className="p-10 text-center">Cargando ficha técnica...</div>;
    if (!camion) return <div className="p-10 text-center text-red-500">No se encontró el camión.</div>;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border-none">
                <CardHeader className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6 shrink-0">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl">
                                <Truck className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">{camion.matricula}</h2>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                                    {camion.marca} {camion.modelo} • {camion.kmActual.toLocaleString()} KM
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">CERRAR</Button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-6 bg-white/5 p-1 rounded-xl w-fit">
                        {[
                            { id: 'info', label: 'Especificaciones', icon: Truck },
                            { id: 'mantenimientos', label: 'Historial Mecánico', icon: Wrench },
                            { id: 'averias', label: 'Historial de Averías', icon: AlertTriangle }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                <t.icon className="w-3.5 h-3.5" /> {t.label}
                            </button>
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                    {tab === 'info' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-gray-900 border-l-4 border-indigo-600 pl-3">Datos Técnicos del Vehículo</h3>
                                    <Button size="sm" variant={editMode ? "primary" : "outline"} onClick={editMode ? handleSaveMetadata : () => setEditMode(true)} className="gap-2">
                                        {editMode ? <><Save className="w-4 h-4" /> GUARDAR CAMBIOS</> : <><Plus className="w-4 h-4" /> EDITAR DATOS</>}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Marca', key: 'marca' },
                                            { label: 'Modelo', key: 'modelo' },
                                            { label: 'Bastidor (VIN)', key: 'nVin' },
                                            { label: 'Año Fabricación Vehículo', key: 'anio', type: 'number' },
                                            { label: 'Año Fabricación Cisterna', key: 'anioCisterna', type: 'number' }
                                        ].map(field => (
                                            <div key={field.key}>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{field.label}</label>
                                                {editMode ? (
                                                    <Input
                                                        type={field.type || 'text'}
                                                        value={formData[field.key]}
                                                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                                        className="mt-1 bg-gray-50"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-bold text-gray-800 mt-0.5">{camion[field.key] || 'No definido'}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Vencimiento ITV', key: 'itvVencimiento', type: 'date' },
                                            { label: 'Vencimiento Seguro', key: 'seguroVencimiento', type: 'date' },
                                            { label: 'Vencimiento Tacógrafo', key: 'tacografoVencimiento', type: 'date' },
                                            { label: 'Vencimiento ADR', key: 'adrVencimiento', type: 'date' }
                                        ].map(field => (
                                            <div key={field.key}>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{field.label}</label>
                                                {editMode ? (
                                                    <Input
                                                        type="date"
                                                        value={formData[field.key]}
                                                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                                                        className="mt-1 bg-gray-50"
                                                    />
                                                ) : (
                                                    <p className={`text-sm font-bold mt-0.5 ${camion[field.key] && new Date(camion[field.key]) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                                                        {camion[field.key] ? format(new Date(camion[field.key]), 'dd/MM/yyyy') : 'No definido'}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-gray-900 border-l-4 border-emerald-600 pl-3">Recordatorios Próximos</h3>
                                <div className="space-y-3">
                                    {[
                                        { label: 'ITV', date: camion.itvVencimiento, color: 'blue' },
                                        { label: 'Seguro', date: camion.seguroVencimiento, color: 'emerald' },
                                        { label: 'Tacógrafo', date: camion.tacografoVencimiento, color: 'orange' },
                                        { label: 'ADR', date: camion.adrVencimiento, color: 'red' },
                                    ].map(v => (
                                        <Card key={v.label} className="border-none shadow-sm flex items-center p-4 gap-4 bg-white hover:shadow-md transition-shadow">
                                            <div className={`p-3 rounded-xl bg-${v.color}-50 text-${v.color}-600`}>
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">{v.label}</p>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {v.date ? format(new Date(v.date), 'dd MMM yyyy', { locale: es }) : 'Pendiente fechar'}
                                                </p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'mantenimientos' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-black text-gray-900 border-l-4 border-orange-600 pl-3 whitespace-nowrap">Historial de Intervenciones</h3>
                                <Button variant="secondary" size="sm" className="gap-2 bg-orange-50 text-orange-700 hover:bg-orange-100 border-none font-bold">
                                    <Plus className="w-4 h-4" /> REGISTRAR INTERVENCIÓN
                                </Button>
                            </div>

                            {(!camion.historialMantenimientos || camion.historialMantenimientos?.length === 0) ? (
                                <div className="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                    <Wrench className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-400 italic">No hay registros de mantenimiento históricos para este vehículo.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {camion.historialMantenimientos?.map((m: any) => (
                                        <Card key={m.id} className="border-none shadow-sm group hover:shadow-md transition-all overflow-hidden bg-white">
                                            <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-start gap-5">
                                                    <div className="p-4 bg-gray-50 text-gray-400 rounded-2xl group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                                                        <Clock className="w-6 h-6" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-black uppercase tracking-tighter">{m.tipo}</span>
                                                            <span className="text-sm font-black text-gray-900">{format(new Date(m.fecha), 'dd MMMM yyyy', { locale: es })}</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-gray-700">{m.descripcion}</p>
                                                        {m.piezasCambiadas && <p className="text-[11px] text-gray-400">Piezas: {m.piezasCambiadas}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex md:flex-col items-center md:items-end gap-2 shrink-0 md:pl-6 border-l md:border-l-gray-100">
                                                    <p className="text-xl font-black text-gray-900">{m.kmEnEseMomento.toLocaleString()} <span className="text-xs text-gray-400 uppercase">KM</span></p>
                                                    <p className="text-xs font-bold text-emerald-600">{m.costo ? `${m.costo}€` : 'Coste no reg.'}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'averias' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-black text-gray-900 border-l-4 border-red-600 pl-3">Registro de Incidencias Técnicas</h3>
                            {(!camion.tareas || camion.tareas?.length === 0) ? (
                                <div className="p-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                    <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-400 italic">No hay historial de averías para este camión.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {camion.tareas?.map((t: any) => (
                                        <Card key={t.id} className="border-none shadow-sm bg-white hover:border-l-4 hover:border-l-red-500 transition-all">
                                            <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-start gap-5">
                                                    <div className={`p-4 rounded-2xl ${t.prioridad === 'ALTA' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                                                        <AlertTriangle className="w-6 h-6" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black text-gray-900">{t.titulo}</span>
                                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${t.estado === 'CERRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {t.estado}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 line-clamp-1">{t.descripcion}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Reportado por {t.creadoPor?.nombre} el {format(new Date(t.createdAt), 'dd/MM/yyyy')}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0 text-indigo-600 font-bold text-xs"
                                                    onClick={() => router.push(`/tareas/${t.id}`)}
                                                >
                                                    VER TICKET →
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
