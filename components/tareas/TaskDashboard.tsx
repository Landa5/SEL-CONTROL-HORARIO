'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Plus,
    Search,
    RefreshCw,
    LayoutGrid,
    List,
    Filter
} from 'lucide-react';
import { TaskBoard } from './kanban/TaskBoard';
import TaskList from './list/TaskList';
import TaskDetailPanel from './TaskDetailPanel';

interface TaskDashboardProps {
    rol: string;
    userId: number;
}

import ProjectManager from './ProjectManager';

export default function TaskDashboard({ rol, userId }: TaskDashboardProps) {
    const router = useRouter();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'BOARD' | 'LIST'>('BOARD');
    const [activeTab, setActiveTab] = useState<'TAREAS' | 'PROYECTOS'>('TAREAS');
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [filterText, setFilterText] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);

    useEffect(() => {
        if (activeTab === 'TAREAS') {
            fetchTasks();
        }
    }, [refreshTrigger, activeTab]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tareas');
            if (res.ok) {
                const data = await res.json();

                // Client-side filtering for archived tasks
                const now = new Date();
                const oneDay = 24 * 60 * 60 * 1000;

                const activeTasks = data.filter((t: any) => {
                    if (!['COMPLETADA', 'CERRADA', 'CANCELADA'].includes(t.estado)) return true;
                    // Keep project completed tasks a bit longer? or same rule?
                    // Same rule applies generally.
                    const updated = new Date(t.updatedAt).getTime();
                    return (now.getTime() - updated) < oneDay;
                });

                setTasks(activeTasks);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleTaskMove = async (taskId: number, newState: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, estado: newState, updatedAt: new Date().toISOString() } : t));

        try {
            const res = await fetch(`/api/tareas/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newState })
            });

            if (!res.ok) {
                setRefreshTrigger(prev => prev + 1);
                console.error("Failed to update task state");
            }
        } catch (e) {
            setRefreshTrigger(prev => prev + 1);
        }
    };

    const toggleView = () => {
        setView(prev => prev === 'BOARD' ? 'LIST' : 'BOARD');
    };

    // Filter logic
    const filteredTasks = tasks.filter(t => {
        if (selectedProject && t.proyectoId !== selectedProject.id) return false;

        return (
            t.titulo.toLowerCase().includes(filterText.toLowerCase()) ||
            t.matricula?.toLowerCase().includes(filterText.toLowerCase()) ||
            t.id.toString().includes(filterText) ||
            (t.creadoPor?.nombre && t.creadoPor.nombre.toLowerCase().includes(filterText.toLowerCase()))
        );
    });

    const handleProjectSelect = (project: any) => {
        setSelectedProject(project);
        setActiveTab('TAREAS');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] relative">
            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('TAREAS')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'TAREAS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Tareas
                </button>
                <button
                    onClick={() => setActiveTab('PROYECTOS')}
                    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PROYECTOS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Proyectos
                </button>
            </div>

            {activeTab === 'PROYECTOS' ? (
                <ProjectManager onSelectProject={handleProjectSelect} />
            ) : (
                <>
                    {/* Project Context Header */}
                    {selectedProject && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                            <div>
                                <h3 className="text-lg font-black text-blue-900">Proyecto: {selectedProject.nombre}</h3>
                                <p className="text-sm text-blue-700">{selectedProject.descripcion || 'Sin descripción'}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} className="text-blue-600 hover:bg-blue-100">
                                Cerrar Vista de Proyecto
                            </Button>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="flex gap-2 items-center w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar tarea, matrícula, usuario..."
                                    className="pl-9 bg-white"
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                />
                            </div>

                            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                                <button
                                    onClick={() => setView('BOARD')}
                                    className={`p-2 rounded-md transition-all ${view === 'BOARD' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    title="Vista Tablero"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setView('LIST')}
                                    className={`p-2 rounded-md transition-all ${view === 'LIST' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    title="Vista Lista"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>

                            <Button variant="outline" size="icon" onClick={() => setRefreshTrigger(p => p + 1)} title="Recargar">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 flex-1 md:flex-none"
                                onClick={() => router.push(selectedProject ? `/tareas/nueva?proyectoId=${selectedProject.id}` : '/tareas/nueva')}
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Nueva Tarea
                            </Button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-auto">
                        <div className="pb-4">
                            {filteredTasks.length === 0 && selectedProject ? (
                                <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                                    <p className="text-gray-400 mb-2">Este proyecto no tiene tareas aún.</p>
                                    <Button variant="outline" onClick={() => router.push(`/tareas/nueva?proyectoId=${selectedProject.id}`)}>
                                        Crear Primera Tarea
                                    </Button>
                                </div>
                            ) : (
                                view === 'BOARD' ? (
                                    <TaskBoard
                                        tasks={filteredTasks}
                                        onTaskClick={setSelectedTaskId}
                                        onTaskMove={handleTaskMove}
                                    />
                                ) : (
                                    <TaskList
                                        tasks={filteredTasks}
                                        onTaskClick={setSelectedTaskId}
                                    />
                                )
                            )}
                        </div>
                    </div>

                    {/* Side Panel */}
                    <TaskDetailPanel
                        taskId={selectedTaskId}
                        onClose={() => setSelectedTaskId(null)}
                        onUpdate={() => setRefreshTrigger(p => p + 1)}
                    />
                </>
            )}
        </div>
    );
}
