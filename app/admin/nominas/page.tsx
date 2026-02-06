'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar, FileText, Settings, Droplet, Users } from 'lucide-react';
import Link from 'next/link';

export default function PayrollDashboard() {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link href="/admin/nominas/config">
                    <Card className="hover:bg-gray-50 cursor-pointer h-full transition-colors border-blue-200">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-full">
                                <Settings className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-blue-800">Tarifas y Precios</h3>
                                <p className="text-sm text-gray-500">Configurar precio KM, dietas, etc.</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/nominas/comercial">
                    <Card className="hover:bg-gray-50 cursor-pointer h-full transition-colors border-indigo-200">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="bg-indigo-100 p-3 rounded-full">
                                <Droplet className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-indigo-800">Litros Comercial</h3>
                                <p className="text-sm text-gray-500">Introducir litros mensuales.</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* MONTH SELECTOR */}
            <h2 className="text-2xl font-bold flex items-center gap-2 mt-8">
                <Calendar className="w-6 h-6" /> Meses de Nómina
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Generate Last 12 months links */}
                {Array.from({ length: 12 }, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const year = d.getFullYear();
                    const month = d.getMonth() + 1;
                    const label = d.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

                    return (
                        <Link key={i} href={`/admin/nominas/${year}/${month}`}>
                            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                <CardContent className="p-6 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-gray-400" />
                                        <span className="capitalize font-medium text-lg">{label}</span>
                                    </div>
                                    <Button variant="ghost" size="sm">Ver Detalles &rarr;</Button>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
