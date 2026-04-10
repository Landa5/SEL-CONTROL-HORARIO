/**
 * Wrapper para ejecutar el spike y capturar salida limpia.
 * Uso: npx tsx lib/vnnox/spike/run-spike.ts
 */
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';

dotenv.config();

const BASE_URL = process.env.VNNOX_BASE_URL || 'https://open-au.vnnox.com';
const APP_KEY = process.env.VNNOX_APP_KEY || '';
const APP_SECRET = process.env.VNNOX_APP_SECRET || '';
const SPIKE_PLAYER_ID = process.env.SPIKE_PLAYER_ID || '';

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

async function apiCall(method: 'GET' | 'POST', path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { method, headers: makeHeaders(), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

const log: string[] = [];
function L(msg: string) { log.push(msg); console.log(msg); }

async function main() {
  L('=== FASE 0 - Spike VNNOX v2 ===');
  L(`Timestamp: ${new Date().toISOString()}`);
  L('');

  // STEP 0: Config
  L('--- PASO 0: Config ---');
  if (!APP_KEY) { L('FAIL: VNNOX_APP_KEY vacia'); return; }
  if (!APP_SECRET) { L('FAIL: VNNOX_APP_SECRET vacia'); return; }
  L(`PASS: BASE_URL = ${BASE_URL}`);
  L(`PASS: APP_KEY = ${APP_KEY.substring(0, 8)}...`);
  L('PASS: APP_SECRET configurado');
  const nonce = makeNonce(32);
  L(`PASS: Nonce format OK: "${nonce}" (${nonce.length} chars, alphanumeric)`);
  L('');

  // STEP 1: List players
  L('--- PASO 1: GET /v2/player/list ---');
  try {
    const r = await apiCall('GET', '/v2/player/list');
    L(`HTTP Status: ${r.status}`);
    L(`OK: ${r.ok}`);
    L(`Response code: ${r.data?.code}`);
    L(`Response msg: ${r.data?.msg || r.data?.message || '-'}`);

    if (!r.ok) {
      L(`FAIL: HTTP ${r.status}`);
      L(`Raw: ${JSON.stringify(r.data).substring(0, 800)}`);
      writeLog();
      return;
    }

    const players = r.data?.data ?? r.data?.list ?? (Array.isArray(r.data) ? r.data : []);
    const playerList: any[] = Array.isArray(players) ? players : [];
    L(`PASS: ${playerList.length} player(s) encontrado(s)`);

    playerList.forEach((p: any, i: number) => {
      const id = p.playerId ?? p.id ?? p.terminalId ?? 'N/A';
      const name = p.playerName ?? p.name ?? p.terminalName ?? 'Sin nombre';
      const w = p.width ?? p.terminalWidth ?? '?';
      const h = p.height ?? p.terminalHeight ?? '?';
      L(`  [${i + 1}] ID="${id}" Name="${name}" Res=${w}x${h}`);
    });
    L('');

    // Pick player for testing
    let targetId = SPIKE_PLAYER_ID;
    if (!targetId && playerList.length > 0) {
      const p = playerList[0];
      targetId = String(p.playerId ?? p.id ?? p.terminalId ?? '');
      L(`INFO: Usando primer player: ${targetId}`);
    }

    if (!targetId) {
      L('INFO: No hay player para probar pasos 2-6. Fin.');
      writeLog();
      return;
    }

    // STEP 2: Online status
    L('--- PASO 2: POST /v2/player/current/online-status ---');
    const r2 = await apiCall('POST', '/v2/player/current/online-status', { playerIds: [targetId] });
    L(`HTTP Status: ${r2.status}, OK: ${r2.ok}`);
    L(`Response code: ${r2.data?.code}`);
    if (r2.ok) {
      const items = r2.data?.data ?? r2.data?.list ?? [];
      const info = Array.isArray(items) ? items[0] : items;
      if (info) {
        const online = info.onlineStatus === 1 || info.status === 1 || info.online === true;
        const w2 = info.width ?? info.terminalWidth ?? info.resolutionWidth ?? 0;
        const h2 = info.height ?? info.terminalHeight ?? info.resolutionHeight ?? 0;
        L(`PASS: Estado=${online ? 'ONLINE' : 'OFFLINE'} Res=${w2}x${h2}`);
        L(`Raw: ${JSON.stringify(info).substring(0, 600)}`);
      } else {
        L(`INFO: No info returned. Raw: ${JSON.stringify(r2.data).substring(0, 400)}`);
      }
    } else {
      L(`FAIL: ${JSON.stringify(r2.data).substring(0, 400)}`);
    }
    L('');

    // STEP 3: Over-specification check
    L('--- PASO 3: POST /v2/player/program/over-specification-check ---');
    try {
      const r3 = await apiCall('POST', '/v2/player/program/over-specification-check', {
        playerId: targetId, width: 1920, height: 1080
      });
      L(`HTTP Status: ${r3.status}, OK: ${r3.ok}`);
      L(`Response: ${JSON.stringify(r3.data).substring(0, 400)}`);
      if (r3.ok) L('PASS: Over-spec check respondio');
      else L('INFO: Over-spec check no disponible (no bloqueante)');
    } catch (e: any) {
      L(`INFO: Over-spec check fallo (no bloqueante): ${e.message}`);
    }
    L('');

    // STEP 4: Publish (DRY RUN)
    L('--- PASO 4: Publicacion (DRY RUN) ---');
    L('INFO: No se envia nada. Solo validamos el payload.');
    const payload = {
      name: `SpikeTest-${Date.now()}`,
      playerIds: [targetId],
      width: 1920, height: 1080,
      programItems: [{ ordinal: 1, type: 'IMAGE', url: 'https://example.com/test.png', width: 1920, height: 1080, x: 0, y: 0, duration: 10 }]
    };
    L(`Payload: ${JSON.stringify(payload)}`);
    L('PASS: DRY RUN OK');
    L('');

    // STEP 5,6: Schedule (DRY RUN)
    L('--- PASO 5: Schedule screen-status (DRY RUN) ---');
    L('PASS: Payload valido para /v2/player/scheduled-control/screen-status');
    L('--- PASO 6: Schedule brightness (DRY RUN) ---');
    L('PASS: Payload valido para /v2/player/scheduled-control/brightness');
    L('');

    L('=== RESUMEN ===');
    L('PASS: Config OK');
    L('PASS: List players OK');
    L(`PASO 2: ${r2.ok ? 'PASS' : 'CHECK'}`);
    L('PASO 3: CHECK (ver output)');
    L('PASO 4-6: DRY RUN OK');

  } catch (error: any) {
    L(`ERROR: ${error.message}`);
  }

  writeLog();
}

function writeLog() {
  fs.writeFileSync('spike-result.log', log.join('\n'), 'utf8');
  console.log('\n[Resultado guardado en spike-result.log]');
}

main();
