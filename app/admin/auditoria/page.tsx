
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, RefreshCw, Search, Filter, ShieldCheck, Clock, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AuditoriaPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchLogs = async (p = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/auditoria?page=${p}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data);
                setTotalPages(data.pagination.totalPages);
                setPage(data.pagination.page);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-slate-600" />
                        Auditoría Interna
                    </h1>
                    <p className="text-slate-500 font-medium">Registro de acciones críticas y seguridad del sistema</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Button>
                    <Button onClick={() => fetchLogs(page)} className="bg-slate-800 hover:bg-slate-700 flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <Card>
                <CardHeader className="border-b border-gray-100 bg-slate-50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-slate-700 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Registro de Eventos
                        </CardTitle>
                        <span className="text-xs font-mono text-slate-400">Mostrando {logs.length} registros</span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-bold">Fecha / Hora</th>
                                    <th className="px-6 py-3 font-bold">Usuario</th>
                                    <th className="px-6 py-3 font-bold">Rol</th>
                                    <th className="px-6 py-3 font-bold">Acción</th>
                                    <th className="px-6 py-3 font-bold">Entidad</th>
                                    <th className="px-6 py-3 font-bold">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                            Cargando registros...
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                            No hay registros de auditoría aún.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                    {format(new Date(log.createdAt), 'dd MMMM yyyy HH:mm:ss', { locale: es })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                        {log.usuario.nombre.charAt(0)}
                                                    </div>
                                                    <span className="font-semibold text-slate-700">{log.usuario.nombre} {log.usuario.apellidos}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${log.usuario.rol === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                        log.usuario.rol === 'OFICINA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {log.usuario.rol}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                    {log.accion}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {log.entidad} #{log.entidadId}
                                            </td>
                                            <td className="px-6 py-4">
                                                <pre className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded max-w-[300px] overflow-x-auto border border-gray-100 font-mono">
                                                    {typeof log.detalles === 'string' && log.detalles.startsWith('{')
                                                        ? JSON.stringify(JSON.parse(log.detalles), null, 2)
                                                        : log.detalles}
                                                </pre>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>

                {/* Pagination */}
                <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-between items-center">
                    <Button
                        disabled={page === 1}
                        onClick={() => fetchLogs(page - 1)}
                        variant="ghost"
                        size="sm"
                    >
                        Anterior
                    </Button>
                    <span className="text-xs font-bold text-slate-500">Página {page} de {totalPages}</span>
                    <Button
                        disabled={page >= totalPages}
                        onClick={() => fetchLogs(page + 1)}
                        variant="ghost"
                        size="sm"
                    >
                        Siguiente
                    </Button>
                </div>
            </Card>
        </div>
    );
}
