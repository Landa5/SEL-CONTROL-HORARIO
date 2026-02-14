'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Clock,
    BookOpen,
    Euro,
    Truck,
    Wrench,
    AlertTriangle,
    Map,
    FileText,
    BarChart2,
    Download,
    FileCheck,
    ShieldCheck,
    PartyPopper,
    Settings,
    Coins,
    UserCog,
    LogOut,
    Menu,
    X,
    ChevronDown,
    ChevronRight,
    Car
} from 'lucide-react';
import QuickIncidentReport from '@/components/incidencias/QuickIncidentReport';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Session {
    user: {
        name: string;
        email: string;
    };
    rol: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [session, setSession] = useState<Session | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState<string>('');

    useEffect(() => {
        setCurrentDate(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
    }, []);

    // State for collapsible groups
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        'Personas (RRHH)': true,
        'Flota y Operaciones': true
    });

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                if (res.ok) setSession(await res.json());
            } catch (e) {
                console.error("Error fetching session", e);
            }
        };
        fetchSession();
    }, []);

    const toggleGroup = (group: string) => {
        setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const isOficina = session?.rol === 'OFICINA';
    const isAdmin = session?.rol === 'ADMIN';
    const roleLabel = isOficina ? 'Gestión de Oficina' : (isAdmin ? 'Panel de Administración' : 'Logística SEL');
    const shortRole = isOficina ? 'Oficina' : (isAdmin ? 'Admin' : 'SEL');

    // Mapped Structure
    const navStructure = [
        {
            type: 'single',
            href: '/admin/dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard
        },
        {
            type: 'group',
            label: 'Personas (RRHH)',
            items: [
                { href: '/admin/empleados', label: 'Empleados', icon: Users },
                { href: '/admin/ausencias', label: 'Ausencias y Vacaciones', icon: Calendar },
                { href: '/admin/jornadas', label: 'Jornada / Fichajes', icon: Clock },
                { href: '/admin/formacion', label: 'Formación', icon: BookOpen },
                { href: '/admin/nominas', label: 'Nóminas', icon: Euro },
                { href: '/admin/informes/operativos?tab=personnel', label: 'Informe Operativo RRHH', icon: FileText },
            ]
        },
        {
            type: 'group',
            label: 'Flota y Operaciones',
            items: [
                { href: '/admin/camiones', label: 'Camiones', icon: Truck },
                { href: '/admin/tareas', label: 'Taller y Mantenimiento', icon: Wrench },
                { href: '/admin/tareas?tab=incidencias', label: 'Incidencias', icon: AlertTriangle },
                { href: '/admin/jornadas?tab=rutas', label: 'Rutas / Operación', icon: Map },
                { href: '/admin/informes/operativos', label: 'Informe Operativo', icon: FileText },
            ]
        },
        {
            type: 'group',
            label: 'Alquiler Garaje',
            items: [
                { href: '/admin/alquiler', label: 'Gestión Plazas', icon: Car },
            ]
        },
        {
            type: 'group',
            label: 'Control y Auditoría',
            items: [
                { href: '/admin/informes/mensuales', label: 'Informes Mensuales', icon: BarChart2 },
                { href: '/admin/informes/gestoria', label: 'Exportaciones Gestoría', icon: Download },
                { href: '/admin/informes/legal', label: 'Registro Jornada Legal', icon: FileCheck },
                { href: '/admin/auditoria', label: 'Auditoría Interna', icon: ShieldCheck },
            ]
        },
        {
            type: 'group',
            label: 'Configuración',
            items: [
                { href: '/admin/fiestas', label: 'Fiestas Locales', icon: PartyPopper },
                { href: '/admin/construccion?modulo=Parámetros Productividad', label: 'Parámetros Productividad', icon: Settings },
                { href: '/admin/construccion?modulo=Tarifas Incentivos', label: 'Tarifas Incentivos', icon: Coins },
                { href: '/admin/construccion?modulo=Roles y Permisos', label: 'Roles y Permisos', icon: UserCog },
            ]
        }
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar Desktop */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex h-screen sticky top-0">
                <div className="p-6 border-b border-slate-800 bg-white text-center shrink-0">
                    <img src="/logo.jpg" alt="SEL Logo" className="h-16 w-auto mx-auto object-contain" />
                    <p className="text-[10px] text-slate-900 font-bold uppercase tracking-widest mt-2">{roleLabel}</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    {navStructure.map((item: any, idx) => {
                        if (item.type === 'single') {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link key={idx} href={item.href}>
                                    <div className={`flex items-center gap-3 p-3 rounded-lg transition-all mb-4 ${isActive ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                                        <Icon className="w-5 h-5" />
                                        <span className="text-sm">{item.label}</span>
                                    </div>
                                </Link>
                            );
                        } else {
                            const isOpen = openGroups[item.label];
                            const containsActive = item.items.some((sub: any) => pathname.startsWith(sub.href) && sub.href !== '#');

                            return (
                                <div key={idx} className="mb-2">
                                    <button
                                        onClick={() => toggleGroup(item.label)}
                                        className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${containsActive ? 'text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                                        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>

                                    {isOpen && (
                                        <div className="mt-1 space-y-0.5 ml-2 border-l border-slate-700 pl-2">
                                            {item.items.map((sub: any, sIdx: number) => {
                                                const SubIcon = sub.icon;
                                                const isSubActive = pathname === sub.href;
                                                return (
                                                    <Link key={sIdx} href={sub.href}>
                                                        <div className={`flex items-center gap-3 p-2 rounded-md text-sm transition-colors ${isSubActive ? 'bg-blue-900/50 text-blue-300 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                                                            <SubIcon className="w-4 h-4 opacity-70" />
                                                            <span>{sub.label}</span>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 shrink-0">
                    <QuickIncidentReport />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-20 relative">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </Button>
                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest md:hidden">{shortRole}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block mr-4 pr-4 border-r">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Hoy</p>
                            <p className="text-sm font-bold text-gray-700 capitalize">
                                {currentDate}
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

                {/* Mobile Menu Overlay */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900 text-white pt-16 md:hidden overflow-y-auto animate-in fade-in slide-in-from-left-10 duration-200">
                        <div className="p-6">
                            <div className="mb-8 text-center">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">ESTÁS EN</p>
                                <h2 className="text-xl font-bold uppercase tracking-widest text-white">{roleLabel}</h2>
                            </div>
                            <nav className="space-y-6">
                                {navStructure.map((item: any, idx) => (
                                    <div key={idx}>
                                        {item.type === 'single' ? (
                                            <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>
                                                <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-600 text-white font-bold shadow-lg">
                                                    <item.icon className="w-6 h-6" />
                                                    <span className="text-lg">{item.label}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="space-y-3">
                                                <h3 className="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                                                    {item.label}
                                                </h3>
                                                <div className="space-y-2 pl-2">
                                                    {item.items.map((sub: any, sIdx: number) => (
                                                        <Link key={sIdx} href={sub.href} onClick={() => setMobileMenuOpen(false)}>
                                                            <div className="flex items-center gap-4 p-3 rounded-lg text-slate-300 hover:bg-slate-800">
                                                                <sub.icon className="w-5 h-5 opacity-70" />
                                                                <span className="text-base">{sub.label}</span>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </nav>
                        </div>
                    </div>
                )}

                <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-50/50">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
