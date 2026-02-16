'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    ShieldCheck,
    Users,
    History,
    CheckCircle2,
    XCircle,
    Search,
    Settings,
    Plus,
    Edit,
    User
} from 'lucide-react';
import { format } from 'date-fns';
import RolesEditor from '@/components/admin/roles/RolesEditor';

export default function RolesPage() {
    const [activeTab, setActiveTab] = useState<'PERMISOS' | 'USUARIOS' | 'ROLES' | 'AUDITORIA'>('ROLES');
    const [employees, setEmployees] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Role Editor State
    const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

    // Load data based on tab
    useEffect(() => {
        if (activeTab === 'USUARIOS') fetchEmployees();
        if (activeTab === 'AUDITORIA') fetchAuditLogs();
        if (activeTab === 'ROLES') fetchRoles();
    }, [activeTab]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/roles');
            if (res.ok) setEmployees(await res.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/roles/list');
            if (res.ok) setRoles(await res.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/auditoria?limit=50');
            const data = await res.json();
            if (data.data) setAuditLogs(data.data);
            else if (Array.isArray(data)) setAuditLogs(data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleCreateRole = async () => {
        const nombre = prompt('Nombre del nuevo rol (ej: SUPERVISOR):');
        if (!nombre) return;

        const descripcion = prompt('Descripción corta:');

        try {
            const res = await fetch('/api/admin/roles/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, descripcion })
            });

            if (res.ok) {
                fetchRoles();
            } else {
                alert('Error al crear rol');
            }
        } catch (e) {
            alert('Error de conexión');
        }
    };

    const handleRoleChange = async (userId: number, newRole: string, customRoleId?: string) => {
        const roleName = customRoleId
            ? roles.find(r => r.id === parseInt(customRoleId))?.nombre || 'Rol Personalizado'
            : newRole;

        if (!confirm(`¿Estás seguro de cambiar el rol de este usuario a ${roleName}? Esta acción quedará registrada.`)) return;

        try {
            const res = await fetch('/api/admin/roles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: userId,
                    newRole,
                    customRoleId
                })
            });

            if (res.ok) {
                alert('Rol actualizado correctamente');
                fetchEmployees();
            } else {
                const err = await res.json();
                alert(err.error || 'Error al actualizar');
            }
        } catch (e) {
            alert('Error de conexión');
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.rol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Centro de Roles y Permisos</h1>
                    <p className="text-gray-500 text-sm">Gestiona quién tiene acceso a qué en la plataforma.</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
                <button
                    onClick={() => { setActiveTab('ROLES'); setEditingRoleId(null); }}
                    className={`px-4 py-2 flex items-center gap-2 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'ROLES' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Settings className="w-4 h-4" /> Configuración de Roles
                </button>
                <button
                    onClick={() => setActiveTab('USUARIOS')}
                    className={`px-4 py-2 flex items-center gap-2 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'USUARIOS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Users className="w-4 h-4" /> Gestión de Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('PERMISOS')}
                    className={`px-4 py-2 flex items-center gap-2 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'PERMISOS' ? 'border-gray-400 text-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ShieldCheck className="w-4 h-4" /> Matriz (Referencia)
                </button>
                <button
                    onClick={() => setActiveTab('AUDITORIA')}
                    className={`px-4 py-2 flex items-center gap-2 font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'AUDITORIA' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <History className="w-4 h-4" /> Auditoría
                </button>
            </div>

            {/* CONTENT: ROLES CONFIGURATION */}
            {activeTab === 'ROLES' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {editingRoleId ? (
                        <RolesEditor
                            rolId={editingRoleId}
                            rolNombre={roles.find(r => r.id === editingRoleId)?.nombre || 'Rol'}
                            onClose={() => { setEditingRoleId(null); fetchRoles(); }}
                        />
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button onClick={handleCreateRole} className="bg-purple-600 hover:bg-purple-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Crear Nuevo Rol
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {roles.map(rol => (
                                    <Card key={rol.id} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500" onClick={() => setEditingRoleId(rol.id)}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-lg">{rol.nombre}</CardTitle>
                                                {rol.esSistema && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Sistema</span>}
                                            </div>
                                            <CardDescription>{rol.descripcion || 'Sin descripción'}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                                                <div className="flex items-center gap-1">
                                                    <User className="w-4 h-4" />
                                                    <span>{rol.empleadosCount || 0} usuarios</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <ShieldCheck className="w-4 h-4" />
                                                    <span>{rol.permisos?.length || 0} permisos</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CONTENT: PERMISSIONS MATRIX (STATIC REFERENCE) */}
            {activeTab === 'PERMISOS' && (
                <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader>
                        <CardTitle>Capacidades por Rol (Referencia Estática)</CardTitle>
                        <CardDescription>Esta tabla muestra los permisos base definidos en el sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 uppercase text-xs font-bold text-gray-600">
                                <tr>
                                    <th className="p-4">Módulo / Acción</th>
                                    <th className="p-4 text-center text-purple-700 bg-purple-50">ADMIN</th>
                                    <th className="p-4 text-center text-blue-700 bg-blue-50">OFICINA</th>
                                    <th className="p-4 text-center text-orange-700 bg-orange-50">MECANICO</th>
                                    <th className="p-4 text-center text-green-700 bg-green-50">CONDUCTOR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* RRHH SECTION */}
                                <tr className="bg-gray-50 font-bold text-xs uppercase"><td colSpan={5} className="p-2 pl-4">Recursos Humanos (RRHH)</td></tr>
                                <tr>
                                    <td className="p-4 font-medium">Ver Fichas Empleados</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-medium">Editar Datos Personales / Roles</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-medium">Ver Nóminas (Todos)</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                </tr>

                                {/* OPERATIONS SECTION */}
                                <tr className="bg-gray-50 font-bold text-xs uppercase"><td colSpan={5} className="p-2 pl-4">Operaciones y Flota</td></tr>
                                <tr>
                                    <td className="p-4 font-medium">Ver Camiones y Estado</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-medium">Gestionar Tareas / Taller</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center text-xs text-gray-400">Sólo Reportar</td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-medium">Editar Jornadas / Fichajes</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                </tr>

                                {/* CONFIGURATION SECTION */}
                                <tr className="bg-gray-50 font-bold text-xs uppercase"><td colSpan={5} className="p-2 pl-4">Configuración y Auditoría</td></tr>
                                <tr>
                                    <td className="p-4 font-medium">Acceso a Auditoría / Logs</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4 font-medium">Cambiar Roles de Usuarios</td>
                                    <td className="p-4 text-center"><CheckCircle2 className="w-5 h-5 mx-auto text-green-500" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                    <td className="p-4 text-center"><XCircle className="w-5 h-5 mx-auto text-gray-300" /></td>
                                </tr>
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* CONTENT: USER MANAGEMENT */}
            {activeTab === 'USUARIOS' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre, usuario o rol..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0 overflow-hidden">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-4 text-xs uppercase font-bold text-gray-500">Empleado</th>
                                            <th className="p-4 text-xs uppercase font-bold text-gray-500">Usuario</th>
                                            <th className="p-4 text-xs uppercase font-bold text-gray-500">Rol Actual</th>
                                            <th className="p-4 text-xs uppercase font-bold text-gray-500 text-right">Acción Rápida</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredEmployees.map(emp => (
                                            <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="p-4 font-bold text-gray-800">
                                                    {emp.nombre} {emp.apellidos}
                                                    {!emp.activo && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full uppercase">Baja</span>}
                                                </td>
                                                <td className="p-4 text-sm text-gray-500 font-mono">@{emp.usuario}</td>
                                                <td className="p-4">
                                                    {emp.rolPersonalizado ? (
                                                        <span className="px-2 py-1 rounded text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                            ★ {emp.rolPersonalizado.nombre}
                                                        </span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${emp.rol === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                                            emp.rol === 'OFICINA' ? 'bg-blue-100 text-blue-800' :
                                                                emp.rol === 'MECANICO' ? 'bg-orange-100 text-orange-800' :
                                                                    'bg-green-100 text-green-800'
                                                            }`}>
                                                            {emp.rol}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <select
                                                        className="text-sm border border-gray-300 rounded p-1.5 focus:ring-2 focus:ring-blue-500 outline-none max-w-[150px]"
                                                        value={emp.rolPersonalizado ? `custom_${emp.rolPersonalizado.id}` : emp.rol}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val.startsWith('custom_')) {
                                                                handleRoleChange(emp.id, '', val.split('_')[1]);
                                                            } else {
                                                                handleRoleChange(emp.id, val);
                                                            }
                                                        }}
                                                        disabled={!emp.activo}
                                                    >
                                                        <optgroup label="Roles Fijos">
                                                            <option value="ADMIN">ADMIN</option>
                                                            <option value="OFICINA">OFICINA</option>
                                                            <option value="CONDUCTOR">CONDUCTOR</option>
                                                            <option value="MECANICO">MECANICO</option>
                                                            <option value="EMPLEADO">EMPLEADO</option>
                                                        </optgroup>
                                                        {roles.length > 0 && (
                                                            <optgroup label="Roles Dinámicos">
                                                                {roles.map(r => (
                                                                    <option key={r.id} value={`custom_${r.id}`}>
                                                                        {r.nombre}
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredEmployees.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-400">
                                                    No se encontraron empleados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* CONTENT: AUDIT LOGS */}
            {activeTab === 'AUDITORIA' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card>
                        <CardHeader>
                            <CardTitle>Registro de Cambios de Seguridad</CardTitle>
                            <CardDescription>Mostrando los últimos 50 eventos registrados en el sistema.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-4 font-bold text-gray-500">Fecha</th>
                                            <th className="p-4 font-bold text-gray-500">Acción</th>
                                            <th className="p-4 font-bold text-gray-500">Realizado Por</th>
                                            <th className="p-4 font-bold text-gray-500">Detalles</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="p-4 whitespace-nowrap text-gray-600">
                                                    {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                                                </td>
                                                <td className="p-4 font-bold text-blue-700">
                                                    {log.accion}
                                                </td>
                                                <td className="p-4">
                                                    {log.usuario ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{log.usuario.nombre} {log.usuario.apellidos}</span>
                                                            <span className="text-xs text-gray-400">@{log.usuario.usuario}</span>
                                                        </div>
                                                    ) : <span className="text-gray-400 italic">Desconocido</span>}
                                                </td>
                                                <td className="p-4 font-mono text-xs text-gray-600 max-w-md truncate">
                                                    {log.detalles}
                                                </td>
                                            </tr>
                                        ))}
                                        {auditLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-gray-400">
                                                    No hay registros de auditoría disponibles.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
