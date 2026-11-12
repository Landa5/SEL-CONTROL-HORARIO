'use client';

import React, { Suspense } from 'react';
import AdminLayoutContent from '@/components/admin/AdminLayoutContent';

export default function MecanicoLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </Suspense>
    );
}
