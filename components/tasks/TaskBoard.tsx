'use client';

import { useState, useEffect } from 'react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import TaskCard from './TaskCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from "@/components/ui/Badge";
import { Button } from '@/components/ui/Button';
import { Plus, Filter, RefreshCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import CreateTaskDialog from './CreateTaskDialog';

export default function TaskBoard() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('HOY');

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tareas'); // Fetches all relevant tasks
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (error) {
            console.error("Error fetching tasks", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    // --- FILTER LOGIC ---
    const getTodayTasks = () => {
        return tasks.filter(t => {
            if (t.estado === 'COMPLETADA' || t.estado === 'CANCELADA') return false;
            // Includes tasks with deadline today OR overdue
            if (!t.fechaLimite) return false;
            const d = new Date(t.fechaLimite);
            // Check if same day or past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return d < new Date() || isToday(d);
        }).sort((a, b) => {
            // Sort by Priority (ALTA=0, MEDIA=1, BAJA=2 ideally, but enum is string)
            // Let's rely on backend sort or simple mapping
            const pMap: any = { ALTA: 0, MEDIA: 1, BAJA: 2 };
            if (pMap[a.prioridad] !== pMap[b.prioridad]) return pMap[a.prioridad] - pMap[b.prioridad];
            return new Date(a.fechaLimite).getTime() - new Date(b.fechaLimite).getTime();
        });
    };

    const getInProgressTasks = () => {
        return tasks.filter(t => t.estado === 'EN_CURSO');
    };

    const getBlockedTasks = () => {
        return tasks.filter(t => t.estado === 'BLOQUEADA');
    };

    const getBacklogTasks = () => {
        return tasks.filter(t => !t.fechaLimite && t.estado !== 'COMPLETADA' && t.estado !== 'CANCELADA');
    };

    const getByProjectTasks = () => {
        // Group by activoTipo + matricula/cliente or just activoTipo
        // Or simply "Por Proyecto" tab listing all active grouped by context
        return tasks.filter(t => t.estado !== 'COMPLETADA' && t.estado !== 'CANCELADA');
    };

    // --- RENDER HELPERS ---
    const renderGroupedByAssignee = (taskList: any[]) => {
        const grouped: any = {};
        taskList.forEach(t => {
            const name = t.asignadoA?.nombre || 'Sin Asignar';
            if (!grouped[name]) grouped[name] = [];
            grouped[name].push(t);
        });

        return Object.entries(grouped).map(([name, items]: any) => (
            <div key={name} className="mb-6">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    {name}
                    <span className="text-gray-400 font-normal text-sm">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((t: any) => <TaskCard key={t.id} task={t} />)}
                </div>
            </div>
        ));
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header / Toolbar */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Tareas</h1>
                    <p className="text-sm text-gray-500">
                        {tasks.length} tareas totales • {getTodayTasks().length} para hoy
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchTasks}>
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <CreateTaskDialog onTaskCreated={fetchTasks} />
                </div>
            </div>

            {/* Views */}
            <Tabs defaultValue="HOY" className="w-full flex-1 flex flex-col" onValueChange={setView}>
                <TabsList className="grid w-full grid-cols-5 lg:w-[600px] mb-6">
                    <TabsTrigger value="HOY">Hoy ({getTodayTasks().length})</TabsTrigger>
                    <TabsTrigger value="EN_CURSO">En Curso ({getInProgressTasks().length})</TabsTrigger>
                    <TabsTrigger value="BLOQUEADAS">Bloqueadas ({getBlockedTasks().length})</TabsTrigger>
                    <TabsTrigger value="BACKLOG">Backlog</TabsTrigger>
                    <TabsTrigger value="PROYECTO">Proyectos</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto min-h-0 pb-10">

                    <TabsContent value="HOY" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {getTodayTasks().map(t => <TaskCard key={t.id} task={t} />)}
                            {getTodayTasks().length === 0 && (
                                <div className="col-span-full text-center py-20 text-gray-400">
                                    <p>🎉 ¡Todo al día! No hay tareas urgentes para hoy.</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="EN_CURSO" className="mt-0">
                        {renderGroupedByAssignee(getInProgressTasks())}
                    </TabsContent>

                    <TabsContent value="BLOQUEADAS" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {getBlockedTasks().map(t => <TaskCard key={t.id} task={t} />)}
                        </div>
                    </TabsContent>

                    <TabsContent value="BACKLOG" className="mt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {getBacklogTasks().map(t => <TaskCard key={t.id} task={t} />)}
                        </div>
                    </TabsContent>

                    <TabsContent value="PROYECTO" className="mt-0">
                        {/* Group by Context (Matricula, Cliente, etc) */}
                        <div className="space-y-8">
                            {/* Simple implementation for now */}
                            {['CAMION', 'DEPOSITO_CLIENTE', 'BASE', 'OTRO'].map(type => {
                                const typeTasks = getByProjectTasks().filter(t => t.activoTipo === type);
                                if (typeTasks.length === 0) return null;
                                return (
                                    <div key={type}>
                                        <h3 className="font-bold text-gray-900 border-b pb-2 mb-4">{type}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {typeTasks.map(t => <TaskCard key={t.id} task={t} />)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TabsContent>

                </div>
            </Tabs>
        </div>
    );
}
