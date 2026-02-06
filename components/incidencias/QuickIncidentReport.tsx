'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertTriangle, Send, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Camion {
    id: number;
    matricula: string;
}

export default function QuickIncidentReport({ dark = true }: { dark?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [camiones, setCamiones] = useState<Camion[]>([]);
    const [selectedCamion, setSelectedCamion] = useState<string>('');
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && camiones.length === 0) {
            fetch('/api/camiones')
                .then(res => res.json())
                .then(data => setCamiones(data))
                .catch(err => console.error('Error fetching camiones:', err));
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titulo || !descripcion) return;

        setLoading(true);
        try {
            const res = await fetch('/api/tareas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'AVERIA',
                    activoTipo: selectedCamion ? 'CAMION' : 'OTRO',
                    matricula: selectedCamion ? camiones.find(c => c.id.toString() === selectedCamion)?.matricula : 'GENERAL',
                    titulo,
                    descripcion,
                    prioridad: 'MEDIA',
                    camionId: selectedCamion || undefined
                })
            });

            if (res.ok) {
                alert('Incidencia reportada correctamente');
                setTitulo('');
                setDescripcion('');
                setSelectedCamion('');
                setIsOpen(false);
            } else {
                const data = await res.json();
                alert(`Error: ${data.error || 'No se pudo enviar'}`);
            }
        } catch (error) {
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`pt-4 border-t ${dark ? 'mt-auto border-white/10' : 'border-gray-100'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${isOpen
                        ? (dark ? 'bg-white/20 text-white' : 'bg-red-50 text-red-700')
                        : (dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700')
                    }`}
            >
                <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${dark ? 'text-yellow-400' : 'text-red-600'}`} />
                    <span className="font-semibold text-sm text-left">Reportar Incidencia</span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {isOpen && (
                <div className={`mt-2 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 ${dark ? 'bg-white/5' : 'bg-gray-50 border border-gray-100'
                    }`}>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className={`block text-[10px] font-bold uppercase mb-1 ${dark ? 'text-white/50' : 'text-gray-400'}`}>
                                {selectedCamion ? 'Vehículo Detectado' : 'Camión (Opcional)'}
                            </label>
                            <select
                                className={`w-full border rounded p-2 text-xs focus:outline-none focus:ring-1 ${dark
                                        ? 'bg-black/20 border-white/10 text-white focus:ring-yellow-400'
                                        : 'bg-white border-gray-200 text-gray-900 focus:ring-red-500'
                                    }`}
                                value={selectedCamion}
                                onChange={e => setSelectedCamion(e.target.value)}
                            >
                                <option value="">General / Otros</option>
                                {camiones.map(c => (
                                    <option key={c.id} value={c.id.toString()}>{c.matricula}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={`block text-[10px] font-bold uppercase mb-1 ${dark ? 'text-white/50' : 'text-gray-400'}`}>Título</label>
                            <Input
                                placeholder="Ej: Fuga de aceite..."
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                                className={`h-8 text-xs focus:ring-1 ${dark
                                        ? 'bg-black/20 border-white/10 text-white focus:ring-yellow-400'
                                        : 'bg-white border-gray-200 text-gray-900 focus:ring-red-500'
                                    }`}
                                required
                            />
                        </div>

                        <div>
                            <label className={`block text-[10px] font-bold uppercase mb-1 ${dark ? 'text-white/50' : 'text-gray-400'}`}>Descripción</label>
                            <textarea
                                className={`w-full border rounded p-2 text-xs focus:outline-none focus:ring-1 min-h-[60px] ${dark
                                        ? 'bg-black/20 border-white/10 text-white focus:ring-yellow-400'
                                        : 'bg-white border-gray-200 text-gray-900 focus:ring-red-500'
                                    }`}
                                placeholder="Detalla el problema..."
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className={`w-full font-bold h-8 text-xs gap-2 ${dark
                                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                        >
                            <Send className="w-3 h-3" />
                            {loading ? 'Enviando...' : 'Enviar Reporte'}
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
