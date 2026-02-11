'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader2 } from 'lucide-react';

interface EditUsoCamionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    usage: any; // The usage object to edit
    onSave: (id: number, data: any) => Promise<void>;
}

export default function EditUsoCamionDialog({
    open,
    onOpenChange,
    usage,
    onSave
}: EditUsoCamionDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        kmInicial: 0,
        kmFinal: 0,
        descargasCount: 0,
        viajesCount: 0,
        litrosRepostados: 0
    });

    useEffect(() => {
        if (usage) {
            setFormData({
                kmInicial: usage.kmInicial || 0,
                kmFinal: usage.kmFinal || 0,
                descargasCount: usage.descargasCount || usage.descargas?.length || 0,
                viajesCount: usage.viajesCount || 0,
                litrosRepostados: usage.litrosRepostados || 0
            });
        }
    }, [usage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave(usage.id, formData);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Uso de Camión</DialogTitle>
                    <DialogDescription>
                        Modifica los datos operativos de este tramo.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">KM Inicial</label>
                            <Input
                                type="number"
                                value={formData.kmInicial}
                                onChange={(e) => setFormData({ ...formData, kmInicial: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">KM Final</label>
                            <Input
                                type="number"
                                value={formData.kmFinal}
                                onChange={(e) => setFormData({ ...formData, kmFinal: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Descargas</label>
                            <Input
                                type="number"
                                value={formData.descargasCount}
                                onChange={(e) => setFormData({ ...formData, descargasCount: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Viajes</label>
                            <Input
                                type="number"
                                value={formData.viajesCount}
                                onChange={(e) => setFormData({ ...formData, viajesCount: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Litros</label>
                            <Input
                                type="number"
                                step="0.1"
                                value={formData.litrosRepostados}
                                onChange={(e) => setFormData({ ...formData, litrosRepostados: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
