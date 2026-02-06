'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Download, Clock, Truck, Users, LayoutDashboard, Calendar, AlertCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';

export default function OficinaJornadasPage() {
    const [jornadas, setJornadas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const isAdminView = searchParams.get('admin') === 'true';

    const [numTareas, setNumTareas] = useState(0);
    const [hasActiveJornada, setHasActiveJornada] = useState(true);

    useEffect(() => {
        fetchSession();
        fetchJornadas();
        fetchStats();
    }, [searchParams]);

    const fetchSession = async () => {
        const res = await fetch('/api/auth/session');
        if (res.ok) setSession(await res.json());
    };

    const fetchJornadas = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(searchParams.toString());
            const res = await fetch(`/api/jornadas?${params.toString()}`);
            if (res.ok) setJornadas(await res.json());
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const [tRes, jRes] = await Promise.all([
                fetch('/api/tareas?estado=ABIERTA'),
                fetch(`/api/jornadas?date=${new Date().toISOString()}`)
            ]);
            if (tRes.ok) setNumTareas((await tRes.json()).length);
            if (jRes.ok) {
                const jData = await jRes.json();
                setHasActiveJornada(!!jData && !jData.horaSalida);
            }
        } catch (e) { console.error(e); }
    };

    const navItems = [
        { id: 'summary', label: 'Panel Oficina', icon: LayoutDashboard },
        { id: 'jornada', label: 'Mi Control de Días', icon: Clock, badgeCount: !hasActiveJornada ? 1 : 0 },
        { id: 'vacaciones', label: 'Mis Vacaciones', icon: Calendar },
        { id: 'historial-personal', label: 'Mi Historial', icon: FileText },
        { id: 'conductores', label: 'Días Conductores', icon: Users },
        { id: 'camiones', label: 'Gestionar Camiones', icon: Truck },
        { id: 'taller', label: 'Averías / Taller', icon: AlertCircle, badgeCount: numTareas }
    ];

    const canSeeDetails = session?.rol === 'ADMIN';

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

    return (
        <MainDashboardLayout
            title={isAdminView ? 'Historial de Días (Conductores)' : 'Mi Historial de Días'}
            userName={session?.nombre || 'Usuario'}
            roleLabel="Gestión Logística"
            navItems={navItems}
            activeSection={isAdminView ? 'conductores' : 'historial-personal'}
            onNavigate={(id) => {
                if (id === 'summary') router.push('/oficina/dashboard');
                else if (id === 'jornada') router.push('/oficina/dashboard');
                else if (id === 'vacaciones') router.push('/oficina/dashboard');
                else if (id === 'historial-personal') router.push('/oficina/jornadas');
                else if (id === 'conductores') router.push('/oficina/jornadas?admin=true');
                else if (id === 'camiones') router.push('/oficina/camiones');
                else if (id === 'taller') router.push('/oficina/tareas');
            }}
            onLogout={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
            }}
        >
            <div className="space-y-6">
                <header className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isAdminView ? 'Historial de Días (Conductores)' : 'Mi Historial de Días'}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {isAdminView ? 'Registro detallado de actividad de la flota.' : 'Tu registro histórico de entradas y salidas.'}
                        </p>
                    </div>
                </header>

                <Card className="shadow-sm border-0">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">Cargando registros...</div>
                        ) : sortedDates.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 italic font-medium">No hay actividad registrada para este periodo.</div>
                        ) : (
                            <div className="space-y-8 p-4">
                                {sortedDates.map(date => (
                                    <div key={date} className="space-y-3">
                                        <div className="flex items-center gap-2 px-2">
                                            <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
                                            <h3 className="font-bold text-gray-900 uppercase tracking-tighter">
                                                {format(new Date(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead>
                                                    <tr className="border-b bg-gray-50/50">
                                                        {isAdminView && <th className="p-4 font-bold text-gray-600">Empleado</th>}
                                                        <th className="p-4 font-bold text-gray-600 text-center">Entrada</th>
                                                        <th className="p-4 font-bold text-gray-600 text-center">Salida</th>
                                                        {canSeeDetails && <th className="p-4 font-bold text-gray-600 text-center">Total Horas</th>}
                                                        <th className="p-4 font-bold text-gray-600 text-center">Estado</th>
                                                        {canSeeDetails && <th className="p-4 font-bold text-gray-600 text-center">KM</th>}
                                                        {canSeeDetails && <th className="p-4 font-bold text-gray-600 text-center">Descargas</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupedJornadas[date].map((jor: any) => {
                                                        const totalKm = jor.usosCamion?.reduce((acc: number, t: any) => acc + ((t.kmFinal || t.kmInicial) - t.kmInicial), 0) || 0;
                                                        return (
                                                            <tr key={jor.id} className="border-b last:border-0 hover:bg-blue-50/20 transition-colors">
                                                                {isAdminView && (
                                                                    <td className="p-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                                                                {jor.empleado?.nombre?.charAt(0) || '?'}
                                                                            </div>
                                                                            <span className="font-bold text-gray-900">{jor.empleado?.nombre || 'Desconocido'}</span>
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                <td className="p-4 text-center font-mono">
                                                                    <span className="bg-gray-100 px-2 py-1 rounded">{format(new Date(jor.horaEntrada), 'HH:mm')}</span>
                                                                </td>
                                                                <td className="p-4 text-center font-mono text-gray-500">
                                                                    <span className="bg-gray-100 px-2 py-1 rounded">{jor.horaSalida ? format(new Date(jor.horaSalida), 'HH:mm') : '--:--'}</span>
                                                                </td>
                                                                {canSeeDetails && (
                                                                    <td className="p-4 font-bold text-blue-700 text-center">
                                                                        {formatDuration(jor.totalHoras)}
                                                                    </td>
                                                                )}
                                                                <td className="p-4 text-center">
                                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${jor.estado === 'CERRADA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 animate-pulse'}`}>
                                                                        {jor.estado === 'CERRADA' ? 'CERRADO' : 'ACTIVO'}
                                                                    </span>
                                                                </td>
                                                                {canSeeDetails && (
                                                                    <td className="p-4 text-center font-bold text-indigo-600">
                                                                        {totalKm > 0 ? `${totalKm} km` : '-'}
                                                                    </td>
                                                                )}
                                                                {canSeeDetails && (
                                                                    <td className="p-4 text-center">
                                                                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded text-xs">
                                                                            {jor.usosCamion?.reduce((acc: number, t: any) => acc + (t.descargas?.length || 0), 0) || 0}
                                                                        </span>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainDashboardLayout>
    );
}
