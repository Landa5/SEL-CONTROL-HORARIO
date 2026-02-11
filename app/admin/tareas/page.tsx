import TaskBoard from '@/components/tasks/TaskBoard';
import { Suspense } from 'react';

export default function AdminTareasPage() {
    return (
        <div className="h-[calc(100vh-theme(spacing.16))] p-6 bg-gray-50/50">
            <Suspense fallback={<div className="p-12 text-center text-gray-500">Cargando tareas...</div>}>
                <TaskBoard />
            </Suspense>
        </div>
    );
}
