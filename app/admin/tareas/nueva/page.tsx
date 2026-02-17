'use client';

import React from 'react';
import TaskForm from '@/components/tareas/TaskForm';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NuevaTareaAdminPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get pre-filled data from URL
    const initialTipo = searchParams.get('tipo');
    const initialMatricula = searchParams.get('matricula');

    const initialData = {
        tipo: initialTipo || undefined,
        matricula: initialMatricula || undefined,
        activoTipo: initialMatricula ? 'CAMION' : undefined
    };

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" className="p-2" onClick={() => router.back()}>
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </Button>
                <div>
                    <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Nueva Tarea / Incidencia</h1>
                    <p className="text-gray-500 text-sm">Gestiona averías o crea tareas internas para el equipo.</p>
                </div>
            </div>

            <TaskForm
                rol="ADMIN"
                initialData={initialData}
                onSuccess={() => {
                    // unexpected error here if I just go back?
                    // Safe default: go to dashboard
                    router.push('/admin/tareas');
                }}
            />
        </div>
    );
}
