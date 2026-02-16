'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Save, Coins, ArrowLeft, SaveAll, TrendingUp, Shield, GraduationCap, Clock, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function IncentivesPage() {
    const router = useRouter();
    const [concepts, setConcepts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);

    // Employee Selection
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('GLOBAL');

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
            // Fetch concepts (will auto-seed new ones if missing)
            const resConfig = await fetch('/api/nominas/config');

            // Fetch employees
            const resEmp = await fetch('/api/empleados');

            if (resConfig.ok) {
                const data = await resConfig.json();
                // Filter or sort to prioritize incentives? 
                // For now, let's show all but maybe sort Incentives first or highlight them
                setConcepts(data);
            }

            if (resEmp.ok) {
                const empData = await resEmp.json();
                setEmployees(empData);
            }

        } catch (e: any) {
            console.error('Fetch error:', e);
            toast.error('Error cargando datos');
        } finally {
            setLoading(false);
        }
    };

    const updateEditsForSelection = () => {
        const newEdits: any = {};
        concepts.forEach((c: any) => {
            let activeTariff = null;
            if (selectedEmployeeId === 'GLOBAL') {
                activeTariff = c.tarifas.find((t: any) => t.activo && !t.empleadoId);
            } else {
                const empId = parseInt(selectedEmployeeId);
                activeTariff = c.tarifas.find((t: any) => t.activo && t.empleadoId === empId);
            }

            if (activeTariff) {
                newEdits[c.id] = activeTariff.valor.toString();
            } else {
                newEdits[c.id] = '';
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
        if (!res.ok) throw new Error('Error guardando');
    };

    const handleSave = async (conceptoId: number) => {
        setSaving(conceptoId);
        try {
            const valStr = edits[conceptoId];
            if (!valStr || valStr === '') return toast.warning('Introduce un valor');

            const val = parseFloat(valStr);
            if (isNaN(val)) return toast.warning('Valor inválido');

            await saveConcept(conceptoId, val);

            // Reload
            const resConfig = await fetch('/api/nominas/config');
            if (resConfig.ok) setConcepts(await resConfig.json());

            toast.success('Tarifa actualizada');
        } catch (e: any) {
            toast.error('Error al guardar');
        } finally {
            setSaving(null);
        }
    };

    const handleSaveAll = async () => {
        if (!confirm('¿Guardar todos los cambios visibles?')) return;
        setSaving(-1);
        try {
            const promises = Object.entries(edits).map(async ([idStr, valStr]) => {
                if (!valStr || valStr === '') return;
                const conceptId = parseInt(idStr);
                const val = parseFloat(valStr);
                if (isNaN(val)) return;
                await saveConcept(conceptId, val);
            });

            await Promise.all(promises);

            const resConfig = await fetch('/api/nominas/config');
            if (resConfig.ok) setConcepts(await resConfig.json());

            toast.success('Todas las tarifas guardadas');
        } catch (e: any) {
            toast.error('Error al guardar algunos elementos');
        } finally {
            setSaving(null);
        }
    };

    // Helper to identify incentive types for iconography
    const getIcon = (code: string) => {
        if (code.includes('ANTIGUEDAD')) return <TrendingUp className="w-5 h-5 text-amber-500" />;
        if (code.includes('SEGURIDAD')) return <Shield className="w-5 h-5 text-green-500" />;
        if (code.includes('FORMACION')) return <GraduationCap className="w-5 h-5 text-blue-500" />;
        if (code.includes('PUNTUALIDAD') || code.includes('DISPONIBILIDAD')) return <Clock className="w-5 h-5 text-purple-500" />;
        return <Coins className="w-5 h-5 text-gray-400" />;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                        <Coins className="w-8 h-8 text-blue-600" />
                        Tarifas de Incentivos
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Gestiona los incentivos, pluses y tarifas por actividad para la plantilla.
                    </p>
                </div>
                <Button
                    onClick={handleSaveAll}
                    disabled={saving !== null}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                    {saving === -1 ? 'Guardando...' : <><SaveAll className="w-4 h-4 mr-2" /> Guardar Todo</>}
                </Button>
            </div>

            {/* Selector Card */}
            <Card className="border-blue-100 bg-blue-50/50">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold uppercase text-blue-800 mb-2">
                                Ámbito de Configuración
                            </label>
                            <select
                                className="w-full p-3 border border-blue-200 rounded-lg font-medium text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                            >
                                <option value="GLOBAL">🌐 TARIFAS BASE (GLOBAL)</option>
                                <optgroup label="Personalizar por Empleado">
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>👤 {emp.nombre} {emp.apellidos}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <div className="hidden md:block text-sm text-blue-600 italic max-w-md">
                            "Las tarifas base se aplican a todos. Si seleccionas un empleado, los valores que introduzcas sobreescribirán la base solo para él."
                        </div>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-4">Cargando tarifas...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {concepts.map((concept) => {
                        const isSpecific = selectedEmployeeId !== 'GLOBAL';
                        const activeGlobal = concept.tarifas.find((t: any) => t.activo && !t.empleadoId)?.valor;
                        const hasEdit = edits[concept.id] !== undefined && edits[concept.id] !== '';

                        // Highlight logic for new incentives
                        const isHighlight = ['PLUS', 'BONUS', 'INCENTIV'].some(k => concept.codigo.includes(k));

                        return (
                            <div
                                key={concept.id}
                                className={`
                                    relative flex items-center justify-between p-4 border rounded-xl transition-all
                                    ${isHighlight ? 'bg-white border-blue-100 shadow-sm hover:shadow-md' : 'bg-gray-50 border-gray-100 opacity-80 hover:opacity-100'}
                                    ${hasEdit && isSpecific ? 'ring-2 ring-blue-400' : ''}
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${isHighlight ? 'bg-blue-50' : 'bg-gray-200'}`}>
                                        {getIcon(concept.codigo)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{concept.nombre}</h3>
                                        <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">{concept.codigo}</p>

                                        {isSpecific && (
                                            <div className="mt-1 flex items-center gap-2 text-xs">
                                                <span className="text-gray-500">Base:</span>
                                                <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">
                                                    {activeGlobal !== undefined ? `${activeGlobal} €` : '-'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className={`
                                                pl-4 w-28 text-right font-bold text-lg
                                                ${isSpecific && hasEdit ? 'text-blue-600 border-blue-300' : 'text-gray-700'}
                                            `}
                                            placeholder={isSpecific && activeGlobal ? activeGlobal.toString() : '0.00'}
                                            value={edits[concept.id] || ''}
                                            onChange={(e) => setEdits({ ...edits, [concept.id]: e.target.value })}
                                        />
                                        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">€</span>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleSave(concept.id)}
                                        disabled={saving === concept.id}
                                        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                        {saving === concept.id ? <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
