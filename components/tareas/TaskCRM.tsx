'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/Button";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, User, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export default function TaskCRM({ task, onUpdate }: { task: any, onUpdate: () => void }) {
    const [mensaje, setMensaje] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mensaje.trim()) return;

        setSending(true);
        try {
            const res = await fetch(`/api/tareas/${task.id}/historial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje, tipoAccion: 'COMENTARIO' })
            });

            if (res.ok) {
                setMensaje('');
                onUpdate(); // Reload parent
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    if (!task) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full max-h-[600px]">
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" /> Historial de Actividad
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {task.historial?.map((h: any, i: number) => (
                    <div key={h.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex-shrink-0 mt-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${h.tipoAccion === 'COMENTARIO' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                                }`}>
                                {h.autor?.nombre?.charAt(0) || '?'}
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-bold text-gray-900">{h.autor?.nombre}</span>
                                <span className="text-[10px] text-gray-400 capitalize">
                                    {format(new Date(h.createdAt), "d MMM HH:mm", { locale: es })}
                                </span>
                            </div>

                            {h.tipoAccion === 'CAMBIO_ESTADO' ? (
                                <div className="mt-1 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100 italic">
                                    {h.mensaje}
                                </div>
                            ) : h.tipoAccion === 'CREACION' ? (
                                <div className="mt-1 text-xs bg-green-50 text-green-800 p-2 rounded border border-green-100 font-medium">
                                    {h.mensaje}
                                </div>
                            ) : (
                                <div className="mt-1 text-sm text-gray-700 bg-gray-50 p-2 rounded-tr-xl rounded-br-xl rounded-bl-xl border border-gray-100">
                                    {h.mensaje}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSend} className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                <input
                    type="text"
                    placeholder="Escribe un comentario o actualización..."
                    className="flex-1 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    disabled={sending}
                />
                <Button
                    type="submit"
                    size="icon"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={sending || !mensaje.trim()}
                >
                    {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
            </form>
        </div>
    );
}
