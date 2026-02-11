'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FileText, Download, Trash2, Calendar, Upload, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DocumentManagerProps {
    entityId: number;
    entityType: 'EMPLEADO' | 'CAMION';
}

export default function DocumentManager({ entityId, entityType }: DocumentManagerProps) {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Upload State
    const [file, setFile] = useState<File | null>(null);
    const [tipo, setTipo] = useState("OTRO");
    const [fechaCaducidad, setFechaCaducidad] = useState("");
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchDocs();
    }, [entityId, entityType]);

    async function fetchDocs() {
        setLoading(true);
        try {
            const param = entityType === 'EMPLEADO' ? `empleadoId=${entityId}` : `camionId=${entityId}`;
            const res = await fetch(`/api/documentos?${param}`);
            if (res.ok) {
                const data = await res.json();
                setDocs(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload(e: React.FormEvent) {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nombre', file.name);
        formData.append('tipo', tipo);
        if (fechaCaducidad) formData.append('fechaCaducidad', fechaCaducidad);

        if (entityType === 'EMPLEADO') formData.append('empleadoId', entityId.toString());
        if (entityType === 'CAMION') formData.append('camionId', entityId.toString());

        try {
            const res = await fetch('/api/documentos', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                setFile(null);
                setFechaCaducidad("");
                setTipo("OTRO");
                fetchDocs();
            } else {
                alert("Error al subir documento");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            setUploading(false);
        }
    }

    function getExpirationStatus(doc: any) {
        if (!doc.fechaCaducidad) return null;
        const days = Math.ceil((new Date(doc.fechaCaducidad).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        if (days < 0) return <span className="text-red-600 font-bold text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Caducado</span>;
        if (days < 30) return <span className="text-orange-500 font-bold text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Caduca en {days} días</span>;
        return <span className="text-green-600 text-xs">Vence: {format(new Date(doc.fechaCaducidad), 'dd/MM/yyyy')}</span>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Subir Documento
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-1/3">
                            <label className="block text-sm font-medium mb-1">Archivo</label>
                            <Input
                                type="file"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                required
                            />
                        </div>
                        <div className="w-full md:w-1/4">
                            <label className="block text-sm font-medium mb-1">Tipo</label>
                            <select
                                className="w-full border rounded-md p-2 text-sm"
                                value={tipo}
                                onChange={e => setTipo(e.target.value)}
                            >
                                <option value="CONTRATO">Contrato</option>
                                <option value="NOMINA">Nómina</option>
                                <option value="SEGURO">Seguro</option>
                                <option value="ITV">ITV</option>
                                <option value="ADR">ADR</option>
                                <option value="CAP">CAP</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>
                        <div className="w-full md:w-1/4">
                            <label className="block text-sm font-medium mb-1">Caducidad (Opcional)</label>
                            <Input
                                type="date"
                                value={fechaCaducidad}
                                onChange={e => setFechaCaducidad(e.target.value)}
                            />
                        </div>
                        <Button type="submit" disabled={uploading || !file}>
                            {uploading ? 'Subiendo...' : 'Subir'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Documentación ({docs.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-gray-500">Cargando...</p>
                    ) : docs.length === 0 ? (
                        <p className="text-gray-500 italic">No hay documentos adjuntos.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {docs.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-full shadow-sm">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{doc.nombre}</p>
                                            <div className="flex gap-2 text-xs text-gray-500">
                                                <span className="bg-gray-200 px-2 py-0.5 rounded text-gray-700 font-medium">{doc.tipo}</span>
                                                <span>Subido el {format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: es })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {getExpirationStatus(doc)}
                                        <div className="mt-1">
                                            <a
                                                href={doc.url}
                                                download
                                                className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center justify-end gap-1"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Download className="w-4 h-4" /> Descargar
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
