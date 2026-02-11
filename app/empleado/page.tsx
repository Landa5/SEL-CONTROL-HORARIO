'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    LayoutDashboard,
    Calendar,
    Truck,
    Clock,
    AlertTriangle,
    BookOpen,
    LogOut,
    DollarSign,
    FileText,
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Droplet,
    User
} from 'lucide-react';
import EmployeeAbsenceView from '@/components/empleado/EmployeeAbsenceView';
import EmployeeAbsenceSummary from '@/components/empleado/EmployeeAbsenceSummary';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';
import EmployeeTrainingView from '@/components/empleado/EmployeeTrainingView';

export default function EmpleadoDashboard() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [jornada, setJornada] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [camiones, setCamiones] = useState<any[]>([]);
    const [tareas, setTareas] = useState<any[]>([]);

    // Monthly View States (Conductor)
    const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [monthlyDetails, setMonthlyDetails] = useState<any[]>([]);

    // View control
    const [activeSection, setActiveSection] = useState<'summary' | 'jornada' | 'vehiculo' | 'vacaciones' | 'taller' | 'formacion' | 'profile'>('summary');

    // Form states
    const [observaciones, setObservaciones] = useState('');
    const [activeTurno, setActiveTurno] = useState<any>(null);
    const [selectedCamion, setSelectedCamion] = useState('');
    const [kmInicial, setKmInicial] = useState('');
    const [kmFinal, setKmFinal] = useState('');
    const [numViajes, setNumViajes] = useState('');
    const [numDescargas, setNumDescargas] = useState('');
    const [litrosRepostados, setLitrosRepostados] = useState('');
    const [conflictData, setConflictData] = useState<any>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictPhoto, setConflictPhoto] = useState<string>('');

    // Profile State
    const [profileData, setProfileData] = useState<any>(null);
    const [profileForm, setProfileForm] = useState<any>({
        email: '',
        telefono: '',
        direccion: '',
        password: '',
        // Docs
        dniCaducidad: '',
        carnetTipo: '',
        carnetCaducidad: '',
        tieneAdr: true,
        adrCaducidad: ''
    });

    const [myAlerts, setMyAlerts] = useState<any[]>([]);

    useEffect(() => {
        if (profileData?.perfilProfesional) {
            checkMyAlerts(profileData.perfilProfesional);
        }
    }, [profileData]);

    const checkMyAlerts = (perf: any) => {
        const newAlerts = [];
        const now = new Date();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + 40);

        const check = (dateStr: string | null, label: string) => {
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (d <= threshold) {
                newAlerts.push({
                    label,
                    date: d,
                    expired: d < now
                });
            }
        };

        check(perf.dniCaducidad, 'DNI');
        check(perf.carnetCaducidad, 'Carnet Conducir');
        check(perf.adrCaducidad, 'ADR');
        setMyAlerts(newAlerts);
    };

    useEffect(() => {
        const loadSession = async () => {
            const res = await fetch('/api/auth/session');
            if (res.ok) {
                const sess = await res.json();
                setSession(sess);
                fetchMonthlyStats();
            }
        };
        loadSession();
        fetchData();
        fetchCamiones();
        fetchTareas();
    }, []);

    const fetchMonthlyStats = async () => {
        const res = await fetch('/api/jornadas/mensual');
        if (res.ok) setMonthlyStats(await res.json());
    };

    const fetchMonthlyDetails = async (month: string) => {
        const res = await fetch(`/api/jornadas/mensual?month=${month}`);
        if (res.ok) setMonthlyDetails(await res.json());
    };

    const handleMonthClick = async (month: string) => {
        setSelectedMonth(month);
        await fetchMonthlyDetails(month);
    };

    const fetchTareas = async () => {
        const res = await fetch('/api/tareas?estado=ABIERTA');
        if (res.ok) setTareas(await res.json());
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
        } finally {
            setLoading(false);
        }
    };

    const fetchCamiones = async () => {
        const res = await fetch('/api/camiones');
        if (res.ok) setCamiones(await res.json());
    };

    useEffect(() => {
        if (selectedCamion) fetchUltimoKm(selectedCamion);
    }, [selectedCamion]);

    useEffect(() => {
        if (activeSection === 'profile' && session?.id) {
            fetchProfile();
        }
    }, [activeSection, session]);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`/api/empleados?id=${session.id}`);
            if (res.ok) {
                const data = await res.json();
                setProfileData(data);
                setProfileForm({
                    email: data.email || '',
                    telefono: data.telefono || '',
                    direccion: data.direccion || '',
                    password: '',
                    dniCaducidad: data.perfilProfesional?.dniCaducidad ? new Date(data.perfilProfesional.dniCaducidad).toISOString().split('T')[0] : '',
                    carnetTipo: data.perfilProfesional?.carnetTipo || '',
                    carnetCaducidad: data.perfilProfesional?.carnetCaducidad ? new Date(data.perfilProfesional.carnetCaducidad).toISOString().split('T')[0] : '',
                    tieneAdr: data.perfilProfesional?.tieneAdr || false,
                    adrCaducidad: data.perfilProfesional?.adrCaducidad ? new Date(data.perfilProfesional.adrCaducidad).toISOString().split('T')[0] : ''
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchUltimoKm = async (camionId: string) => {
        const res = await fetch(`/api/turnos/ultimo-km?camionId=${camionId}`);
        if (res.ok) {
            const data = await res.json();
            setKmInicial(data.kmSugerido.toString());
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const handleClockIn = async () => {
        const res = await fetch('/api/jornadas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: new Date(), horaEntrada: new Date(), estado: 'TRABAJANDO' })
        });
        if (res.ok) {
            await fetchData();
            if (session?.rol === 'CONDUCTOR') {
                setActiveSection('vehiculo');
            } else {
                setActiveSection('summary');
            }
        } else {
            alert('Error iniciando jornada');
        }
    };

    const handleClockOut = async () => {
        if (!jornada) return;
        const res = await fetch('/api/jornadas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: jornada.id, horaSalida: new Date(), observaciones })
        });
        if (res.ok) {
            setObservaciones('');
            await fetchData();
            setActiveSection('summary');
        }
    };

    const handleStartShift = async () => {
        if (!jornada || !selectedCamion || !kmInicial) return;
        const res = await fetch('/api/turnos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jornadaId: jornada.id, camionId: selectedCamion, horaInicio: new Date(), kmInicial: parseInt(kmInicial) })
        });

        const data = await res.json();

        if (res.status === 409) {
            setConflictData(data);
            setShowConflictModal(true);
            return;
        }

        if (res.ok) {
            fetchData();
        } else {
            alert(data.error || 'Error al iniciar ruta');
        }
    };

    const handleConfirmConflict = async () => {
        if (!jornada || !selectedCamion || !kmInicial || !conflictPhoto) return alert("Debes subir una foto");

        const res = await fetch('/api/turnos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jornadaId: jornada.id,
                camionId: selectedCamion,
                horaInicio: new Date(),
                kmInicial: parseInt(kmInicial),
                confirmConflict: true,
                foto: conflictPhoto
            })
        });

        if (res.ok) {
            setShowConflictModal(false);
            setConflictPhoto('');
            setConflictData(null);
            fetchData();
        } else {
            const data = await res.json();
            alert(data.error || 'Error al resolver conflicto');
        }
    };

    const handleEndShift = async () => {
        if (!activeTurno || !kmFinal) return;
        // Auto-save pending values if they exist
        const payload: any = {
            id: activeTurno.id,
            horaFin: new Date(),
            kmFinal: parseInt(kmFinal)
        };

        if (numDescargas) payload.descargasCount = numDescargas;
        if (numViajes) payload.viajesCount = numViajes;
        if (litrosRepostados) payload.litrosRepostados = litrosRepostados;

        await fetch('/api/turnos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        setKmFinal('');
        setNumDescargas('');
        setNumViajes('');
        setLitrosRepostados('');
        fetchData();
    };

    const handleUpdateDescargas = async () => {
        if (!activeTurno || !numDescargas) return;

        const res = await fetch('/api/descargas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turnoId: activeTurno.id, cantidad: parseInt(numDescargas) })
        });

        if (res.ok) {
            setNumDescargas('');
            alert('Descargas actualizadas correctamente');
            fetchData();
        } else {
            alert('Error al actualizar descargas');
        }
    };

    const handleUpdateRepostaje = async () => {
        if (!activeTurno || !litrosRepostados) return;

        const res = await fetch('/api/repostaje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turnoId: activeTurno.id, litros: parseFloat(litrosRepostados) })
        });

        if (res.ok) {
            setLitrosRepostados('');
            alert('Repostaje registrado correctamente');
            fetchData();
        } else {
            alert('Error al registrar repostaje');
        }
    };

    const handleUpdateViajes = async () => {
        if (!activeTurno || !numViajes) return;

        const res = await fetch('/api/viajes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turnoId: activeTurno.id, cantidad: parseInt(numViajes) })
        });

        if (res.ok) {
            setNumViajes('');
            alert('Viajes actualizados correctamente');
            fetchData();
        } else {
            alert('Error al actualizar viajes');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

    const isConductor = session?.rol === 'CONDUCTOR' || session?.rol === 'MECANICO';

    // Navigation Configuration
    const navItems = [
        { id: 'summary', label: 'Resumen', icon: LayoutDashboard },
        { id: 'jornada', label: 'Mi Control de Días', icon: Clock, badgeCount: !jornada ? 1 : 0 },
        ...(isConductor ? [{ id: 'vehiculo', label: 'Vehículo', icon: Truck }] : []),
        { id: 'vacaciones', label: 'Vacaciones/Bajas', icon: Calendar },
        { id: 'taller', label: 'Reportar Avería', icon: AlertTriangle, badgeCount: tareas.length },
        { id: 'formacion', label: 'Formación', icon: BookOpen },
        { id: 'profile', label: 'Mi Perfil', icon: User },
        ...(session?.rol === 'ADMIN' ? [{ id: 'admin-back', label: 'Panel Admon', icon: LayoutDashboard }] : []),
        ...(session?.rol === 'OFICINA' ? [{ id: 'office-back', label: 'Panel Oficina', icon: LayoutDashboard }] : []),
    ];

    return (
        <MainDashboardLayout
            title={isConductor ? "Panel del Conductor" : "Portal del Empleado"}
            userName={session?.nombre || 'Empleado'}
            roleLabel={isConductor ? "Transporte" : "Personal"}
            navItems={navItems as any}
            activeSection={activeSection}
            onNavigate={(id) => {
                if (id === 'admin-back') {
                    router.push('/admin/dashboard');
                } else if (id === 'office-back') {
                    router.push('/oficina/dashboard');
                } else {
                    setActiveSection(id as any);
                    if (id === 'summary') setSelectedMonth(null); // Reset drill-down
                }
            }}
            onLogout={handleLogout}
        >
            {/* CONTENT INJECTION */}
            {activeSection === 'summary' && (
                <div className="space-y-6">

                    {/* 1. TOP WIDGETS (Absences & Alerts) - Optimized to load only if needed */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-in slide-in-from-top-4 duration-500">
                        <EmployeeAbsenceSummary />
                        <Card className="border-l-4 border-l-red-600 shadow-sm hover:shadow-md cursor-pointer transition-all hover:scale-[1.01]" onClick={() => setActiveSection('taller')}>
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Taller</p>
                                    <p className="text-xl font-bold text-gray-900">Incidencias Activas</p>
                                    <p className="text-xs text-red-600 font-bold mt-1">{tareas.length} Pendientes</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-full">
                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 2. HISTORICAL ACTIVITY (Monthly View) - Universal & efficient */}
                    {!selectedMonth ? (
                        <div className="space-y-4 animate-in fade-in duration-700">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <LayoutDashboard className="w-5 h-5 text-blue-600" />
                                Histórico de Actividad
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {monthlyStats.length === 0 ? (
                                    <Card className="col-span-full border-dashed border-2 bg-gray-50/50">
                                        <CardContent className="p-8 text-center text-gray-400">
                                            <p>No hay actividad registrada en el sistema.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    monthlyStats.map((stat: any) => {
                                        const [year, month] = stat.month.split('-');
                                        const dateObj = new Date(parseInt(year), parseInt(month) - 1);
                                        return (
                                            <Card
                                                key={stat.month}
                                                className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-blue-600 group hover:-translate-y-1"
                                                onClick={() => handleMonthClick(stat.month)}
                                            >
                                                <CardContent className="p-6">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <p className="text-xs font-bold text-gray-400 uppercase">{year}</p>
                                                            <h3 className="text-xl font-bold text-gray-900 capitalize">
                                                                {format(dateObj, 'MMMM', { locale: es })}
                                                            </h3>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                                                    </div>
                                                    <div className={`grid ${isConductor ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                                        {isConductor ? (
                                                            <>
                                                                <div className="bg-blue-50 p-2 rounded text-center">
                                                                    <p className="text-xs text-blue-600 font-bold uppercase">Distancia</p>
                                                                    <p className="font-mono font-bold text-gray-800">{stat.totalKm} KM</p>
                                                                </div>
                                                                <div className="bg-green-50 p-2 rounded text-center">
                                                                    <p className="text-xs text-green-600 font-bold uppercase">Viajes</p>
                                                                    <p className="font-mono font-bold text-gray-800">{stat.totalViajes || 0}</p>
                                                                </div>
                                                                <div className="bg-indigo-50 p-2 rounded text-center col-span-2">
                                                                    <p className="text-xs text-indigo-600 font-bold uppercase">Descargas</p>
                                                                    <p className="font-mono font-bold text-gray-800">{stat.totalDescargas}</p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="bg-gray-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-500 font-bold uppercase">Días</p>
                                                                <p className="font-mono font-bold text-gray-800">{stat.jornadasCount || 0}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        /* MONTHLY DRILL-DOWN VIEW */
                        <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="flex items-center gap-4 mb-6">
                                <Button variant="ghost" onClick={() => setSelectedMonth(null)} className="gap-2 pl-0 hover:pl-2 transition-all">
                                    <ChevronLeft className="w-4 h-4" /> Volver al Resumen
                                </Button>
                                <h2 className="text-2xl font-bold capitalize text-gray-800">
                                    {format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), 'MMMM yyyy', { locale: es })}
                                </h2>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                {monthlyDetails.map((day: any) => (
                                    <div key={day.id} className="p-4 border-b last:border-0 hover:bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between transition-colors gap-3 sm:gap-0">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="w-12 text-center bg-gray-100 rounded p-1 shrink-0">
                                                <p className="text-xs text-gray-500 uppercase">{format(new Date(day.fecha), 'EEE', { locale: es })}</p>
                                                <p className="font-bold text-lg text-gray-800">{format(new Date(day.fecha), 'dd')}</p>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm mb-1">
                                                    <span className="flex items-center gap-1 text-gray-600 font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        {format(new Date(day.horaEntrada), 'HH:mm')} - {day.horaSalida ? format(new Date(day.horaSalida), 'HH:mm') : 'En curso'}
                                                    </span>
                                                </div>
                                                {isConductor ? (
                                                    <div className="flex flex-wrap gap-2 text-xs mt-1">
                                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">{day.km} KM</span>
                                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">{day.viajes || 0} Viajes</span>
                                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">{day.descargas} Descargas</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2 text-xs mt-1">
                                                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold">Día Registrado</span>
                                                        {day.horaSalida && session?.rol === 'ADMIN' && (
                                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">
                                                                {((new Date(day.horaSalida).getTime() - new Date(day.horaEntrada).getTime()) / (1000 * 60 * 60)).toFixed(1)} Horas
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Common Quick Access - Re-enable for everyone if needed, or integrate above */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${isConductor ? 'lg:grid-cols-3' : ''} gap-6 mt-6`}>
                        <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-blue-500" onClick={() => setActiveSection('jornada')}>
                            <CardContent className="p-6 text-center space-y-2">
                                <Clock className="w-10 h-10 mx-auto text-blue-500 mb-2" />
                                <h3 className="font-bold text-gray-700">Mi Control de Días</h3>
                                <p className={`text-sm font-bold ${jornada ? 'text-green-600' : 'text-gray-400'}`}>
                                    {jornada ? (jornada.horaSalida ? 'Completada' : 'En Curso') : 'Sin Iniciar'}
                                </p>
                            </CardContent>
                        </Card>

                        {isConductor && (
                            <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-indigo-500" onClick={() => setActiveSection('vehiculo')}>
                                <CardContent className="p-6 text-center space-y-2">
                                    <Truck className="w-10 h-10 mx-auto text-indigo-500 mb-2" />
                                    <h3 className="font-bold text-gray-700">Vehículo</h3>
                                    <p className="text-sm text-gray-500">{activeTurno ? activeTurno.camion?.matricula : 'Sin Asignar'}</p>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-emerald-500" onClick={() => setActiveSection('vacaciones')}>
                            <CardContent className="p-6 text-center space-y-2">
                                <Calendar className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                                <h3 className="font-bold text-gray-700">Vacaciones</h3>
                                <p className="text-sm text-gray-500">Gestionar Solicitudes</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {activeSection === 'jornada' && (
                <Card className="max-w-2xl mx-auto shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> Control de Días</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {!jornada ? (
                            <div className="text-center py-8">
                                <Button onClick={handleClockIn} size="xl" className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-700">FICHAR ENTRADA</Button>
                            </div>
                        ) : !jornada.horaSalida ? (
                            <div className="space-y-6">
                                <div className="text-center p-6 bg-blue-50 rounded-xl">
                                    <p className="text-4xl font-black text-blue-900">{format(new Date(jornada.horaEntrada), 'HH:mm')}</p>
                                    <p className="text-sm text-blue-600 font-bold uppercase mt-2">Hora Entrada</p>
                                </div>
                                <textarea className="w-full border p-3 rounded" placeholder="Observaciones..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                                <Button onClick={handleClockOut} size="xl" className="w-full h-16 text-xl font-bold bg-red-600 hover:bg-red-700">FICHAR SALIDA</Button>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-green-50 rounded-xl">
                                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-green-800">Día Finalizado</h3>
                                <Button className="mt-4" onClick={() => setJornada(null)}>Iniciar Nuevo Día</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {isConductor && activeSection === 'vehiculo' && (
                <Card className="max-w-2xl mx-auto shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-indigo-600" /> Gestión de Vehículo</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {!jornada || jornada.horaSalida ? (
                            <p className="text-center text-gray-500">Inicia el día para asignar vehículo.</p>
                        ) : !activeTurno ? (
                            <div className="space-y-4">
                                <select className="w-full p-3 border rounded" value={selectedCamion} onChange={e => setSelectedCamion(e.target.value)}>
                                    <option value="">Seleccione Camión...</option>
                                    {camiones.map(c => <option key={c.id} value={c.id}>{c.matricula}</option>)}
                                </select>
                                <Input type="number" placeholder="KM Iniciales" value={kmInicial} onChange={e => setKmInicial(e.target.value)} />
                                <Button onClick={handleStartShift} className="w-full h-12 font-bold bg-indigo-600">INICIAR RUTA</Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-indigo-50 p-6 rounded-xl text-center">
                                    <p className="text-2xl font-black text-indigo-900">{activeTurno.camion?.matricula}</p>
                                    <p className="text-sm text-indigo-600 font-bold uppercase">Vehículo Actual</p>
                                </div>

                                {/* DESCARGAS (Gasoil entregado a clientes) */}
                                <div className="border p-4 rounded-xl space-y-4">
                                    <h4 className="font-bold flex items-center gap-2"><Droplet className="w-4 h-4 text-blue-500" /> Registro de Descargas</h4>
                                    <p className="text-sm text-gray-500">Número total de descargas realizadas.</p>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            placeholder="Total Descargas"
                                            value={numDescargas}
                                            onChange={e => setNumDescargas(e.target.value)}
                                            className="text-lg font-bold"
                                        />
                                        <Button onClick={handleUpdateDescargas} className="bg-blue-600 hover:bg-blue-700">Actualizar</Button>
                                    </div>
                                    {activeTurno.descargasCount > 0 && (
                                        <div className="mt-2 bg-blue-50 p-2 rounded text-center">
                                            <p className="text-sm text-blue-800">Descargas registradas: <strong>{activeTurno.descargasCount}</strong></p>
                                        </div>
                                    )}
                                </div>

                                {/* REPOSTAJE (Gasoil echado al camión) */}
                                <div className="border p-4 rounded-xl space-y-4 border-l-4 border-l-orange-500">
                                    <h4 className="font-bold flex items-center gap-2"><Droplet className="w-4 h-4 text-orange-600" /> Registro de Repostaje</h4>
                                    <p className="text-sm text-gray-500">Litros repostados al vehículo (para consumo).</p>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            placeholder="Litros Repostados"
                                            value={litrosRepostados}
                                            onChange={e => setLitrosRepostados(e.target.value)}
                                            className="text-lg font-bold"
                                        />
                                        <Button onClick={handleUpdateRepostaje} className="bg-orange-600 hover:bg-orange-700">Guardar</Button>
                                    </div>
                                    {activeTurno.litrosRepostados > 0 && (
                                        <div className="mt-2 bg-orange-50 p-3 rounded text-center">
                                            <p className="text-sm text-orange-800">Litros registrados: <strong>{activeTurno.litrosRepostados}</strong></p>
                                        </div>
                                    )}
                                </div>

                                {/* VIAJES (Transporte) */}
                                <div className="border p-4 rounded-xl space-y-4 border-l-4 border-l-green-500">
                                    <h4 className="font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-green-600" /> Registro de Viajes</h4>
                                    <p className="text-sm text-gray-500">Número total de viajes en este turno.</p>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            placeholder="Total Viajes"
                                            value={numViajes}
                                            onChange={e => setNumViajes(e.target.value)}
                                            className="text-lg font-bold"
                                        />
                                        <Button onClick={handleUpdateViajes} className="bg-green-600 hover:bg-green-700">Actualizar</Button>
                                    </div>
                                    {activeTurno.viajesCount > 0 && (
                                        <div className="mt-2 bg-green-50 p-3 rounded text-center">
                                            <p className="text-sm text-green-800">Viajes registrados: <strong>{activeTurno.viajesCount}</strong></p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t space-y-2">
                                    <Input type="number" placeholder="KM Finales" value={kmFinal} onChange={e => setKmFinal(e.target.value)} />
                                    <Button onClick={handleEndShift} variant="outline" className="w-full text-red-600 border-red-200">TERMINAR RUTA</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeSection === 'vacaciones' && <div className="bg-white p-6 rounded-xl shadow-sm"><EmployeeAbsenceView /></div>}

            {activeSection === 'taller' && (
                <Card>
                    <CardHeader className="flex flex-row justify-between">
                        <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> Incidencias / Taller</CardTitle>
                        <Button onClick={() => router.push('/tareas/nueva')} className="bg-red-600">+ Nueva</Button>
                    </CardHeader>
                    <CardContent>
                        {tareas.length === 0 ? <p className="text-center text-gray-500 py-8">No hay incidencias activas.</p> : (
                            <div className="space-y-2">
                                {tareas.map(t => (
                                    <div key={t.id} className="p-4 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center" onClick={() => router.push(`/tareas/${t.id}`)}>
                                        <div>
                                            <span className="font-bold">#{t.id} {t.titulo}</span>
                                            <p className="text-xs text-gray-500">{t.camion?.matricula}</p>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${t.estado === 'ABIERTA' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{t.estado}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeSection === 'formacion' && (
                <EmployeeTrainingView />
            )}

            {/* CONFLICT MODAL */}
            {showConflictModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl max-w-md w-full space-y-4 shadow-2xl mx-4">
                        <div className="text-center">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                            <h3 className="text-xl font-bold text-red-600">Conflicto de Kilometraje</h3>
                            <p className="text-gray-600 text-sm">
                                El odómetro no coincide con el registro anterior.
                            </p>
                        </div>

                        <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Registro Anterior:</span>
                                <span className="font-bold text-gray-800 text-lg">{conflictData?.expectedKm} KM</span>
                            </div>
                            <div className="border-t border-gray-300 my-2"></div>
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-red-600 uppercase">Tu Registro (Editable)</label>
                                <Input
                                    type="number"
                                    value={kmInicial}
                                    onChange={(e) => setKmInicial(e.target.value)}
                                    className="text-lg font-bold border-red-300 focus:border-red-500 focus:ring-red-500 bg-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold block text-gray-700">
                                📸 Sube una foto del odómetro (Obligatorio):
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => setConflictPhoto(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                className="w-full text-sm p-2 border rounded-lg bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button onClick={() => setShowConflictModal(false)} variant="ghost" className="flex-1 py-6">Cancelar</Button>
                            <Button
                                onClick={handleConfirmConflict}
                                disabled={!conflictPhoto}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-6 shadow-red-200 shadow-lg"
                            >
                                Confirmar y Corregir
                            </Button>
                        </div>
                    </div>
                </div>
            )}


            {activeSection === 'profile' && (
                <div className="max-w-4xl mx-auto animate-in slide-in-from-right-4 fade-in duration-300">
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="w-6 h-6 text-blue-600" /> Mi Perfil y Documentación
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!session?.id) return;

                                const payload: any = {
                                    id: session.id,
                                    // Preserve original read-only fields
                                    nombre: profileData?.nombre,
                                    apellidos: profileData?.apellidos,
                                    dni: profileData?.dni,
                                    rol: session.rol,
                                    // Update editable fields
                                    email: profileForm.email,
                                    telefono: profileForm.telefono,
                                    direccion: profileForm.direccion,
                                    // Docs
                                    dniCaducidad: profileForm.dniCaducidad,
                                    carnetTipo: profileForm.carnetTipo,
                                    carnetCaducidad: profileForm.carnetCaducidad,
                                    tieneAdr: profileForm.tieneAdr,
                                    adrCaducidad: profileForm.adrCaducidad
                                };

                                if (profileForm.password) payload.password = profileForm.password;

                                const res = await fetch('/api/empleados', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                });

                                if (res.ok) {
                                    alert('Perfil actualizado correctamente');
                                    setProfileForm((prev: any) => ({ ...prev, password: '' })); // Clear password
                                } else {
                                    alert('Error al actualizar perfil');
                                }
                            }} className="space-y-6">


                                {/* MY ALERTS SECTION */}
                                {myAlerts.length > 0 && (
                                    <div className="mb-6 space-y-2">
                                        {myAlerts.map((alert, i) => (
                                            <div key={i} className={`p-4 rounded-xl border flex items-center gap-4 ${alert.expired ? 'bg-red-50 border-red-200 text-red-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                                                <AlertTriangle className="w-6 h-6 shrink-0" />
                                                <div className="flex-1">
                                                    <p className="font-bold flex justify-between">
                                                        <span>TU {alert.label} {alert.expired ? 'HA CADUCADO' : 'VA A CADUCAR'}</span>
                                                        <span>{format(alert.date, 'dd/MM/yyyy')}</span>
                                                    </p>
                                                    <p className="text-sm">Por favor ve a "Mi Perfil" y actualiza la fecha si ya has renovado.</p>
                                                </div>
                                                <Button size="sm" onClick={() => setActiveSection('profile')} className={alert.expired ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}>
                                                    Renovar
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* TOP SECTION: URGENT ALERTS OR CURRENT STATUS */}
                                {/* PERSONAL INFO */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl">
                                    <div className="md:col-span-2">
                                        <h3 className="font-bold text-gray-700 mb-2">Datos Personales</h3>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-gray-500">Nombre Completo</label>
                                        <Input value={`${profileData?.nombre || ''} ${profileData?.apellidos || ''}`} disabled className="bg-gray-200" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-gray-500">DNI</label>
                                        <Input value={profileData?.dni || ''} disabled className="bg-gray-200" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-gray-700">Email</label>
                                        <Input value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} type="email" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-gray-700">Teléfono</label>
                                        <Input value={profileForm.telefono} onChange={e => setProfileForm({ ...profileForm, telefono: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <label className="text-sm font-bold text-gray-700">Dirección</label>
                                        <Input value={profileForm.direccion} onChange={e => setProfileForm({ ...profileForm, direccion: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <label className="text-sm font-bold text-yellow-600">Cambiar Contraseña (Opcional)</label>
                                        <Input
                                            type="password"
                                            placeholder="Dejar vacío para mantener la actual"
                                            value={profileForm.password}
                                            onChange={e => setProfileForm({ ...profileForm, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* PROFESSIONAL INFO (Drivers/Mechanics) */}
                                {isConductor && (
                                    <div className="space-y-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
                                        <div className="flex items-center gap-2 text-orange-800">
                                            <div className="p-2 bg-orange-200 rounded-lg">
                                                <Truck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold">Documentación Profesional</h3>
                                                <p className="text-xs">Mantén actualizada la fecha de caducidad de tus carnets.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="Caducidad DNI"
                                                type="date"
                                                value={profileForm.dniCaducidad}
                                                onChange={e => setProfileForm({ ...profileForm, dniCaducidad: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Carnet</label>
                                                <select
                                                    value={profileForm.carnetTipo}
                                                    onChange={e => setProfileForm({ ...profileForm, carnetTipo: e.target.value })}
                                                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                                                    required
                                                >
                                                    <option value="">Selecciona...</option>
                                                    <option value="C+E">C+E</option>
                                                    <option value="C">C</option>
                                                    <option value="C1">C1</option>
                                                </select>
                                            </div>
                                            <Input
                                                label="Caducidad Carnet"
                                                type="date"
                                                value={profileForm.carnetCaducidad}
                                                onChange={e => setProfileForm({ ...profileForm, carnetCaducidad: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-4 pt-2 border-t border-orange-200">
                                            <div className="flex items-center gap-2 opacity-50 pointer-events-none">
                                                <input
                                                    type="checkbox"
                                                    checked={true}
                                                    readOnly
                                                    className="w-4 h-4 text-orange-600 rounded"
                                                />
                                                <span className="font-bold text-gray-700">Tengo ADR (Obligatorio)</span>
                                            </div>

                                            <Input
                                                label="Caducidad ADR"
                                                type="date"
                                                value={profileForm.adrCaducidad}
                                                onChange={e => setProfileForm({ ...profileForm, adrCaducidad: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4">
                                    <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 font-bold shadow-lg">
                                        Guardar Cambios
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </MainDashboardLayout>
    );
}
