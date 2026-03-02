'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertCircle, Calendar, Truck, ShieldAlert, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface FleetAlert {
    id: number;
    entityName: string; // Matricula or Employee Name
    entityType: 'TRUCK' | 'EMPLOYEE';
    alertType: string; // ITV, ADR, DNI, etc.
    date: string | Date;
    isExpired: boolean;
}

interface FleetAlertsWidgetProps {
    alerts: FleetAlert[];
    hrefPrefix?: string;
}

export default function FleetAlertsWidget({ alerts, hrefPrefix = '/admin' }: FleetAlertsWidgetProps) {
    const [hiddenAlerts, setHiddenAlerts] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('sel_hidden_alerts');
        if (stored) {
            try { setHiddenAlerts(JSON.parse(stored)); } catch (e) { }
        }
    }, []);

    const hideAlert = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        e.stopPropagation();
        const newHidden = [...hiddenAlerts, key];
        setHiddenAlerts(newHidden);
        localStorage.setItem('sel_hidden_alerts', JSON.stringify(newHidden));
    };

    if (!alerts || alerts.length === 0) return null;

    const visibleAlerts = alerts.filter((alert: any) => {
        const key = `ALERT_${alert.entityType}_${alert.id}_${alert.type}_${alert.date}`;
        return !hiddenAlerts.includes(key);
    });

    if (visibleAlerts.length === 0) return null;

    // Sort by date (expired first)
    const sortedAlerts = [...visibleAlerts].sort((a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
        <Card className="border-red-100 shadow-md overflow-hidden">
            <CardHeader className="bg-red-50 py-3 border-b border-red-100">
                <CardTitle className="text-sm font-black text-red-700 flex items-center gap-2 uppercase tracking-tight">
                    <ShieldAlert className="w-4 h-4" /> Alertas de Vencimientos
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    {sortedAlerts.map((alert: any, i) => {
                        const key = `ALERT_${alert.entityType}_${alert.id}_${alert.type}_${alert.date}`;
                        return (
                            <Link
                                key={i}
                                href={alert.entityType === 'TRUCK' ? `${hrefPrefix}/camiones` : `${hrefPrefix}/empleados`}
                                className="block p-4 hover:bg-gray-50 transition-colors group relative"
                            >
                                <button onClick={(e) => hideAlert(e, key)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${alert.isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {alert.entityType === 'TRUCK' ? <Truck className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900 leading-none group-hover:text-blue-600 transition-colors">{alert.entityName}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                {alert.alertType} • {alert.isExpired ? 'CADUCADO' : 'Próximo vencimiento'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right pl-11 sm:pl-0">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${alert.isExpired ? 'bg-red-600 text-white' : 'bg-orange-50 text-orange-700'}`}>
                                            <Calendar className="w-4 h-4" />
                                            {(() => {
                                                const d = new Date(alert.date);
                                                return !isNaN(d.getTime()) ? format(d, 'dd/MM/yy', { locale: es }) : 'N/A';
                                            })()}
                                        </div>
                                        <p className="text-[10px] font-medium text-gray-400 mt-1 flex items-center sm:justify-end gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {alert.isExpired ? 'Acción urgente' : 'Revisar pronto'}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
                <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                    <Link href={`${hrefPrefix}/camiones`} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                        Ir a Gestión de Flota →
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
