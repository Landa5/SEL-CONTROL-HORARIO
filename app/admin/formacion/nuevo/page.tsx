'use client';

import React from 'react';
import ModuleEditor from '@/components/admin/ModuleEditor';
import { useRouter } from 'next/navigation';

export default function NuevoModuloPage() {
    const router = useRouter();

    const handleSave = async (data: any) => {
        try {
            const res = await fetch('/api/formacion/modulos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                router.push('/admin/formacion');
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'No se pudo crear el módulo'}`);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-black text-gray-900 uppercase">Crear Nuevo Módulo</h1>
                <p className="text-sm text-gray-500 font-medium">Define el contenido y la evaluación para la nueva formación.</p>
            </header>
            <ModuleEditor onSave={handleSave} />
        </div>
    );
}
