'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
    DialogTrigger // Ensure this is exported or use a separate button to open
} from '@/components/ui/Dialog';
import { Car, User, Calendar, Euro, Plus, FileText, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Cliente {
    id: number;
    nombre: string;
    telefono: string;
}

interface Alquiler {
    id: number;
    cliente: Cliente;
    matricula: string;
    fechaInicio: string;
    fechaFin?: string;
    precioMensual: number;
    activo: boolean;
}

interface Plaza {
    id: number;
    numero: number;
    alquileres: Alquiler[];
}

export default function AlquilerPage() {
    const [plazas, setPlazas] = useState<Plaza[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlaza, setSelectedPlaza] = useState<Plaza | null>(null);
    const [isRentModalOpen, setIsRentModalOpen] = useState(false);

    // Form States
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [matricula, setMatricula] = useState('');
    const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [precioMensual, setPrecioMensual] = useState('');

    // New Client Form
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [isNewClientMode, setIsNewClientMode] = useState(false);

    // Report State
    const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pRes, cRes] = await Promise.all([
                fetch('/api/admin/alquiler/dashboard'),
                fetch('/api/admin/alquiler/clientes')
            ]);
            if (pRes.ok) setPlazas(await pRes.json());
            if (cRes.ok) setClientes(await cRes.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClient = async () => {
        if (!newClientName || !newClientPhone) return;
        try {
            const res = await fetch('/api/admin/alquiler/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: newClientName, telefono: newClientPhone })
            });
            if (res.ok) {
                const newClient = await res.json();
                setClientes([...clientes, newClient]);
                setSelectedClientId(newClient.id.toString());
                setIsNewClientMode(false);
                setNewClientName('');
                setNewClientPhone('');
            }
        } catch (error) {
            console.error('Error creating client', error);
        }
    };

    const handleRent = async () => {
        if (!selectedPlaza || !selectedClientId || !matricula || !precioMensual) return;

        try {
            const res = await fetch('/api/admin/alquiler/rentals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plazaId: selectedPlaza.id,
                    clienteId: selectedClientId,
                    matricula,
                    fechaInicio,
                    precioMensual
                })
            });

            if (res.ok) {
                setIsRentModalOpen(false);
                fetchData(); // Refresh
                // Reset Form
                setSelectedClientId('');
                setMatricula('');
                setPrecioMensual('');
            } else {
                alert('Error al alquilar plaza (quizás ya está ocupada)');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleEndRental = async (rentalId: number) => {
        if (!confirm('¿Seguro que quieres finalizar este alquiler?')) return;
        try {
            const res = await fetch('/api/admin/alquiler/rentals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rentalId, action: 'END' })
            });

            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const generateReport = async () => {
        try {
            const res = await fetch(`/api/admin/alquiler/informe?month=${reportMonth}&year=${reportYear}`);
            if (res.ok) {
                setReportData(await res.json());
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-black text-gray-900 uppercase">Gestión de Alquiler de Garaje</h1>

            <Tabs defaultValue="dashboard">
                <TabsList>
                    <TabsTrigger value="dashboard">Dashboard Garaje</TabsTrigger>
                    <TabsTrigger value="clientes">Clientes</TabsTrigger>
                    <TabsTrigger value="informes">Informes Mensuales</TabsTrigger>
                </TabsList>

                {/* DASHBOARD */}
                <TabsContent value="dashboard" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
                        {plazas.map((plaza) => {
                            const activeRental = plaza.alquileres.find(a => a.activo);
                            const isOccupied = !!activeRental;

                            return (
                                <Card key={plaza.id} className={`border-2 transition-all ${isOccupied ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50 hover:shadow-lg'}`}>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                        <CardTitle className={`text-lg font-black uppercase ${isOccupied ? 'text-red-700' : 'text-green-700'}`}>
                                            Plaza {plaza.numero}
                                        </CardTitle>
                                        {isOccupied ? <Car className="text-red-400 w-6 h-6" /> : <CheckCircle className="text-green-400 w-6 h-6" />}
                                    </CardHeader>
                                    <CardContent>
                                        {isOccupied ? (
                                            <div className="space-y-2 text-sm text-gray-700">
                                                <div className="flex items-center gap-2 font-bold">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    {activeRental?.cliente.nombre}
                                                </div>
                                                <div className="flex items-center gap-2 font-mono bg-white px-2 py-1 rounded border">
                                                    <Car className="w-4 h-4 text-gray-400" />
                                                    {activeRental?.matricula}
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                                                    <span>Desde: {format(new Date(activeRental!.fechaInicio), 'dd/MM/yyyy')}</span>
                                                    <span className="font-bold text-gray-900">{activeRental!.precioMensual}€/mes</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full text-red-600 hover:bg-red-100 hover:text-red-800 mt-2"
                                                    onClick={() => handleEndRental(activeRental!.id)}
                                                >
                                                    Finalizar Alquiler
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6">
                                                <p className="text-green-600 font-medium mb-4">Disponible</p>
                                                <Button
                                                    className="w-full bg-green-600 hover:bg-green-700"
                                                    onClick={() => {
                                                        setSelectedPlaza(plaza);
                                                        setIsRentModalOpen(true);
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4 mr-2" /> Alquilar
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* CLIENTES */}
                <TabsContent value="clientes">
                    <Card>
                        <CardHeader>
                            <CardTitle>Listado de Clientes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clientes.map(c => (
                                    <div key={c.id} className="p-4 border rounded bg-gray-50 flex items-center gap-4">
                                        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold">{c.nombre}</p>
                                            <p className="text-sm text-gray-500">{c.telefono}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* INFORMES */}
                <TabsContent value="informes">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informe Mensual de Alquileres</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mes</label>
                                    <select
                                        value={reportMonth}
                                        onChange={(e) => setReportMonth(parseInt(e.target.value))}
                                        className="border rounded p-2 w-32"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM', { locale: es }).toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                                    <select
                                        value={reportYear}
                                        onChange={(e) => setReportYear(parseInt(e.target.value))}
                                        className="border rounded p-2 w-24"
                                    >
                                        {[2024, 2025, 2026].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button onClick={generateReport} className="mb-0.5">
                                    <FileText className="mr-2 w-4 h-4" /> Generar Informe
                                </Button>
                            </div>

                            {reportData && (
                                <div className="mt-8 border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left text-gray-500">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 font-bold">
                                            <tr>
                                                <th className="px-6 py-3">Plaza</th>
                                                <th className="px-6 py-3">Cliente</th>
                                                <th className="px-6 py-3">Matrícula</th>
                                                <th className="px-6 py-3 text-right">Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.rentals?.map((r: any, idx: number) => (
                                                <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-bold">{r.plaza}</td>
                                                    <td className="px-6 py-4">{r.cliente}</td>
                                                    <td className="px-6 py-4 font-mono">{r.matricula}</td>
                                                    <td className="px-6 py-4 text-right font-bold">{r.precio.toFixed(2)}€</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                                                <td colSpan={3} className="px-6 py-4 text-right uppercase">Total Facturación</td>
                                                <td className="px-6 py-4 text-right text-lg">{reportData.totalAmount?.toFixed(2)}€</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* RENT MODAL */}
            <Dialog open={isRentModalOpen} onOpenChange={setIsRentModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Alquilar Plaza {selectedPlaza?.numero}</DialogTitle>
                        <DialogDescription>Introduce los datos del alquiler.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* CLIENT SELECTOR */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Cliente</label>
                            {!isNewClientMode ? (
                                <div className="flex gap-2">
                                    <select
                                        className="w-full border rounded p-2"
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar Cliente --</option>
                                        {clientes.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                    <Button variant="outline" size="icon" onClick={() => setIsNewClientMode(true)}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2 border p-3 rounded bg-gray-50">
                                    <p className="text-xs font-bold text-gray-500 uppercase">Nuevo Cliente</p>
                                    <Input
                                        placeholder="Nombre Completo"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                    />
                                    <Input
                                        placeholder="Teléfono"
                                        value={newClientPhone}
                                        onChange={(e) => setNewClientPhone(e.target.value)}
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => setIsNewClientMode(false)}>Cancelar</Button>
                                        <Button size="sm" onClick={handleCreateClient}>Guardar Cliente</Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Matrícula</label>
                            <Input
                                placeholder="Ej: 1234 ABC"
                                value={matricula}
                                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Precio Mensual (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={precioMensual}
                                onChange={(e) => setPrecioMensual(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Fecha Inicio</label>
                            <Input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRentModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleRent} className="bg-green-600 hover:bg-green-700">Confirmar Alquiler</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
