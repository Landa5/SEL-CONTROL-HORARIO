"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function EmployeeAbsenceView() {
    const [activeTab, setActiveTab] = useState<'VACACIONES' | 'BAJA'>('VACACIONES');
    const [ausencias, setAusencias] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form States
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [file, setFile] = useState<File | null>(null);

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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('tipo', activeTab);
            formData.append('fechaInicio', fechaInicio);
            if (fechaFin) formData.append('fechaFin', fechaFin);
            if (observaciones) formData.append('observaciones', observaciones);
            if (file) formData.append('justificante', file);

            const res = await fetch('/api/ausencias', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                // Reset form
                setFechaInicio("");
                setFechaFin("");
                setObservaciones("");
                setFile(null);
                fetchAusencias();
            } else {
                alert("Error al enviar solicitud");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setLoading(false);
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
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                        <button
                            className={`px-4 py-2 font-bold w-full sm:w-auto ${activeTab === 'VACACIONES' ? 'border-b-2 border-blue-500 bg-blue-50 sm:bg-transparent' : ''}`}
                            onClick={() => setActiveTab('VACACIONES')}
                        >
                            Solicitar Vacaciones
                        </button>
                        <button
                            className={`px-4 py-2 font-bold w-full sm:w-auto ${activeTab === 'BAJA' ? 'border-b-2 border-blue-500 bg-blue-50 sm:bg-transparent' : ''}`}
                            onClick={() => setActiveTab('BAJA')}
                        >
                            Notificar Baja / Ausencia
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Fecha Inicio</label>
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Fecha Fin</label>
                                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} required />
                            </div>
                        </div>

                        {activeTab === 'VACACIONES' ? (
                            <div>
                                <label className="block text-sm font-medium mb-1">Observaciones (Opcional)</label>
                                <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Motivo o comentarios..." />
                            </div>
                        ) : (
                            <div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-1">Observaciones / Motivo</label>
                                    <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Explica el motivo..." />
                                </div>
                                <label className="block text-sm font-medium mb-1">Justificante Médico (PDF/Imagen)</label>
                                <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,image/*" />
                            </div>
                        )}

                        <Button type="submit" disabled={loading}>
                            {loading ? 'Enviando...' : (activeTab === 'VACACIONES' ? 'Solicitar Vacaciones' : 'Registrar Baja')}
                        </Button>
                    </form>
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
