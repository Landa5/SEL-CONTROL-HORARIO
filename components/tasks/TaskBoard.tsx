'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import TaskCard from './TaskCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Plus, Filter, RefreshCcw, List } from 'lucide-react';
import CreateTaskDialog from './CreateTaskDialog';
import { useSearchParams } from 'next/navigation';

export default function TaskBoard() {
    const searchParams = useSearchParams();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tareas');
            if (res.ok) {
                const data = await res.json();
                // Filter out finalizadas/canceladas immediately as requested
                const activeTasks = data.filter((t: any) => t.estado !== 'COMPLETADA' && t.estado !== 'CANCELADA' && t.estado !== 'BLOQUEADA');
                setTasks(activeTasks);
            }
        } catch (error) {
            console.error("Error fetching tasks", error);
        } finally {
            setLoading(false);
        }
    };

    // Columns for Kanban
    const columns = [
        { id: 'BACKLOG', title: 'Backlog / Pendiente', status: ['BACKLOG', 'PENDIENTE'], color: 'bg-gray-100' },
        { id: 'EN_CURSO', title: 'En Curso', status: ['EN_CURSO'], color: 'bg-blue-50' },
        { id: 'REVISION', title: 'Revisión', status: ['REVISION'], color: 'bg-purple-50' },
        // User asked to hide BLOCKED and COMPLETED.
    ];

    const getTasksByStatus = (statuses: string[]) => {
        return tasks.filter(t => statuses.includes(t.estado));
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tablero de Tareas</h1>
                    <p className="text-sm text-gray-500">
                        Visualización del flujo de trabajo activo (Ocultas: Bloqueadas y Finalizadas)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchTasks}>
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <CreateTaskDialog onTaskCreated={fetchTasks} />
                </div>
            </div>

            {/* KANBAN BOARD */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-6 min-w-[1000px] pb-4">
                    {columns.map(col => {
                        const colTasks = getTasksByStatus(col.status);
                        return (
                            <div key={col.id} className={`flex-1 flex flex-col rounded-xl border border-gray-200 ${col.color} max-w-md`}>
                                {/* Column Header */}
                                <div className="p-4 border-b border-gray-200/50 flex justify-between items-center bg-white/50 rounded-t-xl backdrop-blur-sm sticky top-0 z-10">
                                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                        {col.title}
                                        <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-xs text-gray-500">
                                            {colTasks.length}
                                        </span>
                                    </h3>
                                </div>

                                {/* Column Content */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300">
                                    {colTasks.map(task => (
                                        <TaskCard key={task.id} task={task} />
                                    ))}
                                    {colTasks.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                            <p className="text-sm">Sin tareas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
