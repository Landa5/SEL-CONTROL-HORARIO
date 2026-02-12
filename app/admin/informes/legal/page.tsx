'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function LegalReportPage() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);

    const handlePDFExport = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/informes/legal?year=${year}&month=${month}`);
            if (res.ok) {
                const responseData = await res.json();
                const { data, periodo } = responseData;

                const doc = new jsPDF();

                // Generate one page (or more) per employee
                data.forEach((empData: any, index: number) => {
                    if (index > 0) doc.addPage();

                    const emp = empData.empleado;

                    // HEADER
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text("REGISTRO DE JORNADA LABORAL", 105, 15, { align: 'center' });

                    doc.setFontSize(10);
                    doc.setFont("helvetica", "normal");
                    doc.text("Cumplimiento del RD-ley 8/2019", 105, 20, { align: 'center' });

                    // COMPANY & EMPLOYEE INFO BOX
                    doc.setDrawColor(0);
                    doc.setFillColor(245, 245, 245);
                    doc.rect(14, 25, 182, 25, 'F');

                    doc.setFontSize(9);
                    doc.text(`EMPRESA: S.E.L. (Suministros Especiales)`, 16, 30); // Placeholder Name
                    doc.text(`PERIODO: ${periodo.toUpperCase()}`, 16, 35);
                    doc.text(`TRABAJADOR: ${emp.nombre} ${emp.apellidos || ''}`, 100, 30);
                    doc.text(`DNI: ${emp.dni || 'N/D'}`, 100, 35);
                    doc.text(`TOTAL HORAS: ${empData.totalHoras} h`, 100, 40);

                    // TABLE
                    const tableColumn = ["Día", "Entrada", "Salida", "Horas", "Tipo / Incidencia", "Firma Trabajador"];
                    const tableRows = empData.registros.map((r: any) => {
                        let tipoDetalle = r.tipo;
                        if (r.detalle) tipoDetalle += ` (${r.detalle})`;

                        // Capitalize day
                        const diaStr = r.diaSemana.charAt(0).toUpperCase() + r.diaSemana.slice(1);

                        return [
                            `${r.fecha}\n${diaStr}`,
                            r.entrada || '-',
                            r.salida || '-',
                            r.horas || '-',
                            tipoDetalle === 'TRABAJO' ? '' : tipoDetalle, // Empty if just normal work to save clutter
                            '' // Empty space for signature
                        ];
                    });

                    autoTable(doc, {
                        startY: 55,
                        head: [tableColumn],
                        body: tableRows,
                        theme: 'grid', // 'grid' shows borders for signature cells
                        headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8, halign: 'center' },
                        bodyStyles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                        columnStyles: {
                            0: { cellWidth: 25, halign: 'center' }, // Fecha
                            1: { cellWidth: 20, halign: 'center' }, // Entrada
                            2: { cellWidth: 20, halign: 'center' }, // Salida
                            3: { cellWidth: 15, halign: 'center' }, // Horas
                            4: { cellWidth: 50 }, // Tipo
                            5: { cellWidth: 50 }  // Firma
                        },
                        didParseCell: function (data) {
                            // Highlight Weekends
                            if ((data.row.raw as any)[4] && ((data.row.raw as any)[4] as string).includes('DESCANSO')) {
                                data.cell.styles.fillColor = [240, 240, 240];
                                data.cell.styles.textColor = [150, 150, 150];
                            }
                            // Highlight Holidays
                            if ((data.row.raw as any)[4] && ((data.row.raw as any)[4] as string).includes('FESTIVO')) {
                                data.cell.styles.fillColor = [255, 240, 240];
                            }
                        }
                    });

                    // FOOTER SIGNATURES
                    const finalY = (doc as any).lastAutoTable.finalY + 10;

                    doc.setFontSize(8);
                    doc.text("Firma de la Empresa:", 20, finalY);
                    doc.text("Firma del Trabajador:", 120, finalY);

                    doc.line(20, finalY + 15, 80, finalY + 15);
                    doc.line(120, finalY + 15, 180, finalY + 15);

                    doc.text("Sello", 45, finalY + 20, { align: 'center' });
                });

                doc.save(`Registro_Jornada_${periodo.replace(' ', '_')}.pdf`);
            }
        } catch (error) {
            console.error('PDF Generation failed', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-black text-gray-900 uppercase">Registro de Jornada Legal</h1>
            <p className="text-gray-500">Genera las hojas de firma mensual para el cumplimiento del RD-ley 8/2019.</p>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Configuración del Informe</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800 border border-yellow-200">
                        <h4 className="font-bold mb-2">Importante:</h4>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Este documento debe ser <strong>firmado mensualmente</strong> por cada trabajador.</li>
                            <li>La empresa debe custodiar estos registros durante <strong>4 años</strong>.</li>
                            <li>El sistema rellena automáticamente los días festivos, vacaciones y bajas si están registrados.</li>
                        </ul>
                    </div>

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

                    <Button onClick={handlePDFExport} disabled={loading} className="w-full h-12 text-lg bg-slate-900 hover:bg-slate-800">
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <FileText className="mr-2" />}
                        GENERAR HOJAS DE FIRMA (PDF)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
