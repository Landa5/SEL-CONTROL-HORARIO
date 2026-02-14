"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import AbsenceForm from '@/components/ausencias/AbsenceForm';

export default function EmployeeAbsenceView() {
    const [ausencias, setAusencias] = useState<any[]>([]);

    useEffect(() => {
        fetchAusencias();
    }, []);

    async function fetchAusencias() {
        try {
            const res = await fetch('/api/ausencias');
            if (res.ok) {
                const data = await res.json();
                setAusencias(data);
            }
        } catch (error) {
            console.error("Error fetching absences:", error);
        }
    }

    const getStatusColor = (ausencia: any) => {
        const isPast = new Date(ausencia.fechaFin) < new Date();
        if (ausencia.estado === 'PENDIENTE') return 'text-green-600 font-bold';
        if (ausencia.estado === 'APROBADA' && isPast) return 'text-red-600'; // Disfrutada logic
        if (ausencia.estado === 'DENEGADA') return 'text-gray-500 line-through';
        return 'text-blue-600';
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Nueva Solicitud</CardTitle>
                </CardHeader>
                <CardContent>
                    <AbsenceForm onSuccess={fetchAusencias} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Mis Solicitudes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 uppercase">
                                <tr>
                                    <th className="px-4 py-2">Tipo</th>
                                    <th className="px-4 py-2">Fechas</th>
                                    <th className="px-4 py-2">Estado</th>
                                    <th className="px-4 py-2">Info</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ausencias.map(ausencia => (
                                    <tr key={ausencia.id} className="border-b">
                                        <td className="px-4 py-2">{ausencia.tipo}</td>
                                        <td className="px-4 py-2">
                                            {new Date(ausencia.fechaInicio).toLocaleDateString()} - {new Date(ausencia.fechaFin).toLocaleDateString()}
                                        </td>
                                        <td className={`px-4 py-2 ${getStatusColor(ausencia)}`}>
                                            {ausencia.estado}
                                        </td>
                                        <td className="px-4 py-2">
                                            {ausencia.justificanteUrl && (
                                                <a href={ausencia.justificanteUrl} target="_blank" className="text-blue-500 underline" rel="noopener noreferrer">
                                                    Ver Justificante
                                                </a>
                                            )}
                                            {ausencia.observaciones && <span className="text-gray-500 italic ml-2">{ausencia.observaciones}</span>}
                                        </td>
                                    </tr>
                                ))}
                                {ausencias.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-4 text-center text-gray-500">No hay registros.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
