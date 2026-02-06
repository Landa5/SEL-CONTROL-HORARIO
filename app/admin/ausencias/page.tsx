'use client';

import AdminAbsenceView from "@/components/admin/AdminAbsenceView";
import { Calendar } from "lucide-react";

export default function AdminAbsencePage() {
    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3 border-b pb-4">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                    <Calendar className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Ausencias y Vacaciones</h1>
                    <p className="text-gray-500">Control centralizado de permisos y calendario laboral.</p>
                </div>
            </header>

            <AdminAbsenceView />
        </div>
    );
}
