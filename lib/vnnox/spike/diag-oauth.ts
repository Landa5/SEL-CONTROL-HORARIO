/**
 * Diagnóstico 3: API v1 OAuth + servidor EU
 * 
 * Flujo v1:
 *   1. POST /v1/oauth/token → obtener access_token
 *   2. Usar Bearer token en las llamadas
 * 
 * Servidor: https://api-eu.vnnox.com
 */
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';

dotenv.config();

// Credenciales v1 OAuth
const V1_BASE = 'https://api-eu.vnnox.com';
const USERNAME = 'SELSA';
const PASSWORD = 'p327ut';

// Credenciales v2 CheckSum (probar también contra servidor EU)
const APP_KEY = process.env.VNNOX_APP_KEY || '';
const APP_SECRET = process.env.VNNOX_APP_SECRET || '';

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function makeNonce(len = 32): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += NONCE_CHARS[bytes[i] % NONCE_CHARS.length];
  return s;
}
function makeV2Headers(baseUrl: string = V1_BASE) {
  const nonce = makeNonce(32);
  const curTime = Math.floor(Date.now() / 1000).toString();
  const checkSum = crypto.createHash('sha256').update(APP_SECRET + nonce + curTime, 'utf8').digest('hex');
  return { 'AppKey': APP_KEY, 'Nonce': nonce, 'CurTime': curTime, 'CheckSum': checkSum, 'Content-Type': 'application/json' };
}

const log: string[] = [];
function L(msg: string) { log.push(msg); console.log(msg); }

async function rawCall(method: string, url: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: res.status, data: parsed, rawText: text, ok: res.ok };
}

async function main() {
  L('=== DIAGNOSTICO 3: Servidor EU + OAuth v1 ===');
  L(`Servidor: ${V1_BASE}`);
  L(`Usuario: ${USERNAME}`);
  L(`Timestamp: ${new Date().toISOString()}`);
  L('');

  // ========================================
  // PARTE A: OAuth v1 — obtener token
  // ========================================
  L('========================================');
  L('A1) POST /v1/oauth/token (username+password)');
  L('========================================');

  // Probar con JSON body
  const r1 = await rawCall('POST', `${V1_BASE}/v1/oauth/token`, {
    'Content-Type': 'application/json',
  }, {
    username: USERNAME,
    password: PASSWORD,
  });
  L(`HTTP ${r1.status}: ${r1.rawText.substring(0, 500)}`);
  L('');

  // Probar con form-urlencoded (algunos OAuth servers lo requieren)
  L('A2) POST /v1/oauth/token (form-urlencoded)');
  const r2 = await rawCall('POST', `${V1_BASE}/v1/oauth/token`, {
    'Content-Type': 'application/x-www-form-urlencoded',
  }, undefined);
  // Manual form body
  const r2b = await fetch(`${V1_BASE}/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`,
  });
  const r2bText = await r2b.text();
  L(`HTTP ${r2b.status}: ${r2bText.substring(0, 500)}`);
  L('');

  // Probar con grant_type
  L('A3) POST /v1/oauth/token con grant_type=password');
  const r3 = await fetch(`${V1_BASE}/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=password&username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}`,
  });
  const r3Text = await r3.text();
  L(`HTTP ${r3.status}: ${r3Text.substring(0, 500)}`);
  L('');

  // Probar con JSON + grant_type
  L('A4) POST /v1/oauth/token JSON con grant_type');
  const r4 = await rawCall('POST', `${V1_BASE}/v1/oauth/token`, {
    'Content-Type': 'application/json',
  }, {
    grant_type: 'password',
    username: USERNAME,
    password: PASSWORD,
  });
  L(`HTTP ${r4.status}: ${r4.rawText.substring(0, 500)}`);
  L('');

  // ========================================
  // Extraer token si alguno funciono
  // ========================================
  let token = '';
  for (const r of [r1, r4]) {
    if (r.data?.access_token) { token = r.data.access_token; break; }
    if (r.data?.token) { token = r.data.token; break; }
    if (r.data?.data?.access_token) { token = r.data.data.access_token; break; }
    if (r.data?.data?.token) { token = r.data.data.token; break; }
  }
  // Check form-urlencoded responses
  try {
    const parsed3 = JSON.parse(r3Text);
    if (parsed3?.access_token) token = parsed3.access_token;
    if (parsed3?.token) token = parsed3.token;
    if (parsed3?.data?.access_token) token = parsed3.data.access_token;
  } catch {}
  try {
    const parsed2 = JSON.parse(r2bText);
    if (parsed2?.access_token) token = parsed2.access_token;
    if (parsed2?.token) token = parsed2.token;
    if (parsed2?.data?.access_token) token = parsed2.data.access_token;
  } catch {}

  if (token) {
    L(`TOKEN OBTENIDO: ${token.substring(0, 30)}...`);
    L('');

    // ========================================
    // PARTE B: Usar token para listar players
    // ========================================
    L('========================================');
    L('B1) GET /v1/player/list con Bearer token');
    L('========================================');
    const rb1 = await rawCall('GET', `${V1_BASE}/v1/player/list`, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    L(`HTTP ${rb1.status}: ${rb1.rawText.substring(0, 800)}`);
    L('');

    L('B2) GET /v1/players con Bearer token');
    const rb2 = await rawCall('GET', `${V1_BASE}/v1/players`, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    L(`HTTP ${rb2.status}: ${rb2.rawText.substring(0, 800)}`);
    L('');

    L('B3) GET /v2/player/list con Bearer token');
    const rb3 = await rawCall('GET', `${V1_BASE}/v2/player/list`, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    L(`HTTP ${rb3.status}: ${rb3.rawText.substring(0, 800)}`);
    L('');

    // Online status con token
    L('B4) POST /v1/player/current/online-status con Bearer token');
    const rb4 = await rawCall('POST', `${V1_BASE}/v1/player/current/online-status`, {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }, { playerSns: ['2ZTA54I20W2A10002575'] });
    L(`HTTP ${rb4.status}: ${rb4.rawText.substring(0, 800)}`);
    L('');

  } else {
    L('NO SE OBTUVO TOKEN. Probando checksum auth contra servidor EU...');
    L('');
  }

  // ========================================
  // PARTE C: v2 CheckSum auth contra servidor EU
  // ========================================
  L('========================================');
  L('C1) GET /v2/player/list con CheckSum contra api-eu');
  L('========================================');
  const rc1 = await rawCall('GET', `${V1_BASE}/v2/player/list`, makeV2Headers());
  L(`HTTP ${rc1.status}: ${rc1.rawText.substring(0, 500)}`);
  L('');

  fs.writeFileSync('spike-diag3.log', log.join('\n'), 'utf8');
  L('\n[Guardado en spike-diag3.log]');
}

main().catch(e => console.error('Fatal:', e));
