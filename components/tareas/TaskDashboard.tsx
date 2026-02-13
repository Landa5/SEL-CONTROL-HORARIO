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

export default function TaskDashboard({ rol, userId }: TaskDashboardProps) {
    const router = useRouter();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'BOARD' | 'LIST'>('BOARD');
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
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

                // Client-side filtering for archived tasks
                const now = new Date();
                const oneDay = 24 * 60 * 60 * 1000;

                const activeTasks = data.filter((t: any) => {
                    if (!['COMPLETADA', 'CERRADA', 'CANCELADA'].includes(t.estado)) return true;
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
    const filteredTasks = tasks.filter(t =>
        t.titulo.toLowerCase().includes(filterText.toLowerCase()) ||
        t.matricula?.toLowerCase().includes(filterText.toLowerCase()) ||
        t.id.toString().includes(filterText) ||
        (t.creadoPor?.nombre && t.creadoPor.nombre.toLowerCase().includes(filterText.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] relative">
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
                        onClick={() => router.push('/tareas/nueva')}
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Nueva Tarea
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {view === 'BOARD' ? (
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
                )}
            </div>

            {/* Side Panel */}
            <TaskDetailPanel
                taskId={selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
                onUpdate={() => setRefreshTrigger(p => p + 1)}
            />
        </div>
    );
}
