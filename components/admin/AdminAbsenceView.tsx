'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { User, Calendar, Settings, LayoutDashboard, History, ChevronRight, Search, Clock } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import GlobalVacationsCalendar from './GlobalVacationsCalendar';
import AdminAbsenceConfig from './AdminAbsenceConfig';
import TodayOverview from './TodayOverview';
import AbsenceHistoryTable from './AbsenceHistoryTable';
import EmployeeAbsenceDetail from './EmployeeAbsenceDetail';
import { toast } from "sonner";

interface Employee {
    empleadoId: number;
    nombre: string;
    usuario: string;
    rol: string;
    totalVacaciones: number;
    diasExtras: number;
    horasExtra: number;
    diasDisfrutados: number;
    diasRestantes: number;
    diasSolicitados: number;
    numSolicitudesPendientes: number;
    ausencias: any[];
    compensaciones?: any[];
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
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

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

    // Filter employees by search term
    const filteredEmployees = employees.filter(emp =>
        emp.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.rol.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div className="animate-in fade-in duration-500 space-y-4">
                    {/* Search bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar empleado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredEmployees.map(emp => {
                            const totalDias = emp.totalVacaciones + (emp.diasExtras || 0);
                            const pctUsed = totalDias > 0 ? Math.min((emp.diasDisfrutados / totalDias) * 100, 100) : 0;

                            return (
                                <Card
                                    key={emp.empleadoId}
                                    className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg hover:border-l-indigo-600 transition-all duration-200 group"
                                    onClick={() => setSelectedEmployee(emp)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{emp.nombre}</p>
                                                <p className="text-xs text-gray-500 uppercase">{emp.rol}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {emp.numSolicitudesPendientes > 0 && (
                                                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">
                                                        <Clock className="w-3 h-3" />
                                                        {emp.numSolicitudesPendientes}
                                                    </span>
                                                )}
                                                <div className={`px-2 py-1 rounded text-xs font-bold ${
                                                    emp.diasRestantes > 10 ? 'bg-green-50 text-green-700' :
                                                    emp.diasRestantes > 0 ? 'bg-blue-50 text-blue-700' :
                                                    'bg-red-50 text-red-700'
                                                }`}>
                                                    {emp.diasRestantes} Restantes
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs text-center mb-3">
                                            <div className="bg-gray-100 p-2 rounded">
                                                <span className="block font-bold text-gray-700">{totalDias}</span> Total
                                            </div>
                                            <div className="bg-blue-50 p-2 rounded">
                                                <span className="block font-bold text-blue-600">{emp.diasDisfrutados}</span> Usados
                                            </div>
                                            <div className="bg-green-50 p-2 rounded">
                                                <span className="block font-bold text-green-600">{emp.diasRestantes}</span> Saldo
                                            </div>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden mb-2">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    pctUsed > 90 ? 'bg-red-500' : pctUsed > 70 ? 'bg-amber-500' : 'bg-blue-500'
                                                }`}
                                                style={{ width: `${pctUsed}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400">{pctUsed.toFixed(0)}% consumido</span>
                                            <span className="text-xs text-blue-500 font-medium group-hover:text-indigo-600 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Ver detalle <ChevronRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Employee Absence Detail Drawer */}
            {selectedEmployee && (
                <EmployeeAbsenceDetail
                    employee={selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                />
            )}
        </div>
    );
}

