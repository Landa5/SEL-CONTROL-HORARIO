'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Star, Target, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EmployeeEvaluationsPage() {
    const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvaluaciones = async () => {
            try {
                // Filter by current user is handled by API or we can filter here if API returns all (unlikely for security)
                // We need a specific endpoint or use existing with query params
                // Let's assume GET /api/admin/evaluaciones filters by user role? 
                // Actually, existing GET /api/admin/evaluaciones fetches ALL. We need a new endpoint or update existing.
                // Let's try to update existing GET to filter by session user if not admin.
                const res = await fetch('/api/admin/evaluaciones');
                if (res.ok) {
                    const data = await res.json();
                    setEvaluaciones(data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvaluaciones();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando tus evaluaciones...</div>;

    const completedEvaluations = evaluaciones.filter(ev => ev.estado === 'COMPLETADA');

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-black text-gray-900 uppercase">Mis Evaluaciones</h1>
                <p className="text-sm text-gray-500">Histórico de desempeño y objetivos marcados.</p>
            </header>

            {completedEvaluations.length === 0 ? (
                <Card className="border-dashed border-2 bg-gray-50/50">
                    <CardContent className="p-12 text-center space-y-4">
                        <div className="p-4 bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto shadow-sm">
                            <Star className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-lg font-bold text-gray-800">No tienes evaluaciones finalizadas</p>
                        <p className="text-sm text-gray-500">Las evaluaciones en borrador no se muestran hasta que son cerradas por dirección.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {completedEvaluations.map(ev => (
                        <Card key={ev.id} className="overflow-hidden border-l-4 border-l-green-500">
                            <CardHeader className="bg-gray-50/50 border-b pb-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-gray-400" />
                                            {ev.periodo}
                                        </CardTitle>
                                        <CardDescription>
                                            Finalizada el {format(new Date(ev.updatedAt || ev.createdAt), 'dd MMMM yyyy', { locale: es })}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                        <span className="font-black text-gray-900">{ev.puntuacionGeneral}/10</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div>
                                    <h4 className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wide">Comentarios y Feedback</h4>
                                    <p className="text-gray-700 bg-gray-50 p-4 rounded-lg italic border-l-2 border-gray-200">
                                        "{ev.comentarios}"
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                        <Target className="w-4 h-4 text-blue-600" />
                                        Objetivos Marcados
                                    </h4>
                                    <ul className="space-y-3">
                                        {ev.objetivos && JSON.parse(ev.objetivos).map((obj: string, i: number) => (
                                            <li key={i} className="flex gap-3 items-start p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                                                <div className="mt-1 min-w-[20px] h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                                                    {i + 1}
                                                </div>
                                                <span className="text-gray-700 text-sm leading-relaxed">{obj}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
