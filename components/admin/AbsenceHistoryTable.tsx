'use client';

import React, { useState } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/Table";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, AlertTriangle } from 'lucide-react';

interface EmployeeSimple {
    id: number;
    nombre: string;
    apellidos: string | null;
    rol: string;
}

interface Absence {
    id: number;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    horas?: number | null;
    justificanteUrl?: string | null;
    empleado: EmployeeSimple;
}

interface AbsenceHistoryTableProps {
    history: Absence[];
}

export default function AbsenceHistoryTable({ history }: AbsenceHistoryTableProps) {
    const [filterType, setFilterType] = useState<string>('TODOS');
    const [filterState, setFilterState] = useState<string>('TODOS');

    const filteredHistory = history.filter(abs => {
        if (filterType !== 'TODOS' && abs.tipo !== filterType) return false;
        if (filterState !== 'TODOS' && abs.estado !== filterState) return false;
        return true;
    });

    const getStatusColor = (estado: string) => {
        switch (estado) {
            case 'APROBADA': return 'bg-green-100 text-green-700';
            case 'DENEGADA': return 'bg-red-100 text-red-700';
            case 'PENDIENTE': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getTypeColor = (tipo: string) => {
        switch (tipo) {
            case 'VACACIONES': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'BAJA': return 'bg-orange-50 text-orange-700 border-orange-100';
            case 'PERMISO': return 'bg-purple-50 text-purple-700 border-purple-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-700">Historial Reciente</h3>
                <div className="flex gap-2">
                    <select
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="TODOS">Todos los Tipos</option>
                        <option value="VACACIONES">Vacaciones</option>
                        <option value="BAJA">Bajas</option>
                        <option value="PERMISO">Permisos</option>
                    </select>
                    <select
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={filterState}
                        onChange={(e) => setFilterState(e.target.value)}
                    >
                        <option value="TODOS">Todos los Estados</option>
                        <option value="PENDIENTE">Pendientes</option>
                        <option value="APROBADA">Aprobadas</option>
                        <option value="DENEGADA">Denegadas</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empleado</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Fechas</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Adjunto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                    No hay registros que coincidan con los filtros.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredHistory.map(abs => (
                                <TableRow key={abs.id} className="hover:bg-gray-50">
                                    <TableCell>
                                        <div className="font-medium">{abs.empleado.nombre} {abs.empleado.apellidos}</div>
                                        <div className="text-xs text-gray-500 uppercase">{abs.empleado.rol}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getTypeColor(abs.tipo)} uppercase`}>
                                            {abs.tipo} {abs.horas ? `(${abs.horas}h)` : ''}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-gray-700">
                                            {format(new Date(abs.fechaInicio), 'dd MMM yyyy', { locale: es })}
                                            {abs.fechaInicio !== abs.fechaFin && (
                                                <> - {format(new Date(abs.fechaFin), 'dd MMM yyyy', { locale: es })}</>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(abs.estado)}`}>
                                            {abs.estado}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {abs.justificanteUrl ? (
                                            <a href={abs.justificanteUrl} target="_blank" className="text-blue-600 hover:text-blue-800" title="Ver Justificante">
                                                <FileText className="w-4 h-4" />
                                            </a>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
