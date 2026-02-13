'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TaskColumn } from './TaskColumn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Plus,
    Search,
    Filter,
    LayoutKanban,
    RefreshCw,
    AlertCircle,
    PlayCircle,
    CheckCircle
} from 'lucide-react';

interface TaskBoardProps {
    rol: string;
    userId: number;
}

export function TaskBoard({ rol, userId }: TaskBoardProps) {
    const router = useRouter();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterText, setFilterText] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        fetchTasks();
    }, [refreshTrigger]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tareas');
            if (res.ok) {
                const data = await res.json();
                // Client-side filtering for archived tasks (just in case backend sends them)
                // We want to hide 'COMPLETADA' tasks that are older than 24h
                const now = new Date();
                const oneDay = 24 * 60 * 60 * 1000;

                const activeTasks = data.filter((t: any) => {
                    if (t.estado !== 'COMPLETADA') return true;
                    // If completed, check if updated within last 24h
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

    const handleMoveTask = async (taskId: number, newState: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, estado: newState, updatedAt: new Date().toISOString() } : t));

        try {
            const res = await fetch(`/api/tareas/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newState })
            });

            if (!res.ok) {
                // Revert on error
                setRefreshTrigger(prev => prev + 1);
                console.error("Failed to update task state");
            }
        } catch (e) {
            setRefreshTrigger(prev => prev + 1);
        }
    };

    const handleTaskClick = (taskId: number) => {
        router.push(`/tareas/${taskId}`);
    };

    // Filter logic
    const filteredTasks = tasks.filter(t =>
        t.titulo.toLowerCase().includes(filterText.toLowerCase()) ||
        t.matricula?.toLowerCase().includes(filterText.toLowerCase()) ||
        t.id.toString().includes(filterText)
    );

    // Group by Columns
    // Column 1: PENDIENTES (Backlog, Pendiente, Abierta)
    const pendingTasks = filteredTasks.filter(t => ['BACKLOG', 'PENDIENTE', 'ABIERTA'].includes(t.estado));

    // Column 2: EN PROCESO (En Curso, Revision, Bloqueada - user wanted to remove blocked col, so putting here or ignored?
    // User said "elimiarlo no utilizamos material" for Blocked column. 
    // Let's map 'BLOQUEADA' and 'REVISION' to 'EN_CURSO' visually or put them in the same column but with badges.
    const inProgressTasks = filteredTasks.filter(t => ['EN_CURSO', 'BLOQUEADA', 'REVISION'].includes(t.estado));

    // Column 3: HECHO (Completada, Cerrada)
    const doneTasks = filteredTasks.filter(t => ['COMPLETADA', 'CERRADA', 'CANCELADA'].includes(t.estado));

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            {/* Toolbar */}
            <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex gap-2 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar tarea, matrícula..."
                            className="pl-9 bg-white"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => setRefreshTrigger(p => p + 1)} title="Recargar">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 flex-1 md:flex-none"
                        onClick={() => router.push('/tareas/nueva')}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nueva Tarea
                    </Button>
                </div>
            </div>

            {/* Board Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex gap-6 h-full min-w-max px-1">

                    {/* COLUMNA 1: PENDIENTES */}
                    <TaskColumn
                        title="Pendientes"
                        tasks={pendingTasks}
                        statusId="PENDIENTE"
                        color="border-l-4 border-l-slate-400"
                        icon={<AlertCircle className="w-5 h-5 text-slate-500" />}
                        onMoveTask={handleMoveTask}
                        onTaskClick={handleTaskClick}
                    />

                    {/* COLUMNA 2: EN PROCESO */}
                    <TaskColumn
                        title="En Proceso"
                        tasks={inProgressTasks}
                        statusId="EN_CURSO"
                        color="border-l-4 border-l-blue-500"
                        icon={<PlayCircle className="w-5 h-5 text-blue-600" />}
                        onMoveTask={handleMoveTask}
                        onTaskClick={handleTaskClick}
                    />

                    {/* COLUMNA 3: HECHO */}
                    <TaskColumn
                        title="Hecho (Últimas 24h)"
                        tasks={doneTasks}
                        statusId="COMPLETADA"
                        color="border-l-4 border-l-green-500"
                        icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                        onMoveTask={handleMoveTask}
                        onTaskClick={handleTaskClick}
                    />

                </div>
            </div>
        </div>
    );
}
