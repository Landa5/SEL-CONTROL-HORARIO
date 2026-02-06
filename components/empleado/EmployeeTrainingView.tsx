'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BookOpen, CheckCircle, Clock, PlayCircle, Trophy, AlertTriangle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

export default function EmployeeTrainingView() {
    const [modulos, setModulos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchModulos = async () => {
            try {
                const res = await fetch('/api/formacion/modulos');
                if (res.ok) {
                    setModulos(await res.json());
                }
            } catch (error) {
                console.error('Error fetching modules:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchModulos();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando formación disponible...</div>;

    const modulosPendientes = modulos.filter(m => m.resultados.length === 0 || !m.resultados[0].aprobado);
    const modulosCompletados = modulos.filter(m => m.resultados.length > 0 && m.resultados[0].aprobado);

    return (
        <div className="space-y-8">
            <header className="space-y-1">
                <h2 className="text-2xl font-black text-gray-900 uppercase">Formación y Capacitación</h2>
                <p className="text-sm text-gray-500 font-medium">Accede a tus cursos asignados, materiales de formación y evaluaciones.</p>
            </header>

            {modulos.length === 0 ? (
                <Card className="border-dashed border-2 bg-gray-50/50">
                    <CardContent className="p-12 text-center space-y-4">
                        <div className="p-4 bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-sm">
                            <BookOpen className="w-8 h-8 text-gray-300" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-bold text-gray-800">No tienes formación asignada</p>
                            <p className="text-sm text-gray-500">Actualmente no hay módulos activos para tu perfil.</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* ACTIVOS / PENDIENTES */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                            <PlayCircle className="w-4 h-4" /> Formación Pendiente
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {modulosPendientes.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No tienes cursos pendientes por ahora. ¡Buen trabajo!</p>
                            ) : (
                                modulosPendientes.map(m => {
                                    const resultado = m.resultados[0];
                                    const intentosRestantes = 2 - (resultado?.intentos || 0);

                                    return (
                                        <Card key={m.id} className="group hover:shadow-md transition-all border-l-4 border-l-indigo-500 overflow-hidden">
                                            <CardContent className="p-0">
                                                <div className="p-6 space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{m.titulo}</h4>
                                                            <p className="text-xs text-gray-500 line-clamp-2">{m.descripcion}</p>
                                                        </div>
                                                        <span className="shrink-0 p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                            <BookOpen className="w-5 h-5" />
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-6 text-[10px] font-black uppercase text-gray-400">
                                                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {m.duracionEstimada} MIN</span>
                                                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> HASTA {format(new Date(m.fechaFin), 'dd MMM', { locale: es })}</span>
                                                        {resultado && (
                                                            <span className="text-amber-600 flex items-center gap-1">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> {intentosRestantes} INTENTO(S) REST.
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-3 border-t flex justify-between items-center group-hover:bg-indigo-50 transition-colors">
                                                    <span className="text-[10px] font-black uppercase text-gray-400">
                                                        {resultado ? `Última nota: ${resultado.puntuacion}%` : 'No iniciado'}
                                                    </span>
                                                    <Link href={`/empleado/formacion/${m.id}`}>
                                                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 text-xs">
                                                            COMENZAR <ChevronRight className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* COMPLETADOS */}
                    {modulosCompletados.length > 0 && (
                        <div className="space-y-4 pt-4">
                            <h3 className="text-xs font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                                <Trophy className="w-4 h-4" /> Formación Completada
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {modulosCompletados.map(m => (
                                    <Card key={m.id} className="bg-green-50/30 border-green-100 shadow-sm">
                                        <CardContent className="p-5 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{m.titulo}</h4>
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="text-2xl font-black text-green-700">{m.resultados[0].puntuacion}%</div>
                                                <div className="text-[10px] font-black text-gray-400 uppercase">
                                                    Finalizado {format(new Date(m.resultados[0].completadoAl), 'dd/MM/yy')}
                                                </div>
                                            </div>
                                            <Link href={`/empleado/formacion/${m.id}`}>
                                                <Button variant="ghost" className="w-full text-xs font-bold text-green-700 hover:bg-green-100/50 uppercase tracking-widest h-8">
                                                    REVISAR MATERIAL
                                                </Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
