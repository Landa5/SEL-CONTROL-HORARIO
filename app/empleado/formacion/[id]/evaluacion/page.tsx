'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, HelpCircle, Trophy } from 'lucide-react';

export default function EvaluacionPage() {
    const router = useRouter();
    const { id } = useParams();
    const [modulo, setModulo] = useState<any>(null);
    const [respuestas, setRespuestas] = useState<Record<number, string>>({});
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchModulo = async () => {
            try {
                const res = await fetch(`/api/formacion/modulos/${id}`);
                if (res.ok) {
                    setModulo(await res.json());
                }
            } catch (error) {
                console.error('Error fetching module:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchModulo();
    }, [id]);

    const handleSelectRespuesta = (preguntaId: number, opcion: string) => {
        if (resultado) return;
        setRespuestas({ ...respuestas, [preguntaId]: opcion });
    };

    const handleSubmit = async () => {
        if (Object.keys(respuestas).length < modulo.preguntas.length) {
            alert('Por favor, responde a todas las preguntas antes de enviar.');
            return;
        }

        setEnviando(true);
        try {
            const res = await fetch('/api/formacion/evaluacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moduloId: id, respuestas })
            });

            if (res.ok) {
                setResultado(await res.json());
            } else {
                const err = await res.json();
                alert(err.error || 'Error al enviar la evaluación');
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            setEnviando(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">Preparando Evaluación...</div>;
    if (!modulo) return <div className="p-12 text-center text-red-500 font-bold uppercase tracking-widest text-sm">Error: Módulo no encontrado.</div>;

    if (resultado) {
        return (
            <div className="max-w-2xl mx-auto py-12 space-y-8 animate-in zoom-in-95 duration-500">
                <Card className={`border-none shadow-2xl overflow-hidden ${resultado.passed ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                    <CardContent className="p-12 text-center space-y-6">
                        <div className="flex justify-center">
                            {resultado.passed ? (
                                <Trophy className="w-24 h-24 mb-4 animate-bounce" />
                            ) : (
                                <XCircle className="w-24 h-24 mb-4" />
                            )}
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black uppercase tracking-tighter">
                                {resultado.passed ? '¡HAS APROBADO!' : 'NO HAS SUPERADO EL EXAMEN'}
                            </h2>
                            <p className="text-xl opacity-90 font-medium">
                                Tu puntuación: <span className="font-black underline">{resultado.score}%</span>
                            </p>
                            {!resultado.passed && (
                                <p className="text-sm bg-black/20 p-3 rounded-xl mt-4">
                                    {resultado.attempts >= 2
                                        ? "Has agotado tus intentos. Contacta con administración."
                                        : `Te queda ${2 - resultado.attempts} intento adicional.`}
                                </p>
                            )}
                        </div>
                        <Button
                            className="bg-white text-black hover:bg-gray-100 font-black px-12 h-12 rounded-full uppercase tracking-widest mt-6"
                            onClick={() => router.push('/empleado')}
                        >
                            VOLVER AL PORTAL
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-32">
            <header className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-gray-900 uppercase">Evaluación Final</h1>
                    <div className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest">
                        ESTANDAR: 70% PARA APROBAR
                    </div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 text-amber-800 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                        <p className="font-bold">Aviso Importante</p>
                        <p>Lee atentamente cada pregunta. Solo dispones de <b>2 intentos</b> para superar esta formación.</p>
                    </div>
                </div>
            </header>

            <div className="space-y-6">
                {modulo.preguntas.map((p: any, idx: number) => (
                    <Card key={p.id} className="border-none shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all">
                        <div className="p-6 bg-gray-50 border-b flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-indigo-600" /> PREGUNTA {idx + 1}
                            </h3>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.puntos} Puntos</span>
                        </div>
                        <CardContent className="p-8 space-y-6">
                            <p className="text-xl font-bold text-gray-800 leading-tight">
                                {p.texto}
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                {['A', 'B', 'C'].map((opt) => {
                                    const letra = opt as 'A' | 'B' | 'C';
                                    const texto = p[`opcion${letra}`];
                                    const isSelected = respuestas[p.id] === opt;

                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => handleSelectRespuesta(p.id, opt)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${isSelected
                                                    ? 'border-indigo-600 bg-indigo-50 shadow-inner translate-x-2'
                                                    : 'border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-400'}`}>
                                                {opt}
                                            </div>
                                            <span className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-600'}`}>{texto}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t flex justify-center z-50">
                <Button
                    className="max-w-md w-full h-14 bg-indigo-900 hover:bg-black text-white font-black text-lg gap-3 rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={enviando || Object.keys(respuestas).length < modulo.preguntas.length}
                >
                    {enviando ? 'PROCESANDO...' : 'ENVIAR EVALUACIÓN'}
                    {!enviando && <ArrowRight className="w-6 h-6" />}
                </Button>
            </div>
        </div>
    );
}
