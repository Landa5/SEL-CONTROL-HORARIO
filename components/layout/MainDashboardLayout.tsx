'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LogOut, Menu, X, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    badgeCount?: number;
}

interface MainDashboardLayoutProps {
    title: string;
    userName: string;
    roleLabel: string; // e.g. "Gestión Logística" or "Conductor"
    navItems: NavItem[];
    activeSection: string;
    onNavigate: (sectionId: string) => void;
    onLogout: () => void;
    children: React.ReactNode;
}

export default function MainDashboardLayout({
    title,
    userName,
    roleLabel,
    navItems,
    activeSection,
    onNavigate,
    onLogout,
    children
}: MainDashboardLayoutProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* SIDEBAR (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shadow-xl fixed h-full z-10">
                <div className="p-6 border-b border-slate-800 bg-white">
                    <img src="/logo.jpg" alt="SEL Logo" className="h-16 w-auto mx-auto object-contain" />
                    <p className="text-[10px] text-slate-900 font-black text-center mt-2 uppercase tracking-tighter">{roleLabel}</p>
                </div>

                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all group ${isActive
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                    <span>{item.label}</span>
                                </div>
                                {item.badgeCount ? (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                                        }`}>
                                        {item.badgeCount}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                            {userName.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT WRAPPER */}
            <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all">

                {/* HEADER */}
                <header className="bg-white border-b shadow-sm sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden text-gray-500" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                            <Menu className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">{title}</h1>
                            <p className="text-xs text-gray-500 md:hidden">{roleLabel}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-gray-400 uppercase">Hoy</p>
                            <p className="text-sm font-semibold text-gray-700 capitalize">
                                {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
                            </p>
                        </div>
                        <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
                        <Button variant="ghost" size="sm" onClick={onLogout} className="text-red-600 hover:bg-red-50 gap-2">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Salir</span>
                        </Button>
                    </div>
                </header>

                {/* MOBILE SIDEBAR OVERLAY */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
                        <div className="absolute left-0 top-0 bottom-0 w-3/4 max-w-xs bg-slate-900 text-white shadow-2xl p-6 overflow-y-auto">
                            <div className="flex justify-between items-center mb-8">
                                <div className="bg-white p-2 rounded-lg shrink-0">
                                    <img src="/logo.jpg" alt="SEL Logo" className="h-10 w-auto object-contain" />
                                </div>
                                <button onClick={() => setMobileMenuOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
                            </div>
                            <nav className="space-y-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => { onNavigate(item.id); setMobileMenuOpen(false); }}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-medium ${activeSection === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    </div>
                )}

                {/* CONTENT AREA */}
                <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
                    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
