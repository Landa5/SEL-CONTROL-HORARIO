'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, GripVertical, FileText, Video, FileDigit, HelpCircle } from 'lucide-react';

interface ModuleEditorProps {
    initialData?: any;
    onSave: (data: any) => void;
    isAdminEditingQuestions?: boolean;
}

export default function ModuleEditor({ initialData, onSave, isAdminEditingQuestions = true }: ModuleEditorProps) {
    const [formData, setFormData] = useState({
        titulo: initialData?.titulo || '',
        descripcion: initialData?.descripcion || '',
        fechaInicio: initialData?.fechaInicio ? new Date(initialData.fechaInicio).toISOString().split('T')[0] : '',
        fechaFin: initialData?.fechaFin ? new Date(initialData.fechaFin).toISOString().split('T')[0] : '',
        duracionEstimada: initialData?.duracionEstimada || 30,
        activo: initialData?.activo ?? true,
        temas: initialData?.temas || [{ titulo: '', contenido: '', tipo: 'TEXTO', orden: 0, resourceUrl: '' }],
        preguntas: initialData?.preguntas || [{ texto: '', opcionA: '', opcionB: '', opcionC: '', correcta: 'A', puntos: 10 }]
    });

    const [activeTab, setActiveTab] = useState<'info' | 'temas' | 'preguntas'>('info');

    const handleAddTema = () => {
        setFormData({
            ...formData,
            temas: [...formData.temas, { titulo: '', contenido: '', tipo: 'TEXTO', orden: formData.temas.length, resourceUrl: '' }]
        });
    };

    const handleRemoveTema = (index: number) => {
        const newTemas = formData.temas.filter((_: any, i: number) => i !== index);
        setFormData({ ...formData, temas: newTemas });
    };

    const handleAddPregunta = () => {
        if (!isAdminEditingQuestions) return;
        setFormData({
            ...formData,
            preguntas: [...formData.preguntas, { texto: '', opcionA: '', opcionB: '', opcionC: '', correcta: 'A', puntos: 10 }]
        });
    };

    const handleRemovePregunta = (index: number) => {
        if (!isAdminEditingQuestions) return;
        const newPreguntas = formData.preguntas.filter((_: any, i: number) => i !== index);
        setFormData({ ...formData, preguntas: newPreguntas });
    };

    return (
        <div className="space-y-6">
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Información Básica
                </button>
                <button
                    onClick={() => setActiveTab('temas')}
                    className={`px-4 py-2 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'temas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Temas del Curso ({formData.temas.length})
                </button>
                <button
                    onClick={() => setActiveTab('preguntas')}
                    className={`px-4 py-2 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'preguntas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Evaluación Final ({formData.preguntas.length})
                </button>
            </div>

            <Card>
                <CardContent className="p-6">
                    {activeTab === 'info' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase">Título del Módulo</label>
                                    <Input
                                        value={formData.titulo}
                                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                                        placeholder="Ej: Seguridad en el Transporte de Cisternas"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase">Duración Estimada (minutos)</label>
                                    <Input
                                        type="number"
                                        value={formData.duracionEstimada}
                                        onChange={(e) => setFormData({ ...formData, duracionEstimada: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase">Descripción / Resumen</label>
                                <textarea
                                    className="w-full min-h-[100px] p-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    placeholder="Describe brevemente de qué trata este curso..."
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase">Fecha Inicio</label>
                                    <Input
                                        type="date"
                                        value={formData.fechaInicio}
                                        onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase">Fecha Fin (Vencimiento)</label>
                                    <Input
                                        type="date"
                                        value={formData.fechaFin}
                                        onChange={(e) => setFormData({ ...formData, fechaFin: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <input
                                        type="checkbox"
                                        id="activo"
                                        checked={formData.activo}
                                        onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="activo" className="text-sm font-bold text-gray-700">Módulo Activo</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'temas' && (
                        <div className="space-y-6">
                            {formData.temas.map((tema: any, idx: number) => (
                                <div key={idx} className="p-4 bg-gray-50 rounded-xl space-y-4 relative border border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-black text-indigo-900 text-sm">
                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                            TEMA {idx + 1}
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleRemoveTema(idx)}
                                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-3">
                                            <Input
                                                placeholder="Título del tema"
                                                value={tema.titulo}
                                                onChange={(e) => {
                                                    const newTemas = [...formData.temas];
                                                    newTemas[idx].titulo = e.target.value;
                                                    setFormData({ ...formData, temas: newTemas });
                                                }}
                                            />
                                        </div>
                                        <select
                                            className="p-2 border rounded-lg text-sm bg-white"
                                            value={tema.tipo}
                                            onChange={(e) => {
                                                const newTemas = [...formData.temas];
                                                newTemas[idx].tipo = e.target.value;
                                                setFormData({ ...formData, temas: newTemas });
                                            }}
                                        >
                                            <option value="TEXTO">Texto / Lectura</option>
                                            <option value="VIDEO">Video (URL)</option>
                                            <option value="PDF">PDF (Archivo/Link)</option>
                                        </select>
                                    </div>
                                    <textarea
                                        className="w-full min-h-[120px] p-3 border rounded-lg text-sm bg-white"
                                        placeholder="Contenido del tema (Markdown soportado)"
                                        value={tema.contenido}
                                        onChange={(e) => {
                                            const newTemas = [...formData.temas];
                                            newTemas[idx].contenido = e.target.value;
                                            setFormData({ ...formData, temas: newTemas });
                                        }}
                                    />
                                    {tema.tipo !== 'TEXTO' && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1">
                                                {tema.tipo === 'VIDEO' ? <Video className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                                URL del Recurso
                                            </label>
                                            <Input
                                                placeholder="https://..."
                                                value={tema.resourceUrl}
                                                onChange={(e) => {
                                                    const newTemas = [...formData.temas];
                                                    newTemas[idx].resourceUrl = e.target.value;
                                                    setFormData({ ...formData, temas: newTemas });
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            <Button variant="outline" onClick={handleAddTema} className="w-full dashed border-2 border-indigo-200 text-indigo-600 gap-2">
                                <Plus className="w-4 h-4" /> Añadir Tema
                            </Button>
                        </div>
                    )}

                    {activeTab === 'preguntas' && (
                        <div className="space-y-6">
                            {!isAdminEditingQuestions && (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                                    ⚠️ No se pueden añadir ni eliminar preguntas porque ya hay resultados registrados para este módulo. Solo se permite edición leve de textos si fuera necesario (aunque se recomienda cautela).
                                </div>
                            )}
                            {formData.preguntas.map((pregunta: any, idx: number) => (
                                <div key={idx} className="p-4 bg-gray-50 rounded-xl space-y-4 border border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-black text-gray-900 text-sm">
                                            <HelpCircle className="w-4 h-4 text-indigo-500" />
                                            PREGUNTA {idx + 1}
                                        </div>
                                        {isAdminEditingQuestions && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleRemovePregunta(idx)}
                                                className="h-8 w-8 text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="¿Cuál es la pregunta?"
                                            value={pregunta.texto}
                                            onChange={(e) => {
                                                const newPreguntas = [...formData.preguntas];
                                                newPreguntas[idx].texto = e.target.value;
                                                setFormData({ ...formData, preguntas: newPreguntas });
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className={`space-y-1 p-2 rounded-lg border ${pregunta.correcta === 'A' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Opción A (Correcta)</label>
                                            <Input
                                                value={pregunta.opcionA}
                                                onChange={(e) => {
                                                    const newPreguntas = [...formData.preguntas];
                                                    newPreguntas[idx].opcionA = e.target.value;
                                                    setFormData({ ...formData, preguntas: newPreguntas });
                                                }}
                                            />
                                        </div>
                                        <div className={`space-y-1 p-2 rounded-lg border ${pregunta.correcta === 'B' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Opción B</label>
                                            <Input
                                                value={pregunta.opcionB}
                                                onChange={(e) => {
                                                    const newPreguntas = [...formData.preguntas];
                                                    newPreguntas[idx].opcionB = e.target.value;
                                                    setFormData({ ...formData, preguntas: newPreguntas });
                                                }}
                                            />
                                        </div>
                                        <div className={`space-y-1 p-2 rounded-lg border ${pregunta.correcta === 'C' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Opción C</label>
                                            <Input
                                                value={pregunta.opcionC}
                                                onChange={(e) => {
                                                    const newPreguntas = [...formData.preguntas];
                                                    newPreguntas[idx].opcionC = e.target.value;
                                                    setFormData({ ...formData, preguntas: newPreguntas });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 pt-2 border-t border-gray-200/50 mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Opción Correcta:</span>
                                            <div className="flex gap-2">
                                                {['A', 'B', 'C'].map((opt) => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => {
                                                            const newPreguntas = [...formData.preguntas];
                                                            newPreguntas[idx].correcta = opt;
                                                            setFormData({ ...formData, preguntas: newPreguntas });
                                                        }}
                                                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black transition-all ${pregunta.correcta === opt ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Puntos:</span>
                                            <input
                                                type="number"
                                                className="w-16 h-8 text-center border rounded-lg text-sm"
                                                value={pregunta.puntos}
                                                onChange={(e) => {
                                                    const newPreguntas = [...formData.preguntas];
                                                    newPreguntas[idx].puntos = parseInt(e.target.value);
                                                    setFormData({ ...formData, preguntas: newPreguntas });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isAdminEditingQuestions && (
                                <Button variant="outline" onClick={handleAddPregunta} className="w-full dashed border-2 border-amber-200 text-amber-700 gap-2">
                                    <Plus className="w-4 h-4" /> Añadir Pregunta
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-6 border-t">
                <Button variant="ghost" className="font-bold text-gray-500" onClick={() => window.history.back()}>Cancelar</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700 font-bold px-10" onClick={() => onSave(formData)}>
                    GUARDAR MÓDULO
                </Button>
            </div>
        </div>
    );
}
