'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Clock, Briefcase, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EmployeeWorkdaySummary() {
    const [stats, setStats] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                // Fetch session for role check
                const sRes = await fetch('/api/auth/session');
                if (sRes.ok) setSession(await sRes.json());

                // Fetch stats
                const res = await fetch('/api/jornadas/mensual');
                if (res.ok) {
                    const data = await res.json();
                    const currentMonth = format(new Date(), 'yyyy-MM');
                    const monthData = data.find((m: any) => m.month === currentMonth);
                    setStats(monthData);
                }
            } catch (error) {
                console.error("Error fetching workday stats:", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const safeStats = stats || { totalHoras: 0, jornadasCount: 0, totalKm: 0, totalDescargas: 0 };

    if (loading) return (
        <Card className="border-l-4 border-gray-200 shadow-sm animate-pulse">
            <CardContent className="p-6 h-32"></CardContent>
        </Card>
    );

    return (
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">
                    <Clock className="w-5 h-5 text-blue-600" /> Mi Resumen (Este Mes)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className={`grid ${session?.rol === 'ADMIN' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 text-center`}>
                    {session?.rol === 'ADMIN' && (
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <div className="flex justify-center mb-1">
                                <Clock className="w-4 h-4 text-blue-600 opactiy-70" />
                            </div>
                            <span className="block font-black text-blue-700 text-2xl">{safeStats.totalHoras.toFixed(1)}h</span>
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Horas Totales</span>
                        </div>
                    )}

                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <div className="flex justify-center mb-1">
                            <Briefcase className="w-4 h-4 text-indigo-600 opactiy-70" />
                        </div>
                        <span className="block font-black text-indigo-700 text-2xl">{safeStats.jornadasCount}</span>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Días Trabajados</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span>Actividad registrada</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(), 'MMMM yyyy', { locale: es })}</span>
                </div>
            </CardContent>
        </Card>
    );
}
