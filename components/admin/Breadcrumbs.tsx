'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
    admin: 'Panel',
    dashboard: 'Hoy',
    empleados: 'Empleados',
    ausencias: 'Ausencias y Vacaciones',
    jornadas: 'Jornadas y Rutas',
    formacion: 'Formación',
    nominas: 'Nóminas',
    evaluaciones: 'Evaluaciones',
    camiones: 'Flota de Camiones',
    'mantenimientos-conductor': 'Mantenimientos Conductor',
    'revisiones-accesorios': 'Revisión Accesorios',
    tareas: 'Taller e Incidencias',
    inventario: 'Inventario de Taller',
    flota: 'Flota',
    inteligencia: 'Inteligencia de Flota',
    tacografo: 'Tacógrafo Digital',
    importaciones: 'Importaciones',
    conductores: 'Conductores',
    vehiculos: 'Vehículos',
    actividad: 'Actividad',
    incidencias: 'Incidencias',
    regulacion: 'Regulación',
    configuracion: 'Configuración',
    informes: 'Informes',
    centro: 'Centro de Informes (9 KPIs)',
    mensuales: 'Informes Mensuales',
    operativos: 'Informe Operativo',
    personalizados: 'Informes Personalizados',
    gestoria: 'Exportaciones Gestoría',
    legal: 'Registro Jornada Legal',
    auditoria: 'Auditoría Interna',
    fiestas: 'Fiestas Locales',
    parametros: 'Parámetros Productividad',
    incentivos: 'Tarifas e Incentivos',
    roles: 'Roles y Permisos',
    alquiler: 'Alquiler Garaje',
    pantallas: 'Pantallas VNNOX'
};

export default function Breadcrumbs() {
    const pathname = usePathname();
    if (!pathname || pathname === '/admin/dashboard') return null;

    const rawSegments = pathname.split('/').filter(Boolean);
    if (rawSegments.length <= 1) return null;

    const crumbs = rawSegments.map((segment, index) => {
        const href = '/' + rawSegments.slice(0, index + 1).join('/');
        const isNumeric = /^\d+$/.test(segment);
        const label = isNumeric
            ? `Ficha #${segment}`
            : SEGMENT_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

        return {
            href: href === '/admin' ? '/admin/dashboard' : href,
            label,
            isLast: index === rawSegments.length - 1
        };
    });

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 flex-wrap">
            <Link
                href="/admin/dashboard"
                className="flex items-center gap-1 hover:text-blue-600 transition-colors font-medium"
            >
                <Home className="w-3.5 h-3.5" />
                <span>Hoy</span>
            </Link>
            {crumbs.slice(1).map((crumb, idx) => (
                <React.Fragment key={idx}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    {crumb.isLast ? (
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                            {crumb.label}
                        </span>
                    ) : (
                        <Link href={crumb.href} className="hover:text-blue-600 transition-colors font-medium">
                            {crumb.label}
                        </Link>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}
