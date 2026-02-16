'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Save, CheckCircle, Plus, Trash2 } from 'lucide-react';

interface EvaluacionFormProps {
    empleadoId: number;
    periodoInicial?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function EvaluacionForm({ empleadoId, periodoInicial, onSuccess, onCancel }: EvaluacionFormProps) {
    const [periodo, setPeriodo] = useState(periodoInicial || new Date().getFullYear() + '-Q1');
    const [puntuacion, setPuntuacion] = useState(5);
    const [comentarios, setComentarios] = useState('');
    const [objetivos, setObjetivos] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);

    const handleAddObjetivo = () => setObjetivos([...objetivos, '']);
    const handleRemoveObjetivo = (index: number) => setObjetivos(objetivos.filter((_, i) => i !== index));
    const handleObjetivoChange = (index: number, value: string) => {
        const newObjetivos = [...objetivos];
        newObjetivos[index] = value;
        setObjetivos(newObjetivos);
    };

    const handleSubmit = async (estado: 'BORRADOR' | 'COMPLETADA') => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/evaluaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    periodo,
                    puntuacionGeneral: puntuacion,
                    comentarios,
                    objetivos: JSON.stringify(objetivos.filter(o => o.trim() !== '')),
                    estado // Note: Backend defaults to BORRADOR, we might need to update API to accept state or just rely on update later
                })
            });

            if (res.ok) {
                onSuccess();
            } else {
                const err = await res.json();
                alert(err.error || 'Error al guardar');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
        setLoading(false);
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Nueva Evaluación de Desempeño</CardTitle>
                <CardDescription>Define objetivos y valora el rendimiento del periodo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periodo Evaluación</label>
                    <Input
                        value={periodo}
                        onChange={e => setPeriodo(e.target.value)}
                        placeholder="Ej: 2026-Q1"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Puntuación General: <span className="text-blue-600 font-bold text-lg">{puntuacion}/10</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={puntuacion}
                        onChange={e => setPuntuacion(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Bajo</span>
                        <span>Medio</span>
                        <span>Alto</span>
                        <span>Excelente</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios y Feedback</label>
                    <textarea
                        className="w-full min-h-[100px] p-3 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Describe los puntos fuertes y áreas de mejora..."
                        value={comentarios}
                        onChange={e => setComentarios(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Objetivos para el siguiente periodo</label>
                    <div className="space-y-2">
                        {objetivos.map((obj, idx) => (
                            <div key={idx} className="flex gap-2">
                                <Input
                                    value={obj}
                                    onChange={e => handleObjetivoChange(idx, e.target.value)}
                                    placeholder={`Objetivo ${idx + 1}...`}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-500 hover:bg-red-50"
                                    onClick={() => handleRemoveObjetivo(idx)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddObjetivo}
                            className="mt-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Añadir Objetivo
                        </Button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={() => handleSubmit('BORRADOR')} disabled={loading}>
                        <Save className="w-4 h-4 mr-2" /> Guardar Borrador
                    </Button>
                    {/* Add Complete button logic later if needed via PUT */}
                </div>
            </CardContent>
        </Card>
    );
}
