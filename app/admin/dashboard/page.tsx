'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    AlertTriangle,
    CheckCircle,
    Truck,
    Users,
    Clock,
    TrendingUp,
    Euro,
    Activity,
    Calendar,
    FileText,
    Wrench,
    ShieldAlert,
    ChevronRight,
    PlayCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminDashboard() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/dashboard');
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

                            ].map((link, idx) => (
        <Link key={idx} href={link.href}>
            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                <div className={`p-3 rounded-xl bg-${link.color}-50 text-${link.color}-600 group-hover:bg-${link.color}-600 group-hover:text-white transition-colors`}>
                    <link.icon className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-sm font-black text-gray-900">{link.label}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{link.sub}</p>
                </div>
            </div>
        </Link>
    ))
}
                        </div >
                    </section >
                </div >

    {/* SIDEBAR WIDGETS */ }
    < aside className = "space-y-8 h-full" >
        {/* IA WIDGET AREA */ }
        < div className = "space-y-4" >
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest italic">Inteligencia Fleet</h2>
                        </div>
                        <PredictiveMaintenanceWidget />
                    </div >

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <h2 className="text-sm font-black uppercase tracking-widest">Alertas Técnicas</h2>
                        </div>
                        <FleetAlertsWidget alerts={stats.upcomingExpirations} />
                    </div>

                    <div className="space-y-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h2 className="text-sm font-black text-blue-900 uppercase tracking-widest">Control Ausencias</h2>
                        </div>
                        <AdminAbsenceWidget />
                    </div>
                </aside >
            </div >

    <footer className="pt-10 border-t border-gray-100 flex flex-col items-center gap-4">
        <Link href="/admin/dashboard" className="text-xs font-black text-blue-600/50 hover:text-blue-600 flex items-center gap-2 transition-colors uppercase tracking-[0.3em]">
            <LayoutDashboard className="w-4 h-4" /> REFRESCAR SISTEMA
        </Link>
        <div className="text-center text-[10px] text-gray-300 font-black uppercase tracking-[0.5em]">
            SISTEMA DE GESTIÓN SEL • 2026
        </div>
    </footer>
        </div >
    );
}
