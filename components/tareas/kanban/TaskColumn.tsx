import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
    title: string;
    tasks: any[];
    statusId: string; // 'PENDIENTE', 'EN_CURSO', 'COMPLETADA'
    color: string; // Tailwind class for border/bg accents
    icon: React.ReactNode;
    onMoveTask: (taskId: number, newState: string) => void;
    onTaskClick: (taskId: number) => void;
}

export function TaskColumn({ title, tasks, statusId, color, icon, onMoveTask, onTaskClick }: TaskColumnProps) {
    return (
        <div className="flex flex-col h-full min-w-[300px] w-full md:w-[350px] bg-slate-50/50 rounded-xl border border-slate-100/50">
            {/* Column Header */}
            <div className={`p-4 border-b flex justify-between items-center sticky top-0 bg-slate-50/95 backdrop-blur z-10 rounded-t-xl ${color}`}>
                <div className="flex items-center gap-2 text-slate-700">
                    {icon}
                    <h3 className="font-extrabold uppercase tracking-tight text-sm">{title}</h3>
                </div>
                <span className="bg-white text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border">
                    {tasks.length}
                </span>
            </div>

            {/* Tasks Container */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[200px] max-h-[calc(100vh-250px)] scrollbar-thin scrollbar-thumb-slate-200">
                {tasks.length > 0 ? (
                    tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onMove={onMoveTask}
                            onClick={onTaskClick}
                        />
                    ))
                ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-lg">
                        <p className="text-xs font-medium">Vacío</p>
                    </div>
                )}
            </div>
        </div>
    );
}
