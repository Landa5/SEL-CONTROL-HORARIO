/**
 * Lightweight, zero-dependency OpenXML (.xlsx) multi-sheet generator.
 * Produces standard .xlsx files (ZIP with STORE method + XML worksheets)
 * compatible with Microsoft Excel, LibreOffice Calc, and Google Sheets.
 */

export interface ExcelSheetData {
    name: string;
    headers?: string[];
    rows: Record<string, string | number | boolean | null | undefined>[] | (string | number | boolean | null | undefined)[][];
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function colIndexToLetter(index: number): string {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

function buildWorksheetXml(rowsInput: any[], explicitHeaders?: string[]): string {
    let rows: Record<string, any>[] = [];
    if (explicitHeaders && explicitHeaders.length > 0 && Array.isArray(rowsInput)) {
        rows = rowsInput.map((r) => {
            if (Array.isArray(r)) {
                const obj: Record<string, any> = {};
                explicitHeaders.forEach((h, i) => {
                    obj[h] = r[i];
                });
                return obj;
            }
            return r;
        });
    } else {
        rows = rowsInput as Record<string, any>[];
    }

    if (!rows || rows.length === 0) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>`;
    }

    const headers = explicitHeaders && explicitHeaders.length > 0 ? explicitHeaders : Object.keys(rows[0]);

    // Compute column widths
    const colWidths = headers.map((h) => {
        let maxLen = h.length;
        for (const r of rows) {
            const val = r[h];
            const len = val !== null && val !== undefined ? String(val).length : 0;
            if (len > maxLen) maxLen = len;
        }
        return Math.min(Math.max(maxLen + 4, 12), 45);
    });

    const colsXml = `<cols>${colWidths
        .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`;

    let sheetDataXml = '<sheetData>';

    // Header row (row 1, style s="1" bold header)
    sheetDataXml += `<row r="1">`;
    headers.forEach((h, cIdx) => {
        const ref = `${colIndexToLetter(cIdx)}1`;
        sheetDataXml += `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`;
    });
    sheetDataXml += `</row>`;

    // Data rows
    rows.forEach((row, rIdx) => {
        const rowNum = rIdx + 2;
        sheetDataXml += `<row r="${rowNum}">`;
        headers.forEach((h, cIdx) => {
            const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
            const val = row[h];
            if (typeof val === 'number' && Number.isFinite(val)) {
                sheetDataXml += `<c r="${ref}" t="n"><v>${val}</v></c>`;
            } else {
                const strVal = val !== null && val !== undefined ? String(val) : '';
                sheetDataXml += `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(strVal)}</t></is></c>`;
            }
        });
        sheetDataXml += `</row>`;
    });

    sheetDataXml += '</sheetData>';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  ${sheetDataXml}
</worksheet>`;
}

// Standard CRC-32 implementation for ZIP container
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function createZipStore(files: { path: string; content: string }[]): Uint8Array {
    const encoder = new TextEncoder();
    const entries = files.map((f) => {
        const nameBytes = encoder.encode(f.path);
        const dataBytes = encoder.encode(f.content);
        const crc = crc32(dataBytes);
        return { nameBytes, dataBytes, crc, offset: 0 };
    });

    let totalSize = 0;
    for (const e of entries) {
        e.offset = totalSize;
        totalSize += 30 + e.nameBytes.length + e.dataBytes.length;
    }
    const centralDirOffset = totalSize;
    let centralDirSize = 0;
    for (const e of entries) {
        centralDirSize += 46 + e.nameBytes.length;
    }
    totalSize += centralDirSize + 22;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const out = new Uint8Array(buffer);
    let pos = 0;

    // Local file headers + data
    for (const e of entries) {
        view.setUint32(pos, 0x04034b50, true); // Local file header signature
        view.setUint16(pos + 4, 20, true); // Version needed
        view.setUint16(pos + 6, 0x0800, true); // UTF-8 flag
        view.setUint16(pos + 8, 0, true); // Compression method: 0 (STORE)
        view.setUint16(pos + 10, 0, true); // Mod time
        view.setUint16(pos + 12, 0x21, true); // Mod date
        view.setUint32(pos + 14, e.crc, true); // CRC-32
        view.setUint32(pos + 18, e.dataBytes.length, true); // Compressed size
        view.setUint32(pos + 22, e.dataBytes.length, true); // Uncompressed size
        view.setUint16(pos + 26, e.nameBytes.length, true); // File name length
        view.setUint16(pos + 28, 0, true); // Extra field length
        pos += 30;
        out.set(e.nameBytes, pos);
        pos += e.nameBytes.length;
        out.set(e.dataBytes, pos);
        pos += e.dataBytes.length;
    }

    // Central directory
    for (const e of entries) {
        view.setUint32(pos, 0x02014b50, true); // Central file header signature
        view.setUint16(pos + 4, 20, true); // Version made by
        view.setUint16(pos + 6, 20, true); // Version needed
        view.setUint16(pos + 8, 0x0800, true); // UTF-8 flag
        view.setUint16(pos + 10, 0, true); // Compression method: 0 (STORE)
        view.setUint16(pos + 12, 0, true); // Mod time
        view.setUint16(pos + 14, 0x21, true); // Mod date
        view.setUint32(pos + 16, e.crc, true); // CRC-32
        view.setUint32(pos + 20, e.dataBytes.length, true); // Compressed size
        view.setUint32(pos + 24, e.dataBytes.length, true); // Uncompressed size
        view.setUint16(pos + 28, e.nameBytes.length, true); // File name length
        view.setUint16(pos + 30, 0, true); // Extra length
        view.setUint16(pos + 32, 0, true); // Comment length
        view.setUint16(pos + 34, 0, true); // Disk number
        view.setUint16(pos + 36, 0, true); // Internal attrs
        view.setUint32(pos + 38, 0, true); // External attrs
        view.setUint32(pos + 42, e.offset, true); // Relative offset of local header
        pos += 46;
        out.set(e.nameBytes, pos);
        pos += e.nameBytes.length;
    }

    // End of central directory record
    view.setUint32(pos, 0x06054b50, true);
    view.setUint16(pos + 4, 0, true);
    view.setUint16(pos + 6, 0, true);
    view.setUint16(pos + 8, entries.length, true);
    view.setUint16(pos + 10, entries.length, true);
    view.setUint32(pos + 12, centralDirSize, true);
    view.setUint32(pos + 16, centralDirOffset, true);
    view.setUint16(pos + 20, 0, true);

    return out;
}

export function downloadExcelWorkbook(filename: string, sheets: ExcelSheetData[]): void {
    const safeSheets = sheets.map((s, idx) => ({
        name: s.name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || `Hoja${idx + 1}`,
        headers: s.headers,
        rows: s.rows
    }));

    const files: { path: string; content: string }[] = [];

    // [Content_Types].xml
    files.push({
        path: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
      .map(
          (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('\n  ')}
</Types>`
    });

    // _rels/.rels
    files.push({
        path: '_rels/.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    });

    // xl/workbook.xml
    files.push({
        path: 'xl/workbook.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
        .map(
            (s, i) =>
                `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        )
        .join('\n    ')}
  </sheets>
</workbook>`
    });

    // xl/_rels/workbook.xml.rels
    files.push({
        path: 'xl/_rels/workbook.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
      .map(
          (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('\n  ')}
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    });

    // xl/styles.xml (s="0" default, s="1" bold header with light gray fill)
    files.push({
        path: 'xl/styles.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`
    });

    // Worksheets
    safeSheets.forEach((s, i) => {
        files.push({
            path: `xl/worksheets/sheet${i + 1}.xml`,
            content: buildWorksheetXml(s.rows as any[], s.headers)
        });
    });

    const zipBytes = createZipStore(files);
    const blob = new Blob([zipBytes as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
