'use client';

import { useEffect, useState, use } from 'react';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, FileText } from 'lucide-react';

type Props = {
    params: Promise<{
        year: string;
        month: string;
    }>
}

export default function EmployeePayrollDetail(props: Props) {
    const params = use(props.params);
    const { year, month } = params;
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchIt = async () => {
            // Fetch list for this month (filtered by self in API)
            const res = await fetch(`/api/nominas?year=${year}&month=${month}`);
            if (res.ok) {
                const list = await res.json();
                if (list.length > 0 && list[0].nomina) {
                    // Fetch full details of that nomina
                    const nomRes = await fetch(`/api/nominas/${list[0].nomina.id}`);
                    if (nomRes.ok) {
                        setDetails(await nomRes.json());
                    }
                }
            }
            setLoading(false);
        };
        fetchIt();
    }, [year, month]);

    return (
        <MainDashboardLayout
            title="Detalle de Nómina"
            userName="Empleado"
            roleLabel="Mi Espacio"
            navItems={[{ id: 'back', label: 'Volver', icon: ArrowLeft }]}
            activeSection="detail"
            onNavigate={(id) => {
                if (id === 'back') window.location.href = '/empleado';
            }}
            onLogout={() => { window.location.href = '/login'; }}
        >
            <div className="max-w-3xl mx-auto py-6">
                {loading ? <p>Cargando...</p> : details ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Nómina {month}/{year}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded">
                                <div>
                                    <p className="text-sm text-gray-500">Estado</p>
                                    <p className="font-bold">{details.estado}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Total Variables</p>
                                    <p className="text-2xl font-bold text-green-700">{details.totalVariables.toFixed(2)} €</p>
                                </div>
                            </div>

                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2 text-left">Concepto</th>
                                        <th className="p-2 text-right">Cantidad</th>
                                        <th className="p-2 text-right">Importe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {details.lineas.map((l: any) => (
                                        <tr key={l.id} className="border-b last:border-0">
                                            <td className="p-2">{l.conceptoNombre}</td>
                                            <td className="p-2 text-right">{l.cantidad}</td>
                                            <td className="p-2 text-right font-medium">{l.importe.toFixed(2)} €</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* PDF Button logic could be reused here if desired */}
                        </CardContent>
                    </Card>
                ) : (
                    <p className="text-center text-gray-500">No hay nómina generada para este mes.</p>
                )}
            </div>
        </MainDashboardLayout>
    );
}
