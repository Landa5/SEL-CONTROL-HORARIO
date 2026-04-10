/**
 * Diagnóstico: dump raw de todos los endpoints VNNOX v2
 * Muestra la respuesta cruda sin parsear para identificar la estructura real.
 */
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';

dotenv.config();

const BASE_URL = process.env.VNNOX_BASE_URL || 'https://open-au.vnnox.com';
const APP_KEY = process.env.VNNOX_APP_KEY || '';
const APP_SECRET = process.env.VNNOX_APP_SECRET || '';

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function makeNonce(len = 32): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += NONCE_CHARS[bytes[i] % NONCE_CHARS.length];
  return s;
}

function makeHeaders() {
  const nonce = makeNonce(32);
  const curTime = Math.floor(Date.now() / 1000).toString();
  const checkSum = crypto.createHash('sha256').update(APP_SECRET + nonce + curTime, 'utf8').digest('hex');
  return { 'AppKey': APP_KEY, 'Nonce': nonce, 'CurTime': curTime, 'CheckSum': checkSum, 'Content-Type': 'application/json' };
}

interface CallResult {
  endpoint: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  body?: any;
  rawText: string;
}

async function apiCall(method: 'GET' | 'POST', path: string, body?: unknown): Promise<CallResult> {
  const url = `${BASE_URL}${path}`;
  const headers = makeHeaders();
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(rawText); } catch { parsed = null; }

  // Capture response headers
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { respHeaders[k] = v; });

  return {
    endpoint: `${method} ${path}`,
    method,
    status: res.status,
    headers: respHeaders,
    body: parsed,
    rawText,
  };
}

const log: string[] = [];
function L(msg: string) { log.push(msg); console.log(msg); }

async function main() {
  L('=== DIAGNOSTICO VNNOX v2 - Raw Dump ===');
  L(`Timestamp: ${new Date().toISOString()}`);
  L(`Base URL: ${BASE_URL}`);
  L(`AppKey: ${APP_KEY.substring(0, 8)}...`);
  L('');

  // 1) GET /v2/player/list
  L('========================================');
  L('1) GET /v2/player/list');
  L('========================================');
  const r1 = await apiCall('GET', '/v2/player/list');
  L(`HTTP ${r1.status}`);
  L(`Response Headers: ${JSON.stringify(r1.headers, null, 2)}`);
  L(`Raw Body: ${r1.rawText}`);
  L(`Parsed keys: ${r1.body ? Object.keys(r1.body).join(', ') : 'N/A'}`);
  if (r1.body?.data) L(`data type: ${typeof r1.body.data}, isArray: ${Array.isArray(r1.body.data)}`);
  if (r1.body?.data && typeof r1.body.data === 'object') {
    L(`data keys: ${Object.keys(r1.body.data).join(', ')}`);
    if (r1.body.data.list) L(`data.list length: ${r1.body.data.list?.length}`);
    if (r1.body.data.total !== undefined) L(`data.total: ${r1.body.data.total}`);
  }
  L('');

  // 2) POST /v2/player/list (some APIs need POST)
  L('========================================');
  L('2) POST /v2/player/list');
  L('========================================');
  const r2 = await apiCall('POST', '/v2/player/list', {});
  L(`HTTP ${r2.status}`);
  L(`Raw Body: ${r2.rawText}`);
  L('');

  // 3) POST /v2/player/list con paginacion
  L('========================================');
  L('3) POST /v2/player/list {currentPage:1, pageSize:100}');
  L('========================================');
  const r3 = await apiCall('POST', '/v2/player/list', { currentPage: 1, pageSize: 100 });
  L(`HTTP ${r3.status}`);
  L(`Raw Body: ${r3.rawText}`);
  L('');

  // 4) GET /v2/player/list con query params
  L('========================================');
  L('4) GET /v2/player/list?currentPage=1&pageSize=100');
  L('========================================');
  const r4 = await apiCall('GET', '/v2/player/list?currentPage=1&pageSize=100');
  L(`HTTP ${r4.status}`);
  L(`Raw Body: ${r4.rawText}`);
  L('');

  // 5) Probar endpoint alternativo /v1/
  L('========================================');
  L('5) GET /v1/player/list');
  L('========================================');
  try {
    const r5 = await apiCall('GET', '/v1/player/list');
    L(`HTTP ${r5.status}`);
    L(`Raw Body: ${r5.rawText.substring(0, 500)}`);
  } catch (e: any) { L(`Error: ${e.message}`); }
  L('');

  // 6) Probar /v2/player con SN conocido
  L('========================================');
  L('6) POST /v2/player/current/online-status {playerIds:["2ZTA54I20W2A10002575"]}');
  L('========================================');
  const r6 = await apiCall('POST', '/v2/player/current/online-status', {
    playerIds: ['2ZTA54I20W2A10002575']
  });
  L(`HTTP ${r6.status}`);
  L(`Raw Body: ${r6.rawText}`);
  L('');

  // 7) Probar con SN como terminalId
  L('========================================');
  L('7) POST /v2/player/current/online-status con nombres alternativos');
  L('========================================');
  const r7 = await apiCall('POST', '/v2/player/current/online-status', {
    terminalIds: ['2ZTA54I20W2A10002575']
  });
  L(`HTTP ${r7.status}`);
  L(`Raw Body: ${r7.rawText}`);
  L('');

  // 8) Probar endpoint de pantallas (screen vs player)
  L('========================================');
  L('8) GET /v2/screen/list');
  L('========================================');
  try {
    const r8 = await apiCall('GET', '/v2/screen/list');
    L(`HTTP ${r8.status}`);
    L(`Raw Body: ${r8.rawText.substring(0, 500)}`);
  } catch (e: any) { L(`Error: ${e.message}`); }
  L('');

  // 9) Probar /v2/terminal/list
  L('========================================');
  L('9) GET /v2/terminal/list');
  L('========================================');
  try {
    const r9 = await apiCall('GET', '/v2/terminal/list');
    L(`HTTP ${r9.status}`);
    L(`Raw Body: ${r9.rawText.substring(0, 500)}`);
  } catch (e: any) { L(`Error: ${e.message}`); }
  L('');

  // Write full log
  fs.writeFileSync('spike-diag.log', log.join('\n'), 'utf8');
  L('\n[Diagnostico guardado en spike-diag.log]');
}

main().catch(e => { console.error('Fatal:', e); });
