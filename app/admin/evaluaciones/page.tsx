'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, MoreVertical, FileText, Target, Star } from 'lucide-react';
import EvaluacionForm from '@/components/evaluaciones/EvaluacionForm';
import { format } from 'date-fns';

export default function EvaluacionesPage() {
    const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
    const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

    useEffect(() => {
        fetchEvaluaciones();
        fetchEmployees();
    }, []);

    const fetchEvaluaciones = async () => {
        try {
            const res = await fetch('/api/admin/evaluaciones');
            if (res.ok) {
                const data = await res.json();
                setEvaluaciones(data);
            }
        } catch (error) {
            console.error('Error fetching evaluaciones:', error);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/empleados?activo=true');
            if (res.ok) {
                const data = await res.json();
                setEmployees(data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const handleEdit = (evaluation: any) => {
        setSelectedEvaluation(evaluation);
        setSelectedEmployee(evaluation.empleadoId); // To skip employee selection step if needed, or just pass initialData
        setView('CREATE');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Evaluaciones de Desempeño</h1>
                    <p className="text-gray-500 text-sm">Gestiona el feedback y objetivos del equipo.</p>
                </div>
                {view === 'LIST' && (
                    <Button onClick={() => { setSelectedEvaluation(null); setSelectedEmployee(null); setView('CREATE'); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Evaluación
                    </Button>
                )}
            </div>

            {view === 'CREATE' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {!selectedEmployee && !selectedEvaluation ? (
                        <Card>
                            <CardHeader><CardTitle>Selecciona un Empleado</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {employees.filter(e => e.activo).map(emp => (
                                        <button
                                            key={emp.id}
                                            onClick={() => setSelectedEmployee(emp.id)}
                                            className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left flex items-center gap-3"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                                {emp.nombre.charAt(0)}{emp.apellidos?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{emp.nombre} {emp.apellidos}</p>
                                                <p className="text-xs text-gray-500">{emp.rol}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <Button variant="ghost" onClick={() => setView('LIST')}>Cancelar</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <EvaluacionForm
                            empleadoId={selectedEmployee || selectedEvaluation.empleadoId}
                            initialData={selectedEvaluation}
                            onSuccess={() => {
                                setView('LIST');
                                setSelectedEmployee(null);
                                setSelectedEvaluation(null);
                                fetchEvaluaciones();
                            }}
                            onCancel={() => {
                                setView('LIST');
                                setSelectedEmployee(null);
                                setSelectedEvaluation(null);
                            }}
                        />
                    )}
                </div>
            )}

            {view === 'LIST' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {evaluaciones.map(ev => (
                        <Card
                            key={ev.id}
                            onClick={() => handleEdit(ev)}
                            className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                                            {ev.puntuacionGeneral}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{ev.empleado.nombre} {ev.empleado.apellidos}</h3>
                                            <p className="text-xs text-gray-500">{ev.periodo}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${ev.estado === 'COMPLETADA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {ev.estado}
                                    </span>
                                </div>

                                {ev.comentarios && (
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 italic">
                                        "{ev.comentarios}"
                                    </p>
                                )}

                                <div className="flex items-center justify-between text-xs text-gray-400 border-t pt-4">
                                    <span className="flex items-center gap-1">
                                        <Target className="w-3 h-3" /> {ev.objetivos ? JSON.parse(ev.objetivos).length : 0} Objetivos
                                    </span>
                                    <span>{format(new Date(ev.createdAt || new Date()), 'dd MMM yyyy')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {/* ... empty state ... */}

                    {evaluaciones.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed rounded-xl">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No hay evaluaciones registradas aún.</p>
                            <Button variant="ghost" onClick={() => setView('CREATE')} className="mt-2 text-blue-600 hover:bg-blue-50">
                                Crear la primera
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
