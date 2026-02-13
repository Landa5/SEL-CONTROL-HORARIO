'use client';

import { useState, useEffect } from 'react';
import { TaskBoard } from '@/components/tareas/kanban/TaskBoard';
import { LayoutDashboard } from 'lucide-react';
import TaskDetailPanel from '@/components/tareas/TaskDetailPanel';

export default function UnifiedTaskCenterPage() {
    const [session, setSession] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                setSession(data);
                if (data?.id) fetchTasks();
            });
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await fetch('/api/tareas');
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    };

    const handleTaskMove = async (taskId: number, newState: string) => {
        // Optimistic update
        const originalTasks = [...tasks];
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, estado: newState } : t));

        try {
            const res = await fetch(`/api/tareas/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newState })
            });

            if (!res.ok) {
                // Revert if failed
                setTasks(originalTasks);
                console.error("Failed to update task status");
            } else {
                fetchTasks(); // Refresh to ensure consistency
            }
        } catch (error) {
            setTasks(originalTasks);
            console.error("Error updating task:", error);
        }
    };

    if (!session) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

    return (
        <div className="min-h-screen bg-slate-50 relative">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

            <div className="relative p-6 max-w-[1800px] mx-auto space-y-6 h-screen flex flex-col">
                <header className="flex flex-col gap-1 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                            <LayoutDashboard className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Centro de Tareas</h1>
                            <p className="text-sm text-slate-500 font-medium">Gestiona tus incidencias y trabajos activos.</p>
                        </div>
                    </div>
                </header>

                <TaskBoard
                    tasks={tasks}
                    onTaskClick={setSelectedTaskId}
                    onTaskMove={handleTaskMove}
                />
            </div>

            <TaskDetailPanel
                taskId={selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
                onUpdate={fetchTasks}
            />
        </div>
    );
}
