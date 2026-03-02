'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { PlusCircle, Wrench, Package, MinusCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Categoria {
    id: number;
    nombre: string;
    descripcion: string | null;
    _count?: { articulos: number };
}

interface Articulo {
    id: number;
    nombre: string;
    descripcion: string | null;
    codigoBarras: string | null;
    referencia: string | null;
    cantidad: number;
    stockMinimo: number;
    ubicacion: string | null;
    precioCosto: number | null;
    categoriaId: number;
    categoria: { nombre: string };
}

export default function InventarioPage() {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [articulos, setArticulos] = useState<Articulo[]>([]);
    const [loading, setLoading] = useState(true);

    const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
    const [isArtDialogOpen, setIsArtDialogOpen] = useState(false);
    const [isMovDialogOpen, setIsMovDialogOpen] = useState(false);

    const [selectedArticulo, setSelectedArticulo] = useState<Articulo | null>(null);
    const [movTipo, setMovTipo] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
    const [movCantidad, setMovCantidad] = useState('');
    const [movMotivo, setMovMotivo] = useState('');
    const [movCamionId, setMovCamionId] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catRes, artRes] = await Promise.all([
                fetch('/api/inventario/categorias'),
                fetch('/api/inventario/articulos')
            ]);

            if (catRes.ok) setCategorias(await catRes.json());
            if (artRes.ok) setArticulos(await artRes.json());
        } catch (error) {
            toast.error('Error cargando el inventario');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategoria = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            nombre: formData.get('nombre') as string,
            descripcion: formData.get('descripcion') as string,
        };

        const res = await fetch('/api/inventario/categorias', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            toast.success('Categoría creada');
            setIsCatDialogOpen(false);
            fetchData();
        } else {
            const err = await res.json();
            toast.error(err.error || 'Error al crear');
        }
    };

    const handleCreateArticulo = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            nombre: formData.get('nombre') as string,
            categoriaId: formData.get('categoriaId'),
            referencia: formData.get('referencia') as string,
            ubicacion: formData.get('ubicacion') as string,
            cantidad: Number(formData.get('cantidad')),
            stockMinimo: Number(formData.get('stockMinimo')),
        };

        const res = await fetch('/api/inventario/articulos', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            toast.success('Artículo creado');
            setIsArtDialogOpen(false);
            fetchData();
        } else {
            const err = await res.json();
            toast.error(err.error || 'Error al crear artículo');
        }
    };

    const handleMovimiento = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedArticulo) return;

        const data = {
            articuloId: selectedArticulo.id,
            tipo: movTipo,
            cantidad: Number(movCantidad),
            motivo: movMotivo,
            camionId: movCamionId || undefined
        };

        const res = await fetch('/api/inventario/movimientos', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            toast.success('Movimiento registrado');
            setIsMovDialogOpen(false);
            setSelectedArticulo(null);
            setMovCantidad('');
            setMovMotivo('');
            fetchData();
        } else {
            const err = await res.json();
            toast.error(err.error || 'Error en movimiento');
        }
    };

    if (loading) return <div>Cargando inventario...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Wrench className="h-6 w-6 text-orange-600" />
                    Inventario de Taller
                </h1>
            </div>

            <Tabs defaultValue="articulos" className="w-full">
                <TabsList className="bg-white shadow border">
                    <TabsTrigger value="articulos">Stock de Artículos</TabsTrigger>
                    <TabsTrigger value="categorias">Categorías</TabsTrigger>
                </TabsList>

                <TabsContent value="articulos" className="mt-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-700">Artículos y Repuestos</h2>
                        <Dialog open={isArtDialogOpen} onOpenChange={setIsArtDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                                    <PlusCircle className="h-4 w-4" /> Nuevo Artículo
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Añadir Artículo al Inventario</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateArticulo} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-sm font-medium">Nombre</label>
                                            <Input name="nombre" placeholder="Ej: Neumático Michelin 315/80 R22.5" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Categoría</label>
                                            <select name="categoriaId" required className="w-full border rounded-md p-2 text-sm">
                                                <option value="">Selecciona categoría</option>
                                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Referencia / Modelo</label>
                                            <Input name="referencia" placeholder="Opcional" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Stock Inicial</label>
                                            <Input type="number" name="cantidad" defaultValue="0" min="0" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Stock Mínimo (Alerta)</label>
                                            <Input type="number" name="stockMinimo" defaultValue="0" min="0" />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <label className="text-sm font-medium">Ubicación Fija</label>
                                            <Input name="ubicacion" placeholder="Ej: Estante 4, Nivel 2" />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white">Guardar Artículo</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {articulos.map(art => (
                            <Card key={art.id} className={art.cantidad <= art.stockMinimo ? 'border-red-400 shadow-sm' : 'shadow-sm'}>
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-md font-bold text-gray-800">{art.nombre}</CardTitle>
                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold uppercase">{art.categoria.nombre}</span>
                                    </div>
                                    {art.referencia && <p className="text-xs text-gray-500">Ref: {art.referencia}</p>}
                                </CardHeader>
                                <CardContent className="p-4 pt-2">
                                    <div className="flex justify-between items-end mt-2">
                                        <div>
                                            <div className="text-2xl font-black text-gray-800">
                                                {art.cantidad} <span className="text-sm font-normal text-gray-500">uds</span>
                                            </div>
                                            {(art.cantidad <= art.stockMinimo && art.stockMinimo > 0) && (
                                                <p className="text-xs text-red-500 font-bold mt-1">¡Bajo Stock! (Mín: {art.stockMinimo})</p>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => {
                                                setSelectedArticulo(art);
                                                setMovTipo('ENTRADA');
                                                setIsMovDialogOpen(true);
                                            }}>
                                                <PlusCircle className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => {
                                                setSelectedArticulo(art);
                                                setMovTipo('SALIDA');
                                                setIsMovDialogOpen(true);
                                            }}>
                                                <MinusCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {articulos.length === 0 && (
                            <div className="col-span-full text-center text-gray-500 py-8 bg-white border border-dashed rounded-lg">
                                No hay artículos en el almacén. Dale a "Nuevo Artículo" para empezar.
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="categorias" className="mt-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-700">Categorías de Inventario</h2>
                        <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                                    <PlusCircle className="h-4 w-4" /> Nueva Categoría
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Crear Categoría</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateCategoria} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nombre de la Categoría</label>
                                        <Input name="nombre" placeholder="Ej: Ruedas, Contadores, Mangueras..." required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Descripción</label>
                                        <Input name="descripcion" placeholder="Opcional" />
                                    </div>
                                    <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white">Guardar Categoría</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {categorias.map(cat => (
                            <Card key={cat.id}>
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-md flex items-center gap-2">
                                        <Package className="h-4 w-4 text-orange-600" />
                                        {cat.nombre}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    {cat.descripcion && <p className="text-sm text-gray-500 mb-2">{cat.descripcion}</p>}
                                    <p className="text-sm font-semibold text-gray-700">{cat._count?.articulos || 0} artículos</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modal for Movements */}
            <Dialog open={isMovDialogOpen} onOpenChange={setIsMovDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {movTipo === 'ENTRADA' ? 'Registrar ENTRADA' : 'Registrar SALIDA'} de Stock
                        </DialogTitle>
                    </DialogHeader>
                    {selectedArticulo && (
                        <form onSubmit={handleMovimiento} className="space-y-4">
                            <div className="bg-gray-50 p-3 rounded-md border flex justify-between">
                                <span className="font-semibold text-gray-700">{selectedArticulo.nombre}</span>
                                <span className="text-gray-500">Stock Actual: {selectedArticulo.cantidad}</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Cantidad a {movTipo === 'ENTRADA' ? 'añadir' : 'retirar'}</label>
                                <Input type="number" min="1" max={movTipo === 'SALIDA' ? selectedArticulo.cantidad : undefined} required value={movCantidad} onChange={(e) => setMovCantidad(e.target.value)} />
                                {movTipo === 'SALIDA' && selectedArticulo.cantidad === 0 && (
                                    <p className="text-red-500 text-xs">No hay stock disponible para retirar.</p>
                                )}
                            </div>

                            {/* Opcional: Relacionar con camión */}
                            {movTipo === 'SALIDA' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-600">ID Camión (Opcional si es para un camión)</label>
                                    <Input type="number" placeholder="Ej: 5" value={movCamionId} onChange={(e) => setMovCamionId(e.target.value)} />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Motivo / Notas</label>
                                <Input placeholder={movTipo === 'ENTRADA' ? 'Ej: Compra proveedor, Devolución...' : 'Ej: Reparación camión, sustitución...'} required value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} />
                            </div>

                            <Button type="submit" disabled={movTipo === 'SALIDA' && selectedArticulo.cantidad === 0} className={`w-full text-white ${movTipo === 'ENTRADA' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                Confirmar {movTipo}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
