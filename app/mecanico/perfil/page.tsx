'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { format } from 'date-fns';
import { User, AlertTriangle, Truck } from 'lucide-react';

export default function MecanicoPerfil() {
    const [session, setSession] = useState<any>(null);
    const [profileData, setProfileData] = useState<any>(null);

    // Form state corresponding to the employee profile form
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
        const loadSession = async () => {
            const res = await fetch('/api/auth/session');
            if (res.ok) {
                const sess = await res.json();
                setSession(sess);
            }
        };
        loadSession();
    }, []);

    useEffect(() => {
        if (session?.id) {
            fetchProfile();
        }
    }, [session]);

    useEffect(() => {
        if (profileData?.perfilProfesional) {
            checkMyAlerts(profileData.perfilProfesional);
        }
    }, [profileData]);

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

    const checkMyAlerts = (perf: any) => {
        const newAlerts: { label: string; date: Date; expired: boolean }[] = [];
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

    const handleSubmit = async (e: React.FormEvent) => {
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
    };

    if (!session) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

    return (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-right-4 fade-in duration-300">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Mi Perfil</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-6 h-6 text-blue-600" /> Datos y Documentación
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">

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
                                            <p className="text-sm">Por favor actualiza la fecha en el formulario de abajo si ya has renovado.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

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

                        <div className="flex justify-end pt-4">
                            <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700 font-bold shadow-lg">
                                Guardar Cambios
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
