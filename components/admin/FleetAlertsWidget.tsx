'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertCircle, Calendar, Truck, ShieldAlert, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface FleetAlert {
    truckId: number;
    matricula: string;
    type: string;
    date: string | Date;
    isExpired: boolean;
}

interface FleetAlertsWidgetProps {
    alerts: FleetAlert[];
    hrefPrefix?: string;
}

export default function FleetAlertsWidget({ alerts, hrefPrefix = '/admin' }: FleetAlertsWidgetProps) {
    if (!alerts || alerts.length === 0) return null;

    // Sort by date (expired first)
    const sortedAlerts = [...alerts].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
        <Card className="border-red-100 shadow-md overflow-hidden">
            <CardHeader className="bg-red-50 py-3 border-b border-red-100">
                <CardTitle className="text-sm font-black text-red-700 flex items-center gap-2 uppercase tracking-tight">
                    <ShieldAlert className="w-4 h-4" /> Alertas de Flota (Vencimientos)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    {sortedAlerts.map((alert, i) => (
                        <Link
                            key={i}
                            href={`${hrefPrefix}/camiones`}
                            className="block p-4 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${alert.isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                        <Truck className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900 leading-none group-hover:text-blue-600 transition-colors">{alert.matricula}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            {alert.type} • {alert.isExpired ? 'CADUCADO' : 'Próximo vencimiento'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${alert.isExpired ? 'bg-red-600 text-white' : 'bg-orange-50 text-orange-700'}`}>
                                        <Calendar className="w-4 h-4" />
                                        {format(new Date(alert.date), 'dd/MM/yy', { locale: es })}
                                    </div>
                                    <p className="text-[10px] font-medium text-gray-400 mt-1 flex items-center justify-end gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {alert.isExpired ? 'Acción urgente' : 'Revisar pronto'}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
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
