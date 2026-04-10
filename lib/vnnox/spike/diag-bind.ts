/**
 * Diagnóstico 2: Buscar endpoint de bind y explorar estructura.
 * La pantalla existe en VNNOX UI pero /v2/player/list devuelve 0 rows.
 * Hipótesis: hay que vincular el player al API App (bind).
 */
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';

dotenv.config();

const BASE_URL = process.env.VNNOX_BASE_URL || 'https://open-au.vnnox.com';
const APP_KEY = process.env.VNNOX_APP_KEY || '';
const APP_SECRET = process.env.VNNOX_APP_SECRET || '';
const PLAYER_SN = '2ZTA54I20W2A10002575';

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

async function apiCall(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { method, headers: makeHeaders(), body: body ? JSON.stringify(body) : undefined });
  const rawText = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(rawText); } catch { parsed = null; }
  return { status: res.status, data: parsed, rawText, ok: res.ok };
}

const log: string[] = [];
function L(msg: string) { log.push(msg); console.log(msg); }

async function main() {
  L('=== DIAGNOSTICO 2: Bind y endpoints alternativos ===');
  L(`SN conocido: ${PLAYER_SN}`);
  L('');

  // 1) Intentar bind del player por SN
  const bindEndpoints = [
    { m: 'POST' as const, p: '/v2/player/bind', b: { playerSn: PLAYER_SN } },
    { m: 'POST' as const, p: '/v2/player/bind', b: { playerSns: [PLAYER_SN] } },
    { m: 'POST' as const, p: '/v2/player/bind', b: { sn: PLAYER_SN } },
    { m: 'PUT' as const,  p: '/v2/player/bind', b: { playerSn: PLAYER_SN } },
    { m: 'POST' as const, p: '/v2/player/register', b: { playerSn: PLAYER_SN } },
    { m: 'POST' as const, p: '/v2/player/register', b: { sn: PLAYER_SN } },
  ];

  for (const ep of bindEndpoints) {
    L(`--- ${ep.m} ${ep.p} ---`);
    L(`Body: ${JSON.stringify(ep.b)}`);
    const r = await apiCall(ep.m, ep.p, ep.b);
    L(`HTTP ${r.status}: ${r.rawText.substring(0, 300)}`);
    L('');
  }

  // 2) online-status con playerSns (NOT playerIds)
  L('--- POST /v2/player/current/online-status con playerSns ---');
  const r2 = await apiCall('POST', '/v2/player/current/online-status', { playerSns: [PLAYER_SN] });
  L(`HTTP ${r2.status}: ${r2.rawText}`);
  L('');

  // 3) Buscar info del player por endpoint alternativo
  const altEndpoints = [
    { m: 'GET' as const, p: `/v2/player/${PLAYER_SN}` },
    { m: 'GET' as const, p: `/v2/player/detail?sn=${PLAYER_SN}` },
    { m: 'GET' as const, p: `/v2/player/detail?playerSn=${PLAYER_SN}` },
    { m: 'POST' as const, p: '/v2/player/detail', b: { playerSn: PLAYER_SN } },
    { m: 'POST' as const, p: '/v2/player/info', b: { playerSn: PLAYER_SN } },
  ];

  for (const ep of altEndpoints) {
    L(`--- ${ep.m} ${ep.p} ---`);
    const r = await apiCall(ep.m, ep.p, (ep as any).b);
    L(`HTTP ${r.status}: ${r.rawText.substring(0, 300)}`);
    L('');
  }

  // 4) Explorar /v2/app endpoints (metadata del API App)
  const appEndpoints = [
    { m: 'GET' as const, p: '/v2/app/info' },
    { m: 'GET' as const, p: '/v2/app/player/list' },
    { m: 'GET' as const, p: '/v2/user/info' },
    { m: 'GET' as const, p: '/v2/workspace/list' },
    { m: 'GET' as const, p: '/v2/organization/info' },
  ];

  for (const ep of appEndpoints) {
    L(`--- ${ep.m} ${ep.p} ---`);
    const r = await apiCall(ep.m, ep.p);
    L(`HTTP ${r.status}: ${r.rawText.substring(0, 300)}`);
    L('');
  }

  fs.writeFileSync('spike-diag2.log', log.join('\n'), 'utf8');
  L('\n[Guardado en spike-diag2.log]');
}

main().catch(e => console.error('Fatal:', e));
