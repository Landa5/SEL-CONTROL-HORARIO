
const http = require('http');

function request(path, method, body, cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (cookie) options.headers['Cookie'] = cookie;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('--- LOGIN AS OFICINA ---');
    const loginRes = await request('/api/auth/login', 'POST', { usuario: 'oficina', password: '1234' });
    const cookie = loginRes.headers['set-cookie']?.[0].split(';')[0];
    console.log('Login:', loginRes.status, cookie ? 'Cookie OK' : 'No cookie');

    if (!cookie) return;

    console.log('\n--- FETCH AUSENCIAS (view=all) ---');
    // Expecting to fail/empty if restriction is active
    const absRes = await request('/api/ausencias?view=all', 'GET', null, cookie);
    console.log('Ausencias:', absRes.status, absRes.body.length, 'bytes');
    console.log('Preview:', absRes.body.substring(0, 100));

    // Normal view (should return only own - which is likely 0)
    const absRes2 = await request('/api/ausencias', 'GET', null, cookie);
    console.log('Ausencias (Own):', absRes2.status, absRes2.body.length, 'bytes');

    console.log('\n--- FETCH TAREAS ---');
    // Expecting ALL tasks
    const tasksRes = await request('/api/tareas', 'GET', null, cookie);
    console.log('Tareas:', tasksRes.status, tasksRes.body.length, 'bytes');
    console.log('Preview:', tasksRes.body.substring(0, 100));
}

main().catch(console.error);
