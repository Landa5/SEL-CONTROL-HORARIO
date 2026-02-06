'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Edit, Trash2, Eye, CheckCircle, Clock, BookOpen, Users, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminFormacionPage() {
    const [modulos, setModulos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchModulos = async () => {
        try {
            const res = await fetch('/api/formacion/modulos');
            if (res.ok) {
                setModulos(await res.json());
            }
        } catch (error) {
            console.error('Error fetching modules:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModulos();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este módulo?')) return;
        try {
            const res = await fetch(`/api/formacion/modulos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchModulos();
            } else {
                alert('Error al eliminar el módulo');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando módulos de formación...</div>;

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 to-indigo-700 p-8 rounded-2xl shadow-xl text-white">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Formación Interna</h1>
                    <p className="text-indigo-100 opacity-90">Gestiona cursos, materiales y evaluaciones para los empleados.</p>
                </div>
                <Link href="/admin/formacion/nuevo">
                    <Button className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold gap-2">
                        <Plus className="w-5 h-5" /> Nuevo Módulo
                    </Button>
                </Link>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Módulos Totales</p>
                            <p className="text-2xl font-black text-gray-900">{modulos.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-50 rounded-xl">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Módulos Activos</p>
                            <p className="text-2xl font-black text-gray-900">{modulos.filter(m => m.activo).length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-purple-50 rounded-xl">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Participaciones</p>
                            <p className="text-2xl font-black text-gray-900">
                                {modulos.reduce((acc, m) => acc + (m.resultados?.length || 0), 0)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Listado de Módulos</h3>
                    <Link href="/admin/formacion/nuevo">
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 text-xs">
                            <Plus className="w-4 h-4" /> NUEVO MÓDULO
                        </Button>
                    </Link>
                </div>
                {modulos.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        No hay módulos de formación creados todavía.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                                <tr>
                                    <th className="px-6 py-4">Módulo</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Fechas</th>
                                    <th className="px-6 py-4 text-center">Contenido</th>
                                    <th className="px-6 py-4 text-center">Resultados</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {modulos.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{m.titulo}</div>
                                            <div className="text-xs text-gray-500 line-clamp-1">{m.descripcion}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${m.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {m.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-xs font-medium text-gray-600">
                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(m.fechaInicio), 'dd/MM/yy')}</span>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(m.fechaFin), 'dd/MM/yy')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-xs font-bold text-gray-700">
                                                {m._count.temas} Temas / {m._count.preguntas} Preg.
                                            </div>
                                            <div className="text-[10px] text-gray-400">{m.duracionEstimada} min aprox.</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Link href={`/admin/formacion/resultados?moduloId=${m.id}`}>
                                                <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold uppercase tracking-widest gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                                    <Users className="w-3 h-3" /> Ver Reporte
                                                </Button>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/admin/formacion/editar/${m.id}`}>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)} className="h-8 w-8 text-red-600 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
