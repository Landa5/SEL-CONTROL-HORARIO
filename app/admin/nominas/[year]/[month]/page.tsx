'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calculator, CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, Edit2, Save, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // Ensure this is installed or handle absence

type Props = {
    params: Promise<{
        year: string;
        month: string;
    }>
}

export default function PayrollMonthDetail(props: Props) {
    const params = use(props.params);
    const { year, month } = params;

    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Expanded row for details
    const [expandedNominaId, setExpandedNominaId] = useState<number | null>(null);
    const [details, setDetails] = useState<any>(null); // Details of expanded payroll
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Edit Line State
    const [editingLineId, setEditingLineId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<any>({}); // { importe: val, notas: val }

    useEffect(() => {
        fetchData();
    }, [year, month]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/nominas?year=${year}&month=${month}`);
            if (res.ok) {
                setRows(await res.json());
            }
        } finally {
            setLoading(false);
        }
    };


    const handleGenerate = async () => {
        if (!confirm('Esto recalculará las nóminas de todos los empleados activos para este mes. Las líneas manuales se mantendrán, pero los cálculos automáticos se sobrescribirán. ¿Continuar?')) return;
        setGenerating(true);
        try {
            const res = await fetch('/api/nominas/generar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month })
            });
            if (res.ok) {
                const data = await res.json();
                await fetchData();
                // If expanded, refresh details
                if (expandedNominaId) fetchDetails(expandedNominaId);
                alert(`Generación completada.\nCreadas: ${data.results.filter((r: any) => r.status === 'CREATED').length}\nActualizadas: ${data.results.filter((r: any) => r.status === 'UPDATED').length}`);
            } else {
                const err = await res.json();
                alert('Error al generar nóminas: ' + (err.error || 'Error desconocido'));
            }
        } catch (e: any) {
            alert('Error de red: ' + e.message);
        } finally {
            setGenerating(false);
        }
    };

    const fetchDetails = async (nominaId: number) => {
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/nominas/${nominaId}`);
            if (res.ok) {
                setDetails(await res.json());
            }
        } finally {
            setDetailsLoading(false);
        }
    };

    const toggleExpand = (nominaId: number) => {
        if (expandedNominaId === nominaId) {
            setExpandedNominaId(null);
            setDetails(null);
        } else {
            setExpandedNominaId(nominaId);
            fetchDetails(nominaId);
        }
    };

    const handleEditLine = (line: any) => {
        setEditingLineId(line.id);
        setEditValues({ importe: line.importe, notas: line.notas || '' });
    };

    const handleSaveLine = async (lineId: number) => {
        try {
            const res = await fetch(`/api/nominas/lineas/${lineId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    importe: parseFloat(editValues.importe),
                    notas: editValues.notas
                })
            });
            if (res.ok) {
                setEditingLineId(null);
                fetchDetails(expandedNominaId!); // Refresh
            } else {
                alert('Error guardando línea');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleClosePayroll = async (nominaId: number) => {
        if (!confirm('¿Estás seguro de CERRAR esta nómina? No se podrá editar más.')) return;

        const res = await fetch(`/api/nominas/${nominaId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'CERRADA' })
        });

        if (res.ok) {
            fetchData();
            if (expandedNominaId === nominaId) fetchDetails(nominaId);
        }
    };

    const handleExportPDF = () => {
        if (!details) return alert('Despliega una nómina para exportar');

        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text('HOJA DE SALARIO', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Empresa: SEL Suministros Energéticos`, 14, 28);

        // Employee Info Box
        doc.setDrawColor(200);
        doc.rect(14, 35, 180, 25);

        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Empleado: ${details.empleado.nombre} ${details.empleado.apellidos}`, 18, 42);
        doc.text(`NIF/DNI: -`, 18, 48); // Todo: Add DNI to model
        doc.text(`Categoría: ${details.empleado.rol}`, 18, 54);

        doc.text(`H. Extra: ${details.empleado.horasExtra || 0}`, 120, 42);
        doc.text(`Periodo: ${month}/${year}`, 120, 48);

        // Lines table
        const tableData = details.lineas.map((l: any) => [
            l.conceptoNombre,
            l.cantidad > 1 ? l.cantidad : '',
            l.cantidad > 1 || l.rate > 0 ? l.rate.toFixed(3) : '',
            l.importe.toFixed(2) + ' €',
        ]);

        (doc as any).autoTable({
            startY: 65,
            head: [['Concepto', 'Cantidad', 'Precio Unit.', 'Devengos']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right', fontStyle: 'bold' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // Totals
        doc.setFontSize(12);
        doc.text('TOTAL A PERCIBIR (NETO):', 120, finalY);
        doc.setFontSize(16);
        doc.text(`${details.totalVariables.toFixed(2)} €`, 180, finalY, { align: 'right' });

        doc.save(`Nomina_${details.empleado.nombre}_${month}_${year}.pdf`);
    };

    const handleExportGlobalPDF = async () => {
        if (!confirm('Se generará el RESUMEN de nóminas para la gestoría con la tabla resumida. ¿Continuar?')) return;

        try {
            // DEBUG: Start
            // alert('Iniciando exportación...'); 

            const res = await fetch(`/api/nominas?year=${year}&month=${month}&details=true`);
            if (!res.ok) throw new Error('Error recuperando datos (API Error)');
            const data = await res.json();

            // Filter payrolls
            const payrolls = data.filter((r: any) => r.nomina).map((r: any) => ({
                empleado: r.empleado,
                ...r.nomina
            }));

            if (payrolls.length === 0) return alert('No hay datos exportables para este mes.');

            // DEBUG: Data loaded
            // alert(`Datos cargados: ${payrolls.length} nóminas. Generando PDF...`);

            const doc = new jsPDF('l');

            // --- HEADER ---
            doc.setFillColor(220, 50, 50); // SEL Red
            doc.circle(105, 15, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text('SEL', 102, 16.5);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(8);
            doc.text('SUMINISTROS ENERGÉTICOS DE LEVANTE S.A.', 105, 28, { align: 'center' });

            const today = new Date();
            const dateStr = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.setFontSize(9);
            doc.text(dateStr, 280, 35, { align: 'right' });

            // Title Row: 2026 | NOMINA | ENERO
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`${year}`, 20, 45);
            doc.text('NOMINA', 130, 45);

            // Box for Month
            doc.setDrawColor(0);
            doc.setLineWidth(0.5);
            doc.rect(220, 40, 50, 8);
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('es-ES', { month: 'long' }).toUpperCase();
            doc.text(monthName, 245, 45.5, { align: 'center' });

            // --- TABLE DATA PREP ---
            const tableBody: any[] = [];
            let totalCol1 = 0;
            let totalCol2 = 0;
            let totalCol3 = 0;
            let totalCol4 = 0;

            payrolls.forEach((p: any) => {
                // Map concepts to columns
                let col1 = 0; // Dietas/Km
                let col2 = 0; // Hora presencia
                let col3 = 0; // Productividad
                let col4 = 0; // Incentivo
                let notes: string[] = [];

                if (p.lineas) {
                    p.lineas.forEach((l: any) => {
                        const code = l.conceptoCodigo;
                        // Ensure amount is a number (handle potential string from JSON/Prisma)
                        const amount = Number(l.importe) || 0;

                        if (['INCENTIVOS'].includes(code)) {
                            col4 += amount;
                        } else if (['DISPONIBILIDAD', 'HORAS_EXTRA'].includes(code)) {
                            col2 += amount;
                        } else if (['PRODUCTIVIDAD', 'PRODUCTIVIDAD_FIJA'].includes(code)) {
                            col3 += amount;
                        } else {
                            // All others to Col 1 (Dietas, Km, Viajes, Descargas, Litros, Dietas Fijas...)
                            // Explicitly including DIETAS to be sure
                            col1 += amount;
                        }

                        if (l.notas) notes.push(l.notas);
                    });
                }

                totalCol1 += col1;
                totalCol2 += col2;
                totalCol3 += col3;
                totalCol4 += col4;

                const name = `${p.empleado.nombre} ${p.empleado.apellidos}`;
                const formatCurr = (v: number) => v !== 0 ? v.toFixed(2) + ' €' : '';

                tableBody.push([
                    name.toUpperCase(),
                    formatCurr(col1),
                    formatCurr(col2),
                    formatCurr(col3),
                    formatCurr(col4),
                    notes.join(', ')
                ]);
            });

            // Totals Row
            const formatTotal = (v: number) => v.toFixed(2) + ' €';
            tableBody.push([
                { content: '', styles: { fillColor: [255, 255, 255] } }, // Name
                { content: formatTotal(totalCol1), styles: { fontStyle: 'bold' } },
                { content: formatTotal(totalCol2), styles: { fontStyle: 'bold' } },
                { content: formatTotal(totalCol3), styles: { fontStyle: 'bold' } },
                { content: formatTotal(totalCol4), styles: { fontStyle: 'bold' } },
                ''
            ]);

            // --- TABLE GENERATION ---
            // Use functional autoTable(doc, options) for better compatibility
            autoTable(doc, {
                startY: 50,
                head: [[
                    'NOMBRE',
                    'Dietas/Kilometraje',
                    'Hora de\npresencia',
                    'Productividad\ncotizable seg.s.',
                    'INCENTIVO',
                    'Notas'
                ]],
                body: tableBody,
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    cellPadding: 2,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.5,
                    lineColor: [0, 0, 0],
                    halign: 'center',
                    valign: 'middle'
                },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold', cellWidth: 80 },
                    1: { halign: 'right', cellWidth: 35 },
                    2: { halign: 'right', cellWidth: 35 },
                    3: { halign: 'right', cellWidth: 35 },
                    4: { halign: 'right', cellWidth: 35 },
                    5: { halign: 'left' }
                },
            });

            // Footer info
            // @ts-ignore
            const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 150;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bolditalic');
            doc.text('LES RUEGO ENVIEN LAS NOMINAS Y EL RESUMEN AL', 20, finalY);

            doc.setTextColor(0, 0, 255);
            doc.text('joseluis.mendez@transportesmendez.com', 80, finalY + 5);
            doc.text('direccion@selsel.com', 80, finalY + 10);

            doc.setTextColor(0, 0, 0);
            doc.text('CORREO:', 20, finalY + 5);

            doc.text('Fdo.', 20, finalY + 30);
            doc.line(20, finalY + 35, 100, finalY + 35); // Signature line

            doc.save(`Resumen_Nominas_${month}_${year}.pdf`);
            // DEBUG: Check
            // alert('PDF Generado correctamente');

        } catch (e: any) {
            console.error(e);
            alert('Error exportando global: ' + e.message + '\nConsulta la consola para más detalles.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4 border-b bg-gray-50/50">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <div>
                            <CardTitle>Nóminas: {month}/{year}</CardTitle>
                            <p className="text-xs text-gray-500 mt-1">Gestión mensual de variables y complementos</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                        <Button onClick={handleGenerate} disabled={generating} className={generating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}>
                            <Calculator className="w-4 h-4 mr-2" />
                            {generating ? 'Procesando...' : 'Recalcular Todo'}
                        </Button>
                        <Button onClick={handleExportGlobalPDF} variant="outline" className="text-gray-700 border-gray-300">
                            <FileText className="w-4 h-4 mr-2" /> Exportar Global
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && <div className="p-8 text-center text-gray-500">Cargando datos...</div>}

                    <div className="divide-y">
                        {rows.map((row) => (
                            <div key={row.empleado.id} className="group">
                                <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleExpand(row.nomina?.id)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${row.nomina ? (row.nomina.estado === 'CERRADA' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700') : 'bg-gray-100 text-gray-400'}`}>
                                            {row.nomina ? (
                                                row.nomina.estado === 'CERRADA' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />
                                            ) : (
                                                <div className="w-5 h-5" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{row.empleado.nombre} {row.empleado.apellidos}</p>
                                            <div className="flex gap-2 text-xs items-center mt-1">
                                                <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 font-medium text-[10px]">{row.empleado.rol}</span>
                                                {row.nomina && <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{row.nomina.totalVariables.toFixed(2)} €</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {row.nomina && (
                                            <Button variant="ghost" size="sm" className="text-gray-400 group-hover:text-gray-600">
                                                {expandedNominaId === row.nomina.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* EXPANDED DETAILS (PAYSLIP STYLE) */}
                                {expandedNominaId === (row.nomina?.id) && (
                                    <div className="border-t bg-slate-50 p-6 animate-in slide-in-from-top-2 shadow-inner">
                                        {detailsLoading ? <p className="text-center py-4 text-gray-500">Cargando detalle...</p> : details && (
                                            <div className="bg-white rounded-lg shadow-sm border max-w-4xl mx-auto overflow-hidden">
                                                {/* Header Actions */}
                                                <div className="bg-gray-100 px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4 border-b">
                                                    <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Detalle de Nómina</span>
                                                    <div className="flex gap-2">
                                                        {details.estado === 'BORRADOR' && (
                                                            <Button size="sm" variant="danger" onClick={() => handleClosePayroll(details.id)}>Cerrar Nómina</Button>
                                                        )}
                                                        <Button size="sm" variant="outline" onClick={handleExportPDF}>
                                                            <FileText className="w-4 h-4 mr-2" /> PDF
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Payslip Table */}
                                                <div className="p-0 overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left font-semibold">Concepto</th>
                                                                <th className="px-6 py-3 text-right font-semibold">Cantidad</th>
                                                                <th className="px-6 py-3 text-right font-semibold">Precio Unit.</th>
                                                                <th className="px-6 py-3 text-right font-semibold">Devengos</th>
                                                                <th className="px-6 py-3 text-left font-semibold">Notas</th>
                                                                <th className="px-6 py-3 w-10"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {details.lineas.map((line: any) => (
                                                                <tr key={line.id} className="hover:bg-slate-50/50 transition-colors group/row">
                                                                    <td className="px-6 py-3 font-medium text-gray-800">{line.conceptoNombre}</td>
                                                                    <td className="px-6 py-3 text-right text-gray-500 font-mono">
                                                                        {line.cantidad > 1 ? line.cantidad : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right text-gray-500 font-mono">
                                                                        {(line.cantidad > 1 || line.rate > 0) ? `${line.rate.toFixed(3)} €` : '-'}
                                                                    </td>

                                                                    {editingLineId === line.id ? (
                                                                        <>
                                                                            <td className="px-6 py-3 text-right">
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-24 text-right border border-blue-300 ring-2 ring-blue-100 p-1 rounded font-bold"
                                                                                    value={editValues.importe}
                                                                                    onChange={(e) => setEditValues({ ...editValues, importe: e.target.value })}
                                                                                    autoFocus
                                                                                />
                                                                            </td>
                                                                            <td className="px-6 py-3">
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full border border-blue-300 p-1 rounded text-xs"
                                                                                    value={editValues.notas}
                                                                                    placeholder="Motivo..."
                                                                                    onChange={(e) => setEditValues({ ...editValues, notas: e.target.value })}
                                                                                />
                                                                            </td>
                                                                            <td className="px-6 py-3 flex gap-1 justify-end">
                                                                                <button onClick={() => handleSaveLine(line.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                                                                                <button onClick={() => setEditingLineId(null)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                                                            </td>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <td className="px-6 py-3 text-right font-bold text-gray-800">
                                                                                {line.importe.toFixed(2)} €
                                                                            </td>
                                                                            <td className="px-6 py-3 text-xs text-gray-400 italic">
                                                                                {line.override && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px] mr-2 font-not-italic">MANUAL</span>}
                                                                                {line.notas}
                                                                            </td>
                                                                            <td className="px-6 py-3 text-right">
                                                                                {details.estado === 'BORRADOR' && (
                                                                                    <button
                                                                                        onClick={() => handleEditLine(line)}
                                                                                        className="text-gray-300 hover:text-blue-600 transition-colors opacity-0 group-hover/row:opacity-100"
                                                                                        title="Editar manualmente"
                                                                                    >
                                                                                        <Edit2 className="w-4 h-4" />
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                                            <tr>
                                                                <td colSpan={3} className="px-6 py-4 text-right uppercase text-xs font-bold text-gray-500">Total a Percibir</td>
                                                                <td className="px-6 py-4 text-right text-xl font-bold text-gray-900">{details.totalVariables.toFixed(2)} €</td>
                                                                <td colSpan={2}></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
