'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function EmployeeAbsenceSummary() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMyStats() {
            try {
                const res = await fetch('/api/ausencias/stats?me=true');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        setStats(data[0]); // User sees their own stats as single item array
                    }
                }
            } catch (error) {
                console.error("Error fetching personal stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchMyStats();
    }, []);

    // Default stats if null to ensures widget visibility
    const safeStats = stats || { totalVacaciones: 0, diasDisfrutados: 0, diasRestantes: 0, diasSolicitados: 0 };

    if (loading) return (
        <Card className="border-l-4 border-gray-200 shadow-sm animate-pulse">
            <CardContent className="p-6 h-32"></CardContent>
        </Card>
    );

    return (
        <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-all">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">
                    <Calendar className="w-5 h-5 text-indigo-600" /> Mis Vacaciones
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                    <div className="bg-gray-100 p-2 rounded">
                        <span className="block font-bold text-gray-700 text-lg">
                            {(safeStats.totalVacaciones || 0) + (safeStats.diasExtras || 0)}
                        </span>
                        <span className="text-gray-500">Total</span>
                    </div>
                    <div className="bg-indigo-50 p-2 rounded">
                        <span className="block font-bold text-indigo-700 text-lg">{safeStats.diasDisfrutados}</span>
                        <span className="text-indigo-600">Usados</span>
                    </div>
                    <div className="bg-green-50 p-2 rounded border border-green-100">
                        <span className="block font-bold text-green-700 text-xl">{safeStats.diasRestantes}</span>
                        <span className="text-green-600 font-bold uppercase">Saldo</span>
                    </div>
                </div>

                {safeStats.diasSolicitados > 0 && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600 font-bold bg-yellow-50 p-2 rounded border border-yellow-200">
                        <AlertCircle className="w-3 h-3" />
                        Tienes {safeStats.diasSolicitados} días pendientes de aprobación.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
