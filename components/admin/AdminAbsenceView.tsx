'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { User, Calendar, Settings, LayoutDashboard, History } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import GlobalVacationsCalendar from './GlobalVacationsCalendar';
import AdminAbsenceConfig from './AdminAbsenceConfig';
import TodayOverview from './TodayOverview';
import AbsenceHistoryTable from './AbsenceHistoryTable';
import { toast } from "sonner";

interface Employee {
    empleadoId: number;
    nombre: string;
    rol: string;
    totalVacaciones: number;
    diasDisfrutados: number;
    diasRestantes: number;
    numSolicitudesPendientes: number;
    // ... other fields if needed for cards
}

export default function AdminAbsenceView() {
    const [stats, setStats] = useState<any>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'DASHBOARD' | 'CALENDAR' | 'EMPLOYEES'>('DASHBOARD');
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    useEffect(() => {
        fetchAllData();

        const view = searchParams.get('view');
        const date = searchParams.get('date');

        if (view === 'CALENDAR') {
            setViewMode('CALENDAR');
            if (date) {
                setCalendarDate(new Date(date));
            }
        }
    }, [searchParams]);

    // Update URL when view changes manually
    const handleViewChange = (mode: 'DASHBOARD' | 'CALENDAR' | 'EMPLOYEES') => {
        setViewMode(mode);
        // Optional: Update URL to reflect state, or keep it simple.
        // For now, let's clear params when switching manually to avoid getting stuck
        if (mode === 'DASHBOARD') router.push(pathname);
    };

    async function fetchAllData() {
        setLoading(true);
        try {
            const [dashboardRes, statsRes] = await Promise.all([
                fetch('/api/admin/ausencias/dashboard'),
                fetch('/api/ausencias/stats')
            ]);

            if (dashboardRes.ok) {
                const data = await dashboardRes.json();
                setStats(data);
            }

            if (statsRes.ok) {
                const empData = await statsRes.json();
                setEmployees(empData);
            }

        } catch (error) {
            console.error("Error loading dashboard:", error);
            toast.error("Error al cargar datos.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header / Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
                <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-blue-600" />
                    Gestión de Ausencias
                </h3>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                    <Button
                        variant={viewMode === 'DASHBOARD' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleViewChange('DASHBOARD')}
                        className="flex items-center gap-2"
                    >
                        <LayoutDashboard className="w-4 h-4" /> Dashboard Hoy
                    </Button>
                    <Button
                        variant={viewMode === 'CALENDAR' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleViewChange('CALENDAR')}
                        className="flex items-center gap-2"
                    >
                        <Calendar className="w-4 h-4" /> Calendario Global
                    </Button>
                    <Button
                        variant={viewMode === 'EMPLOYEES' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleViewChange('EMPLOYEES')}
                        className="flex items-center gap-2"
                    >
                        <User className="w-4 h-4" /> Saldos Vacaciones
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsConfigOpen(true)}
                        className="text-gray-500 hover:text-gray-900 border border-gray-200"
                        title="Configuración"
                    >
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <AdminAbsenceConfig open={isConfigOpen} onOpenChange={setIsConfigOpen} />

            {/* VIEWS */}
            {viewMode === 'DASHBOARD' && stats && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <TodayOverview stats={stats} loading={loading} />
                    <AbsenceHistoryTable history={stats.history} />
                </div>
            )}

            {viewMode === 'CALENDAR' && (
                <div className="animate-in fade-in duration-500">
                    <GlobalVacationsCalendar initialDate={calendarDate} />
                </div>
            )}

            {viewMode === 'EMPLOYEES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
                    {employees.map(emp => (
                        <Card key={emp.empleadoId} className="border-l-4 border-l-blue-500">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="font-bold text-gray-900">{emp.nombre}</p>
                                        <p className="text-xs text-gray-500 uppercase">{emp.rol}</p>
                                    </div>
                                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                                        {emp.diasRestantes} Restantes
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-center">
                                    <div className="bg-gray-100 p-2 rounded">
                                        <span className="block font-bold">{emp.totalVacaciones}</span> Total
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded">
                                        <span className="block font-bold">{emp.diasDisfrutados}</span> Usados
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

