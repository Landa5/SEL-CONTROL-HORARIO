'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Trash2, Edit, Plus, User, Briefcase, Lock, MapPin, Phone, Mail, Award } from 'lucide-react';

// Enum simulation for dropdown
const ROLES = [
    { value: 'CONDUCTOR', label: 'Conductor' },
    { value: 'MECANICO', label: 'Mecánico' },
    { value: 'OFICINA', label: 'Oficina' },
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'EMPLEADO', label: 'Empleado Genérico' }
];

export default function AdminEmpleados() {
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState<'PERSONAL' | 'LABORAL' | 'CUENTA'>('PERSONAL');

    // Form State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        nombre: '',
        apellidos: '',
        dni: '',
        email: '',
        telefono: '',
        direccion: '',
        usuario: '',
        password: '',
        rol: 'CONDUCTOR',
        observaciones: '',
        activo: true,
        // Perfil Profesional
        dniCaducidad: '',
        carnetTipo: '',
        carnetCaducidad: '',
        tieneAdr: false,
        adrCaducidad: ''
    });

    useEffect(() => {
        fetchEmpleados();
    }, []);

    const fetchEmpleados = async () => {
        try {
            const res = await fetch('/api/empleados');
            if (res.ok) setEmpleados(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Custom Validation for Professional Profile
        if (formData.rol === 'CONDUCTOR' || formData.rol === 'MECANICO') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!formData.dniCaducidad) { alert('Fecha caducidad DNI obligatoria'); return; }
            if (new Date(formData.dniCaducidad) <= today) { alert('La caducidad del DNI debe ser futura'); return; }

            if (!formData.carnetTipo) { alert('Tipo de carnet obligatorio'); return; }
            if (!formData.carnetCaducidad) { alert('Caducidad carnet obligatoria'); return; }
            if (new Date(formData.carnetCaducidad) <= today) { alert('La caducidad del carnet debe ser futura'); return; }

            if (formData.tieneAdr) {
                if (!formData.adrCaducidad) { alert('Caducidad ADR obligatoria si tiene ADR'); return; }
                if (new Date(formData.adrCaducidad) <= today) { alert('La caducidad del ADR debe ser futura'); return; }
            }
        }

        const payload: any = { ...formData };
        if (!payload.password) delete payload.password; // Don't send empty password on edit
        if (editingId) payload.id = editingId;

        const method = editingId ? 'PUT' : 'POST';

        try {
            const res = await fetch('/api/empleados', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                closeModal();
                fetchEmpleados();
            } else {
                const err = await res.json();
                alert(err.error || 'Error al guardar');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que quieres dar de baja a este empleado?')) return;
        try {
            const res = await fetch(`/api/empleados?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Error al eliminar');
            } else {
                fetchEmpleados();
            }
        } catch (e) {
            alert('Error de conexión al eliminar');
        }
    };

    const openEdit = (emp: any) => {
        setEditingId(emp.id);
        setFormData({
            nombre: emp.nombre || '',
            apellidos: emp.apellidos || '',
            dni: emp.dni || '',
            email: emp.email || '',
            telefono: emp.telefono || '',
            direccion: emp.direccion || '',
            usuario: emp.usuario || '',
            password: '',
            rol: emp.rol || 'CONDUCTOR',
            observaciones: emp.observaciones || '',
            activo: emp.activo,
            dniCaducidad: emp.perfilProfesional?.dniCaducidad ? new Date(emp.perfilProfesional.dniCaducidad).toISOString().split('T')[0] : '',
            carnetTipo: emp.perfilProfesional?.carnetTipo || '',
            carnetCaducidad: emp.perfilProfesional?.carnetCaducidad ? new Date(emp.perfilProfesional.carnetCaducidad).toISOString().split('T')[0] : '',
            tieneAdr: emp.perfilProfesional?.tieneAdr || false,
            adrCaducidad: emp.perfilProfesional?.adrCaducidad ? new Date(emp.perfilProfesional.adrCaducidad).toISOString().split('T')[0] : ''
        });
        setCurrentTab('PERSONAL');
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingId(null);
        setFormData({
            nombre: '',
            apellidos: '',
            dni: '',
            email: '',
            telefono: '',
            direccion: '',
            usuario: '',
            password: '',
            rol: 'CONDUCTOR',
            observaciones: '',
            activo: true,
            dniCaducidad: '',
            carnetTipo: '',
            carnetCaducidad: '',
            tieneAdr: false,
            adrCaducidad: ''
        });
        setCurrentTab('PERSONAL');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Empleados</h1>
                    <p className="text-gray-500 text-sm">Administra el personal, roles y accesos.</p>
                </div>
                <Button onClick={openNew} className="gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md">
                    <Plus className="w-4 h-4" /> Nuevo Empleado
                </Button>
            </div>

            <Card className="border-none shadow-md">
                <CardContent className="p-0 overflow-hidden rounded-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="p-4 font-bold text-gray-600 text-sm uppercase">Empleado</th>
                                <th className="p-4 font-bold text-gray-600 text-sm uppercase">Contacto</th>
                                <th className="p-4 font-bold text-gray-600 text-sm uppercase">Documentación</th>
                                <th className="p-4 font-bold text-gray-600 text-sm uppercase">Rol / Usuario</th>
                                <th className="p-4 font-bold text-gray-600 text-sm uppercase text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {empleados.map(emp => (
                                <tr key={emp.id} className={`hover:bg-blue-50 transition-colors ${!emp.activo ? 'opacity-50 grayscale bg-gray-50' : 'bg-white'}`}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                                                {emp.nombre.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{emp.nombre} {emp.apellidos}</p>
                                                <p className="text-xs text-gray-500 font-mono">{emp.dni}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm">
                                        {emp.telefono && <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-gray-400" /> {emp.telefono}</div>}
                                        {emp.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-gray-400" /> {emp.email}</div>}
                                    </td>
                                    <td className="p-4">
                                        {emp.perfilProfesional ? (
                                            <div className="space-y-1 text-xs">
                                                {/* Carnet */}
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold bg-gray-100 px-1 rounded">
                                                        {emp.perfilProfesional.carnetTipo}
                                                    </span>
                                                    <span className={`${new Date(emp.perfilProfesional.carnetCaducidad) < new Date() ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                        Exp: {new Date(emp.perfilProfesional.carnetCaducidad).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {/* ADR */}
                                                {emp.perfilProfesional.tieneAdr && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold bg-orange-100 text-orange-800 px-1 rounded">ADR</span>
                                                        <span className={`${new Date(emp.perfilProfesional.adrCaducidad) < new Date() ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                            Exp: {new Date(emp.perfilProfesional.adrCaducidad).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* DNI Warning if near */}
                                                <div className="text-gray-400 text-[10px]">
                                                    DNI Exp: {new Date(emp.perfilProfesional.dniCaducidad).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">No requiere</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-1">
                                            <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${emp.rol === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                                emp.rol === 'MECANICO' ? 'bg-orange-100 text-orange-800' :
                                                    emp.rol === 'OFICINA' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-green-100 text-green-800'
                                                }`}>
                                                {emp.rol}
                                            </span>
                                            <div className="text-xs text-gray-500 font-mono bg-gray-100 px-1 rounded w-fit">@{emp.usuario}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <Button size="sm" variant="secondary" onClick={() => openEdit(emp)} className="hover:bg-blue-100 text-blue-600">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        {emp.activo && (
                                            <Button size="sm" className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100" onClick={() => handleDelete(emp.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* UPGRADED MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
                        <CardHeader className="border-b pb-4">
                            <CardTitle className="flex justify-between items-center text-xl">
                                {editingId ? 'Editar Ficha Empleado' : 'Alta de Nuevo Empleado'}
                                <Button variant="ghost" size="sm" onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</Button>
                            </CardTitle>

                            {/* TABS */}
                            <div className="flex gap-4 mt-4 text-sm font-bold border-b border-gray-100">
                                <button
                                    onClick={() => setCurrentTab('PERSONAL')}
                                    className={`pb-2 flex items-center gap-2 border-b-2 transition-all ${currentTab === 'PERSONAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    <User className="w-4 h-4" /> Datos Personales
                                </button>
                                <button
                                    onClick={() => setCurrentTab('LABORAL')}
                                    className={`pb-2 flex items-center gap-2 border-b-2 transition-all ${currentTab === 'LABORAL' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    <Briefcase className="w-4 h-4" /> Datos Laborales
                                </button>
                                <button
                                    onClick={() => setCurrentTab('CUENTA')}
                                    className={`pb-2 flex items-center gap-2 border-b-2 transition-all ${currentTab === 'CUENTA' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    <Lock className="w-4 h-4" /> Cuenta y Acceso
                                </button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 overflow-y-auto">
                            <form id="emp-form" onSubmit={handleSubmit} className="space-y-6">

                                {/* TAB: PERSONAL */}
                                {currentTab === 'PERSONAL' && (
                                    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input label="Nombre" value={formData.nombre} onChange={e => handleInputChange('nombre', e.target.value)} required />
                                            <Input label="Apellidos" value={formData.apellidos} onChange={e => handleInputChange('apellidos', e.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input label="DNI / NIE" value={formData.dni} onChange={e => handleInputChange('dni', e.target.value)} placeholder="00000000X" />
                                            <Input label="Teléfono" value={formData.telefono} onChange={e => handleInputChange('telefono', e.target.value)} type="tel" />
                                        </div>
                                        <Input label="Email Personal" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} type="email" />
                                        <Input label="Dirección Completa" value={formData.direccion} onChange={e => handleInputChange('direccion', e.target.value)} />
                                    </div>
                                )}

                                {/* TAB: LABORAL */}
                                {currentTab === 'LABORAL' && (
                                    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Rol en la empresa</label>
                                            <select
                                                value={formData.rol}
                                                onChange={e => handleInputChange('rol', e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                                            >
                                                {ROLES.map(role => (
                                                    <option key={role.value} value={role.value}>
                                                        {role.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Estado</label>
                                            <label className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.activo}
                                                    onChange={e => handleInputChange('activo', e.target.checked)}
                                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <span className={formData.activo ? 'text-green-600 font-bold' : 'text-gray-500'}>
                                                    {formData.activo ? 'Empleado Activo (Puede acceder)' : 'BAJA / Inactivo (Acceso bloqueado)'}
                                                </span>
                                            </label>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Observaciones</label>
                                            <textarea
                                                className="w-full p-2 border rounded-lg"
                                                rows={4}
                                                placeholder="Notas internas, fecha de contrato, etc..."
                                                value={formData.observaciones}
                                                onChange={e => handleInputChange('observaciones', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* TAB: CUENTA */}
                                {currentTab === 'CUENTA' && (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                            <h4 className="text-yellow-800 font-bold flex items-center gap-2 text-sm mb-2">
                                                <Lock className="w-4 h-4" /> Credenciales de Acceso
                                            </h4>
                                            <p className="text-xs text-yellow-700">
                                                El usuario es único y necesario para entrar. La contraseña se guarda encriptada.
                                            </p>
                                        </div>

                                        <Input
                                            label="Usuario (Login)"
                                            value={formData.usuario}
                                            onChange={e => handleInputChange('usuario', e.target.value)}
                                            required
                                            placeholder="ej. jgarcia"
                                            disabled={!!editingId} // Prevent changing username safely if preferred, or allow it.
                                        />

                                        <div className="space-y-1">
                                            <Input
                                                label={editingId ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                                                type="password"
                                                value={formData.password}
                                                onChange={e => handleInputChange('password', e.target.value)}
                                                required={!editingId}
                                                placeholder={editingId ? 'Dejar vacío para mantener la actual' : 'Mínimo 6 caracteres'}
                                            />
                                            {editingId && <p className="text-xs text-gray-400">Si escribes aquí, se cambiará la contraseña.</p>}
                                        </div>
                                    </div>
                                )}

                                {/* FOOTER ACTIONS */}
                                <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                                    <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
                                    <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 px-6 font-bold shadow-lg">
                                        {currentTab === 'CUENTA' ? 'Guardar Todo' : 'Guardar y Continuar'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
