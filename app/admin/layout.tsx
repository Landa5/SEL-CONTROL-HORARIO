'use client';

import Link from 'next/link';
import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Users, Truck, Calendar, LayoutDashboard, LogOut, AlertCircle, BookOpen, FileText, TrendingUp } from 'lucide-react';
import QuickIncidentReport from '@/components/incidencias/QuickIncidentReport';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [session, setSession] = (React as any).useState(null);

    (React as any).useEffect(() => {
        const fetchSession = async () => {
            const res = await fetch('/api/auth/session');
            if (res.ok) setSession(await res.json());
        };
        fetchSession();
    }, []);

    const isOficina = session?.rol === 'OFICINA';
    const isAdmin = session?.rol === 'ADMIN';
    const roleLabel = isOficina ? 'Gestión de Oficina' : (isAdmin ? 'Panel de Administración' : 'Logística SEL');
    const shortRole = isOficina ? 'Oficina' : (isAdmin ? 'Admin' : 'SEL');

    const navItems = [
        {
            group: 'General', items: [
                { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/admin/empleados', label: 'Empleados', icon: Users },
                { href: '/admin/camiones', label: 'Camiones', icon: Truck },
                { href: '/admin/tareas', label: 'Tareas y Taller', icon: AlertCircle },
                { href: '/admin/jornadas', label: 'Informes de Días', icon: FileText },
                { href: '/admin/nominas', label: 'Nóminas', icon: TrendingUp },
                { href: '/admin/formacion', label: 'Formación Interna', icon: BookOpen },
            ]
        },
        {
            group: 'Ausencias y Festivos', items: [
                { href: '/admin/ausencias', label: 'Ausencias y Vacaciones', icon: Calendar },
                { href: '/admin/fiestas', label: 'Fiestas Locales', icon: Calendar },
                { href: '/admin/fiestas/reporte', label: 'Reporte Festivos', icon: LayoutDashboard },
            ]
        },
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-blue-900 text-white flex flex-col hidden md:flex">
                <div className="p-6 border-b border-blue-800 bg-white text-center">
                    <img src="/logo.jpg" alt="SEL Logo" className="h-16 w-auto mx-auto object-contain" />
                    <p className="text-[10px] text-blue-900 font-black mt-2 uppercase tracking-tighter">{roleLabel}</p>
                </div>
                <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {navItems.map((group, idx) => (
                        <div key={idx} className="space-y-2">
                            <h3 className="px-3 text-[10px] font-bold text-blue-300 uppercase tracking-widest">
                                {group.group}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname.startsWith(item.href);
                                    return (
                                        <Link key={item.href} href={item.href}>
                                            <div className={`flex items-center gap-3 p-2.5 rounded transition-colors text-sm ${isActive ? 'bg-blue-700 text-white font-bold' : 'text-blue-100 hover:bg-blue-800'}`}>
                                                <Icon className="w-4 h-4 opacity-80" />
                                                {item.label}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
                <div className="p-4 border-t border-blue-800 space-y-4">
                    <QuickIncidentReport />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
                    <div>
                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest sm:hidden">{shortRole}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block mr-4 pr-4 border-r">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Hoy</p>
                            <p className="text-sm font-bold text-gray-700 capitalize">
                                {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 gap-2 font-bold transition-all"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Cerrar Sesión</span>
                        </Button>
                    </div>
                </header>

                <main className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
