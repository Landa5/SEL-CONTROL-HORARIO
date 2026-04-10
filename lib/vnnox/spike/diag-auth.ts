/**
 * Diagnóstico 5: Intentar vincular player a la App
 * y explorar endpoints de autorización/workspace.
 */
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';

dotenv.config();

const BASE_URL = 'https://open-au.vnnox.com';
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

const log: string[] = [];
function L(msg: string) { log.push(msg); console.log(msg); }

async function tryCall(label: string, method: string, path: string, body?: unknown) {
  L(`--- ${method} ${path} ---`);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: makeHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    L(`  HTTP ${res.status}: ${text.substring(0, 500)}`);
    return { status: res.status, text };
  } catch (e: any) {
    L(`  ERROR: ${e.message}`);
    return { status: 0, text: '' };
  }
}

async function main() {
  L('=== DIAGNOSTICO 5: Bind player + endpoints de autorización ===');
  L('');

  // Endpoints de autorización/vinculación
  const endpoints = [
    // Player authorization
    { m: 'POST', p: '/v2/player/authorize', b: { playerSn: PLAYER_SN } },
    { m: 'POST', p: '/v2/player/authorize', b: { playerSns: [PLAYER_SN] } },
    { m: 'POST', p: '/v2/player/associate', b: { playerSn: PLAYER_SN } },
    { m: 'POST', p: '/v2/player/add', b: { playerSn: PLAYER_SN } },
    { m: 'POST', p: '/v2/player/add', b: { sn: PLAYER_SN } },
    { m: 'POST', p: '/v2/player/add', b: { sn: PLAYER_SN, name: 'Taurus-10002575' } },
    
    // Workspace/org info (para entender el contexto)
    { m: 'GET', p: '/v2/system/info' },
    { m: 'GET', p: '/v2/account/info' },
    { m: 'GET', p: '/v2/account/player/list' },
    
    // Quizá los players tienen un namespace diferente
    { m: 'GET', p: '/v2/player/list?status=1' },
    { m: 'GET', p: '/v2/player/list?all=true' },
    { m: 'GET', p: '/v2/player/list?includeUnbound=true' },
    
    // Probar con el nombre del player
    { m: 'GET', p: '/v2/player/list?name=Taurus-10002575' },
    { m: 'GET', p: '/v2/player/list?keyword=Taurus' },
    { m: 'GET', p: '/v2/player/list?sn=2ZTA54I20W2A10002575' },
    
    // Explorar documentación inline
    { m: 'GET', p: '/v2/doc' },
    { m: 'GET', p: '/v2/swagger' },
    { m: 'GET', p: '/doc' },
    { m: 'GET', p: '/swagger/v2/api-docs' },
    { m: 'GET', p: '/docs' },
  ];

  for (const ep of endpoints) {
    await tryCall(ep.p, ep.m, ep.p, (ep as any).b);
    L('');
  }

  fs.writeFileSync('spike-diag5.log', log.join('\n'), 'utf8');
  L('\n[Guardado en spike-diag5.log]');
}

main().catch(e => console.error('Fatal:', e));
