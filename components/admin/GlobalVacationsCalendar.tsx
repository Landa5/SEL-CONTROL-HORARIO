'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/Button"; // Assuming this exists based on previous file exploration
import { Card, CardContent } from "@/components/ui/Card";

interface Vacation {
    id: number;
    fechaInicio: string;
    fechaFin: string;
    empleado: {
        id: number;
        nombre: string;
        apellidos: string | null;
        rol: string;
    };
}

export default function GlobalVacationsCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [vacations, setVacations] = useState<Vacation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<string>('TODOS');

    useEffect(() => {
        fetchVacations();
    }, []);

    async function fetchVacations() {
        try {
            const res = await fetch('/api/ausencias/approved');
            if (res.ok) {
                const data = await res.json();
                setVacations(data);
            }
        } catch (error) {
            console.error("Error loading vacations:", error);
        } finally {
            setLoading(false);
        }
    }

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Generate days for the current month
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Filter employees and their vacations
    const uniqueEmployees = Array.from(new Set(vacations.map(v => v.empleado.id)))
        .map(id => vacations.find(v => v.empleado.id === id)?.empleado)
        .filter(emp => emp !== undefined)
        .sort((a, b) => a!.nombre.localeCompare(b!.nombre));

    const filteredEmployees = selectedRole === 'TODOS'
        ? uniqueEmployees
        : uniqueEmployees.filter(emp => emp?.rol === selectedRole);

    const roles = Array.from(new Set(uniqueEmployees.map(e => e?.rol))).filter(Boolean);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando calendario...</div>;

    return (
        <Card className="shadow-lg border-none overflow-hidden">
            <div className="bg-white p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 we-8 p-0 px-2">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <span className="px-4 py-1 font-bold text-gray-700 capitalize min-w-[140px] text-center">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </span>
                        <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0 px-2">
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        className="border border-gray-300 rounded-md text-sm p-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        <option value="TODOS">Todos los Roles</option>
                        {roles.map(rol => (
                            <option key={rol} value={rol}>{rol}</option>
                        ))}
                    </select>
                </div>
            </div>

            <CardContent className="p-0 overflow-x-auto">
                <div className="min-w-[800px]">
                    {/* Header Row: Days */}
                    <div className="flex border-b bg-gray-50">
                        <div className="w-48 flex-shrink-0 p-3 font-bold text-gray-600 border-r bg-gray-100 sticky left-0 z-10">
                            Empleado
                        </div>
                        {daysInMonth.map(day => (
                            <div key={day.toString()} className={`flex-1 min-w-[30px] text-center p-2 text-xs border-r last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-blue-100 font-bold text-blue-700' : ''
                                }`}>
                                <div className="font-bold">{format(day, 'd')}</div>
                                <div className="text-[10px] text-gray-400 uppercase">{format(day, 'EEEEE', { locale: es })}</div>
                            </div>
                        ))}
                    </div>

                    {/* Employee Rows */}
                    {filteredEmployees.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic">
                            No hay vacaciones aprobadas para este criterio.
                        </div>
                    ) : (
                        filteredEmployees.map(emp => (
                            <div key={emp!.id} className="flex border-b hover:bg-gray-50 transition-colors">
                                <div className="w-48 flex-shrink-0 p-3 border-r bg-white sticky left-0 z-10 flex flex-col justify-center">
                                    <span className="font-medium text-gray-800 text-sm truncate" title={`${emp!.nombre} ${emp!.apellidos || ''}`}>
                                        {emp!.nombre} {emp!.apellidos}
                                    </span>
                                    <span className="text-[10px] text-gray-400 uppercase">{emp!.rol}</span>
                                </div>
                                {daysInMonth.map(day => {
                                    // Check if this day is a vacation day for this employee
                                    const isVacation = vacations.some(v =>
                                        v.empleado.id === emp!.id &&
                                        isWithinInterval(day, {
                                            start: parseISO(v.fechaInicio),
                                            end: parseISO(v.fechaFin)
                                        })
                                    );

                                    return (
                                        <div key={day.toString()} className="flex-1 min-w-[30px] border-r last:border-r-0 p-1 relative">
                                            {isVacation && (
                                                <div className="absolute inset-1 bg-blue-500 rounded-sm shadow-sm" title="Vacaciones"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
