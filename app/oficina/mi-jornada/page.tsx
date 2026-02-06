'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, CheckCircle } from 'lucide-react';

export default function OficinaMiJornadaPage() {
    const router = useRouter();
    const [jornada, setJornada] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/jornadas?date=${new Date().toISOString()}`);
            if (res.ok) {
                const data = await res.json();
                setJornada(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleClockIn = async () => {
        try {
            const res = await fetch('/api/jornadas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: new Date(),
                    horaEntrada: new Date(),
                    estado: 'TRABAJANDO'
                })
            });
            if (res.ok) {
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    const handleClockOut = async () => {
        if (!jornada) return;
        try {
            const res = await fetch('/api/jornadas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: jornada.id,
                    horaSalida: new Date(),
                    observaciones
                })
            });
            if (res.ok) {
                setObservaciones('');
                await fetchData();
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <header className="bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mi Control de Tiempo (Personal)</h1>
                    <p className="text-gray-500 text-sm">Registro de entrada y salida para personal de administración.</p>
                </div>
            </header>

            <Card className="shadow-sm overflow-hidden border-t-4 border-t-green-700">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="w-5 h-5 text-green-700" /> Registro Diario
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {!jornada ? (
                        <div className="py-8 text-center space-y-4">
                            <p className="text-gray-500 italic">No has iniciado jornada hoy.</p>
                            <Button onClick={handleClockIn} size="xl" className="w-full bg-green-700 hover:bg-green-800 h-24 text-2xl font-bold shadow-lg">
                                ENTRADA
                            </Button>
                        </div>
                    ) : !jornada.horaSalida ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-green-50 rounded-xl border border-green-100 text-center">
                                    <p className="text-[10px] text-green-700 font-bold uppercase mb-1">Entrada Registrada</p>
                                    <p className="text-4xl font-mono font-bold text-gray-900">{format(new Date(jornada.horaEntrada), 'HH:mm')}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Estado</p>
                                    <p className="text-xl font-bold text-green-600 mt-2 uppercase tracking-wide">Activo</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-500 uppercase">Notas de la jornada</label>
                                <textarea
                                    className="w-full border rounded-xl p-4 text-sm focus:ring-2 focus:ring-green-700 min-h-[100px]"
                                    placeholder="Añadir observaciones sobre el trabajo de hoy..."
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                />
                            </div>

                            <Button onClick={handleClockOut} size="xl" className="w-full bg-red-600 hover:bg-red-700 h-24 text-2xl font-bold shadow-lg">
                                SALIDA
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center p-12 bg-green-50 rounded-xl border border-green-100 space-y-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-green-700 font-bold text-xl">Día Registrado</p>
                                <p className="text-gray-500">Has guardado satisfactoriamente tus horas de hoy.</p>
                            </div>
                            <div className="pt-4 flex justify-center gap-4 text-sm font-medium text-gray-500">
                                <span>Entrada: {format(new Date(jornada.horaEntrada), 'HH:mm')}</span>
                                <span>Salida: {format(new Date(jornada.horaSalida), 'HH:mm')}</span>
                            </div>
                            <Button onClick={handleClockIn} variant="outline" className="mt-6 border-green-200 text-green-700 hover:bg-green-100">Nueva Entrada</Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 flex items-center gap-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                    <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                    <h4 className="font-bold text-gray-700 text-sm">Vista Personal</h4>
                    <p className="text-[11px] text-gray-400 leading-tight">Esta es tu vista privada de registro. Los controles de flota y kilómetros solo están disponibles para personal operativo y técnicos.</p>
                </div>
            </div>
        </div>
    );
}
