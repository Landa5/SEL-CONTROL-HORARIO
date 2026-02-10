
const http = require('http');

function request(path, method, body, cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (cookie) {
            options.headers['Cookie'] = cookie;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const response = {
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                };
                resolve(response);
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('--- 1. Login as Admin ---');
    const loginRes = await request('/api/auth/login', 'POST', { usuario: 'admin', password: 'admin123' });
    console.log('Login Status:', loginRes.status);

    const setCookie = loginRes.headers['set-cookie'];
    if (!setCookie) {
        console.error('No cookie received!');
        console.log('Body:', loginRes.body);
        return;
    }
    const cookie = setCookie[0].split(';')[0];
    console.log('Cookie:', cookie);

    console.log('\n--- 2. Fetch Ausencias (view=all) ---');
    const ausenciasRes = await request('/api/ausencias?view=all', 'GET', null, cookie);
    console.log('Status:', ausenciasRes.status);
    console.log('Body:', ausenciasRes.body);

    console.log('\n--- 3. Fetch Tareas (estado=PENDIENTE) ---');
    const tareasRes = await request('/api/tareas?estado=PENDIENTE', 'GET', null, cookie);
    console.log('Status:', tareasRes.status);
    console.log('Body:', tareasRes.body);
}

main().catch(console.error);
