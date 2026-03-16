import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
    title: string;
    tasks: any[];
    statusId: string;
    color: string;
    icon: React.ReactNode;
    gradient: string;
    onMoveTask: (taskId: number, newState: string) => void;
    onTaskClick: (taskId: number) => void;
}

export function TaskColumn({ title, tasks, statusId, color, icon, gradient, onMoveTask, onTaskClick }: TaskColumnProps) {
    return (
        <div className="flex flex-col h-full min-w-[320px] w-full md:w-[360px] rounded-2xl overflow-hidden bg-white/40 backdrop-blur-sm border border-white/60 shadow-sm">
            {/* Column Header */}
            <div className={`relative px-5 py-3.5 border-b border-white/40 sticky top-0 z-10`}>
                {/* Gradient background layer */}
                <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-[0.08]`} />
                <div className="absolute inset-0 bg-white/60 backdrop-blur-md" />
                
                <div className="relative flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} shadow-sm`}>
                            <div className="text-white">{icon}</div>
                        </div>
                        <h3 className="font-black uppercase tracking-tight text-sm text-gray-800">{title}</h3>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full bg-gradient-to-r ${gradient} text-white shadow-sm`}>
                        {tasks.length}
                    </span>
                </div>
            </div>

            {/* Tasks Container */}
            <div className="flex-1 p-3 overflow-y-auto space-y-1 min-h-[200px] max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-200/50 scrollbar-track-transparent">
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
                    <div className="h-32 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200/60 rounded-xl bg-white/30">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                            <span className="text-gray-300 text-lg">∅</span>
                        </div>
                        <p className="text-xs font-medium text-gray-400">Sin tareas</p>
                    </div>
                )}
            </div>
        </div>
    );
}
