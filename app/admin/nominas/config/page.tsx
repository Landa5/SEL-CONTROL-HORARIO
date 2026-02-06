'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Save, Settings, DollarSign, ArrowLeft, SaveAll } from 'lucide-react';
import { useRouter } from 'next/navigation';


export default function PayrollConfigPage() {
    const router = useRouter();
    const [concepts, setConcepts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);

    // Employee Selection
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('GLOBAL'); // 'GLOBAL' or employee ID

    // Temp state for edits: { [conceptoId]: newValue }
    const [edits, setEdits] = useState<Record<number, string>>({});

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (concepts.length > 0) {
            updateEditsForSelection();
        }
    }, [selectedEmployeeId, concepts]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [resConfig, resEmp] = await Promise.all([
                fetch('/api/nominas/config'),
                fetch('/api/empleados') // Assuming a route exists, valid for Admin
            ]);

            if (resConfig.ok) {
                const data = await resConfig.json();
                setConcepts(data);
            } else {
                throw new Error((await resConfig.json()).error || resConfig.statusText);
            }

            if (resEmp.ok) {
                const empData = await resEmp.json();
                setEmployees(empData);
            }

        } catch (e: any) {
            console.error('Fetch error:', e);
            alert('Error cargando datos: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const updateEditsForSelection = () => {
        const newEdits: any = {};

        concepts.forEach((c: any) => {
            // Find tariff for current selection
            let activeTariff = null;

            if (selectedEmployeeId === 'GLOBAL') {
                // Find global tariff (no user, no role specific logic yet for simplicity, or find where rol is null and emp is null)
                activeTariff = c.tarifas.find((t: any) => t.activo && !t.empleadoId);
            } else {
                // Find tariff for specific employee
                const empId = parseInt(selectedEmployeeId);
                activeTariff = c.tarifas.find((t: any) => t.activo && t.empleadoId === empId);

                // If no specific tariff, maybe show placeholder or 0? 
                // Requirement: "diferentes depending del trabajador".
                // If checking "Global" value as fallback is desired, we can do that, but UI should clarify it's an override.
                // For now, if no override, show empty or 0 to indicate "not set specifically".
                if (!activeTariff) {
                    // Optionally fallback to global to show "Default"
                    const globalTariff = c.tarifas.find((t: any) => t.activo && !t.empleadoId);
                    // Let's settle on showing 0 or empty for now to be explicit it's a new override
                }
            }

            if (activeTariff) {
                newEdits[c.id] = activeTariff.valor.toString();
            } else {
                newEdits[c.id] = ''; // Empty means not set/inherit
            }
        });
        setEdits(newEdits);
    };

    const saveConcept = async (conceptoId: number, val: number) => {
        const payload: any = { conceptoId, valor: val };
        if (selectedEmployeeId !== 'GLOBAL') {
            payload.empleadoId = selectedEmployeeId;
        }
        const res = await fetch('/api/nominas/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error guardando');
        }
    };

    const handleSave = async (conceptoId: number) => {
        setSaving(conceptoId);
        try {
            const valStr = edits[conceptoId];
            if (!valStr || valStr === '') return alert('Introduce un valor');

            const val = parseFloat(valStr);
            if (isNaN(val)) return alert('Valor inválido');

            await saveConcept(conceptoId, val);

            // Reload to confirm and update UI
            const resConfig = await fetch('/api/nominas/config');
            if (resConfig.ok) {
                const data = await resConfig.json();
                setConcepts(data);
            }
        } catch (e: any) {
            console.error(e);
            alert('Error: ' + e.message);
        } finally {
            setSaving(null);
        }
    };

    const handleSaveAll = async () => {
        if (!confirm('¿Guardar todos los cambios visibles?')) return;
        setSaving(-1); // Special ID for "All"
        try {
            // Filter edits that have values
            const promises = Object.entries(edits).map(async ([idStr, valStr]) => {
                if (!valStr || valStr === '') return;
                const conceptId = parseInt(idStr);
                const val = parseFloat(valStr);
                if (isNaN(val)) return;

                await saveConcept(conceptId, val);
            });

            await Promise.all(promises);

            // Reload all
            const resConfig = await fetch('/api/nominas/config');
            if (resConfig.ok) {
                const data = await resConfig.json();
                setConcepts(data);
            }
            alert('Todos los cambios han sido guardados.');
        } catch (e: any) {
            console.error(e);
            alert('Error al guardar algunos elementos: ' + e.message);
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            <CardTitle>Configuración de Tarifas</CardTitle>
                        </div>
                    </div>
                    <Button
                        onClick={handleSaveAll}
                        disabled={saving !== null}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        {saving === -1 ? 'Guardando...' : <><SaveAll className="w-4 h-4" /> Guardar Todos</>}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* SELECTOR */}
                    <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border">
                        <label className="font-bold text-sm uppercase text-gray-500">Configurar para:</label>
                        <select
                            className="flex-1 p-2 border rounded font-medium"
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        >
                            <option value="GLOBAL">📍 Tarifas Base Globales</option>
                            <optgroup label="Personalizar por Empleado">
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {loading ? <p>Cargando configuración...</p> : (
                        <div className="grid gap-4">
                            {concepts.map((concept) => {
                                const isSpecific = selectedEmployeeId !== 'GLOBAL';
                                const activeGlobal = concept.tarifas.find((t: any) => t.activo && !t.empleadoId)?.valor;

                                return (
                                    <div key={concept.id} className="flex items-center justify-between p-4 border rounded hover:bg-gray-50 transition-colors">
                                        <div>
                                            <p className="font-bold text-gray-800">{concept.nombre}</p>
                                            <p className="text-xs text-gray-500 font-mono">{concept.codigo}</p>

                                            {isSpecific && (
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Global actual: <span className="font-bold">{activeGlobal !== undefined ? `${activeGlobal} €` : '-'}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    className={`pl-8 w-32 text-right font-bold ${isSpecific && edits[concept.id] ? 'border-blue-500 bg-blue-50' : ''}`}
                                                    placeholder={isSpecific ? (activeGlobal?.toString() || '0') : '0.00'}
                                                    value={edits[concept.id] || ''}
                                                    onChange={(e) => setEdits({ ...edits, [concept.id]: e.target.value })}
                                                />
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSave(concept.id)}
                                                disabled={saving === concept.id}
                                                className="bg-blue-600 hover:bg-blue-700"
                                            >
                                                {saving === concept.id ? '...' : <Save className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
