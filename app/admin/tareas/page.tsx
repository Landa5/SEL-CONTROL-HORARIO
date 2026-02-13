'use client';

import { useState, useEffect } from 'react';
import TaskDashboard from '@/components/tareas/TaskDashboard';

export default function AdminTareasPage() {
    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        fetch('/api/auth/session').then(res => res.json()).then(data => setSession(data));
    }, []);

    if (!session) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando Centro de Tareas...</div>;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Centro de Tareas</h1>
                <p className="text-gray-500">Gestión global de incidencias y mantenimiento.</p>
            </header>
            <TaskDashboard rol={session.rol} userId={Number(session.id)} />
        </div>
    );
}
