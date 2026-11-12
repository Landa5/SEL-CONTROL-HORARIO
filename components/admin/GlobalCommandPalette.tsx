'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    Users,
    Truck,
    Wrench,
    Calendar,
    BarChart2,
    PlusCircle,
    ArrowRight,
    X,
    FileText,
    ShieldCheck,
    Disc3,
    Loader2,
    Command
} from 'lucide-react';

interface GlobalCommandPaletteProps {
    open: boolean;
    onClose: () => void;
}

const QUICK_ACTIONS = [
    { label: 'Ir al Centro de Informes (9 KPIs)', href: '/admin/informes/centro', icon: BarChart2, category: 'Acción rápida' },
    { label: 'Ver Informes Mensuales y Nóminas', href: '/admin/informes/mensuales', icon: FileText, category: 'Acción rápida' },
    { label: 'Gestionar Taller e Incidencias', href: '/admin/tareas', icon: Wrench, category: 'Acción rápida' },
    { label: 'Aprobar / Registrar Ausencias y Vacaciones', href: '/admin/ausencias', icon: Calendar, category: 'Acción rápida' },
    { label: 'Ficha de Empleados (360°)', href: '/admin/empleados', icon: Users, category: 'Acción rápida' },
    { label: 'Flota de Camiones y Vencimientos (360°)', href: '/admin/camiones', icon: Truck, category: 'Acción rápida' },
    { label: 'Tacógrafo Digital e Importaciones', href: '/admin/tacografo', icon: Disc3, category: 'Acción rápida' },
    { label: 'Registro de Jornada Legal', href: '/admin/informes/legal', icon: ShieldCheck, category: 'Acción rápida' }
];

export default function GlobalCommandPalette({ open, onClose }: GlobalCommandPaletteProps) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{
        empleados: any[];
        camiones: any[];
        tareas: any[];
        ausencias: any[];
    }>({ empleados: [], camiones: [], tareas: [], ausencias: [] });
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (open) onClose();
            } else if (e.key === 'Escape' && open) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery('');
            setResults({ empleados: [], camiones: [], tareas: [], ausencias: [] });
        }
    }, [open]);

    useEffect(() => {
        if (!query.trim()) {
            setResults({ empleados: [], camiones: [], tareas: [], ausencias: [] });
            setLoading(false);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/global-search?q=${encodeURIComponent(query.trim())}`);
                if (res.ok) {
                    setResults(await res.json());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 180);

        return () => clearTimeout(timer);
    }, [query]);

    if (!open) return null;

    const navigate = (href: string) => {
        onClose();
        router.push(href);
    };

    const filteredActions = query.trim()
        ? QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))
        : QUICK_ACTIONS;

    const hasEntityResults =
        results.empleados.length > 0 ||
        results.camiones.length > 0 ||
        results.tareas.length > 0 ||
        results.ausencias.length > 0;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-16 px-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input Bar */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50/60">
                    <Search className="w-5 h-5 text-blue-600 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar camión (1234 BCD), empleado (Óscar), avería (ITV), ausencia o pantalla..."
                        className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 font-medium focus:outline-none"
                    />
                    {loading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded"
                        >
                            Limpiar
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Results Body */}
                <div className="max-h-[68vh] overflow-y-auto p-3 space-y-4">
                    {/* Empleados */}
                    {results.empleados.length > 0 && (
                        <div>
                            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-blue-600" /> Empleados ({results.empleados.length})
                            </p>
                            <div className="space-y-1">
                                {results.empleados.map((emp: any) => (
                                    <button
                                        key={emp.id}
                                        onClick={() => navigate(`/admin/empleados/${emp.id}`)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-blue-50 text-left transition-colors group"
                                    >
                                        <div>
                                            <span className="font-bold text-slate-800 text-sm group-hover:text-blue-700">
                                                {emp.nombre} {emp.apellidos || ''}
                                            </span>
                                            <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                {emp.rol}
                                            </span>
                                            {emp.dni && <span className="ml-2 text-xs text-slate-400 font-mono">{emp.dni}</span>}
                                        </div>
                                        <span className="text-xs text-blue-600 font-semibold flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                            Ficha 360° <ArrowRight className="w-3.5 h-3.5" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Camiones */}
                    {results.camiones.length > 0 && (
                        <div>
                            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-emerald-600" /> Camiones ({results.camiones.length})
                            </p>
                            <div className="space-y-1">
                                {results.camiones.map((cam: any) => (
                                    <button
                                        key={cam.id}
                                        onClick={() => navigate(`/admin/camiones/${cam.id}`)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left transition-colors group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-slate-900 bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded text-xs">
                                                {cam.matricula}
                                            </span>
                                            <span className="text-sm font-medium text-slate-700">
                                                {cam.marca || ''} {cam.modelo || ''}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {(cam.kmActual || 0).toLocaleString()} km
                                            </span>
                                        </div>
                                        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                            Ficha 360° <ArrowRight className="w-3.5 h-3.5" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tareas / Taller / Incidencias */}
                    {results.tareas.length > 0 && (
                        <div>
                            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-amber-600" /> Taller e Incidencias ({results.tareas.length})
                            </p>
                            <div className="space-y-1">
                                {results.tareas.map((t: any) => (
                                    <button
                                        key={t.id}
                                        onClick={() => navigate(`/admin/tareas?q=${encodeURIComponent(t.titulo)}`)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-amber-50 text-left transition-colors group"
                                    >
                                        <div className="truncate pr-3">
                                            <span className="font-semibold text-slate-800 text-sm">{t.titulo}</span>
                                            {t.matricula && (
                                                <span className="ml-2 text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                    {t.matricula}
                                                </span>
                                            )}
                                            <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                                {t.estado}
                                            </span>
                                        </div>
                                        <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Ausencias */}
                    {results.ausencias.length > 0 && (
                        <div>
                            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-purple-600" /> Ausencias ({results.ausencias.length})
                            </p>
                            <div className="space-y-1">
                                {results.ausencias.map((a: any) => (
                                    <button
                                        key={a.id}
                                        onClick={() => navigate(`/admin/ausencias?q=${encodeURIComponent(a.empleado?.nombre || '')}`)}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-purple-50 text-left transition-colors group"
                                    >
                                        <div>
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {a.empleado?.nombre} {a.empleado?.apellidos || ''}
                                            </span>
                                            <span className="ml-2 text-xs text-purple-700 font-bold">{a.tipo}</span>
                                            <span className="ml-2 text-xs text-slate-400">
                                                ({new Date(a.fechaInicio).toLocaleDateString('es-ES')})
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                            {a.estado}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Actions / Navigation */}
                    {filteredActions.length > 0 && (
                        <div>
                            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <PlusCircle className="w-3.5 h-3.5 text-indigo-600" /> Navegación y Acciones Rápidas
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                {filteredActions.map((act, idx) => {
                                    const Icon = act.icon;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => navigate(act.href)}
                                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-left transition-colors"
                                        >
                                            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 truncate">{act.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {query.trim() && !loading && !hasEntityResults && filteredActions.length === 0 && (
                        <div className="py-10 text-center text-slate-400 text-sm">
                            No se encontraron resultados para <span className="font-bold text-slate-600">&ldquo;{query}&rdquo;</span>
                        </div>
                    )}
                </div>

                {/* Footer Shortcut Legend */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-mono text-slate-600">Ctrl+K</kbd> abrir/cerrar
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-mono text-slate-600">Esc</kbd> salir
                        </span>
                    </div>
                    <span className="font-medium text-slate-500">Buscador Global SEL</span>
                </div>
            </div>
        </div>
    );
}
