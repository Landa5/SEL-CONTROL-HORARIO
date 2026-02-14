'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Loader2 } from 'lucide-react';

const AdminLayoutContent = dynamic(
    () => import('@/components/admin/AdminLayoutContent'),
    {
        ssr: false,
        loading: () => (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }
);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div suppressHydrationWarning={true}>
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </div>
    );
}
