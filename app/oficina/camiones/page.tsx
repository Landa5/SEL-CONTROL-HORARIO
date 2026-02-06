'use client';

import { useRouter } from 'next/navigation';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';
import AdminCamiones from '@/app/admin/camiones/page';
import { LayoutDashboard, Clock, Calendar, Truck, AlertCircle, Users, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function OficinaCamionesPage() {
    const router = useRouter();
    const [numTareas, setNumTareas] = useState(0);
    const [hasActiveJornada, setHasActiveJornada] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
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
        fetchData();
    }, []);

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
        { id: 'taller', label: 'Averías / Taller', icon: AlertCircle, badgeCount: numTareas }
    ];

    return (
        <MainDashboardLayout
            title="Gestión de Flota"
            userName="Oficina"
            roleLabel="Gestión Logística"
            navItems={navItems}
            activeSection="camiones"
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
            <AdminCamiones />
        </MainDashboardLayout>
    );
}
