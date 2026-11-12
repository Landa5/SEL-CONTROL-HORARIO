'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Disc3, Upload, UserCheck, Truck, Activity, AlertCircle, ShieldCheck, Settings } from 'lucide-react';

const TACHO_TABS = [
    { href: '/admin/tacografo', label: 'Dashboard', icon: Disc3, exact: true },
    { href: '/admin/tacografo/importaciones', label: 'Importaciones', icon: Upload },
    { href: '/admin/tacografo/conductores', label: 'Conductores', icon: UserCheck },
    { href: '/admin/tacografo/vehiculos', label: 'Vehículos', icon: Truck },
    { href: '/admin/tacografo/actividad', label: 'Actividad Diaria', icon: Activity },
    { href: '/admin/tacografo/incidencias', label: 'Incidencias', icon: AlertCircle },
    { href: '/admin/tacografo/regulacion', label: 'Regulación UE', icon: ShieldCheck },
    { href: '/admin/tacografo/configuracion', label: 'Configuración', icon: Settings }
];

export default function TacografoLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="space-y-6">
            <div className="bg-white border rounded-xl p-2 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
                {TACHO_TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                active
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{tab.label}</span>
                        </Link>
                    );
                })}
            </div>
            {children}
        </div>
    );
}
