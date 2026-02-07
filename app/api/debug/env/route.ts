
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const envVars = Object.keys(process.env).sort().reduce((acc, key) => {
        // Mask sensitive values, show first 3 chars if possible
        const val = process.env[key] || '';
        acc[key] = val.length > 5 ? `${val.substring(0, 3)}...` : '***';
        return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
        message: 'Environment Variables Diagnostics',
        env: envVars,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        nodeEnv: process.env.NODE_ENV
    });
}
