'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Calendar, AlertCircle, ChevronRight, User } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminAbsenceWidget() {
    const [stats, setStats] = useState({
        pendientes: 0,
        deVacaciones: [] as any[]
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWidgetStats = async () => {
            try {
                // Fetch stats from the new API
                const res = await fetch('/api/ausencias/stats');
                if (res.ok) {
                    const data = await res.json();

                    let pendientes = 0;
                    const hoy = new Date();
                    const deVacaciones: any[] = [];

                    data.forEach((emp: any) => {
                        pendientes += emp.diasSolicitados;

                        // Check if on vacation today
                        const currentAbsence = emp.ausencias.find((a: any) => {
                            if (a.estado !== 'APROBADA') return false;
                            const start = new Date(a.fechaInicio);
                            const end = new Date(a.fechaFin);
                            return hoy >= start && hoy <= end;
                        });

                        if (currentAbsence) {
                            deVacaciones.push({
                                nombre: emp.nombre,
                                tipo: currentAbsence.tipo,
                                hasta: currentAbsence.fechaFin
                            });
                        }
                    });

                    setStats({ pendientes, deVacaciones });
                }
            } catch (error) {
                console.error("Error fetching absence widget:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchWidgetStats();
    }, []);

    if (loading) return <div className="text-xs text-gray-400 p-4">Cargando datos...</div>;

    return (
        <Card className="h-full border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">
                    <Calendar className="w-5 h-5 text-blue-600" /> Ausencias
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
                    <span className="text-sm font-medium text-blue-900">Solicitudes Pendientes</span>
                    <span className={`text-xl font-black ${stats.pendientes > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {stats.pendientes}
                    </span>
                </div>

                {stats.pendientes > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-600 font-bold animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        Acción requerida: {stats.pendientes} firmas.
                    </div>
                )}

                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ausentes Hoy</h4>
                    {stats.deVacaciones.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Todo el personal activo.</p>
                    ) : (
                        <ul className="space-y-2">
                            {stats.deVacaciones.map((v, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                    <span className="font-medium text-gray-700">{v.nombre}</span>
                                    <span className="text-xs text-gray-400">
                                        (Hasta {format(new Date(v.hasta), 'd MMM', { locale: es })})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <Link href="/admin/ausencias" className="block">
                    <Button variant="outline" className="w-full mt-2 text-blue-600 hover:bg-blue-50 border-blue-200">
                        Gestionar Ausencias <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}
