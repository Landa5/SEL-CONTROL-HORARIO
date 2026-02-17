'use client';

import React, { Suspense } from 'react';
import TaskForm from '@/components/tareas/TaskForm';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function NuevaIncidenciaContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const proyectoId = searchParams.get('proyectoId');

    const initialData = proyectoId ? { proyectoId } : undefined;

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" className="p-2" onClick={() => router.back()}>
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                </Button>
                <div>
                    <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Nueva Incidencia</h1>
                    <p className="text-gray-500 text-sm">Reporta una avería o problema técnico para el taller.</p>
                </div>
            </div>

            <TaskForm
                rol="CONDUCTOR" // Or detect actual role, but safe default for restrictions
                initialData={initialData}
                onSuccess={() => {
                    // Redirect back to projects if we came from there
                    if (proyectoId) {
                        router.back();
                    } else {
                        router.push('/empleado'); // or /mecanico/tareas if mechanic
                    }
                }}
            />
        </div>
    );
}

export default function NuevaIncidenciaPage() {
    return (
        <Suspense fallback={<div>Cargando form...</div>}>
            <NuevaIncidenciaContent />
        </Suspense>
    );
}
