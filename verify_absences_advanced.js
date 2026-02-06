
const http = require('http');

function request(path, method, body, cookie) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
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
    console.log('--- LOGIN AS ADMIN ---');
    const loginRes = await request('/api/auth/login', 'POST', { usuario: 'admin', password: '1234' });
    const cookie = loginRes.headers['set-cookie']?.[0].split(';')[0];

    if (!cookie) {
        console.error('Login failed, trying admin123...');
        // Retry with alternative password if 1234 fails (seed might have used admin123)
        const loginRes2 = await request('/api/auth/login', 'POST', { usuario: 'admin', password: 'admin123' });
        const cookie2 = loginRes2.headers['set-cookie']?.[0].split(';')[0];
        if (!cookie2) {
            console.error('Login completely failed');
            return;
        }
        console.log('Login OK with admin123');
        await runTests(cookie2);
    } else {
        console.log('Login OK with 1234');
        await runTests(cookie);
    }
}

async function runTests(cookie) {
    console.log('\n--- FETCH ABSENCE STATS ---');
    const res = await request('/api/ausencias/stats', 'GET', null, cookie);
    console.log('Status:', res.status);

    try {
        const stats = JSON.parse(res.body);
        if (Array.isArray(stats)) {
            console.log(`Received stats for ${stats.length} employees.`);
            stats.forEach(emp => {
                console.log(`\nEmployee: ${emp.nombre} (${emp.usuario})`);
                console.log(`- Total Days: ${emp.totalVacaciones}`);
                console.log(`- Used (Approved): ${emp.diasDisfrutados}`);
                console.log(`- Pending Requests: ${emp.diasSolicitados}`);
                console.log(`- Remaining: ${emp.diasRestantes}`);
                console.log(`- Absence Records: ${emp.ausencias.length}`);
            });
        } else {
            console.log('Response is not an array:', res.body);
        }
    } catch (e) {
        console.error('Error parsing JSON:', e);
        console.log('Raw body:', res.body);
    }
}

main().catch(console.error);
