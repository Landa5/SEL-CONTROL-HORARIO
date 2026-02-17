'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus,
    MoreHorizontal,
    AlertCircle,
    PlayCircle,
    CheckCircle,
    Trash2,
    Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from "@/components/ui/Card";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/Dialog";
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface ProjectManagerProps {
    onSelectProject?: (project: any) => void;
}

export default function ProjectManager({ onSelectProject }: ProjectManagerProps) {
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newProject, setNewProject] = useState({ nombre: '', descripcion: '' });

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/proyectos');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar proyectos");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newProject.nombre) return;

        try {
            const res = await fetch('/api/proyectos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (res.ok) {
                toast.success("Proyecto creado");
                setIsCreateOpen(false);
                setNewProject({ nombre: '', descripcion: '' });
                fetchProjects();
            } else {
                toast.error("Error al crear proyecto");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleMove = async (id: number, newState: string) => {
        // Optimistic update
        setProjects(prev => prev.map(p => p.id === id ? { ...p, estado: newState } : p));

        try {
            const res = await fetch(`/api/proyectos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newState })
            });

            if (!res.ok) {
                toast.error("Error al mover proyecto");
                fetchProjects(); // Revert
            }
        } catch (error) {
            fetchProjects();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("¿Seguro que quieres eliminar este proyecto?")) return;

        try {
            const res = await fetch(`/api/proyectos/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success("Proyecto eliminado");
                fetchProjects();
            } else {
                toast.error("Error al eliminar");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const columns = [
        { id: 'PENDIENTE', label: 'Pendiente', color: 'bg-gray-100', icon: AlertCircle, iconColor: 'text-gray-500' },
        { id: 'EN_CURSO', label: 'En Curso', color: 'bg-blue-50', icon: PlayCircle, iconColor: 'text-blue-500' },
        { id: 'COMPLETADA', label: 'Hecho', color: 'bg-green-50', icon: CheckCircle, iconColor: 'text-green-500' },
    ];

    const filterProjects = (status: string) => {
        return projects.filter(p => {
            if (p.estado !== status) return false;
            if (status === 'COMPLETADA') {
                const updated = new Date(p.updatedAt).getTime();
                const now = new Date().getTime();
                const diffHours = (now - updated) / (1000 * 60 * 60);
                if (diffHours > 24) return false;
            }
            return true;
        });
    };

    if (loading && projects.length === 0) {
        return <div className="p-8 text-center animate-pulse">Cargando proyectos...</div>;
    }

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Tablero de Proyectos</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Proyecto
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre</label>
                                <Input
                                    value={newProject.nombre}
                                    onChange={e => setNewProject({ ...newProject, nombre: e.target.value })}
                                    placeholder="Nombre del proyecto..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Descripción</label>
                                <Textarea
                                    value={newProject.descripcion}
                                    onChange={e => setNewProject({ ...newProject, descripcion: e.target.value })}
                                    placeholder="Detalles..."
                                />
                            </div>
                            <Button onClick={handleCreate} className="w-full bg-blue-600">Crear Proyecto</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 h-full min-w-[800px]">
                    {columns.map(col => (
                        <div key={col.id} className={`flex-1 rounded-xl p-4 flex flex-col gap-3 ${col.color}`}>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <col.icon className={`w-5 h-5 ${col.iconColor}`} />
                                    {col.label}
                                </h3>
                                <span className="bg-white/50 px-2 py-1 rounded text-xs font-bold text-gray-500">
                                    {filterProjects(col.id).length}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3">
                                {filterProjects(col.id).map(proj => (
                                    <Card
                                        key={proj.id}
                                        className="cursor-pointer hover:shadow-md transition-shadow bg-white border-l-4 border-l-blue-500 hover:scale-[1.02] active:scale-[0.98]"
                                        onClick={() => onSelectProject && onSelectProject(proj)}
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-800">{proj.nombre}</h4>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-6 w-6 p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Mover a...</DropdownMenuLabel>
                                                        {columns.map(c => c.id !== proj.estado && (
                                                            <DropdownMenuItem key={c.id} onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleMove(proj.id, c.id); }}>
                                                                <c.icon className="mr-2 h-4 w-4" /> {c.label}
                                                            </DropdownMenuItem>
                                                        ))}
                                                        <DropdownMenuItem onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(proj.id); }} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            {proj.descripcion && (
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{proj.descripcion}</p>
                                            )}
                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                                                <span className="text-[10px] text-gray-400">
                                                    {format(new Date(proj.createdAt), 'dd MMM', { locale: es })}
                                                </span>
                                                {proj._count?.tareas > 0 ? (
                                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                                        {proj._count.tareas} Tareas
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300 italic">
                                                        Sin tareas
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {filterProjects(col.id).length === 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm italic">
                                        {col.id === 'COMPLETADA' ? 'Proyectos completados (24h) ordenados aquí' : 'Sin proyectos'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
