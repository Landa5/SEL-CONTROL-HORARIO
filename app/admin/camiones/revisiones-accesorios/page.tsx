'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardCheck, Truck, User, Filter, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const ITEMS_META = [
    { key: 'instruccionesEscritas', label: 'Instrucciones escritas (a la vista)' },
    { key: 'linternaPetroval', label: 'Linterna Petroval' },
    { key: 'linternaNormal', label: 'Linterna Normal' },
    { key: 'gafasSeguridad', label: 'Gafas de seguridad' },
    { key: 'chaleco', label: 'Chaleco' },
    { key: 'calzo', label: 'Calzo' },
    { key: 'liquidoAclaraOjos', label: 'Líquido aclara ojos' },
    { key: 'guantes', label: 'Guantes' },
    { key: 'impermeableCasco', label: 'Impermeable/Casco' },
    { key: 'triangulos', label: 'Triángulos' },
    { key: 'sAutoportante', label: 'S. Autoportante' },
    { key: 'cargadorMovil', label: 'Cargador móvil' },
    { key: 'pala', label: 'Pala' },
    { key: 'obturador', label: 'Obturador' },
    { key: 'recColector', label: 'Rec. Colector' },
    { key: 'sepiolita', label: 'Sepiolita' },
    { key: 'cuerda', label: 'Cuerda' },
    { key: 'pistolaMk50', label: 'Pistola MK-50' },
    { key: 'pistolaAutomatica', label: 'Pistola Automática' },
    { key: 'fundaNegraPistola', label: 'Funda negra pistola automática' },
    { key: 'ruedasDelante', label: 'Ruedas Delante' },
    { key: 'ruedasDetras', label: 'Ruedas Detrás' },
    { key: 'limpiezaInterior', label: 'Limpieza Interior' },
    { key: 'limpiezaExterior', label: 'Limpieza Exterior' },
    { key: 'desagues', label: 'Desagües' },
    { key: 'grifos', label: 'Grifos' },
    { key: 'aceiteAgua', label: 'Aceite/Agua' },
    { key: 'presionRuedas', label: 'Presión Ruedas' },
];

export default function RevisionesAccesoriosAdminPage() {
    const [revisiones, setRevisiones] = useState<any[]>([]);
    const [camiones, setCamiones] = useState<any[]>([]);
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<any>(null);

    const now = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [filtroCamion, setFiltroCamion] = useState('');
    const [filtroEmpleado, setFiltroEmpleado] = useState('');
    const [filtroMes, setFiltroMes] = useState(mesActual);

    const fetchRevisiones = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filtroCamion) params.set('camionId', filtroCamion);
        if (filtroEmpleado) params.set('empleadoId', filtroEmpleado);
        if (filtroMes) params.set('mes', filtroMes);
        const res = await fetch(`/api/admin/revisiones-accesorios?${params}`);
        if (res.ok) setRevisiones(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetch('/api/camiones').then(r => r.json()).then(setCamiones);
        fetch('/api/empleados').then(r => r.json()).then((data) => {
            setEmpleados(Array.isArray(data) ? data.filter((e: any) => ['CONDUCTOR', 'MECANICO'].includes(e.rol)) : []);
        });
        fetchRevisiones();
    }, []);

    const getScore = (r: any) => {
        const total = ITEMS_META.length;
        const ok = ITEMS_META.filter(i => r[i.key]).length;
        return { ok, total, pct: Math.round((ok / total) * 100) };
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardCheck className="w-7 h-7 text-blue-600" />
                    Revisión Mensual de Accesorios
                </h1>
                <p className="text-sm text-gray-500 mt-1">Historial de las revisiones de equipamiento realizadas por los conductores cada mes.</p>
            </div>

            {/* FILTROS */}
            <Card>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Mes</label>
                            <input type="month" className="w-full p-2 border rounded-lg text-sm" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Camión</label>
                            <select className="w-full p-2 border rounded-lg text-sm" value={filtroCamion} onChange={e => setFiltroCamion(e.target.value)}>
                                <option value="">Todos</option>
                                {camiones.map((c: any) => <option key={c.id} value={c.id}>{c.matricula}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Conductor</label>
                            <select className="w-full p-2 border rounded-lg text-sm" value={filtroEmpleado} onChange={e => setFiltroEmpleado(e.target.value)}>
                                <option value="">Todos</option>
                                {empleados.map((e: any) => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos || ''}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button onClick={fetchRevisiones} className="bg-blue-600 hover:bg-blue-700 gap-2">
                            <RefreshCw className="w-4 h-4" /> Buscar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* TABLA */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400">Cargando...</div>
                            ) : revisiones.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                    <p>No hay revisiones para los filtros seleccionados.</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {revisiones.map((r: any) => {
                                        const { ok, total, pct } = getScore(r);
                                        const color = pct === 100 ? 'green' : pct >= 70 ? 'yellow' : 'red';
                                        return (
                                            <div key={r.id} onClick={() => setSelected(r)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === r.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-indigo-700 text-sm bg-indigo-50 px-2 py-0.5 rounded">{r.camion?.matricula}</span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${color === 'green' ? 'bg-green-100 text-green-700' : color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                        {ok}/{total} ✓
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-800">{r.empleado?.nombre} {r.empleado?.apellidos}</p>
                                                <p className="text-xs text-gray-400">{format(new Date(r.creadoEn), "d MMM yyyy 'a las' HH:mm", { locale: es })}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* DETALLE */}
                <div className="lg:col-span-3">
                    {selected ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <ClipboardCheck className="w-5 h-5 text-blue-600" />
                                        Detalle de la Revisión
                                    </span>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="flex items-center gap-1 text-indigo-700 font-bold"><Truck className="w-4 h-4" />{selected.camion?.matricula}</span>
                                        <span className="flex items-center gap-1 text-gray-600"><User className="w-4 h-4" />{selected.empleado?.nombre}</span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                    {ITEMS_META.map(item => (
                                        <div key={item.key} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${selected[item.key] ? 'bg-green-50' : 'bg-red-50'}`}>
                                            {selected[item.key]
                                                ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                                                : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                            }
                                            <span className={selected[item.key] ? 'text-green-800 font-medium' : 'text-red-600'}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                {selected.observaciones && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                        <p className="font-bold text-xs uppercase mb-1">Observaciones:</p>
                                        <p>{selected.observaciones}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 p-12">
                            <div className="text-center">
                                <ClipboardCheck className="w-16 h-16 mx-auto mb-3 text-gray-200" />
                                <p>Selecciona una revisión de la lista para ver el detalle</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
