'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import TimelinePeopleView from '@/components/jornadas/TimelinePeopleView';
import TimelineView from '@/components/jornadas/TimelineView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import EditUsoCamionDialog from '@/components/jornadas/EditUsoCamionDialog';
import { Pencil } from 'lucide-react';
// ... rest of imports

function JornadasContent() {
    const [jornadas, setJornadas] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'list';

    useEffect(() => {
        fetchJornadas();
        fetchEmployees();
    }, [searchParams]);

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/empleados');
            if (res.ok) {
                const data = await res.json();
                setEmployees(data.filter((e: any) => e.activo));
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const fetchJornadas = async () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('admin', 'true');
        const res = await fetch(`/api/jornadas?${params.toString()}`);
        if (res.ok) setJornadas(await res.json());
    };

    const formatDuration = (hoursDecimal: number | null) => {
        if (!hoursDecimal) return '-';
        const hours = Math.floor(hoursDecimal);
        const minutes = Math.round((hoursDecimal - hours) * 60);
        return `${hours}h ${minutes}m`;
    };

    const groupedJornadas = jornadas.reduce((acc: any, jor) => {
        const dateKey = format(new Date(jor.fecha), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(jor);
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedJornadas).sort((a, b) => b.localeCompare(a));

    const [selectedJornada, setSelectedJornada] = useState<any>(null);
    const [editingUso, setEditingUso] = useState<any>(null);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'rol', direction: 'asc' });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortJornadas = (items: any[]) => {
        const sortedItems = [...items];
        sortedItems.sort((a, b) => {
            let aValue: any = '';
            let bValue: any = '';

            // Helper to sum usage data
            const sumUsage = (jor: any, field: string) =>
                jor.usosCamion?.reduce((acc: number, t: any) => acc + (t[field] || 0), 0) || 0;

            const sumKm = (jor: any) =>
                jor.usosCamion?.reduce((acc: number, t: any) => acc + ((t.kmFinal || t.kmInicial) - t.kmInicial), 0) || 0;

            const sumDescargas = (jor: any) =>
                jor.usosCamion?.reduce((acc: number, t: any) => acc + (t.descargasCount || t.descargas?.length || 0), 0) || 0;


            switch (sortConfig.key) {
                case 'empleado':
                    aValue = a.empleado?.nombre || '';
                    bValue = b.empleado?.nombre || '';
                    break;
                case 'rol':
                    // Custom Role Order
                    const roleOrder = ['ADMIN', 'OFICINA', 'JEFE_TRAFICO', 'CONDUCTOR', 'MECANICO'];
                    const roleA = a.empleado?.rol || 'OTROS';
                    const roleB = b.empleado?.rol || 'OTROS';

                    const idxA = roleOrder.indexOf(roleA);
                    const idxB = roleOrder.indexOf(roleB);

                    if (idxA !== idxB) {
                        // If roles are different, sort by role index
                        // direction logic is applied at the end usually, but for fixed role order 
                        // we might want it always consistent or follow sort direction.
                        // Let's follow sort direction for consistency.
                        aValue = idxA === -1 ? 999 : idxA;
                        bValue = idxB === -1 ? 999 : idxB;
                    } else {
                        // If roles SAME, sort by Name
                        return a.empleado?.nombre.localeCompare(b.empleado?.nombre);
                    }
                    break;
                case 'entrada':
                    aValue = new Date(a.horaEntrada).getTime();
                    bValue = new Date(b.horaEntrada).getTime();
                    break;
                case 'salida':
                    aValue = a.horaSalida ? new Date(a.horaSalida).getTime() : 0;
                    bValue = b.horaSalida ? new Date(b.horaSalida).getTime() : 0;
                    break;
                case 'total':
                    aValue = a.totalHoras || 0;
                    bValue = b.totalHoras || 0;
                    break;
                case 'km':
                    aValue = sumKm(a);
                    bValue = sumKm(b);
                    break;
                case 'descargas':
                    aValue = sumDescargas(a);
                    bValue = sumDescargas(b);
                    break;
                case 'viajes':
                    aValue = sumUsage(a, 'viajesCount');
                    bValue = sumUsage(b, 'viajesCount');
                    break;
                case 'repostajes':
                    aValue = sumUsage(a, 'litrosRepostados');
                    bValue = sumUsage(b, 'litrosRepostados');
                    break;
                case 'estado':
                    aValue = a.estado || '';
                    bValue = b.estado || '';
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sortedItems;
    };

    const handleSaveUso = async (id: number, data: any) => {
        try {
            const res = await fetch(`/api/usos-camion/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                await fetchJornadas();
                if (selectedJornada) {
                    const updatedRes = await fetch(`/api/jornadas?admin=true&${searchParams.toString()}`);
                    if (updatedRes.ok) {
                        const newJornadas = await updatedRes.json();
                        setJornadas(newJornadas);
                        const updatedSelected = newJornadas.find((j: any) => j.id === selectedJornada.id);
                        if (updatedSelected) setSelectedJornada(updatedSelected);
                    }
                }
            }
        } catch (error) {
            console.error("Error updating usage:", error);
        }
    };

    const exportCSV = () => {
        const headers = ['ID', 'Empleado', 'Fecha', 'Entrada', 'Salida', 'Duración', 'Descanso Previo', 'Estado', 'KM Totales', 'Total Descargas', 'Total Viajes', 'Total Repostajes'];

        // Pre-calculate rests for all jornadas
        const jornadasWithRest = calculateRestsForJornadas(jornadas);

        const rows = jornadasWithRest.flatMap(jor => {
            let kmTotal = 0;
            let countDescargas = 0;
            let countViajes = 0;
            let countRepostajes = 0;

            jor.usosCamion.forEach((t: any) => {
                if (t.kmFinal) kmTotal += (parseInt(t.kmFinal) - parseInt(t.kmInicial));
                countDescargas += t.descargasCount || t.descargas.length || 0;
                countViajes += t.viajesCount || 0;
                countRepostajes += t.litrosRepostados || 0;
            });

            return [
                jor.id,
                jor.empleado.nombre,
                format(new Date(jor.fecha), 'yyyy-MM-dd'),
                format(new Date(jor.horaEntrada), 'HH:mm'),
                jor.horaSalida ? format(new Date(jor.horaSalida), 'HH:mm') : 'En curso',
                formatDuration(jor.totalHoras),
                jor.descansoPrevio ? formatDuration(jor.descansoPrevio) : '-',
                jor.estado,
                kmTotal,
                countDescargas,
                countViajes,
                countRepostajes
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "informe_jornadas.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper to calculate rest across the entire dataset
    const calculateRestsForJornadas = (items: any[]) => {
        // 1. Flatten and Group by Employee + Date
        const grouped: Record<string, any[]> = {};

        items.forEach(j => {
            const key = `${j.empleado.id}-${format(new Date(j.fecha), 'yyyy-MM-dd')}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(j);
        });

        // 2. Sort and Calculate Gaps
        const result: any[] = [];
        Object.values(grouped).forEach(dayShifts => {
            dayShifts.sort((a, b) => new Date(a.horaEntrada).getTime() - new Date(b.horaEntrada).getTime());

            dayShifts.forEach((shift, idx) => {
                let descansoPrevio = null; // Hours
                if (idx > 0) {
                    const prev = dayShifts[idx - 1];
                    if (prev.horaSalida) {
                        const diffMs = new Date(shift.horaEntrada).getTime() - new Date(prev.horaSalida).getTime();
                        descansoPrevio = diffMs / (1000 * 60 * 60); // Convert to hours
                    }
                }
                result.push({ ...shift, descansoPrevio });
            });
        });

        return result;
    };

    // Helper for rendering Sort Arrow
    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig.key !== column) return <span className="text-gray-300 ml-1 text-[10px]">⇅</span>;
        return <span className="text-blue-600 ml-1 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Informes de Jornada</h1>
                    <p className="text-gray-500 text-sm">Registro histórico detallado de actividad y kilómetros.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportCSV} variant="secondary" className="gap-2 shadow-sm font-bold bg-gray-900 text-white hover:bg-gray-800">
                        <Download className="w-4 h-4" /> EXPORTAR CSV
                    </Button>
                </div>
            </div>

            <Tabs defaultValue={currentTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-lg bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger
                        value="list"
                        onClick={() => window.history.pushState(null, '', `?tab=list`)}
                        className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold uppercase text-xs"
                    >
                        Listado (Tabla)
                    </TabsTrigger>
                    <TabsTrigger
                        value="rutas"
                        onClick={() => window.history.pushState(null, '', `?tab=rutas`)}
                        className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold uppercase text-xs"
                    >
                        Rutas (Camiones)
                    </TabsTrigger>
                    <TabsTrigger
                        value="personal"
                        onClick={() => window.history.pushState(null, '', `?tab=personal`)}
                        className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold uppercase text-xs"
                    >
                        Cronograma (Personal)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-8 mt-6">
                    {sortedDates.length === 0 ? (
                        <Card><CardContent className="p-12 text-center text-gray-400 italic">No hay registros para mostrar</CardContent></Card>
                    ) : sortedDates.map(date => (
                        <div key={date} className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                                <h3 className="font-black text-gray-900 uppercase tracking-tighter">
                                    {format(new Date(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                                </h3>
                            </div>
                            <Card className="shadow-sm border-0 overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b bg-gray-50/50">
                                                    <th className="p-4 font-bold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('rol')}>
                                                        Empleado <SortIcon column="rol" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('entrada')}>
                                                        Entrada <SortIcon column="entrada" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('salida')}>
                                                        Salida <SortIcon column="salida" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('total')}>
                                                        Total <SortIcon column="total" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center text-orange-600">
                                                        Descanso
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center text-indigo-600 cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('km')}>
                                                        KM <SortIcon column="km" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('descargas')}>
                                                        Descargas <SortIcon column="descargas" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('viajes')}>
                                                        Viajes <SortIcon column="viajes" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('repostajes')}>
                                                        Repostajes <SortIcon column="repostajes" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('estado')}>
                                                        Estado <SortIcon column="estado" />
                                                    </th>
                                                    <th className="p-4 font-bold text-gray-600 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    // 1. Get raw items for this day
                                                    const rawItems = groupedJornadas[date] || [];

                                                    // 2. Calculate rests (needs time sorting for logic, but we apply it to items)
                                                    // We create a map of ID -> rest for quick lookup, or just enrich.
                                                    // Since we need to calculate rests relative to *time*, let's sort by time first to compute, then apply usage sort.

                                                    const timeSorted = [...rawItems].sort((a: any, b: any) => new Date(a.horaEntrada).getTime() - new Date(b.horaEntrada).getTime());
                                                    const restsMap = new Map<number, number>(); // ID -> Rest Hours

                                                    // Group by employee to check their previous shift
                                                    const empShifts: Record<string, any[]> = {};
                                                    timeSorted.forEach(j => {
                                                        if (!j.empleado) return;
                                                        const eid = j.empleado.id;
                                                        if (!empShifts[eid]) empShifts[eid] = [];
                                                        empShifts[eid].push(j);
                                                    });

                                                    Object.values(empShifts).forEach(shifts => {
                                                        shifts.forEach((s, idx) => {
                                                            if (idx > 0) {
                                                                const prev = shifts[idx - 1];
                                                                if (prev.horaSalida) {
                                                                    const diff = new Date(s.horaEntrada).getTime() - new Date(prev.horaSalida).getTime();
                                                                    restsMap.set(s.id, diff / (1000 * 60 * 60));
                                                                }
                                                            }
                                                        });
                                                    });

                                                    // 3. Now apply the User's Sort preferences
                                                    const sortedAndEnriched = sortJornadas(rawItems).map(j => ({ ...j, descansoPrevio: restsMap.get(j.id) }));

                                                    return sortedAndEnriched.map((jor: any) => {
                                                        const totalKm = jor.usosCamion?.reduce((acc: number, t: any) => acc + ((t.kmFinal || t.kmInicial) - t.kmInicial), 0) || 0;
                                                        const totalDescargas = jor.usosCamion?.reduce((acc: number, t: any) => acc + (t.descargasCount || t.descargas?.length || 0), 0) || 0;
                                                        const totalViajes = jor.usosCamion?.reduce((acc: number, t: any) => acc + (t.viajesCount || 0), 0) || 0;
                                                        const totalRepostajes = jor.usosCamion?.reduce((acc: number, t: any) => acc + (t.litrosRepostados || 0), 0) || 0;

                                                        return (
                                                            <tr key={jor.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase
                                                                        ${jor.empleado?.rol === 'CONDUCTOR' ? 'bg-blue-100 text-blue-700' :
                                                                                jor.empleado?.rol === 'MECANICO' ? 'bg-orange-100 text-orange-700' :
                                                                                    'bg-gray-100 text-gray-700'}
                                                                    `}>
                                                                            {jor.empleado?.nombre?.charAt(0) || '?'}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-bold text-gray-900">{jor.empleado?.nombre}</div>
                                                                            <div className="text-[10px] text-gray-400 font-bold tracking-wider">{jor.empleado?.rol || 'OTROS'}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-center font-mono text-gray-600">
                                                                    <span className="bg-gray-100 px-2 py-1 rounded">{format(new Date(jor.horaEntrada), 'HH:mm')}</span>
                                                                </td>
                                                                <td className="p-4 text-center font-mono text-gray-500">
                                                                    <span className="bg-gray-100 px-2 py-1 rounded">{jor.horaSalida ? format(new Date(jor.horaSalida), 'HH:mm') : '--:--'}</span>
                                                                </td>
                                                                <td className="p-4 font-bold text-blue-700 text-center">
                                                                    {formatDuration(jor.totalHoras)}
                                                                </td>
                                                                <td className="p-4 font-bold text-orange-600 text-center text-xs">
                                                                    {jor.descansoPrevio ? formatDuration(jor.descansoPrevio) : '-'}
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className="font-black text-indigo-600">{totalKm} km</span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className="bg-orange-50 text-orange-700 font-bold px-2 py-1 rounded text-xs">
                                                                        {totalDescargas}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className="bg-green-50 text-green-700 font-bold px-2 py-1 rounded text-xs">
                                                                        {totalViajes}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className="bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded text-xs">
                                                                        {totalRepostajes} L
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${jor.estado === 'CERRADA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {jor.estado}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <Button onClick={() => setSelectedJornada(jor)} variant="outline" size="sm" className="h-7 text-xs">
                                                                        Detalles
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value="rutas" className="space-y-6 mt-6">
                    {sortedDates.length === 0 ? (
                        <div className="text-center p-12 text-gray-400">No hay datos de rutas para mostrar</div>
                    ) : (
                        sortedDates.map(date => (
                            <TimelineView key={date} date={date} jornadas={groupedJornadas[date]} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="personal" className="space-y-6 mt-6">
                    {sortedDates.length === 0 ? (
                        <div className="text-center p-12 text-gray-400">No hay datos de personal para mostrar</div>
                    ) : (
                        sortedDates.map(date => (
                            <TimelinePeopleView key={date} date={date} jornadas={groupedJornadas[date]} employees={employees} />
                        ))
                    )}
                </TabsContent>
            </Tabs>

            {/* DETAIL DIALOG */}
            {
                selectedJornada && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJornada(null)}>
                        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <div>
                                    <h2 className="text-xl font-black text-gray-900">Detalle de Jornada</h2>
                                    <p className="text-sm text-gray-600">{selectedJornada.empleado?.nombre} • {format(new Date(selectedJornada.fecha), "dd 'de' MMMM", { locale: es })}</p>
                                </div>
                                <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400" onClick={() => setSelectedJornada(null)}>X</Button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                                        <p className="text-xs text-blue-600 font-bold uppercase">Total Horas</p>
                                        <p className="text-xl font-black text-blue-900">{formatDuration(selectedJornada.totalHoras)}</p>
                                    </div>
                                    <div className="bg-indigo-50 p-4 rounded-lg text-center">
                                        <p className="text-xs text-indigo-600 font-bold uppercase">Total KM</p>
                                        <p className="text-xl font-black text-indigo-900">
                                            {selectedJornada.usosCamion?.reduce((acc: number, t: any) => acc + ((t.kmFinal || t.kmInicial) - t.kmInicial), 0)} km
                                        </p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg text-center">
                                        <p className="text-xs text-green-600 font-bold uppercase">Viajes/Desc.</p>
                                        <p className="text-xl font-black text-green-900">
                                            {selectedJornada.usosCamion?.reduce((acc: number, t: any) => acc + (t.viajesCount || 0), 0)} / {selectedJornada.usosCamion?.reduce((acc: number, t: any) => acc + (t.descargasCount || t.descargas?.length || 0), 0)}
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <p className="text-xs text-purple-600 font-bold uppercase">Total Repostado</p>
                                        <p className="text-xl font-black text-purple-900">
                                            {selectedJornada.usosCamion?.reduce((acc: number, t: any) => acc + (t.litrosRepostados || 0), 0)} L
                                        </p>
                                    </div>
                                </div>

                                {/* Truck Usage Timeline */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-gray-900 rounded-full"></div>
                                        Desglose por Camión
                                    </h3>
                                    <div className="space-y-4">
                                        {selectedJornada.usosCamion.map((uso: any, index: number) => {
                                            const kmRecorridos = (uso.kmFinal || uso.kmInicial) - uso.kmInicial;

                                            return (
                                                <div key={uso.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 group-hover:scale-100 transition-transform origin-top-right">
                                                        {/* Truck Icon Watermark */}
                                                    </div>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-lg font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{uso.camion?.matricula} {uso.camion?.modelo ? `(${uso.camion.modelo})` : ''}</span>
                                                                <span className="text-xs text-gray-400 font-mono">#{uso.id}</span>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => setEditingUso(uso)}
                                                                    className="h-7 px-3 bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs gap-2"
                                                                >
                                                                    <Pencil className="w-3 h-3" /> EDITAR
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{format(new Date(uso.horaInicio), 'HH:mm')}</span>
                                                                <span>➔</span>
                                                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{uso.horaFin ? format(new Date(uso.horaFin), 'HH:mm') : 'En curso'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-bold text-gray-400 uppercase">Kilometraje</p>
                                                            <div className="font-mono text-sm text-gray-700">
                                                                {uso.kmInicial} ➔ {uso.kmFinal || '...'}
                                                            </div>
                                                            <p className="font-black text-indigo-600 text-lg">
                                                                {kmRecorridos} km
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 text-sm border-t pt-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-gray-400">Descargas</span>
                                                            <span className="font-bold">{uso.descargasCount || uso.descargas?.length || 0}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-gray-400">Viajes</span>
                                                            <span className="font-bold">{uso.viajesCount || 0}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-gray-400">Repostado</span>
                                                            <span className="font-bold">{uso.litrosRepostados || 0} L</span>
                                                        </div>
                                                    </div>

                                                    {uso.fotoKmInicial && (
                                                        <div className="mt-3 pt-3 border-t">
                                                            <p className="text-xs font-bold text-red-500 mb-1">Evidencia de Conflicto:</p>
                                                            <img src={uso.fotoKmInicial} alt="Inconsistencia KM" className="h-20 rounded border cursor-pointer hover:scale-110 transition-transform" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {selectedJornada.observaciones && (
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                        <h4 className="font-bold text-yellow-800 text-sm mb-1 uppercase">Observaciones</h4>
                                        <p className="text-sm text-yellow-700 italic">"{selectedJornada.observaciones}"</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end">
                                <Button onClick={() => setSelectedJornada(null)}>Cerrar</Button>
                            </div>
                        </div>
                    </div>
                )
            }

            <EditUsoCamionDialog
                open={!!editingUso}
                onOpenChange={(open) => !open && setEditingUso(null)}
                usage={editingUso}
                onSave={handleSaveUso}
            />
        </div >
    );
}

export default function AdminJornadas() {
    return (
        <Suspense fallback={
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        }>
            <JornadasContent />
        </Suspense>
    );
}
