'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Wrench, Truck, User, Filter, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function MantenimientosConductorPage() {
    const [registros, setRegistros] = useState<any[]>([]);
    const [camiones, setCamiones] = useState<any[]>([]);
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [filtroCamion, setFiltroCamion] = useState('');
    const [filtroEmpleado, setFiltroEmpleado] = useState('');
    const [filtroDesde, setFiltroDesde] = useState('');
    const [filtroHasta, setFiltroHasta] = useState('');

    const fetchRegistros = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filtroCamion) params.set('camionId', filtroCamion);
        if (filtroEmpleado) params.set('empleadoId', filtroEmpleado);
        if (filtroDesde) params.set('desde', filtroDesde);
        if (filtroHasta) params.set('hasta', filtroHasta);

        const res = await fetch(`/api/admin/mantenimientos-conductor?${params.toString()}`);
        if (res.ok) setRegistros(await res.json());
        setLoading(false);
    };

    useEffect(() => {
        fetch('/api/camiones').then(r => r.json()).then(setCamiones);
        fetch('/api/empleados').then(r => r.json()).then((data) => {
            const conductores = Array.isArray(data)
                ? data.filter((e: any) => ['CONDUCTOR', 'MECANICO'].includes(e.rol))
                : [];
            setEmpleados(conductores);
        });
        fetchRegistros();
    }, []);

    const getResumen = (r: any) => {
        const items = [];
        if (r.aceite) items.push(`🛢️ Aceite${r.litrosAceite ? ` (${r.litrosAceite}L)` : ''}`);
        if (r.hidraulico) items.push('⚙️ Hidráulico');
        if (r.refrigerante) items.push('🌡️ Refrigerante');
        if (r.lavado) items.push('🚿 Lavado');
        if (r.otroProducto) items.push(`📝 ${r.otroProducto}`);
        return items;
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* CABECERA */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Wrench className="w-7 h-7 text-purple-600" />
                        Mantenimientos Registrados por Conductores
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Registro de aceite, hidráulico, refrigerante, lavados y otras acciones realizadas en cada turno.
                    </p>
                </div>
            </div>

            {/* FILTROS */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
                        <Filter className="w-4 h-4" /> Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Camión</label>
                            <select
                                className="w-full p-2 border rounded-lg text-sm"
                                value={filtroCamion}
                                onChange={e => setFiltroCamion(e.target.value)}
                            >
                                <option value="">Todos</option>
                                {camiones.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.matricula}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Conductor</label>
                            <select
                                className="w-full p-2 border rounded-lg text-sm"
                                value={filtroEmpleado}
                                onChange={e => setFiltroEmpleado(e.target.value)}
                            >
                                <option value="">Todos</option>
                                {empleados.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.nombre} {e.apellidos || ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Desde</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-lg text-sm"
                                value={filtroDesde}
                                onChange={e => setFiltroDesde(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Hasta</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-lg text-sm"
                                value={filtroHasta}
                                onChange={e => setFiltroHasta(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button onClick={fetchRegistros} className="bg-purple-600 hover:bg-purple-700 gap-2">
                            <RefreshCw className="w-4 h-4" /> Buscar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* RESULTADOS */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Cargando...</div>
                    ) : registros.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No hay registros de mantenimiento con los filtros seleccionados.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-3 font-bold text-gray-600">Fecha</th>
                                        <th className="text-left p-3 font-bold text-gray-600">
                                            <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Camión</span>
                                        </th>
                                        <th className="text-left p-3 font-bold text-gray-600">
                                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> Conductor</span>
                                        </th>
                                        <th className="text-left p-3 font-bold text-gray-600">Acciones realizadas</th>
                                        <th className="text-left p-3 font-bold text-gray-600">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registros.map((r: any) => {
                                        const items = getResumen(r);
                                        return (
                                            <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                                                <td className="p-3 whitespace-nowrap">
                                                    <p className="font-bold text-gray-800">
                                                        {format(new Date(r.creadoEn), 'dd/MM/yyyy', { locale: es })}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {format(new Date(r.creadoEn), 'HH:mm')}
                                                    </p>
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                                        {r.usoCamion?.camion?.matricula || '—'}
                                                    </span>
                                                    {r.usoCamion?.camion?.marca && (
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {r.usoCamion.camion.marca} {r.usoCamion.camion.modelo}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <p className="font-medium text-gray-800">
                                                        {r.empleado?.nombre} {r.empleado?.apellidos || ''}
                                                    </p>
                                                </td>
                                                <td className="p-3">
                                                    {items.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {items.map((item, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                                                                >
                                                                    {item}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">Sin acciones</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-gray-600 text-xs max-w-xs">
                                                    {r.observaciones || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="p-3 bg-gray-50 border-t text-xs text-gray-400 text-right">
                                {registros.length} registro{registros.length !== 1 ? 's' : ''} encontrado{registros.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
