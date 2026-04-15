'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, Truck, Calendar, Info, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notification {
    id: number;
    mensaje: string;
    tipo: string | null;
    link: string | null;
    readAt: string | null;
    createdAt: string;
    actor?: {
        nombre: string;
        apellidos: string | null;
    } | null;
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notificaciones?limit=15');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (e) {
            // Silent fail — don't break the UI
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        // Poll every 30 seconds
        pollInterval.current = setInterval(fetchNotifications, 30000);
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [fetchNotifications]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAllAsRead = async () => {
        setLoading(true);
        try {
            await fetch('/api/notificaciones', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true })
            });
            await fetchNotifications();
        } catch (e) { /* silent */ }
        setLoading(false);
    };

    const markAsRead = async (id: number) => {
        try {
            await fetch('/api/notificaciones', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] })
            });
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) { /* silent */ }
    };

    const getIcon = (mensaje: string) => {
        if (mensaje.toLowerCase().includes('km') || mensaje.toLowerCase().includes('descuadre') || mensaje.toLowerCase().includes('camión')) {
            return <Truck className="w-4 h-4 text-orange-500" />;
        }
        if (mensaje.toLowerCase().includes('tarea') || mensaje.toLowerCase().includes('avería')) {
            return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        }
        if (mensaje.toLowerCase().includes('ausencia') || mensaje.toLowerCase().includes('vacacion')) {
            return <Calendar className="w-4 h-4 text-blue-500" />;
        }
        return <Info className="w-4 h-4 text-gray-400" />;
    };

    const formatTime = (dateStr: string) => {
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
        } catch {
            return '';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title="Notificaciones"
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-gray-700' : 'text-gray-400'}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 animate-pulse shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
                    style={{ maxHeight: '480px' }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b bg-gradient-to-r from-gray-50 to-white flex items-center justify-between sticky top-0 z-10">
                        <div>
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <p className="text-[10px] text-gray-400">{unreadCount} sin leer</p>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={loading}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    Marcar todo leído
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                                <p className="text-sm text-gray-400 font-medium">Sin notificaciones</p>
                                <p className="text-[10px] text-gray-300 mt-1">Las alertas de KM y sistema aparecerán aquí</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`px-4 py-3 border-b last:border-0 hover:bg-gray-50/80 transition-colors cursor-pointer ${
                                        !notif.readAt ? 'bg-blue-50/40 border-l-3 border-l-blue-500' : ''
                                    }`}
                                    onClick={() => {
                                        if (!notif.readAt) markAsRead(notif.id);
                                        if (notif.link) window.location.href = notif.link;
                                    }}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                                            !notif.readAt ? 'bg-orange-100' : 'bg-gray-100'
                                        }`}>
                                            {getIcon(notif.mensaje)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug ${
                                                !notif.readAt ? 'text-gray-900 font-semibold' : 'text-gray-600'
                                            }`}>
                                                {notif.mensaje}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-gray-400">
                                                    {formatTime(notif.createdAt)}
                                                </span>
                                                {notif.actor && (
                                                    <span className="text-[10px] text-gray-300">
                                                        • {notif.actor.nombre}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!notif.readAt && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
