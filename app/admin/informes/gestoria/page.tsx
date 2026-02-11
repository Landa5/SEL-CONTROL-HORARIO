'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function GestoriaPage() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);

    const handleExcelExport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/informes/gestoria?year=${year}&month=${month}`);
            if (res.ok) {
                const data = await res.json();

                // Convert JSON to CSV with BOM for Excel UTF-8 support
                const header = ['Empleado', 'DNI', 'Rol', 'Dias Trabajados', 'KM Totales', 'Horas Extra (Admin Festivo)', 'Días Baja > 3'];
                const rows = data.map((d: any) => [
                    `"${d.nombre} ${d.apellidos}"`,
                    `"${d.dni}"`,
                    d.rol,
                    d.diasTrabajados,
                    d.totalKm,
                    d.horasExtrasFestivos,
                    d.diasBaja
                ].join(','));

                const csvContent = "\uFEFF" + [header.join(','), ...rows].join('\n'); // Add BOM

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
            console.error('CSV Download failed', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePDFExport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/informes/gestoria?year=${year}&month=${month}`);
            if (res.ok) {
                const data = await res.json();
                const doc = new jsPDF();

                // -- HEADER & LOGO --
                // Load Logo
                const logoImg = new Image();
                logoImg.src = '/logo.jpg';
                await new Promise((resolve) => { logoImg.onload = resolve; });

                const pageWidth = doc.internal.pageSize.getWidth();

                // Add Logo (Top Left)
                doc.addImage(logoImg, 'JPEG', 15, 10, 30, 15); // x, y, w, h

                // Add Title (Centered/Right)
                doc.setFontSize(16);
                doc.setFont("helvetica", "bold");
                doc.text("INFORME MENSUAL GESTORÍA", pageWidth / 2, 20, { align: 'center' });

                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                const monthName = format(new Date(year, month - 1), 'MMMM yyyy', { locale: es }).toUpperCase();
                doc.text(`PERIODO: ${monthName}`, pageWidth / 2, 26, { align: 'center' });

                doc.line(15, 30, pageWidth - 15, 30); // Horizontal Line

                // -- DATA TABLE --
                const tableColumn = ["Empleado", "DNI", "Rol", "Días Trab.", "Total KM", "H. Extra (Fest.)", "Baja (>3d)"];
                const tableRows = data.map((d: any) => [
                    `${d.nombre} ${d.apellidos}`,
                    d.dni,
                    d.rol,
                    d.diasTrabajados,
                    d.totalKm,
                    d.horasExtrasFestivos || '-',
                    d.diasBaja || '-'
                ]);

                autoTable(doc, {
                    startY: 35,
                    head: [tableColumn],
                    body: tableRows,
                    theme: 'striped',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 8, cellPadding: 2, halign: 'center' },
                    columnStyles: {
                        0: { halign: 'left', cellWidth: 40 }, // Nombre
                        1: { cellWidth: 25 }, // DNI
                    },
                    alternateRowStyles: { fillColor: [245, 245, 245] }
                });

                // Footer
                const pageCount = doc.internal.pages.length - 1;
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, doc.internal.pageSize.getHeight() - 10);
                doc.text(`Página 1 de ${pageCount}`, pageWidth - 15, doc.internal.pageSize.getHeight() - 10, { align: 'right' });

                doc.save(`Informe_Gestoria_${month}_${year}.pdf`);
            }
        } catch (error) {
            console.error('PDF Download failed', error);
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button onClick={handleExcelExport} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />}
                            DESCARGAR EXCEL (CSV)
                        </Button>
                        <Button onClick={handlePDFExport} disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <FileText className="mr-2" />}
                            DESCARGAR PDF
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
