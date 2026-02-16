const BASE_URL = 'http://localhost:3000';

async function verifyPhase3() {
    console.log('--- Verifying Phase 3 APIs ---');

    try {
        // 1. Intelligence Report
        console.log('\n1. Testing /api/admin/flota/inteligencia...');
        const resIntel = await fetch(`${BASE_URL}/api/admin/flota/inteligencia`);
        if (resIntel.ok) {
            const data = await resIntel.json();
            console.log('✅ Intelligence Report OK');
            console.log('   Trucks found:', data.length);
            if (data.length > 0) {
                console.log('   Sample Truck:', data[0].matricula);
                console.log('   Cost/KM:', data[0].costs.perKm);
            }
        } else {
            console.error('❌ Intelligence Report Failed:', resIntel.status, await resIntel.text());
        }

        // 2. Maintenance Records
        console.log('\n2. Testing /api/admin/flota/mantenimiento...');
        const resMaint = await fetch(`${BASE_URL}/api/admin/flota/mantenimiento`);
        if (resMaint.ok) {
            const data = await resMaint.json();
            console.log('✅ Maintenance List OK');
            console.log('   Records found:', data.length);
        } else {
            console.error('❌ Maintenance List Failed:', resMaint.status, await resMaint.text());
        }

        console.log('\n--- Verification Complete ---');

    } catch (error) {
        console.error('Execution Error:', error);
    }
}

verifyPhase3();
