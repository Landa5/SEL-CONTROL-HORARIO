'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle, XCircle, Clock, Search, ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function ResultadosList() {
    const searchParams = useSearchParams();
    const moduloId = searchParams.get('moduloId');
    const [resultados, setResultados] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchResultados = async () => {
            try {
                const url = moduloId ? `/api/formacion/resultados?moduloId=${moduloId}` : '/api/formacion/resultados';
                const res = await fetch(url);
                if (res.ok) {
                    setResultados(await res.json());
                }
            } catch (error) {
                console.error('Error fetching results:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchResultados();
    }, [moduloId]);

    const filteredResultados = resultados.filter(r =>
        r.empleado.nombre.toLowerCase().includes(filter.toLowerCase()) ||
        r.empleado.apellidos?.toLowerCase().includes(filter.toLowerCase()) ||
        r.modulo.titulo.toLowerCase().includes(filter.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando resultados...</div>;

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/formacion">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 uppercase">Reporte de Formación</h1>
                        <p className="text-sm text-gray-500 font-medium">Seguimiento de cumplimiento y puntuaciones de los empleados.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar empleado o curso..."
                            className="pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 min-w-[250px]"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <Card className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                            <tr>
                                <th className="px-6 py-4">Empleado</th>
                                <th className="px-6 py-4">Módulo / Curso</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-center">Puntuación</th>
                                <th className="px-6 py-4 text-center">Intentos</th>
                                <th className="px-6 py-4 text-right">Fecha de Cierre</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredResultados.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        No se han encontrado resultados para los criterios seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                filteredResultados.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{r.empleado.nombre} {r.empleado.apellidos}</div>
                                            <div className="text-[10px] text-gray-400 font-black uppercase">{r.empleado.rol}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-700">{r.modulo.titulo}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {r.aprobado ? (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase">
                                                        <CheckCircle className="w-3 h-3" /> Aprobado
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-black uppercase">
                                                        <XCircle className="w-3 h-3" /> Suspenso
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-lg font-black ${r.puntuacion >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                                                {r.puntuacion}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 text-gray-500 font-medium">
                                                <Clock className="w-3 h-3" /> {r.intentos} / 2
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-xs font-bold text-gray-600">
                                                {format(new Date(r.completadoAl), "d 'de' MMMM, yyyy", { locale: es })}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                {format(new Date(r.completadoAl), 'HH:mm')}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

export default function AdminResultadosPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando reporte...</div>}>
            <ResultadosList />
        </Suspense>
    );
}
