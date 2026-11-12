'use client';

import Link from 'next/link';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
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
    Filter,
    ChevronDown,
    ChevronRight,
    Car,
    CheckCircle,
    Package,
    Disc3,
    UserCheck,
    AlertCircle,
    Monitor,
    Search,
    Star,
    History,
    Sparkles,
    User
} from 'lucide-react';
import QuickIncidentReport from '@/components/incidencias/QuickIncidentReport';
import NotificationBell from '@/components/admin/NotificationBell';
import GlobalCommandPalette from '@/components/admin/GlobalCommandPalette';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import { Toaster } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Session {
    id?: number;
    user?: {
        name: string;
        email: string;
    };
    nombre?: string;
    rol: string;
}

interface SidebarCounts {
    hoyTotal: number;
    ausenciasPendientes: number;
    tareasAbiertas: number;
    jornadasAbiertas: number;
    tachoIncidencias: number;
    vencimientosProximos: number;
}

interface NavSubItem {
    href: string;
    label: string;
    icon: any;
    badge?: number;
    badgeColor?: string;
    roles?: string[];
}

interface NavGroup {
    type: 'single' | 'group';
    href?: string;
    label: string;
    icon?: any;
    badge?: number;
    badgeColor?: string;
    roles?: string[];
    items?: NavSubItem[];
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [session, setSession] = useState<Session | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState<string>('');
    const [counts, setCounts] = useState<SidebarCounts>({
        hoyTotal: 0,
        ausenciasPendientes: 0,
        tareasAbiertas: 0,
        jornadasAbiertas: 0,
        tachoIncidencias: 0,
        vencimientosProximos: 0
    });

    // Favorites & Recents persisted in localStorage
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recents, setRecents] = useState<{ href: string; label: string }[]>([]);

    // Collapsible groups
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        'Personas': true,
        'Flota y Taller': true,
        'Tacógrafo': false,
        'Informes': true,
        'Configuración': false
    });

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setCurrentDate(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));

        try {
            const savedFavs = localStorage.getItem('sel_nav_favorites');
            if (savedFavs) setFavorites(JSON.parse(savedFavs));
            const savedRecents = localStorage.getItem('sel_nav_recents');
            if (savedRecents) setRecents(JSON.parse(savedRecents));
        } catch {
            // ignore storage errors
        }

        const fetchSessionAndCounts = async () => {
            try {
                const [sessRes, countsRes] = await Promise.all([
                    fetch('/api/auth/session'),
                    fetch('/api/admin/sidebar-counts')
                ]);
                if (sessRes.ok) setSession(await sessRes.json());
                if (countsRes.ok) setCounts(await countsRes.json());
            } catch (e) {
                console.error('Error fetching layout state', e);
            }
        };
        fetchSessionAndCounts();
    }, []);

    // Global keyboard shortcut Ctrl+K / Cmd+K
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const userRole = (session?.rol || 'ADMIN').toUpperCase();
    const roleLabel =
        userRole === 'OFICINA'
            ? 'Gestión de Oficina'
            : userRole === 'MECANICO'
            ? 'Gestión de Taller y Flota'
            : 'Panel de Administración';
    const shortRole = userRole === 'OFICINA' ? 'Oficina' : userRole === 'MECANICO' ? 'Taller' : 'Admin';

    // Unified 6-Pillar Navigation Structure
    const navStructure: NavGroup[] = useMemo(
        () => [
            {
                type: 'single',
                href: '/admin/dashboard',
                label: 'Hoy (Panel y Alertas)',
                icon: LayoutDashboard,
                badge: counts.hoyTotal,
                badgeColor: counts.hoyTotal > 0 ? 'bg-amber-500 text-slate-950' : undefined,
                roles: ['ADMIN', 'OFICINA', 'MECANICO']
            },
            {
                type: 'group',
                label: 'Personas',
                roles: ['ADMIN', 'OFICINA'],
                items: [
                    { href: '/admin/empleados', label: 'Empleados (360°)', icon: Users, roles: ['ADMIN', 'OFICINA'] },
                    {
                        href: '/admin/jornadas',
                        label: 'Jornadas y Rutas',
                        icon: Clock,
                        badge: counts.jornadasAbiertas,
                        badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/ausencias',
                        label: 'Ausencias y Vacaciones',
                        icon: Calendar,
                        badge: counts.ausenciasPendientes,
                        badgeColor: 'bg-amber-500 text-slate-950',
                        roles: ['ADMIN', 'OFICINA']
                    },
                    { href: '/admin/nominas', label: 'Nóminas', icon: Euro, roles: ['ADMIN'] },
                    { href: '/admin/formacion', label: 'Formación', icon: BookOpen, roles: ['ADMIN', 'OFICINA'] },
                    { href: '/admin/evaluaciones', label: 'Evaluaciones', icon: CheckCircle, roles: ['ADMIN', 'OFICINA'] }
                ]
            },
            {
                type: 'group',
                label: 'Flota y Taller',
                roles: ['ADMIN', 'OFICINA', 'MECANICO'],
                items: [
                    {
                        href: '/admin/camiones',
                        label: 'Camiones (360°)',
                        icon: Truck,
                        badge: counts.vencimientosProximos,
                        badgeColor: 'bg-red-500 text-white',
                        roles: ['ADMIN', 'OFICINA', 'MECANICO']
                    },
                    {
                        href: '/admin/tareas',
                        label: 'Taller, Mant. e Incidencias',
                        icon: Wrench,
                        badge: counts.tareasAbiertas,
                        badgeColor: 'bg-orange-500 text-white',
                        roles: ['ADMIN', 'OFICINA', 'MECANICO']
                    },
                    {
                        href: '/admin/inventario',
                        label: 'Inventario de Taller',
                        icon: Package,
                        roles: ['ADMIN', 'MECANICO']
                    },
                    {
                        href: '/admin/flota/inteligencia',
                        label: 'Inteligencia de Flota',
                        icon: BarChart2,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/alquiler',
                        label: 'Alquiler Garaje',
                        icon: Car,
                        roles: ['ADMIN', 'OFICINA']
                    }
                ]
            },
            {
                type: 'group',
                label: 'Tacógrafo',
                roles: ['ADMIN', 'OFICINA'],
                items: [
                    {
                        href: '/admin/tacografo',
                        label: 'Dashboard e Importación',
                        icon: Disc3,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/tacografo/conductores',
                        label: 'Conductores y Vehículos',
                        icon: UserCheck,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/tacografo/incidencias',
                        label: 'Incidencias y Actividad',
                        icon: AlertCircle,
                        badge: counts.tachoIncidencias,
                        badgeColor: 'bg-rose-500 text-white',
                        roles: ['ADMIN', 'OFICINA']
                    }
                ]
            },
            {
                type: 'group',
                label: 'Informes',
                roles: ['ADMIN', 'OFICINA'],
                items: [
                    {
                        href: '/admin/informes/centro',
                        label: 'Centro de Informes (9 KPIs)',
                        icon: Sparkles,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/informes/mensuales',
                        label: 'Informes Mensuales',
                        icon: BarChart2,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/informes/operativos',
                        label: 'Informe Operativo',
                        icon: FileText,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/informes/personalizados',
                        label: 'Informes Personalizados',
                        icon: Filter,
                        roles: ['ADMIN']
                    },
                    {
                        href: '/admin/informes/gestoria',
                        label: 'Exportaciones Gestoría',
                        icon: Download,
                        roles: ['ADMIN']
                    },
                    {
                        href: '/admin/informes/legal',
                        label: 'Registro Jornada Legal',
                        icon: FileCheck,
                        roles: ['ADMIN', 'OFICINA']
                    },
                    {
                        href: '/admin/auditoria',
                        label: 'Auditoría Interna',
                        icon: ShieldCheck,
                        roles: ['ADMIN']
                    }
                ]
            },
            {
                type: 'group',
                label: 'Configuración',
                roles: ['ADMIN'],
                items: [
                    { href: '/admin/incentivos', label: 'Tarifas e Incentivos', icon: Coins, roles: ['ADMIN'] },
                    {
                        href: '/admin/configuracion/parametros',
                        label: 'Parámetros Productividad',
                        icon: Settings,
                        roles: ['ADMIN']
                    },
                    { href: '/admin/fiestas', label: 'Fiestas Locales', icon: PartyPopper, roles: ['ADMIN'] },
                    { href: '/admin/roles', label: 'Roles y Permisos', icon: UserCog, roles: ['ADMIN'] },
                    {
                        href: '/admin/tacografo/regulacion',
                        label: 'Regulación y Config. Tacógrafo',
                        icon: ShieldCheck,
                        roles: ['ADMIN']
                    },
                    { href: '/admin/pantallas', label: 'Pantallas / VNNOX', icon: Monitor, roles: ['ADMIN'] }
                ]
            }
        ],
        [counts]
    );

    // Filter structure by role
    const filteredNav = useMemo(() => {
        return navStructure
            .filter(group => !group.roles || group.roles.includes(userRole))
            .map(group => {
                if (group.type === 'single') return group;
                return {
                    ...group,
                    items: (group.items || []).filter(item => !item.roles || item.roles.includes(userRole))
                };
            })
            .filter(group => group.type === 'single' || (group.items && group.items.length > 0));
    }, [navStructure, userRole]);

    // Flatten all items for lookup (Favorites / Recents)
    const allNavLinks = useMemo(() => {
        const map = new Map<string, { href: string; label: string; icon: any }>();
        filteredNav.forEach(g => {
            if (g.type === 'single' && g.href) {
                map.set(g.href, { href: g.href, label: g.label, icon: g.icon });
            } else if (g.items) {
                g.items.forEach(sub => {
                    map.set(sub.href, { href: sub.href, label: sub.label, icon: sub.icon });
                });
            }
        });
        return map;
    }, [filteredNav]);

    // Track recently visited links (up to 5)
    useEffect(() => {
        if (!pathname) return;
        const matched = allNavLinks.get(pathname);
        if (!matched) return;
        setRecents(prev => {
            const next = [
                { href: matched.href, label: matched.label },
                ...prev.filter(r => r.href !== matched.href)
            ].slice(0, 5);
            try {
                localStorage.setItem('sel_nav_recents', JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, [pathname, allNavLinks]);

    const toggleFavorite = (e: React.MouseEvent, href: string) => {
        e.preventDefault();
        e.stopPropagation();
        setFavorites(prev => {
            const exists = prev.includes(href);
            const next = exists ? prev.filter(f => f !== href) : [href, ...prev].slice(0, 5);
            try {
                localStorage.setItem('sel_nav_favorites', JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    };

    const toggleGroup = (group: string) => {
        setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // Accurate link active detection supporting both query strings and detail subroutes
    const isLinkActive = (href: string) => {
        const [basePath, queryStr] = href.split('?');
        if (queryStr) {
            if (pathname !== basePath) return false;
            const targetParams = new URLSearchParams(queryStr);
            for (const [k, v] of targetParams.entries()) {
                if (searchParams?.get(k) !== v) return false;
            }
            return true;
        }
        if (pathname === basePath) return true;
        if (basePath !== '/admin/dashboard' && basePath !== '/admin/tacografo' && pathname?.startsWith(basePath + '/')) {
            return true;
        }
        return false;
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    if (!mounted) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-100" suppressHydrationWarning={true}>
            <Toaster richColors position="top-right" />
            <GlobalCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Sidebar Desktop */}
            <aside className="w-68 bg-slate-900 text-white flex flex-col hidden md:flex h-screen sticky top-0 shrink-0">
                <div className="p-4 border-b border-slate-800 bg-white text-center shrink-0">
                    <img src="/logo.jpg" alt="SEL Logo" className="h-12 w-auto mx-auto object-contain" />
                    <p className="text-[10px] text-slate-900 font-bold uppercase tracking-widest mt-1.5">{roleLabel}</p>
                </div>

                <nav className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Quick Portal Switch for Oficina / Mecanico / Admin */}
                    <Link href="/empleado">
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold mb-2 border border-slate-700/80 transition-colors">
                            <span className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-blue-400" />
                                Mi Portal / Fichar Jornada
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                    </Link>

                    {/* Favorites Section (Up to 5) */}
                    {favorites.length > 0 && (
                        <div className="mb-3 bg-slate-800/40 rounded-lg p-2 border border-slate-800">
                            <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-400" /> Favoritos
                            </p>
                            <div className="space-y-0.5">
                                {favorites.map(favHref => {
                                    const item = allNavLinks.get(favHref);
                                    if (!item) return null;
                                    const FavIcon = item.icon;
                                    const active = isLinkActive(item.href);
                                    return (
                                        <Link key={item.href} href={item.href}>
                                            <div
                                                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                                                    active
                                                        ? 'bg-blue-600/30 text-blue-200 font-semibold'
                                                        : 'text-slate-300 hover:bg-slate-800'
                                                }`}
                                            >
                                                <span className="flex items-center gap-2 truncate">
                                                    <FavIcon className="w-3.5 h-3.5 opacity-80 shrink-0" />
                                                    <span className="truncate">{item.label}</span>
                                                </span>
                                                <button
                                                    onClick={e => toggleFavorite(e, item.href)}
                                                    title="Quitar de favoritos"
                                                    className="text-amber-400 hover:text-amber-300 p-0.5"
                                                >
                                                    <Star className="w-3 h-3 fill-amber-400" />
                                                </button>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Main 6-Group Navigation */}
                    {filteredNav.map((item, idx) => {
                        if (item.type === 'single' && item.href) {
                            const isActive = isLinkActive(item.href);
                            const Icon = item.icon;
                            return (
                                <Link key={idx} href={item.href}>
                                    <div
                                        className={`flex items-center justify-between p-2.5 rounded-lg transition-all mb-2 ${
                                            isActive
                                                ? 'bg-blue-600 text-white font-bold shadow-lg'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Icon className="w-4 h-4 shrink-0" />
                                            <span className="text-xs font-semibold">{item.label}</span>
                                        </div>
                                        {typeof item.badge === 'number' && item.badge > 0 && (
                                            <span
                                                className={`px-1.5 py-0.5 text-[10px] font-black rounded-full ${
                                                    item.badgeColor || 'bg-amber-500 text-slate-950'
                                                }`}
                                            >
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        } else {
                            const isOpen = openGroups[item.label] ?? true;
                            const containsActive = (item.items || []).some(sub => isLinkActive(sub.href));
                            const groupBadgeTotal = (item.items || []).reduce((acc, s) => acc + (s.badge || 0), 0);

                            return (
                                <div key={idx} className="mb-1.5">
                                    <button
                                        onClick={() => toggleGroup(item.label)}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
                                            containsActive
                                                ? 'text-blue-400'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                                        <div className="flex items-center gap-1.5">
                                            {!isOpen && groupBadgeTotal > 0 && (
                                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold">
                                                    {groupBadgeTotal}
                                                </span>
                                            )}
                                            {isOpen ? (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            )}
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="mt-1 space-y-0.5 ml-2 border-l border-slate-700/80 pl-2">
                                            {(item.items || []).map((sub, sIdx) => {
                                                const SubIcon = sub.icon;
                                                const isSubActive = isLinkActive(sub.href);
                                                const isFav = favorites.includes(sub.href);
                                                return (
                                                    <Link key={sIdx} href={sub.href}>
                                                        <div
                                                            className={`group/nav flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                                                                isSubActive
                                                                    ? 'bg-blue-900/60 text-blue-200 font-semibold'
                                                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 truncate pr-1">
                                                                <SubIcon className="w-3.5 h-3.5 opacity-75 shrink-0" />
                                                                <span className="truncate">{sub.label}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {typeof sub.badge === 'number' && sub.badge > 0 && (
                                                                    <span
                                                                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                                            sub.badgeColor || 'bg-slate-700 text-white'
                                                                        }`}
                                                                    >
                                                                        {sub.badge}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={e => toggleFavorite(e, sub.href)}
                                                                    title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                                                    className={`p-0.5 transition-opacity ${
                                                                        isFav
                                                                            ? 'opacity-100 text-amber-400'
                                                                            : 'opacity-0 group-hover/nav:opacity-100 text-slate-500 hover:text-amber-300'
                                                                    }`}
                                                                >
                                                                    <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400' : ''}`} />
                                                                </button>
                                                            </div>
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

                    {/* Recents Section (Up to 5) */}
                    {recents.length > 1 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80">
                            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <History className="w-3 h-3" /> Visitados Recientemente
                            </p>
                            <div className="space-y-0.5">
                                {recents.slice(0, 5).map(r => (
                                    <Link key={r.href} href={r.href}>
                                        <div className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 truncate">
                                            {r.label}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                <div className="p-3 border-t border-slate-800 shrink-0">
                    <QuickIncidentReport />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0 shadow-xs z-20 relative gap-3">
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

                        {/* Global Search Trigger Bar (Ctrl+K) */}
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-500 text-xs font-medium transition-all w-48 sm:w-72 md:w-96 border border-slate-200/80"
                        >
                            <span className="flex items-center gap-2 truncate">
                                <Search className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="truncate">Buscar camión, empleado, avería...</span>
                            </span>
                            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white text-slate-600 rounded border border-slate-300 shrink-0">
                                Ctrl+K
                            </kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden lg:block mr-2 pr-4 border-r">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Hoy</p>
                            <p className="text-xs font-bold text-gray-700 capitalize">{currentDate}</p>
                        </div>
                        <NotificationBell />
                        <Button
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 gap-2 font-bold transition-all text-xs"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Salir</span>
                        </Button>
                    </div>
                </header>

                {/* Mobile Menu Overlay */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900 text-white pt-16 md:hidden overflow-y-auto animate-in fade-in slide-in-from-left-10 duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">ESTÁS EN</p>
                                    <h2 className="text-lg font-bold uppercase tracking-widest text-white">{roleLabel}</h2>
                                </div>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-2 rounded-lg bg-slate-800 text-slate-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <nav className="space-y-5">
                                {filteredNav.map((item, idx) => (
                                    <div key={idx}>
                                        {item.type === 'single' && item.href ? (
                                            <Link href={item.href} onClick={() => setMobileMenuOpen(false)}>
                                                <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg">
                                                    <span className="flex items-center gap-3">
                                                        {item.icon && <item.icon className="w-5 h-5" />}
                                                        <span>{item.label}</span>
                                                    </span>
                                                    {item.badge ? (
                                                        <span className="px-2 py-0.5 text-xs bg-amber-400 text-slate-950 rounded-full font-black">
                                                            {item.badge}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="space-y-2">
                                                <h3 className="px-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                                                    {item.label}
                                                </h3>
                                                <div className="space-y-1 pl-2">
                                                    {(item.items || []).map((sub, sIdx) => (
                                                        <Link
                                                            key={sIdx}
                                                            href={sub.href}
                                                            onClick={() => setMobileMenuOpen(false)}
                                                        >
                                                            <div className="flex items-center justify-between p-2.5 rounded-lg text-slate-300 hover:bg-slate-800">
                                                                <span className="flex items-center gap-3">
                                                                    <sub.icon className="w-4 h-4 opacity-70" />
                                                                    <span className="text-sm">{sub.label}</span>
                                                                </span>
                                                                {sub.badge ? (
                                                                    <span className="px-2 py-0.5 text-xs bg-slate-700 text-white rounded-full font-bold">
                                                                        {sub.badge}
                                                                    </span>
                                                                ) : null}
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
                        <Breadcrumbs />
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">{children}</div>}>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </Suspense>
    );
}
