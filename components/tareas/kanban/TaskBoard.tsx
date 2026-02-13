'use client';

import { TaskColumn } from './TaskColumn';
import { AlertCircle, PlayCircle, CheckCircle } from 'lucide-react';

interface TaskBoardProps {
    tasks: any[];
    onTaskClick: (taskId: number) => void;
    onTaskMove: (taskId: number, newState: string) => void;
}

export function TaskBoard({ tasks, onTaskClick, onTaskMove }: TaskBoardProps) {

    // Group by Columns
    // Column 1: PENDIENTES (Backlog, Pendiente, Abierta)
    const pendingTasks = tasks.filter(t => ['BACKLOG', 'PENDIENTE', 'ABIERTA'].includes(t.estado));

    // Column 2: EN PROCESO (En Curso, Revision, Bloqueada)
    const inProgressTasks = tasks.filter(t => ['EN_CURSO', 'BLOQUEADA', 'REVISION'].includes(t.estado));

    // Column 3: HECHO (Completada, Cerrada)
    const doneTasks = tasks.filter(t => ['COMPLETADA', 'CERRADA', 'CANCELADA'].includes(t.estado));

    return (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
            <div className="flex gap-6 h-full min-w-max px-1">
                {/* COLUMNA 1: PENDIENTES */}
                <TaskColumn
                    title="Pendientes"
                    tasks={pendingTasks}
                    statusId="PENDIENTE"
                    color="border-l-4 border-l-slate-400"
                    icon={<AlertCircle className="w-5 h-5 text-slate-500" />}
                    onMoveTask={onTaskMove}
                    onTaskClick={onTaskClick}
                />

                {/* COLUMNA 2: EN PROCESO */}
                <TaskColumn
                    title="En Proceso"
                    tasks={inProgressTasks}
                    statusId="EN_CURSO"
                    color="border-l-4 border-l-blue-500"
                    icon={<PlayCircle className="w-5 h-5 text-blue-600" />}
                    onMoveTask={onTaskMove}
                    onTaskClick={onTaskClick}
                />

                {/* COLUMNA 3: HECHO */}
                <TaskColumn
                    title="Hecho (Últimas 24h)"
                    tasks={doneTasks}
                    statusId="COMPLETADA"
                    color="border-l-4 border-l-green-500"
                    icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                    onMoveTask={onTaskMove}
                    onTaskClick={onTaskClick}
                />
            </div>
        </div>
    );
}
