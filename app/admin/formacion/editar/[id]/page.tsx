'use client';

import React, { useState, useEffect } from 'react';
import ModuleEditor from '@/components/admin/ModuleEditor';
import { useRouter, useParams } from 'next/navigation';

export default function EditarModuloPage() {
    const router = useRouter();
    const { id } = useParams();
    const [modulo, setModulo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchModulo = async () => {
            try {
                const res = await fetch(`/api/formacion/modulos/${id}`);
                if (res.ok) {
                    setModulo(await res.json());
                }
            } catch (error) {
                console.error('Error fetching module:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchModulo();
    }, [id]);

    const handleSave = async (data: any) => {
        try {
            const res = await fetch(`/api/formacion/modulos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                router.push('/admin/formacion');
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'No se pudo actualizar el módulo'}`);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando módulo...</div>;
    if (!modulo) return <div className="p-8 text-center text-red-500">Módulo no encontrado</div>;

    // Check if questions can be edited based on existing results length
    const canEditQuestions = modulo.resultados?.length === 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-black text-gray-900 uppercase">Editar Módulo: {modulo.titulo}</h1>
                <p className="text-sm text-gray-500 font-medium tracking-tight">Modifica el contenido o la configuración del curso actual.</p>
            </header>
            <ModuleEditor
                initialData={modulo}
                onSave={handleSave}
                isAdminEditingQuestions={canEditQuestions}
            />
        </div>
    );
}
