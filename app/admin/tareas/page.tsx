import TaskBoard from '@/components/tasks/TaskBoard';

export default function AdminTareasPage() {
    return (
        <div className="h-[calc(100vh-theme(spacing.16))] p-6 bg-gray-50/50">
            <TaskBoard />
        </div>
    );
}
