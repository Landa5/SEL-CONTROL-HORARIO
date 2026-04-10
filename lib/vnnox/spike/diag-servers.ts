/**
 * Diagnóstico 4: Probar TODOS los servidores conocidos VNNOX
 * El usuario tiene credenciales en EU pero el server api-eu no tiene módulos v1/v2.
 * Probamos todas las combinaciones posibles.
 */
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';

dotenv.config();

const APP_KEY = process.env.VNNOX_APP_KEY || '';
const APP_SECRET = process.env.VNNOX_APP_SECRET || '';
const USERNAME = 'SELSA';
const PASSWORD = 'p327ut';

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function makeNonce(len = 32): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += NONCE_CHARS[bytes[i] % NONCE_CHARS.length];
  return s;
}

function makeV2Headers() {
  const nonce = makeNonce(32);
  const curTime = Math.floor(Date.now() / 1000).toString();
  const checkSum = crypto.createHash('sha256').update(APP_SECRET + nonce + curTime, 'utf8').digest('hex');
  return { 'AppKey': APP_KEY, 'Nonce': nonce, 'CurTime': curTime, 'CheckSum': checkSum, 'Content-Type': 'application/json' };
}

const log: string[] = [];
function L(msg: string) { log.push(msg); console.log(msg); }

async function tryEndpoint(label: string, method: string, url: string, headers: Record<string, string>, body?: unknown) {
  L(`--- ${label} ---`);
  L(`  ${method} ${url}`);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    // Decode unicode escapes for readability
    let decoded = text;
    try {
      const parsed = JSON.parse(text);
      decoded = JSON.stringify(parsed);
    } catch {}
    L(`  HTTP ${res.status}: ${decoded.substring(0, 400)}`);
    return { status: res.status, text };
  } catch (e: any) {
    L(`  ERROR: ${e.message}`);
    return { status: 0, text: '' };
  }
}

async function main() {
  L('=== DIAGNOSTICO 4: Todas las combinaciones servidor/auth ===');
  L(`Timestamp: ${new Date().toISOString()}`);
  L('');

  // Servidores conocidos
  const servers = [
    'https://open-eu.vnnox.com',       // Open Platform EU
    'https://open-au.vnnox.com',       // Open Platform AU (actual)
    'https://open.vnnox.com',          // Open Platform global
    'https://api-eu.vnnox.com',        // API EU (ya probado)
    'https://api.vnnox.com',           // API global
    'https://open-us.vnnox.com',       // Open Platform US
  ];

  // Prueba 1: v2 CheckSum auth → GET /v2/player/list
  L('======================================');
  L('PRUEBA 1: v2 CheckSum auth contra cada servidor');
  L('======================================');
  
  for (const server of servers) {
    await tryEndpoint(
      `v2/player/list @ ${server}`,
      'GET',
      `${server}/v2/player/list`,
      makeV2Headers()
    );
    L('');
  }

  // Prueba 2: v1 OAuth token contra cada servidor
  L('======================================');
  L('PRUEBA 2: v1 OAuth token contra cada servidor');
  L('======================================');

  for (const server of servers) {
    const r = await tryEndpoint(
      `v1/oauth/token @ ${server}`,
      'POST',
      `${server}/v1/oauth/token`,
      { 'Content-Type': 'application/json' },
      { username: USERNAME, password: PASSWORD }
    );
    
    // Si obtiene token, intentar listar players
    if (r.status === 200) {
      try {
        const parsed = JSON.parse(r.text);
        const token = parsed?.access_token || parsed?.token || parsed?.data?.access_token || parsed?.data?.token || '';
        if (token) {
          L(`  TOKEN: ${token.substring(0, 30)}...`);
          await tryEndpoint(
            `v1/player/list con token @ ${server}`,
            'GET',
            `${server}/v1/player/list`,
            { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          );
        }
      } catch {}
    }
    L('');
  }

  // Prueba 3: CheckSum auth con SN del player como parametro
  L('======================================');
  L('PRUEBA 3: online-status con playerSns contra open-eu y open-au');
  L('======================================');

  for (const server of ['https://open-eu.vnnox.com', 'https://open-au.vnnox.com']) {
    await tryEndpoint(
      `online-status @ ${server}`,
      'POST',
      `${server}/v2/player/current/online-status`,
      makeV2Headers(),
      { playerSns: ['2ZTA54I20W2A10002575'] }
    );
    L('');
  }

  fs.writeFileSync('spike-diag4.log', log.join('\n'), 'utf8');
  L('\n[Guardado en spike-diag4.log]');
}

main().catch(e => console.error('Fatal:', e));
