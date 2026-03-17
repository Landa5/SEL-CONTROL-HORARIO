'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_ICONS: Record<string, string> = {
    TAREA_ASIGNADA: '📋',
    AVERIA_REPORTADA: '🔧',
    CAMBIO_ESTADO: '🔄',
    COMENTARIO_NUEVO: '💬',
    CIERRE_PENDIENTE: '⏳',
    PRIORIDAD_CAMBIADA: '⚡',
    MENCION: '📢',
};

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<{ notificaciones: any[], noLeidas: number }>({ notificaciones: [], noLeidas: 0 });
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notificaciones?limit=15');
            if (res.ok) setData(await res.json());
        } catch (e) {
            console.error('Error fetching notifications:', e);
        }
    };

    const markAsRead = async (ids: number[]) => {
        try {
            await fetch('/api/notificaciones', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            fetchNotifications();
        } catch (e) {
            console.error('Error marking as read:', e);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notificaciones', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marcarTodas: true })
            });
            fetchNotifications();
        } catch (e) {
            console.error('Error marking all as read:', e);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                <Bell className={`w-5 h-5 ${data.noLeidas > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                {data.noLeidas > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                        {data.noLeidas > 9 ? '9+' : data.noLeidas}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80">
                        <h3 className="font-black text-gray-900 text-sm">Notificaciones</h3>
                        <div className="flex items-center gap-2">
                            {data.noLeidas > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todo
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                        {data.notificaciones.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">Sin notificaciones</p>
                            </div>
                        ) : (
                            data.notificaciones.map((n: any) => {
                                const isUnread = !n.readAt;
                                return (
                                    <div
                                        key={n.id}
                                        className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group ${isUnread ? 'bg-blue-50/40' : ''}`}
                                        onClick={() => {
                                            if (isUnread) markAsRead([n.id]);
                                            if (n.link) window.location.href = n.link;
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-lg flex-shrink-0 mt-0.5">
                                                {TIPO_ICONS[n.tipo] || '📌'}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm leading-tight ${isUnread ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                                    {n.mensaje}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-gray-400">
                                                        {format(new Date(n.createdAt), "dd MMM HH:mm", { locale: es })}
                                                    </span>
                                                    {n.actor?.nombre && (
                                                        <span className="text-[10px] text-gray-400">
                                                            por {n.actor.nombre}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {isUnread && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
