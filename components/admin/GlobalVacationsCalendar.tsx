'use client';

import React, { useState, useEffect } from 'react';

import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
    isSameDay, addMonths, subMonths, isWithinInterval, parseISO,
    startOfYear, endOfYear, eachWeekOfInterval, startOfWeek, endOfWeek,
    addYears, subYears, isValid, getYear, setMonth, getMonth, isWeekend
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter, Calendar as CalendarIcon, Grid, List } from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface Vacation {
    id: number;
    fechaInicio: string;
    fechaFin: string;
    estado: 'APROBADA' | 'PENDIENTE'; // Added status
    empleado: {
        id: number;
        nombre: string;
        apellidos: string | null;
        rol: string;
    };
}

type ViewScope = 'MONTH' | 'SEMESTER' | 'YEAR';
type Grouping = 'DAY' | 'WEEK' | 'FORTNIGHT';

export default function GlobalVacationsCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [vacations, setVacations] = useState<Vacation[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [holidays, setHolidays] = useState<any[]>([]); // New state
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<string>('TODOS');

    // New State
    const [viewScope, setViewScope] = useState<ViewScope>('MONTH');
    const [grouping, setGrouping] = useState<Grouping>('DAY');

    useEffect(() => {
        fetchData();
    }, []);

    // Force grouping constraints
    useEffect(() => {
        if (viewScope === 'MONTH') {
            setGrouping('DAY');
        } else if (grouping === 'DAY') {
            setGrouping('WEEK'); // Default to WEEK for wider scopes
        }
    }, [viewScope]);

    async function fetchData() {
        try {
            const [vacRes, empRes, holidayRes] = await Promise.all([
                fetch('/api/ausencias/approved'),
                fetch('/api/empleados'),
                fetch('/api/admin/fiestas')
            ]);

            if (vacRes.ok) {
                const data = await vacRes.json();
                setVacations(data);
            }
            if (empRes.ok) {
                const empData = await empRes.json();
                setEmployees(empData.filter((e: any) => e.activo));
            }
            if (holidayRes.ok) {
                const hData = await holidayRes.json();
                setHolidays(hData);
            }
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }

    const handleNext = () => {
        if (viewScope === 'MONTH') setCurrentDate(addMonths(currentDate, 1));
        if (viewScope === 'SEMESTER') setCurrentDate(addMonths(currentDate, 6));
        if (viewScope === 'YEAR') setCurrentDate(addYears(currentDate, 1));
    };

    const handlePrev = () => {
        if (viewScope === 'MONTH') setCurrentDate(subMonths(currentDate, 1));
        if (viewScope === 'SEMESTER') setCurrentDate(subMonths(currentDate, 6));
        if (viewScope === 'YEAR') setCurrentDate(subYears(currentDate, 1));
    };

    const getIntervals = () => {
        let start: Date, end: Date;

        if (viewScope === 'MONTH') {
            start = startOfMonth(currentDate);
            end = endOfMonth(currentDate);
            return eachDayOfInterval({ start, end }).map(date => {
                // Check if holiday
                const holiday = holidays.find(h => isSameDay(new Date(h.fecha), date));
                const isWe = isWeekend(date);

                return {
                    start: date,
                    end: date,
                    label: format(date, 'd'),
                    subLabel: format(date, 'EEEEE', { locale: es }),
                    id: date.toISOString(),
                    isWeekend: isWe,
                    holiday: holiday
                };
            });
        }

        if (viewScope === 'SEMESTER') {
            const currentMonth = getMonth(currentDate);
            const isSecondSemester = currentMonth >= 6;
            start = new Date(getYear(currentDate), isSecondSemester ? 6 : 0, 1);
            end = endOfMonth(new Date(getYear(currentDate), isSecondSemester ? 11 : 5, 1));
        } else { // YEAR
            start = startOfYear(currentDate);
            end = endOfYear(currentDate);
        }

        if (grouping === 'WEEK') {
            const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
            return weeks.map(weekStart => {
                const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                // Check if full week matches a holiday? Unlikely for single day holidays.
                // Just keep standard styling for weeks.
                return {
                    start: weekStart,
                    end: weekEnd,
                    label: `S${format(weekStart, 'w')}`,
                    subLabel: format(weekStart, 'MMM', { locale: es }),
                    id: weekStart.toISOString(),
                    isWeekend: false,
                    holiday: null
                };
            });
        }

        if (grouping === 'FORTNIGHT') {
            const intervals = [];
            let cursor = start;
            while (cursor <= end) {
                const monthEnd = endOfMonth(cursor);
                const midMonth = new Date(getYear(cursor), getMonth(cursor), 15);

                // First Fortnight: 1-15
                if (midMonth >= cursor && midMonth <= end) {
                    intervals.push({
                        start: cursor,
                        end: midMonth,
                        label: 'Q1',
                        subLabel: format(cursor, 'MMM', { locale: es }),
                        id: cursor.toISOString() + '_1',
                        isWeekend: false,
                        holiday: null
                    });
                }

                // Second Fortnight: 16-End
                const secondStart = new Date(getYear(cursor), getMonth(cursor), 16);
                if (secondStart <= end) {
                    intervals.push({
                        start: secondStart,
                        end: monthEnd > end ? end : monthEnd,
                        label: 'Q2',
                        subLabel: format(cursor, 'MMM', { locale: es }),
                        id: secondStart.toISOString() + '_2',
                        isWeekend: false,
                        holiday: null
                    });
                }

                cursor = addMonths(cursor, 1);
                cursor = startOfMonth(cursor);
            }
            return intervals;
        }

        return [];
    };

    const intervals = getIntervals();

    // Filter employees from the master list
    const filteredEmployees = selectedRole === 'TODOS'
        ? employees
        : employees.filter(emp => emp.rol === selectedRole);

    const roles = Array.from(new Set(employees.map(e => e.rol))).filter(Boolean);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando calendario...</div>;

    const getTitle = () => {
        if (viewScope === 'MONTH') return format(currentDate, 'MMMM yyyy', { locale: es });
        if (viewScope === 'YEAR') return format(currentDate, 'yyyy', { locale: es });
        if (viewScope === 'SEMESTER') {
            const isSecond = getMonth(currentDate) >= 6;
            return `${isSecond ? '2º' : '1º'} Semestre ${format(currentDate, 'yyyy')}`;
        }
    };

    // Helper for holiday color
    const getHolidayColor = (ambito: string) => {
        switch (ambito) {
            case 'NACIONAL': return 'bg-red-100 text-red-700 font-bold';
            case 'AUTONOMICO': return 'bg-orange-100 text-orange-700 font-bold';
            case 'LOCAL': return 'bg-purple-100 text-purple-700 font-bold';
            default: return 'bg-gray-200 text-gray-700';
        }
    };

    return (
        <Card className="shadow-lg border-none overflow-hidden">
            <div className="bg-white p-4 border-b space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    {/* Navigation & Title */}
                    <div className="flex items-center gap-4 bg-gray-50 p-1 rounded-lg">
                        <Button variant="ghost" size="sm" onClick={handlePrev} className="h-8 w-8 p-0">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <span className="px-4 py-1 font-bold text-gray-700 capitalize min-w-[180px] text-center">
                            {getTitle()}
                        </span>
                        <Button variant="ghost" size="sm" onClick={handleNext} className="h-8 w-8 p-0">
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* View Controls */}
                    <div className="flex gap-2">
                        <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-medium">
                            <button
                                onClick={() => setViewScope('MONTH')}
                                className={`px-3 py-1 rounded transition-all ${viewScope === 'MONTH' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Mes
                            </button>
                            <button
                                onClick={() => setViewScope('SEMESTER')}
                                className={`px-3 py-1 rounded transition-all ${viewScope === 'SEMESTER' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Semestre
                            </button>
                            <button
                                onClick={() => setViewScope('YEAR')}
                                className={`px-3 py-1 rounded transition-all ${viewScope === 'YEAR' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Año
                            </button>
                        </div>

                        {viewScope !== 'MONTH' && (
                            <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-medium">
                                <button
                                    onClick={() => setGrouping('WEEK')}
                                    className={`px-3 py-1 rounded transition-all ${grouping === 'WEEK' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Semanas
                                </button>
                                <button
                                    onClick={() => setGrouping('FORTNIGHT')}
                                    className={`px-3 py-1 rounded transition-all ${grouping === 'FORTNIGHT' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Quincenas
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                    {/* Leyenda */}
                    <div className="flex items-center gap-3 mr-4 text-[10px] text-gray-500">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded"></div> Aprobadas</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400 rounded"></div> Pendientes</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div> Fest. Nac.</div>
                    </div>

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
                <div style={{ minWidth: intervals.length * (grouping === 'DAY' ? 30 : 60) + 200 }}>
                    {/* Header Row */}
                    <div className="flex border-b bg-gray-50">
                        <div className="w-48 flex-shrink-0 p-3 font-bold text-gray-600 border-r bg-gray-100 sticky left-0 z-20 shadow-sm">
                            Empleado
                        </div>
                        {intervals.map(iv => {
                            let cellClass = `flex-1 min-w-[${grouping === 'DAY' ? '30px' : '60px'}] text-center p-2 text-xs border-r border-gray-200 last:border-r-0`;

                            // Highlight styles
                            if (iv.holiday) {
                                cellClass += ` ${getHolidayColor(iv.holiday.ambito)}`;
                            } else if (iv.isWeekend) {
                                cellClass += ' bg-gray-100 text-gray-400';
                            } else if (grouping === 'DAY' && isSameDay(iv.start, new Date())) {
                                cellClass += ' bg-blue-100 text-blue-700 font-bold';
                            }

                            return (
                                <div key={iv.id} className={cellClass} title={iv.holiday?.nombre}>
                                    <div className="font-bold">{iv.label}</div>
                                    <div className={`text-[10px] uppercase ${!iv.holiday ? 'text-gray-400' : ''}`}>{iv.subLabel}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Employee Rows */}
                    {filteredEmployees.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic">
                            No hay empleados activos en este criterio.
                        </div>
                    ) : (
                        filteredEmployees.map(emp => (
                            <div key={emp.id} className="flex border-b hover:bg-gray-50 transition-colors">
                                <div className="w-48 flex-shrink-0 p-3 border-r bg-white sticky left-0 z-10 flex flex-col justify-center shadow-sm">
                                    <span className="font-medium text-gray-800 text-sm truncate" title={`${emp.nombre} ${emp.apellidos || ''}`}>
                                        {emp.nombre} {emp.apellidos}
                                    </span>
                                    <span className="text-[10px] text-gray-400 uppercase">{emp.rol}</span>
                                </div>
                                {intervals.map(iv => {
                                    // Highlighting for cells
                                    let cellClass = `flex-1 min-w-[${grouping === 'DAY' ? '30px' : '60px'}] border-r border-gray-100 last:border-r-0 p-1 relative`;
                                    if (iv.holiday) cellClass += ` ${getHolidayColor(iv.holiday.ambito)} bg-opacity-30`; // Lighter fetch for body cells
                                    else if (iv.isWeekend) cellClass += ' bg-gray-50';

                                    // Find Matching Vacation
                                    const vacation = vacations.find(v => {
                                        if (v.empleado.id !== emp.id) return false;
                                        const vacStart = parseISO(v.fechaInicio as any); // Type assertion if string
                                        const vacEnd = parseISO(v.fechaFin as any);
                                        return (vacStart <= iv.end) && (vacEnd >= iv.start);
                                    });

                                    return (
                                        <div key={iv.id} className={cellClass}>
                                            {vacation && (
                                                <div
                                                    className={`absolute inset-1 rounded-sm shadow-sm ${vacation.estado === 'PENDIENTE' ? 'bg-yellow-400' : 'bg-blue-500/80'}`}
                                                    title={`${vacation.estado} - ${format(new Date(vacation.fechaInicio), 'd MMM')} a ${format(new Date(vacation.fechaFin), 'd MMM')}`}
                                                ></div>
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
