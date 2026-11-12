'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TaskDashboard from '@/components/tareas/TaskDashboard';
import { Wrench, ClipboardCheck, Package, Truck } from 'lucide-react';

export default function AdminTareasPage() {
    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => setSession(data));
    }, []);

    if (!session) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando Centro de Taller e Incidencias...</div>;
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border shadow-2xs">
                <div>
                    <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tight">
                        Taller, Mantenimiento e Incidencias
                    </h1>
                    <p className="text-sm text-gray-500">
                        Gestión unificada de averías, partes de conductores, revisiones de accesorios y recambios.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/admin/camiones/mantenimientos-conductor"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
                    >
                        <Wrench className="w-3.5 h-3.5 text-blue-600" />
                        Mant. Conductores (Aceite/Lavado)
                    </Link>
                    <Link
                        href="/admin/camiones/revisiones-accesorios"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
                    >
                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Revisión Accesorios
                    </Link>
                    <Link
                        href="/admin/inventario"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
                    >
                        <Package className="w-3.5 h-3.5 text-amber-600" />
                        Inventario de Taller
                    </Link>
                    <Link
                        href="/admin/camiones"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
                    >
                        <Truck className="w-3.5 h-3.5 text-indigo-600" />
                        Flota (360°)
                    </Link>
                </div>
            </header>
            <TaskDashboard rol={session.rol} userId={Number(session.id)} />
        </div>
    );
}
