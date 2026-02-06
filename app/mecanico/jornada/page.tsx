'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Truck, Droplet, Clock, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

export default function MecanicoJornadaPage() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [jornada, setJornada] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [camiones, setCamiones] = useState<any[]>([]);

    // Form states
    const [observaciones, setObservaciones] = useState('');

    // Shift states
    const [activeTurno, setActiveTurno] = useState<any>(null);
    const [selectedCamion, setSelectedCamion] = useState('');
    const [kmInicial, setKmInicial] = useState('');
    const [kmFinal, setKmFinal] = useState('');

    // Delivery states
    const [litros, setLitros] = useState('');
    const [lugar, setLugar] = useState('');
    const [tipoGasoil, setTipoGasoil] = useState('A');

    useEffect(() => {
        const load = async () => {
            await fetchSession();
            await fetchData();
            await fetchCamiones();
        };
        load();
    }, []);

    const fetchSession = async () => {
        const res = await fetch('/api/auth/session');
        if (res.ok) setSession(await res.json());
    };

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/jornadas?date=${new Date().toISOString()}`);
            if (res.ok) {
                const data = await res.json();
                setJornada(data);
                if (data && data.usosCamion) {
                    const active = data.usosCamion.find((t: any) => !t.horaFin);
                    setActiveTurno(active || null);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchCamiones = async () => {
        const res = await fetch('/api/camiones');
        if (res.ok) setCamiones(await res.json());
    };

    // Auto-fill KM when truck is selected
    useEffect(() => {
        if (selectedCamion) {
            fetchUltimoKm(selectedCamion);
        }
    }, [selectedCamion]);

    const fetchUltimoKm = async (camionId: string) => {
        try {
            const res = await fetch(`/api/turnos/ultimo-km?camionId=${camionId}`);
            if (res.ok) {
                const data = await res.json();
                setKmInicial(data.kmSugerido.toString());
            }
        } catch (e) {
            console.error('Error fetching ultimo KM:', e);
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

    const handleStartShift = async () => {
        if (!jornada || !selectedCamion || !kmInicial) return;
        try {
            const res = await fetch('/api/turnos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jornadaId: jornada.id,
                    camionId: selectedCamion,
                    horaInicio: new Date(),
                    kmInicial: parseInt(kmInicial)
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

    const handleEndShift = async () => {
        if (!activeTurno || !kmFinal) return;
        try {
            const res = await fetch('/api/turnos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeTurno.id,
                    horaFin: new Date(),
                    kmFinal: parseInt(kmFinal)
                })
            });
            if (res.ok) {
                setKmFinal('');
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    const handleAddDescarga = async () => {
        if (!activeTurno || !litros || !lugar) return;
        try {
            const res = await fetch('/api/descargas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    turnoId: activeTurno.id,
                    hora: new Date(),
                    litros: parseInt(litros),
                    tipoGasoil,
                    lugar
                })
            });
            if (res.ok) {
                setLitros('');
                setLugar('');
                await fetchData();
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando jornada...</div>;

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mi Control Horario y KM</h1>
                    <p className="text-gray-500 text-sm">Gestiona tu registro de horas y desplazamientos.</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-orange-600">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Jornada */}
                <div className="space-y-6">
                    <Card className="shadow-sm overflow-hidden border-t-4 border-t-orange-600">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Clock className="w-5 h-5 text-orange-600" /> Registro de Jornada
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!jornada ? (
                                <div className="py-6 text-center space-y-4">
                                    <p className="text-gray-500 text-sm italic">No has iniciado jornada hoy.</p>
                                    <Button onClick={handleClockIn} size="xl" className="w-full bg-green-600 hover:bg-green-700 h-20 text-xl font-bold shadow-lg">
                                        ENTRADA
                                    </Button>
                                </div>
                            ) : !jornada.horaSalida ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-center">
                                            <p className="text-[10px] text-orange-600 font-bold uppercase">Entrada</p>
                                            <p className="text-2xl font-mono font-bold text-gray-900">{format(new Date(jornada.horaEntrada), 'HH:mm')}</p>
                                        </div>
                                        {session?.rol === 'ADMIN' && (
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Total Horas</p>
                                                <p className="text-2xl font-mono font-bold text-gray-900">{jornada.totalHoras || '0.00'}h</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Observaciones del día</label>
                                        <textarea
                                            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 min-h-[80px]"
                                            placeholder="Añadir notas sobre la jornada..."
                                            value={observaciones}
                                            onChange={e => setObservaciones(e.target.value)}
                                        />
                                    </div>

                                    <Button onClick={handleClockOut} size="xl" className="w-full bg-red-600 hover:bg-red-700 h-20 text-xl font-bold shadow-lg">
                                        SALIDA / CERRAR DÍA
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center p-8 bg-green-50 rounded-lg border border-green-100 space-y-3">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <p className="text-green-700 font-bold">Jornada Completada</p>
                                    {session?.rol === 'ADMIN' && <p className="text-sm text-gray-500">Has registrado {jornada.totalHoras} horas hoy.</p>}
                                    <Button onClick={handleClockIn} variant="outline" className="mt-4 w-full">Nueva Entrada</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="shadow-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Droplet className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Descargas</p>
                                    <p className="text-lg font-bold">{jornada?.usosCamion?.reduce((acc: number, u: any) => acc + (u.descargas?.length || 0), 0) || 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Truck className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Vehículos</p>
                                    <p className="text-lg font-bold">{jornada?.usosCamion?.length || 0}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Right Column: Camión/KM */}
                <div className="space-y-6">
                    {jornada && !jornada.horaSalida && (
                        <Card className="shadow-sm overflow-hidden border-t-4 border-t-indigo-600">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Truck className="w-5 h-5 text-indigo-600" /> Control de Vehículo / Ruta
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!activeTurno ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-500">Selecciona el vehículo que vas a utilizar ahora:</p>
                                        <div className="space-y-4 pt-2">
                                            <select
                                                className="w-full p-3 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                                                value={selectedCamion}
                                                onChange={e => setSelectedCamion(e.target.value)}
                                            >
                                                <option value="">Seleccionar Camión...</option>
                                                {camiones.map(c => <option key={c.id} value={c.id}>{c.matricula} {c.modelo || ''}</option>)}
                                            </select>
                                            <Input
                                                type="number"
                                                placeholder="KM Iniciales del vehículo"
                                                value={kmInicial}
                                                onChange={e => setKmInicial(e.target.value)}
                                                className="h-12"
                                            />
                                            {selectedCamion && kmInicial && (
                                                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> KM sugerido desde último viaje
                                                </p>
                                            )}
                                            <Button onClick={handleStartShift} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 font-bold shadow-md">
                                                INICIAR RUTA / MANTENIMIENTO
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] text-indigo-600 font-bold uppercase">Vehículo Actual</p>
                                                <p className="font-bold text-indigo-900">{activeTurno.camion?.matricula}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-indigo-600 font-bold uppercase">Inicio</p>
                                                <p className="text-sm font-mono font-bold text-indigo-900">{format(new Date(activeTurno.horaInicio), 'HH:mm')}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-white border rounded-xl space-y-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                                <Droplet className="w-3 h-3 text-blue-500" /> Registrar Descargas
                                            </h4>
                                            <div className="flex gap-2">
                                                <Input type="number" placeholder="Cantidad" value={litros} onChange={e => setLitros(e.target.value)} />
                                                <Button size="sm" variant="secondary" onClick={async () => {
                                                    if (!activeTurno || !litros) return;
                                                    for (let i = 0; i < parseInt(litros); i++) {
                                                        await fetch('/api/descargas', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ turnoId: activeTurno.id, hora: new Date(), litros: 0, tipoGasoil: 'A', lugar: 'Descarga' })
                                                        });
                                                    }
                                                    setLitros('');
                                                    await fetchData();
                                                }} className="w-1/3">Añadir</Button>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t space-y-4">
                                            <h4 className="text-xs font-bold text-red-600 uppercase">Finalizar Uso de Vehículo</h4>
                                            <Input
                                                type="number"
                                                placeholder="KM Finales"
                                                value={kmFinal}
                                                onChange={e => setKmFinal(e.target.value)}
                                                className="h-12"
                                            />
                                            <Button variant="outline" onClick={handleEndShift} className="w-full border-red-200 text-red-700 hover:bg-red-50 h-12 font-bold shadow-sm">
                                                TERMINAR RUTA / PARAR VEHÍCULO
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {!jornada && (
                        <div className="bg-orange-50 p-8 rounded-xl border-2 border-dashed border-orange-200 flex flex-col items-center justify-center text-center space-y-3">
                            <Clock className="w-12 h-12 text-orange-300" />
                            <p className="text-orange-700 font-medium">Primero debes fichar la entrada para poder gestionar vehículos y KM.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
