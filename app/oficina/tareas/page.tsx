'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';
import { LayoutDashboard, Clock, Calendar, FileText, Users, Truck, AlertCircle } from 'lucide-react';
import TaskDashboard from '@/components/tareas/TaskDashboard';

export default function OficinaTareasPage() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [hasActiveJornada, setHasActiveJornada] = useState(true);

    useEffect(() => {
        fetch('/api/auth/session').then(res => res.json()).then(data => setSession(data));
        fetchJornada();
    }, []);

    const fetchJornada = async () => {
        try {
            const res = await fetch(`/api/jornadas?date=${new Date().toISOString()}`);
            if (res.ok) {
                const data = await res.json();
                setHasActiveJornada(!!data && !data.horaSalida);
            }
        } catch (e) { console.error(e); }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const navItems = [
        { id: 'summary', label: 'Panel Oficina', icon: LayoutDashboard },
        { id: 'jornada', label: 'Mi Control de Días', icon: Clock, badgeCount: !hasActiveJornada ? 1 : 0 },
        { id: 'vacaciones', label: 'Mis Vacaciones', icon: Calendar },
        { id: 'historial-personal', label: 'Mi Historial', icon: FileText },
        { id: 'conductores', label: 'Días Conductores', icon: Users },
        { id: 'camiones', label: 'Gestionar Camiones', icon: Truck },
        { id: 'taller', label: 'Averías / Taller', icon: AlertCircle }
    ];

    if (!session) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando gestión técnica...</div>;

    return (
        <MainDashboardLayout
            title="Gestión Técnica y Taller"
            userName="Oficina"
            roleLabel="Gestión Operativa"
            navItems={navItems}
            activeSection="taller"
            onNavigate={(id) => {
                if (id === 'summary') router.push('/oficina/dashboard');
                else if (id === 'jornada') router.push('/oficina/dashboard');
                else if (id === 'vacaciones') router.push('/oficina/dashboard');
                else if (id === 'historial-personal') router.push('/oficina/jornadas');
                else if (id === 'conductores') router.push('/oficina/jornadas?admin=true');
                else if (id === 'camiones') router.push('/oficina/camiones');
                else if (id === 'taller') router.push('/oficina/tareas');
            }}
            onLogout={handleLogout}
        >
            <div className="space-y-6">
                <header>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Incidencias y Tareas</h1>
                    <p className="text-sm text-gray-500 mt-1">Control de averías mecánicas y gestión de activos.</p>
                </header>

                <TaskDashboard rol={session.rol} userId={Number(session.id)} />
            </div>
        </MainDashboardLayout>
    );
}
