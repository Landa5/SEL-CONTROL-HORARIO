'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Truck, AlertCircle, Clock, CheckCircle, ArrowRight, Home } from 'lucide-react';

export default function MisTareasPage() {
    const router = useRouter();
    const [tareas, setTareas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('TODAS');
    const [session, setSession] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            await fetchSession();
            await fetchTareas();
        };
        load();
    }, []);

    const fetchSession = async () => {
        const res = await fetch('/api/auth/session');
        if (res.ok) setSession(await res.json());
    };

    const fetchTareas = async () => {
        try {
            const res = await fetch('/api/tareas');
            if (res.ok) {
                setTareas(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filtradas = tareas.filter(t => filtroEstado === 'TODAS' || t.estado === filtroEstado);

    const getPriorityColor = (p: string) => {
        if (p === 'ALTA') return 'text-red-600 bg-red-50';
        if (p === 'MEDIA') return 'text-orange-600 bg-orange-50';
        return 'text-green-600 bg-green-50';
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando tus tickets...</div>;

    const isConductor = session?.rol === 'CONDUCTOR';

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            Mis Averías e Incidencias
                        </h1>
                        <p className="text-gray-500 text-sm">
                            Consulta la evolución de los reportes que has enviado al taller.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push(isConductor ? '/empleado' : '/oficina/dashboard')} className="gap-2">
                        <Home className="w-4 h-4" /> Volver al Inicio
                    </Button>
                </header>

                <div className="flex bg-white p-1 rounded-lg border shadow-sm w-fit">
                    {['TODAS', 'ABIERTA', 'EN_CURSO', 'CERRADA'].map(e => (
                        <button
                            key={e}
                            onClick={() => setFiltroEstado(e)}
                            className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${filtroEstado === e ? 'bg-blue-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {e === 'TODAS' ? 'Todos' : e.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filtradas.map((t) => (
                        <Card key={t.id} className="hover:border-blue-500 transition-colors cursor-pointer shadow-sm" onClick={() => router.push(`/tareas/${t.id}`)}>
                            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 w-full">
                                    <div className={`p-3 rounded-lg ${getPriorityColor(t.prioridad)}`}>
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900">{t.titulo}</h3>
                                            <span className="text-[10px] text-gray-400">#{t.id}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 uppercase font-medium">
                                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded"><Truck className="w-3 h-3" /> {t.matricula || t.activoTipo}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(t.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between w-full md:w-auto gap-8 border-t md:border-t-0 pt-4 md:pt-0">
                                    <div className="text-left md:text-right">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Estado</p>
                                        <p className={`text-sm font-bold ${t.estado === 'ABIERTA' ? 'text-yellow-600' : t.estado === 'EN_CURSO' ? 'text-blue-600' : 'text-green-600'}`}>
                                            {t.estado}
                                        </p>
                                    </div>
                                    <ArrowRight className="text-gray-300 w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {filtradas.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed text-gray-400">
                            No tienes averías registradas en este estado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
