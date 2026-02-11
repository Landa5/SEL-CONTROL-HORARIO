'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function GestoriaPage() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/informes/gestoria?year=${year}&month=${month}`);
            if (res.ok) {
                const data = await res.json();

                // Convert JSON to CSV
                const header = ['Empleado', 'DNI', 'Rol', 'Dias Trabajados', 'KM Totales', 'Horas Extra (Admin Festivo)', 'Días Baja > 3'];
                const rows = data.map((d: any) => [
                    `${d.nombre} ${d.apellidos}`,
                    d.dni,
                    d.rol,
                    d.diasTrabajados,
                    d.totalKm,
                    d.horasExtrasFestivos, // Assuming this is calculated correctly in API
                    d.diasBaja // Only shows > 3 days
                ].join(','));

                const csvContent = [header.join(','), ...rows].join('\n');

                // Download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `Informe_Gestoria_${month}_${year}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Download failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-black text-gray-900 uppercase">Exportación Gestoría</h1>
            <p className="text-gray-500">Genera el fichero de incidencias mensuales para nóminas.</p>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Configurar Exportación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="p-2 border rounded font-bold w-full"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM', { locale: es }).toUpperCase()}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="p-2 border rounded font-bold"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-blue-50 p-4 rounded text-sm text-blue-800 space-y-2">
                        <p className="font-bold">Reglas Aplicadas:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Se incluyen <strong>Dietas y Kilometraje</strong>.</li>
                            <li><strong>Horas Extra Administración</strong>: Solo se cuentan si se trabaja en Festivo.</li>
                            <li><strong>Bajas Médicas</strong>: Solo se incluyen si la duración es superior a 3 días.</li>
                            <li><strong>Horas Totales</strong>: Excluidas del informe.</li>
                        </ul>
                    </div>

                    <Button onClick={handleExport} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                        DESCARGAR CSV GESTORÍA
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
