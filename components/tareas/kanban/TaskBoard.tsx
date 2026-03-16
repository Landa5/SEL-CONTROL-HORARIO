'use client';

import { useState } from 'react';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { AlertCircle, PlayCircle, CheckCircle, History, ChevronDown, ChevronUp } from 'lucide-react';

interface TaskBoardProps {
    tasks: any[];
    onTaskClick: (taskId: number) => void;
    onTaskMove: (taskId: number, newState: string) => void;
}

export function TaskBoard({ tasks, onTaskClick, onTaskMove }: TaskBoardProps) {
    const [showHistorico, setShowHistorico] = useState(false);

    // Active columns only show non-completed tasks
    const pendingTasks = tasks.filter(t => ['BACKLOG', 'PENDIENTE', 'ABIERTA'].includes(t.estado));
    const inProgressTasks = tasks.filter(t => ['EN_CURSO', 'BLOQUEADA', 'REVISION'].includes(t.estado));

    // Histórico: completadas + canceladas
    const doneTasks = tasks.filter(t => ['COMPLETADA', 'CERRADA', 'CANCELADA'].includes(t.estado));

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Active Kanban */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                <div className="flex gap-5 h-full min-w-max px-1">
                    <TaskColumn
                        title="Pendientes"
                        tasks={pendingTasks}
                        statusId="PENDIENTE"
                        color="slate"
                        gradient="from-slate-500 to-slate-600"
                        icon={<AlertCircle className="w-4 h-4" />}
                        onMoveTask={onTaskMove}
                        onTaskClick={onTaskClick}
                    />
                    <TaskColumn
                        title="En Proceso"
                        tasks={inProgressTasks}
                        statusId="EN_CURSO"
                        color="blue"
                        gradient="from-blue-500 to-indigo-600"
                        icon={<PlayCircle className="w-4 h-4" />}
                        onMoveTask={onTaskMove}
                        onTaskClick={onTaskClick}
                    />
                </div>
            </div>

            {/* Histórico colapsable */}
            {doneTasks.length > 0 && (
                <div className="border-t border-gray-200/60 mt-2">
                    <button
                        onClick={() => setShowHistorico(!showHistorico)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/80 transition-colors group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm">
                                <History className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-sm font-black text-gray-700 uppercase tracking-wider">Histórico</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white">
                                {doneTasks.length}
                            </span>
                        </div>
                        {showHistorico ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                        )}
                    </button>

                    {showHistorico && (
                        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2 max-h-[300px] overflow-y-auto">
                            {doneTasks.map(task => (
                                <div key={task.id} className="opacity-75 hover:opacity-100 transition-opacity">
                                    <TaskCard
                                        task={task}
                                        onMove={onTaskMove}
                                        onClick={onTaskClick}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
