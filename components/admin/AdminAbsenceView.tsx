'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { User, Calendar, CheckCircle, XCircle, Clock, FileText, ChevronRight, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminAbsenceView() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showOnlyPending, setShowOnlyPending] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const res = await fetch('/api/ausencias/stats');
            if (res.ok) {
                const data = await res.json();
                // Sort: Pending first, then by name
                data.sort((a: any, b: any) => {
                    if (a.diasSolicitados > 0 && b.diasSolicitados === 0) return -1;
                    if (a.diasSolicitados === 0 && b.diasSolicitados > 0) return 1;
                    return a.nombre.localeCompare(b.nombre);
                });
                setEmployees(data);
                // Refresh selected employee if open
                if (selectedEmployee) {
                    const updated = data.find((e: any) => e.empleadoId === selectedEmployee.empleadoId);
                    if (updated) setSelectedEmployee(updated);
                }
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    }

    async function updateStatus(id: number, estado: string) {
        if (!confirm(`¿Confirmar acción: ${estado}?`)) return;

        try {
            const res = await fetch(`/api/ausencias/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado })
            });

            if (res.ok) {
                fetchStats();
            } else {
                alert("Error al actualizar estado");
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function deleteAbsence(id: number) {
        if (!confirm("¿Seguro que quieres eliminar esta solicitud? Esta acción no se puede deshacer.")) return;

        try {
            const res = await fetch(`/api/ausencias/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // Remove from local state
                if (selectedEmployee) {
                    setSelectedEmployee({
                        ...selectedEmployee,
                        ausencias: selectedEmployee.ausencias.filter((a: any) => a.id !== id)
                    });
                }
                fetchStats();
            } else {
                alert("Error al eliminar");
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (loading) return <div className="p-4 text-center text-gray-500">Cargando datos de personal...</div>;

    const filteredEmployees = showOnlyPending
        ? employees.filter(e => e.diasSolicitados > 0)
        : employees;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-500" />
                    Listado de Empleados
                </h3>
                <Button
                    variant={showOnlyPending ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setShowOnlyPending(!showOnlyPending)}
                    className={showOnlyPending ? "bg-yellow-500 hover:bg-yellow-600 text-white border-none animate-pulse" : "text-gray-600 border-gray-300"}
                >
                    {showOnlyPending ? "Mostrando solo pendientes" : "Filtrar Pendientes"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEmployees.map(emp => (
                    <Card
                        key={emp.empleadoId}
                        className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${emp.diasSolicitados > 0 ? 'border-l-yellow-500 bg-yellow-50/30' : 'border-l-blue-500'}`}
                        onClick={() => setSelectedEmployee(emp)}
                    >
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-full shadow-sm">
                                        <User className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{emp.nombre}</p>
                                        <p className="text-xs text-gray-500 uppercase">{emp.rol}</p>
                                    </div>
                                </div>
                                {emp.diasSolicitados > 0 && (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {emp.diasSolicitados} Pendientes
                                    </span>
                                )}
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="bg-gray-100 p-2 rounded">
                                    <span className="block font-bold text-gray-700">{emp.totalVacaciones}</span>
                                    <span className="text-gray-500">Totales</span>
                                </div>
                                <div className="bg-blue-50 p-2 rounded">
                                    <span className="block font-bold text-blue-700">{emp.diasDisfrutados}</span>
                                    <span className="text-blue-600">Usados</span>
                                </div>
                                <div className="bg-green-50 p-2 rounded border border-green-100">
                                    <span className="block font-bold text-green-700 text-lg">{emp.diasRestantes}</span>
                                    <span className="text-green-600 font-bold uppercase">Restantes</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Modal Detail View */}
            {selectedEmployee && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedEmployee.nombre}</h2>
                                <p className="text-sm text-gray-500">Historial completo de ausencias y permisos</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(null)}>
                                Cerrar
                            </Button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {selectedEmployee.ausencias.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    No hay registros de ausencias.
                                </div>
                            ) : (
                                selectedEmployee.ausencias.map((aus: any) => (
                                    <div key={aus.id} className="border rounded-xl p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${aus.tipo === 'VACACIONES' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {aus.tipo}
                                                </span>
                                                <span className="text-sm font-bold text-gray-700">
                                                    {format(new Date(aus.fechaInicio), 'dd MMM yyyy', { locale: es })} - {format(new Date(aus.fechaFin), 'dd MMM yyyy', { locale: es })}
                                                </span>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${aus.estado === 'APROBADA' ? 'bg-green-100 text-green-700' :
                                                aus.estado === 'DENEGADA' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {aus.estado}
                                            </span>
                                        </div>

                                        {aus.observaciones && (
                                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-2 italic">
                                                "{aus.observaciones}"
                                            </p>
                                        )}

                                        {aus.justificanteUrl && (
                                            <a href={aus.justificanteUrl} target="_blank" className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline mb-3">
                                                <FileText className="w-3 h-3" /> Ver Justificante Adjunto
                                            </a>
                                        )}

                                        {aus.estado === 'PENDIENTE' && (
                                            <div className="flex gap-2 mt-2 pt-2 border-t">
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs w-full" onClick={() => updateStatus(aus.id, 'APROBADA')}>
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                                                </Button>
                                                <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 text-xs w-full" onClick={() => updateStatus(aus.id, 'DENEGADA')}>
                                                    <XCircle className="w-3 h-3 mr-1" /> Denegar
                                                </Button>
                                            </div>
                                        )}

                                        {/* Delete Button for Admin */}
                                        {aus.estado === 'APROBADA' && (
                                            <div className="mt-2 pt-2 border-t flex justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                                                    onClick={() => deleteAbsence(aus.id)}
                                                >
                                                    <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
