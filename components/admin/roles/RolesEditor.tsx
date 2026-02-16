'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Save, Loader2, Check } from 'lucide-react';

interface RolesEditorProps {
    rolId: number;
    rolNombre: string;
    onClose: () => void;
}

export default function RolesEditor({ rolId, rolNombre, onClose }: RolesEditorProps) {
    const [permisos, setPermisos] = useState<any[]>([]); // Grouped permissions
    const [selectedPermisos, setSelectedPermisos] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [rolId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch available permissions
            const resPermisos = await fetch('/api/admin/roles/permisos');
            const dataPermisos = await resPermisos.json();
            setPermisos(dataPermisos.grouped); // { "RRHH": [...], "FLOTA": [...] }

            // 2. Fetch current role permissions
            // We can re-use the list endpoint or just filter if we passed data, but safer to re-fetch or use a specific detail endpoint.
            // For simplicity, let's assume we can fetch the role details or we reuse the list endpoint structure if we had a detail endpoint. 
            // Since we don't have a GET /roles/[id] detail yet, let's fetch the list and find the role (not optimal but works for now)
            // Optimization: Created GET /api/admin/roles/list, could filter there.

            const resRoles = await fetch('/api/admin/roles/list');
            const dataRoles = await resRoles.json();
            const currentRol = dataRoles.find((r: any) => r.id === rolId);

            if (currentRol) {
                // currentRol.permisos is array of codes "empleados.ver". 
                // We need IDs. The list endpoint returned codes. 
                // Mistake in my previous step: list endpoint returns codes!
                // We need to map codes to IDs or update list endpoint to return IDs or objects.
                // Let's rely on the permision list to map back.

                const allPermsFlat = dataPermisos.permisos;
                const activeIds = allPermsFlat
                    .filter((p: any) => currentRol.permisos.includes(p.codigo))
                    .map((p: any) => p.id);

                setSelectedPermisos(activeIds);
            }

        } catch (e) {
            console.error(e);
            alert('Error cargando permisos');
        }
        setLoading(false);
    };

    const togglePermiso = (id: number) => {
        if (selectedPermisos.includes(id)) {
            setSelectedPermisos(selectedPermisos.filter(p => p !== id));
        } else {
            setSelectedPermisos([...selectedPermisos, id]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/roles/${rolId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permisos: selectedPermisos
                })
            });

            if (res.ok) {
                // Show success toast ideally
                onClose();
            } else {
                alert('Error guardando cambios');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="border-b bg-gray-50/50 sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Editando Rol: <span className="text-blue-600">{rolNombre}</span></CardTitle>
                        <CardDescription>Marca los permisos que tendrá este rol.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Guardar Cambios
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Object.entries(permisos).map(([categoria, perms]: [string, any]) => (
                        <div key={categoria} className="space-y-4">
                            <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs border-b pb-2">{categoria}</h3>
                            <div className="space-y-2">
                                {perms.map((p: any) => {
                                    const isSelected = selectedPermisos.includes(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => togglePermiso(p.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${isSelected
                                                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                                                    : 'bg-white border-gray-100 hover:border-blue-300'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                                                }`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                    {p.codigo}
                                                </p>
                                                <p className="text-xs text-gray-500 leading-tight mt-1">
                                                    {p.descripcion}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
