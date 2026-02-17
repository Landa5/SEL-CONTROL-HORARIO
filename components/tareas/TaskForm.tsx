'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/Button";
import { format } from 'date-fns';
import { Truck, MapPin, Building2, AlertTriangle, Save, Loader2, UserPlus, AlertCircle } from 'lucide-react';

interface TaskFormProps {
    rol: string; // 'ADMIN', 'CONDUCTOR', etc.
    onSuccess: () => void;
    initialData?: any;
}

export default function TaskForm({ rol, onSuccess, initialData }: TaskFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Data Loading
    const [empleados, setEmpleados] = useState<any[]>([]);

    // Form State
    const [tipo, setTipo] = useState(initialData?.tipo || (rol === 'ADMIN' ? 'TAREA_INTERNA' : 'AVERIA'));
    const [activoTipo, setActivoTipo] = useState(initialData?.activoTipo || (rol === 'ADMIN' ? '' : 'CAMION'));
    const [titulo, setTitulo] = useState(initialData?.titulo || '');
    const [descripcion, setDescripcion] = useState(initialData?.descripcion || '');
    const [prioridad, setPrioridad] = useState(initialData?.prioridad || 'MEDIA');
    const [asignadoAId, setAsignadoAId] = useState(initialData?.asignadoAId || '');

    // Conditional Fields
    const [matricula, setMatricula] = useState(initialData?.matricula || '');
    // Handle specific cases where data might be mixed or need parsing
    const [kilometros, setKilometros] = useState(initialData?.kmRecorridos || ''); // Note: API might allow kmRecorridos or similar
    const [descargas, setDescargas] = useState(initialData?.descargas || '');
    const [clienteNombre, setClienteNombre] = useState(initialData?.clienteNombre || '');
    const [ubicacionTexto, setUbicacionTexto] = useState(initialData?.ubicacionTexto || '');
    const [contactoNombre, setContactoNombre] = useState(initialData?.contactoNombre || '');
    const [contactoTelefono, setContactoTelefono] = useState(initialData?.contactoTelefono || '');

    const [camiones, setCamiones] = useState<any[]>([]);

    useEffect(() => {
        fetchCamiones();
        // Always fetch employees if checking edit mode or if ADMIN, to allow reassignment
        // Or keep current logic: if ADMIN. 
        // For editing, it's useful to see names even if you can't reassign easily without admin, 
        // but let's stick to the prop 'rol' logic for now to avoid breaking permissions.
        if (rol === 'ADMIN' || rol === 'OFICINA') {
            fetchEmpleados();
        }
    }, [rol]);

    const fetchCamiones = async () => {
        try {
            const res = await fetch('/api/camiones');
            if (res.ok) setCamiones(await res.json());
        } catch (e) { console.error("Error cargando camiones", e); }
    };

    const fetchEmpleados = async () => {
        try {
            const res2 = await fetch('/api/ausencias/stats');
            if (res2.ok) {
                setEmpleados(await res2.json());
            }
        } catch (e) {
            console.error("Error cargando empleados", e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload: any = {
                titulo,
                descripcion,
                tipo,
                prioridad,
                activoTipo: activoTipo || undefined,
                matricula: activoTipo === 'CAMION' ? matricula : undefined,
                kilometros: (activoTipo === 'CAMION' && kilometros) ? Number(kilometros) : undefined,
                descargas: descargas ? Number(descargas) : undefined,
                clienteNombre: activoTipo === 'DEPOSITO_CLIENTE' ? clienteNombre : undefined,
                ubicacionTexto: ['BASE', 'DEPOSITO_CLIENTE', 'OTRO'].includes(activoTipo) ? ubicacionTexto : undefined,
                contactoNombre,
                contactoTelefono,
                asignadoAId: asignadoAId ? Number(asignadoAId) : undefined
            };

            let res;
            if (initialData?.id) {
                // UPDATE / PATCH
                res = await fetch(`/api/tareas/${initialData.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // CREATE / POST
                res = await fetch('/api/tareas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (res.ok) {
                onSuccess();
            } else {
                const data = await res.json();
                setError(data.error || 'Error al guardar la tarea');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!initialData?.id;

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">

            {/* TIPO Y PRIORIDAD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(rol === 'ADMIN' || rol === 'OFICINA') && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Tipo de Tarea</label>
                            <select
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value)}
                            >
                                <option value="TAREA_INTERNA">Tarea Interna / Gestión</option>
                                <option value="AVERIA">Avería / Incidencia</option>
                                <option value="MANTENIMIENTO">Mantenimiento (Legacy)</option>
                                <option value="RECLAMACION">Reclamación (Privado)</option>
                                <option value="TALLER">Taller / Mecánica</option>
                            </select>
                        </div>

                        <div className="space-y-2 animate-in fade-in">
                            <label className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                <UserPlus className="w-4 h-4" /> Asignar a (Opcional)
                            </label>
                            <select
                                className="w-full p-2 border border-blue-200 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500"
                                value={asignadoAId}
                                onChange={(e) => setAsignadoAId(e.target.value)}
                            >
                                <option value="">-- Sin asignar --</option>
                                {empleados.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.nombre} ({emp.rol})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* VISIBLE PARA TODOS EXCEPTO ADMIN */}
                {rol !== 'ADMIN' && rol !== 'OFICINA' && (
                    <div className="md:col-span-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            Tipo de Registro
                        </label>
                        <div className="flex gap-4 mt-2 overflow-x-auto pb-2">
                            <label className={`flex-1 min-w-[200px] p-3 rounded-xl border-2 cursor-pointer transition-all ${tipo === 'AVERIA' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                                <input
                                    type="radio"
                                    name="tipo_incidencia"
                                    className="hidden"
                                    checked={tipo === 'AVERIA'}
                                    onChange={() => setTipo('AVERIA')}
                                />
                                <div className="text-center">
                                    <span className="block font-black text-blue-900">AVERÍA / INCIDENCIA</span>
                                    <span className="text-xs text-blue-700">Problemas generales / Instalaciones</span>
                                </div>
                            </label>

                            <label className={`flex-1 min-w-[200px] p-3 rounded-xl border-2 cursor-pointer transition-all ${tipo === 'TALLER' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                                <input
                                    type="radio"
                                    name="tipo_incidencia"
                                    className="hidden"
                                    checked={tipo === 'TALLER'}
                                    onChange={() => {
                                        setTipo('TALLER');
                                        setActivoTipo('CAMION'); // Auto-select vehicle context
                                    }}
                                />
                                <div className="text-center">
                                    <span className="block font-black text-orange-900">TALLER / MECÁNICA</span>
                                    <span className="text-xs text-orange-700">Reparaciones de vehículos</span>
                                </div>
                            </label>

                            <label className={`flex-1 min-w-[200px] p-3 rounded-xl border-2 cursor-pointer transition-all ${tipo === 'RECLAMACION' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                                <input
                                    type="radio"
                                    name="tipo_incidencia"
                                    className="hidden"
                                    checked={tipo === 'RECLAMACION'}
                                    onChange={() => setTipo('RECLAMACION')}
                                />
                                <div className="text-center">
                                    <span className="block font-black text-purple-900">RECLAMACIÓN</span>
                                    <span className="text-xs text-purple-700">Privado: Solo Admins</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}

                {/* PROTOCOLO RECLAMACION */}
                {tipo === 'RECLAMACION' && (
                    <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-full">
                                <AlertTriangle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-900 text-sm uppercase">Protocolo de Atención al Cliente</h4>
                                <ul className="mt-2 space-y-1 text-sm text-blue-800 list-disc list-inside">
                                    <li><strong>Escuchar:</strong> Deja que el cliente explique todo el problema sin interrumpir.</li>
                                    <li><strong>Empatizar:</strong> Muestra comprensión ("Entiendo su molestia"). No busques culpables ahora.</li>
                                    <li><strong>Registrar:</strong> Apunta todos los detalles (lugar, hora, personas) en la descripción.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Prioridad</label>
                    <div className="flex gap-2">
                        {['BAJA', 'MEDIA', 'ALTA', 'URGENTE'].map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPrioridad(p)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${prioridad === p
                                    ? p === 'URGENTE' ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ACTIVO AFECTADO */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    ¿A qué vehículo o zona afecta?
                </label>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { id: 'CAMION', icon: Truck, label: 'Vehículo / Cisterna' },
                        { id: 'DEPOSITO_CLIENTE', icon: Building2, label: 'Instalación Cliente' },
                        { id: 'BASE', icon: MapPin, label: 'Nave / Oficina' },
                        { id: 'OTRO', icon: AlertCircle, label: 'Material / Otros' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setActivoTipo(opt.id)}
                            disabled={tipo === 'TALLER' && opt.id !== 'CAMION'} // Lock to CAMION if TALLER
                            className={`p-4 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-3 transition-all duration-300 
                                ${activoTipo === opt.id
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-lg shadow-orange-100 scale-[1.05]'
                                    : 'border-gray-50 bg-white text-gray-400 hover:border-gray-200 hover:text-gray-600'
                                } ${tipo === 'TALLER' && opt.id !== 'CAMION' ? 'opacity-50 cursor-not-allowed hidden' : ''}`}
                        >
                            <opt.icon className={`w-8 h-8 ${activoTipo === opt.id ? 'animate-bounce' : ''}`} />
                            <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* CAMPOS CONDICIONALES */}
            <div className="bg-gray-50 p-4 rounded-xl space-y-4">

                {activoTipo === 'CAMION' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Matrícula / Vehículo</label>
                            <select
                                required
                                className="w-full p-2 rounded-lg border border-gray-300 uppercase focus:ring-2 focus:ring-orange-500 bg-white"
                                value={matricula}
                                onChange={(e) => setMatricula(e.target.value)}
                            >
                                <option value="">-- Seleccionar --</option>
                                {camiones.map(c => (
                                    <option key={c.id} value={c.matricula}>{c.matricula} - {c.modelo}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Kilómetros</label>
                            <input
                                type="number"
                                // required only for new breakdowns on trucks? maybe optional on edit
                                required={!isEditing}
                                placeholder="Ej: 150000"
                                className="w-full p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500"
                                value={kilometros}
                                onChange={(e) => setKilometros(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {activoTipo === 'DEPOSITO_CLIENTE' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Cliente</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 rounded-lg border border-gray-300"
                                value={clienteNombre}
                                onChange={(e) => setClienteNombre(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ubicación / Dirección</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 rounded-lg border border-gray-300"
                                value={ubicacionTexto}
                                onChange={(e) => setUbicacionTexto(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {(activoTipo === 'BASE' || activoTipo === 'OTRO') && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Zona / Detalle Ubicación</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: Oficina principal, Almacén de repuestos..."
                            className="w-full p-2 rounded-lg border border-gray-300"
                            value={ubicacionTexto}
                            onChange={(e) => setUbicacionTexto(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* DETALLES DE LA INCIDENCIA */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Título de la incidencia</label>
                    <input
                        type="text"
                        required
                        placeholder="Resumen corto del problema..."
                        className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Descripción detallada</label>
                    <textarea
                        required
                        rows={4}
                        placeholder="Explica qué ha pasado, ruidos, testigos encendidos, etc..."
                        className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                    />
                </div>
            </div>

            {/* CONTACTO */}
            {
                ['DEPOSITO_CLIENTE', 'OTRO'].includes(activoTipo) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Persona de Contacto (Opcional)</label>
                            <input
                                type="text"
                                placeholder="Nombre..."
                                className="w-full p-2 rounded-lg border border-gray-300"
                                value={contactoNombre}
                                onChange={(e) => setContactoNombre(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono (Opcional)</label>
                            <input
                                type="tel"
                                placeholder="600 000 000"
                                className="w-full p-2 rounded-lg border border-gray-300"
                                value={contactoTelefono}
                                onChange={(e) => setContactoTelefono(e.target.value)}
                            />
                        </div>
                    </div>
                )
            }

            {error && <p className="text-red-600 text-sm font-bold text-center bg-red-50 p-3 rounded-lg">{error}</p>}

            <Button
                type="submit"
                className={`w-full h-12 text-lg font-bold shadow-lg ${prioridad === 'URGENTE' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                    }`}
                disabled={loading}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                {loading ? 'Guardando...' : (isEditing ? 'GUARDAR CAMBIOS' : 'REGISTRAR INCIDENCIA')}
            </Button>
        </form >
    );
}
