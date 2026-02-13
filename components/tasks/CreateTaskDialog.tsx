'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

export default function CreateTaskDialog({ onTaskCreated }: { onTaskCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [camiones, setCamiones] = useState<any[]>([]);

    // Form State
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [tipo, setTipo] = useState('OPERATIVA');
    const [prioridad, setPrioridad] = useState('MEDIA');
    const [fechaLimite, setFechaLimite] = useState('');
    const [activoTipo, setActivoTipo] = useState('OTRO');
    const [matricula, setMatricula] = useState('');
    const [proyectoId, setProyectoId] = useState('');
    const [asignadoAId, setAsignadoAId] = useState('');

    // Fetch data when dialog opens
    const fetchData = async () => {
        try {
            const [resProjects, resEmployees, resCamiones] = await Promise.all([
                fetch('/api/proyectos'),
                fetch('/api/empleados?activo=true'),
                fetch('/api/camiones')
            ]);

            if (resProjects.ok) setProjects(await resProjects.json());
            if (resEmployees.ok) setEmployees(await resEmployees.json());
            if (resCamiones.ok) setCamiones(await resCamiones.json());
        } catch (error) {
            console.error('Error loading data', error);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            fetchData();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (activoTipo === 'CAMION' && !matricula) {
            alert('Debes seleccionar una matrícula para tareas de Camión');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/tareas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo,
                    descripcion,
                    tipo,
                    prioridad,
                    fechaLimite: fechaLimite || null,
                    activoTipo,
                    matricula: activoTipo === 'CAMION' ? matricula : undefined,
                    proyectoId: proyectoId || undefined,
                    asignadoAId: asignadoAId || undefined
                })
            });

            if (res.ok) {
                setOpen(false);
                onTaskCreated();
                // Reset form
                setTitulo('');
                setDescripcion('');
                setProyectoId('');
                setAsignadoAId('');
                setMatricula('');
                setActivoTipo('OTRO');
                setFechaLimite('');
            } else {
                const err = await res.json();
                alert(err.error || 'Error al crear la tarea');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Nueva Tarea
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear Nueva Tarea</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Título</label>
                        <input
                            required
                            className="w-full p-2 border rounded-md"
                            placeholder="Ej: Revisión mensual..."
                            value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="text-sm font-medium">Tipo</label>
                        <select className="w-full p-2 border rounded-md" value={tipo} onChange={e => setTipo(e.target.value)}>
                            <option value="OPERATIVA">Operativa</option>
                            <option value="AVERIA">Avería</option>
                            <option value="MANTENIMIENTO">Mantenimiento</option>
                            <option value="ADMINISTRATIVA">Administrativa</option>
                            <option value="RECURRENTE">Recurrente</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Prioridad</label>
                        <select className="w-full p-2 border rounded-md" value={prioridad} onChange={e => setPrioridad(e.target.value)}>
                            <option value="URGENTE">Urgente</option>
                            <option value="ALTA">Alta</option>
                            <option value="MEDIA">Media</option>
                            <option value="BAJA">Baja</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Activo / Contexto</label>
                        <select className="w-full p-2 border rounded-md" value={activoTipo} onChange={e => setActivoTipo(e.target.value)}>
                            <option value="OTRO">Otro</option>
                            <option value="CAMION">Camión</option>
                            <option value="DEPOSITO_CLIENTE">Cliente</option>
                            <option value="BASE">Base</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Asignar a (Opcional)</label>
                        <select className="w-full p-2 border rounded-md" value={asignadoAId} onChange={e => setAsignadoAId(e.target.value)}>
                            <option value="">Sin Asignar</option>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {activoTipo === 'CAMION' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-sm font-medium">Matrícula</label>
                        <select
                            required
                            className="w-full p-2 border rounded-md"
                            value={matricula}
                            onChange={e => setMatricula(e.target.value)}
                        >
                            <option value="">Seleccionar Camión...</option>
                            {camiones.map(c => (
                                <option key={c.id} value={c.matricula}>{c.matricula} - {c.modelo}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium">Proyecto (Opcional)</label>
                    <select className="w-full p-2 border rounded-md" value={proyectoId} onChange={e => setProyectoId(e.target.value)}>
                        <option value="">Sin Proyecto</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha Límite</label>
                    <input
                        type="date"
                        className="w-full p-2 border rounded-md"
                        value={fechaLimite}
                        onChange={e => setFechaLimite(e.target.value)}
                    />
                    <p className="text-xs text-gray-400">Si se deja vacío, irá al Backlog.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <textarea
                        className="w-full p-2 border rounded-md min-h-[100px]"
                        placeholder="Detalles de la tarea..."
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Creando...' : 'Crear Tarea'}
                    </Button>
                </div>
            </form>
        </DialogContent>
        </Dialog >
    );
}
