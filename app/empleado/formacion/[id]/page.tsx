'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ChevronRight, ChevronLeft, CheckCircle, PlayCircle, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ModuleViewerPage() {
    const router = useRouter();
    const { id } = useParams();
    const [modulo, setModulo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTemaIndex, setCurrentTemaIndex] = useState(0);

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

    if (loading) return <div className="p-12 text-center text-gray-500">Cargando contenido...</div>;
    if (!modulo) return <div className="p-12 text-center text-red-500">Módulo no encontrado.</div>;

    const currentTema = modulo.temas[currentTemaIndex];
    const isLastTema = currentTemaIndex === modulo.temas.length - 1;
    const progress = ((currentTemaIndex + 1) / modulo.temas.length) * 100;

    const canStartEval = isLastTema;
    const yaAprobado = modulo.resultados?.length > 0 && modulo.resultados[0].aprobado;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" className="text-gray-500 hover:text-indigo-600 gap-2 font-bold px-0" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" /> VOLVER
                </Button>
                <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                    MÓDULO: {modulo.titulo}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-indigo-600 tracking-tighter">
                    <span>Progreso del Curso</span>
                    <span>Tema {currentTemaIndex + 1} de {modulo.temas.length}</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Theme Content */}
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-indigo-900 p-8 text-white relative overflow-hidden">
                    <div className="relative z-10 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-300">
                            {currentTema.tipo === 'VIDEO' ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            Recurso de Aprendizaje
                        </div>
                        <h2 className="text-3xl font-black">{currentTema.titulo}</h2>
                    </div>
                    {/* Abstract background element */}
                    <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
                </div>
                <CardContent className="p-8 md:p-12 space-y-8">
                    {currentTema.tipo === 'VIDEO' && currentTema.resourceUrl && (
                        <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-100">
                            {/* Basic iframe if youtube, or message */}
                            {currentTema.resourceUrl.includes('youtube.com') || currentTema.resourceUrl.includes('youtu.be') ? (
                                <iframe
                                    className="w-full h-full"
                                    src={currentTema.resourceUrl.replace('watch?v=', 'embed/')}
                                    title="YouTube video player"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white space-y-4 p-8">
                                    <PlayCircle className="w-16 h-16 opacity-50" />
                                    <p className="text-center font-bold">Haz clic para ver el video externo:</p>
                                    <Button className="bg-white text-black hover:bg-gray-100" onClick={() => window.open(currentTema.resourceUrl)}>
                                        ABRIR VIDEO
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="prose prose-indigo max-w-none text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                        {currentTema.contenido}
                    </div>

                    {currentTema.tipo === 'PDF' && currentTema.resourceUrl && (
                        <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm">
                                    <FileText className="w-8 h-8 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-blue-900">Documento PDF Adjunto</p>
                                    <p className="text-xs text-blue-600 font-medium">Lectura técnica complementaria</p>
                                </div>
                            </div>
                            <Button className="bg-blue-600 text-white hover:bg-blue-700 font-bold px-6" onClick={() => window.open(currentTema.resourceUrl)}>
                                VER PDF
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
                <Button
                    variant="outline"
                    className="w-full md:w-auto font-bold gap-2 px-8 h-12"
                    onClick={() => setCurrentTemaIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentTemaIndex === 0}
                >
                    <ChevronLeft className="w-5 h-5" /> ANTERIOR
                </Button>

                {!isLastTema ? (
                    <Button
                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-black gap-2 px-12 h-14 text-lg shadow-lg shadow-indigo-100"
                        onClick={() => setCurrentTemaIndex(prev => Math.min(modulo.temas.length - 1, prev + 1))}
                    >
                        SIGUIENTE TEMA <ChevronRight className="w-6 h-6" />
                    </Button>
                ) : (
                    yaAprobado ? (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 font-bold flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" /> YA HAS COMPLETADO ESTE CURSO CON ÉXITO
                        </div>
                    ) : (
                        <Link href={`/empleado/formacion/${modulo.id}/evaluacion`}>
                            <Button
                                className="w-full md:w-auto bg-green-600 hover:bg-green-700 font-black gap-2 px-12 h-14 text-lg shadow-lg shadow-green-100 animate-bounce"
                            >
                                INICIAR EXAMEN FINAL <CheckCircle className="w-6 h-6" />
                            </Button>
                        </Link>
                    )
                )}
            </div>
        </div>
    );
}
