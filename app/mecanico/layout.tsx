'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Wrench, AlertCircle, LayoutDashboard, LogOut, Clock, Calendar, Truck, BookOpen } from 'lucide-react';
import QuickIncidentReport from '@/components/incidencias/QuickIncidentReport';


export default function MecanicoLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const navItems = [
        { href: '/mecanico/dashboard', label: 'Dashboard Taller', icon: LayoutDashboard },
        { href: '/mecanico/camiones', label: 'Gestión de Flota', icon: Truck },
        { href: '/mecanico/tareas', label: 'Gestión Averías', icon: AlertCircle },
        { href: '/mecanico/jornada', label: 'Mi Jornada y KM', icon: Clock },
        { href: '/mecanico/vacaciones', label: 'Mis Vacaciones', icon: Calendar },
        { href: '/mecanico/dashboard?section=formacion', label: 'Formación', icon: BookOpen },
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-orange-600 text-white flex flex-col hidden md:flex min-h-screen sticky top-0">
                <div className="p-6 border-b border-orange-500 bg-white">
                    <img src="/logo.jpg" alt="SEL Logo" className="h-16 w-auto mx-auto object-contain" />
                    <p className="text-[10px] text-orange-600 font-black text-center mt-2 uppercase tracking-tighter">Gestión de Taller</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link key={item.href} href={item.href}>
                                <div className={`flex items-center gap-3 p-3 rounded transition-colors ${isActive ? 'bg-orange-700 text-white shadow-inner font-bold' : 'text-orange-100 hover:bg-orange-500 hover:text-white'}`}>
                                    <Icon className="w-5 h-5" />
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-orange-500 space-y-4">
                    <QuickIncidentReport />
                    <Button variant="outline" className="w-full justify-start gap-2 border-white text-white hover:bg-orange-500" onClick={handleLogout}>
                        <LogOut className="w-4 h-4" /> Cerrar Sesión
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
