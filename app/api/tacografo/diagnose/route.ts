import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * DIAGNOSTIC ENDPOINT (temporary)
 * Analyzes binary TGD/DDD file to find all midnight timestamps
 * and check why certain days might be missing.
 * 
 * POST with { importId: number } body
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const user: any = await verifyToken(session);
    if (!user || user.rol !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
    }

    const body = await request.json();
    const { base64, fileName } = body;
    
    if (!base64 || !fileName) {
      return NextResponse.json({ error: 'Se requiere base64 y fileName' }, { status: 400 });
    }

    const buf = Buffer.from(base64, 'base64');
    
    const SECONDS_PER_DAY = 86400;
    const tsMin = Math.floor(new Date('2023-01-01').getTime() / 1000);
    const tsMax = Math.floor(new Date('2027-01-01').getTime() / 1000);

    // 1. Find ALL midnight timestamps
    const midnights: { offset: number; date: string; ts: number }[] = [];
    for (let i = 0; i < buf.length - 3; i++) {
      const ts = ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3]) >>> 0;
      if (ts >= tsMin && ts <= tsMax && ts % SECONDS_PER_DAY === 0) {
        const d = new Date(ts * 1000);
        midnights.push({ offset: i, date: d.toISOString().substring(0, 10), ts });
      }
    }

    // Group by date
    const byDate: Record<string, { offsets: number[]; hasActivityRecords: boolean }> = {};
    for (const m of midnights) {
      if (!byDate[m.date]) byDate[m.date] = { offsets: [], hasActivityRecords: false };
      byDate[m.date].offsets.push(m.offset);
    }

    // 2. For each midnight timestamp, try to find activity records
    const ACTIVITY_CODES: Record<number, string> = { 0: 'REST', 1: 'AVAIL', 2: 'WORK', 3: 'DRIVE' };
    
    for (const date of Object.keys(byDate)) {
      for (const offset of byDate[date].offsets) {
        // Try different header offsets
        for (const hoff of [4, 6, 8, 10, 12]) {
          const pos = offset + hoff;
          if (pos + 4 > buf.length) continue;
          
          // Try to parse activity records
          let validCount = 0;
          let prevMin = -1;
          
          for (let j = 0; j < 100; j++) {
            const rPos = pos + j * 2;
            if (rPos + 1 >= buf.length) break;
            
            const rec = (buf[rPos] << 8) | buf[rPos + 1];
            if (rec === 0 || rec === 0xffff) break;
            
            const minutes = rec & 0x07ff;
            if (minutes > 1440) break;
            if (prevMin >= 0 && minutes < prevMin) break;
            
            validCount++;
            prevMin = minutes;
          }
          
          if (validCount >= 2) {
            byDate[date].hasActivityRecords = true;
            break;
          }
        }
        if (byDate[date].hasActivityRecords) break;
      }
    }

    // 3. Check specific days of interest
    const mar12Start = Math.floor(new Date('2026-03-12T00:00:00Z').getTime() / 1000);
    const mar12End = Math.floor(new Date('2026-03-13T00:00:00Z').getTime() / 1000);
    
    const mar12Timestamps: { offset: number; time: string }[] = [];
    for (let i = 0; i < buf.length - 3; i++) {
      const ts = ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3]) >>> 0;
      if (ts >= mar12Start && ts < mar12End) {
        mar12Timestamps.push({ offset: i, time: new Date(ts * 1000).toISOString() });
        if (mar12Timestamps.length > 50) break;
      }
    }

    // 4. Also search for plate numbers
    const plates: { plate: string; offset: number }[] = [];
    const platePattern = /\d{4}[A-Z]{3}/;
    for (let i = 0; i < buf.length - 7; i++) {
      const chunk = Array.from(buf.subarray(i, i + 7))
        .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '')
        .join('');
      if (chunk.length === 7 && platePattern.test(chunk)) {
        plates.push({ plate: chunk, offset: i });
      }
    }

    // 5. Summary
    const sortedDates = Object.keys(byDate).sort();
    const daysWithActivity = sortedDates.filter(d => byDate[d].hasActivityRecords);
    const daysWithoutActivity = sortedDates.filter(d => !byDate[d].hasActivityRecords);

    return NextResponse.json({
      fileSize: buf.length,
      totalMidnightTimestamps: midnights.length,
      uniqueDates: sortedDates.length,
      daysWithActivityRecords: daysWithActivity,
      daysWithoutActivityRecords: daysWithoutActivity,
      march12Analysis: {
        hasMidnightTimestamp: !!byDate['2026-03-12'],
        hasActivityRecords: byDate['2026-03-12']?.hasActivityRecords || false,
        anyTimestampsOnMarch12: mar12Timestamps.length,
        timestamps: mar12Timestamps.slice(0, 20),
      },
      platesFound: plates,
      allDays: byDate,
    });
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
