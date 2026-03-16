import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export const maxDuration = 30;

/**
 * Diagnostic endpoint: upload a TGD file and get structural analysis.
 * This is temporary - for debugging the spec parser.
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.base64 || !body.name) {
      return NextResponse.json({ error: 'Missing base64 or name' }, { status: 400 });
    }

    const buffer = Buffer.from(body.base64, 'base64');
    const fileName = body.name;

    // Analysis results
    const analysis: any = {
      fileName,
      fileSize: buffer.length,
      first100Hex: '',
      tlvScan: [],
      midnightTimestamps: [],
      allTimestampCandidates: [],
      activityDataBlocks: [],
    };

    // 1. First 200 bytes hex dump
    const hexLines: string[] = [];
    for (let i = 0; i < Math.min(200, buffer.length); i += 16) {
      const bytes = buffer.subarray(i, Math.min(i + 16, buffer.length));
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = Array.from(bytes).map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.').join('');
      hexLines.push(`${i.toString(16).padStart(6, '0')}: ${hex.padEnd(48)} ${ascii}`);
    }
    analysis.first100Hex = hexLines;

    // 2. Scan for known TLV tags (2-byte)
    const KNOWN_TAGS: Record<number, string> = {
      0x0002: 'Card_ICC', 0x0005: 'Card_Certificate_CA', 0xC100: 'Card_Certificate',
      0x0501: 'EF_Identification', 0x0502: 'EF_Card_Download', 0x0503: 'EF_Driving_Licence_Info',
      0x0504: 'EF_Events_Data', 0x0505: 'EF_Faults_Data', 0x0506: 'EF_Driver_Activity_Data',
      0x0507: 'EF_Vehicles_Used', 0x0508: 'EF_Places', 0x050B: 'EF_Control_Activity',
      0x050C: 'EF_Specific_Conditions',
      0x7600: 'TREP_7600', 0x7601: 'TREP_7601', 0x7602: 'TREP_7602',
      0x7603: 'TREP_7603', 0x7604: 'TREP_7604', 0x7605: 'TREP_7605',
      0x7606: 'TREP_7606', 0x7607: 'TREP_7607',
    };

    for (let i = 0; i < buffer.length - 4; i++) {
      const tag = (buffer[i] << 8) | buffer[i + 1];
      if (!KNOWN_TAGS[tag]) continue;

      let dataLength = 0;
      let headerSize = 2;
      const lenByte = buffer[i + 2];
      if (lenByte <= 0x7f) { dataLength = lenByte; headerSize += 1; }
      else if (lenByte === 0x81) { dataLength = buffer[i + 3]; headerSize += 2; }
      else if (lenByte === 0x82) { dataLength = (buffer[i + 3] << 8) | buffer[i + 4]; headerSize += 3; }
      else continue;

      if (dataLength > 0 && dataLength < buffer.length && (i + headerSize + dataLength) <= buffer.length) {
        const contentStart = i + headerSize;
        const contentPreview = Array.from(buffer.subarray(contentStart, Math.min(contentStart + 32, buffer.length)))
          .map(b => b.toString(16).padStart(2, '0')).join(' ');
        
        analysis.tlvScan.push({
          offset: `0x${i.toString(16)}`,
          tag: `0x${tag.toString(16).padStart(4, '0')}`,
          tagName: KNOWN_TAGS[tag],
          dataLength,
          headerSize,
          contentPreview,
        });

        // For activity data, try to parse structure
        if (tag === 0x0506) {
          const oldestPtr = (buffer[contentStart] << 8) | buffer[contentStart + 1];
          const newestPtr = (buffer[contentStart + 2] << 8) | buffer[contentStart + 3];
          const dataArea = dataLength - 4;
          
          analysis.activityDataBlocks.push({
            offset: `0x${contentStart.toString(16)}`,
            totalLength: dataLength,
            oldestDayRecordPointer: oldestPtr,
            newestRecordPointer: newestPtr,
            dataAreaSize: dataArea,
            firstRecordHex: Array.from(buffer.subarray(contentStart + 4, Math.min(contentStart + 44, buffer.length)))
              .map(b => b.toString(16).padStart(2, '0')).join(' '),
          });
        }
      }
    }

    // 3. Scan for midnight timestamps  
    const SECONDS_PER_DAY = 86400;
    for (let i = 0; i < buffer.length - 3; i++) {
      const ts = ((buffer[i] << 24) | (buffer[i + 1] << 16) | (buffer[i + 2] << 8) | buffer[i + 3]) >>> 0;
      if (ts >= 1577836800 && ts <= 1900000000 && ts % SECONDS_PER_DAY === 0) {
        const date = new Date(ts * 1000);
        analysis.midnightTimestamps.push({
          offset: `0x${i.toString(16)}`,
          date: date.toISOString().substring(0, 10),
          unix: ts,
        });
      }
    }

    // 4. Also try TREP format: tag(1 byte) + length(2 bytes BE) used by some TREP-based TGD files
    const trepScan: any[] = [];
    const TREP_TAGS: Record<number, string> = {
      0x01: 'TREP_MF_ICC', 0x02: 'TREP_MF_IC', 0x03: 'TREP_DF_TACHO',
      0x05: 'TREP_EF_APP_ID', 0x06: 'TREP_EF_KEY_IDS', 
      0x07: 'TREP_EF_ID', 0x08: 'TREP_EF_CARD_DOWNLOAD',
      0x09: 'TREP_EF_DRV_LIC', 0x0A: 'TREP_EF_EVENTS',
      0x0B: 'TREP_EF_FAULTS', 0x0C: 'TREP_EF_DRIVER_ACTIVITY',
      0x0D: 'TREP_EF_VEHICLES', 0x0E: 'TREP_EF_PLACES',
      0x10: 'TREP_EF_CTRL_ACTIVITY', 0x11: 'TREP_EF_SPECIFIC_COND',
    };
    
    let trepPos = 0;
    let trepMaxIter = 100;
    while (trepPos < buffer.length - 3 && trepMaxIter-- > 0) {
      const trepTag = buffer[trepPos];
      if (!TREP_TAGS[trepTag] && trepTag !== 0x00 && trepTag !== 0xFF) {
        trepPos++;
        continue;
      }
      if (trepTag === 0x00 || trepTag === 0xFF) { trepPos++; continue; }
      
      const trepLen = (buffer[trepPos + 1] << 8) | buffer[trepPos + 2];
      if (trepLen <= 0 || trepLen > buffer.length || trepPos + 3 + trepLen > buffer.length) {
        trepPos++;
        continue;
      }

      const preview = Array.from(buffer.subarray(trepPos + 3, Math.min(trepPos + 3 + 32, buffer.length)))
        .map(b => b.toString(16).padStart(2, '0')).join(' ');
      
      trepScan.push({
        offset: `0x${trepPos.toString(16)}`,
        tag: `0x${trepTag.toString(16).padStart(2, '0')}`,
        tagName: TREP_TAGS[trepTag],
        dataLength: trepLen,
        contentPreview: preview,
      });

      // If this is driver activity (0x0C), parse its internal structure
      if (trepTag === 0x0C) {
        const contentStart = trepPos + 3;
        const oldestPtr = (buffer[contentStart] << 8) | buffer[contentStart + 1];
        const newestPtr = (buffer[contentStart + 2] << 8) | buffer[contentStart + 3];
        analysis.activityDataBlocks.push({
          source: 'TREP',
          offset: `0x${contentStart.toString(16)}`,
          totalLength: trepLen,
          oldestDayRecordPointer: oldestPtr,
          newestRecordPointer: newestPtr,
          dataAreaSize: trepLen - 4,
          firstRecordHex: Array.from(buffer.subarray(contentStart + 4, Math.min(contentStart + 44, buffer.length)))
            .map(b => b.toString(16).padStart(2, '0')).join(' '),
        });
      }

      trepPos += 3 + trepLen;
    }
    
    if (trepScan.length > 0) {
      analysis.trepScan = trepScan;
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
