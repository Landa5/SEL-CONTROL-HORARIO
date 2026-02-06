import { prisma } from '@/lib/prisma';

// Helper to get active tariff for a concept, role, and employee
// Returns value (float)
async function getTarifaValue(conceptoCodigo: string, rol: string, empleadoId: number, date: Date): Promise<number> {
    const concepto = await prisma.conceptoNomina.findUnique({
        where: { codigo: conceptoCodigo }
    });
    if (!concepto) return 0;

    // Hierarchy: Empleado > Rol > Global
    // Fetch all active tariffs for this concept
    const tariffs = await prisma.tarifaNomina.findMany({
        where: {
            conceptoId: concepto.id,
            activo: true,
            // Check date range if needed, but 'activo' flag is main driver for MVP
        }
    });

    // 1. Employee specific
    const empTariff = tariffs.find(t => t.empleadoId === empleadoId);
    if (empTariff) return empTariff.valor;

    // 2. Role specific
    const rolTariff = tariffs.find(t => t.rol === rol);
    if (rolTariff) return rolTariff.valor;

    // 3. Global
    const globalTariff = tariffs.find(t => t.rol === null && t.empleadoId === null);
    if (globalTariff) return globalTariff.valor;

    return 0;
}

export async function calcularNominaEmpleado(empleadoId: number, year: number, month: number) {
    const empleado = await prisma.empleado.findUnique({
        where: { id: empleadoId },
        include: { comercialLitros: { where: { year, month } } }
    });
    if (!empleado) throw new Error('Empleado no encontrado');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const lineas = [];

    // --- COMMON DATA ---

    // --- GLOBAL TARIFFS PRE-FETCH ---
    // Fetch generic 'DIETAS' tariff to see if there is a fixed override/value for calculations
    const dietasFijasValue = await getTarifaValue('DIETAS', empleado.rol, empleadoId, startDate);

    // --- ROLE SPECIFIC LOGIC ---

    if (empleado.rol === 'CONDUCTOR' || empleado.rol === 'MECANICO') {
        // 1. Get Shifts
        const jornadas = await prisma.jornadaLaboral.findMany({
            where: {
                empleadoId,
                fecha: { gte: startDate, lte: endDate }
            },
            include: { usosCamion: true }
        });

        let totalKm = 0;
        let totalDescargas = 0;
        let totalViajes = 0;

        jornadas.forEach(j => {
            j.usosCamion.forEach(u => {
                totalKm += (u.kmRecorridos || 0);
                totalDescargas += (u.descargasCount || 0);
                totalViajes += (u.viajesCount || 0);
            });
        });

        // 2. Prices
        const pKm = await getTarifaValue('PRECIO_KM', empleado.rol, empleadoId, startDate);
        const pDescarga = await getTarifaValue('PRECIO_DESCARGA', empleado.rol, empleadoId, startDate);
        const pViaje = await getTarifaValue('PRECIO_VIAJE', empleado.rol, empleadoId, startDate);

        // 3. Variables Calculation (Accumulate to Pot, do NOT add lines yet)
        const impKm = totalKm * pKm;
        const impDescargas = totalDescargas * pDescarga;
        const impViajes = totalViajes * pViaje;

        // Note: We do NOT push 'KM', 'DESCARGA', 'VIAJE' lines because they are transformed into Dietas/Prod/Disp.
        let totalPot = impKm + impDescargas + impViajes;

        // Add Fixed Diets/Base if exists (User said "sumar dietas + km")
        if (dietasFijasValue > 0) {
            totalPot += dietasFijasValue;
        }

        // 4. Absences / Deductions
        // Fetch approved absences for this month
        const ausencias = await prisma.ausencia.findMany({
            where: {
                empleadoId: empleadoId,
                estado: 'APROBADA',
                fechaInicio: { lte: endDate },
                fechaFin: { gte: startDate }
            }
        });

        let diasAusencia = 0;
        let diasVacaciones = 0;

        ausencias.forEach(a => {
            const start = a.fechaInicio < startDate ? startDate : a.fechaInicio;
            const end = a.fechaFin > endDate ? endDate : a.fechaFin;
            const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const days = Math.max(0, diff);

            if (a.tipo === 'VACACIONES') {
                diasVacaciones += days;
            } else {
                diasAusencia += days;
            }
        });

        // 5. Distribution Logic
        // "Repartir entre dietas, horas de presencia y productividad"
        // "Dietas no exceder tope"

        const topeDieta = await getTarifaValue('DIETA_TOPE', empleado.rol, empleadoId, startDate) || 375;

        // Dietas = Min(Tope, Pot)
        const dietasToPay = Math.min(topeDieta, Math.max(0, totalPot));

        // Remainder
        const resto = Math.max(0, totalPot - dietasToPay);

        // Availability / Productivity (50/50 of remainder)
        // Availability / Productivity (Configurable Percentage)
        // Get configured Percentage for Productivity (0-100)
        let pctProd = await getTarifaValue('PORCENTAJE_PRODUCTIVIDAD', empleado.rol, empleadoId, startDate);
        if (pctProd <= 0 && pctProd !== 0) pctProd = 50; // If undefined/negative, default to 50. Allow 0.
        // If it returns 0 exactly, it might mean "not found" or "0%". 
        // Our getTarifaValue returns 0 if not found. 
        // Ideally we should distinguish "not found" vs "0". 
        // But for now, if 0 is returned, we assume it's 50% default unless 0 is explicitly desired?
        // Let's assume if 0 => Default 50%. User has to put 0.01 if they want ~0 or we change logic.
        // Actually, let's treat 0 as "Default".
        if (pctProd === 0) pctProd = 50;

        const factorProd = pctProd / 100;
        const factorDisp = 1 - factorProd;

        const disp = resto * factorDisp;
        let prod = resto * factorProd;

        // Apply Deductions
        let totalDeduction = 0;
        let deductionNotes = [];

        if (diasAusencia > 0) {
            const pAusencia = await getTarifaValue('DESCUENTO_AUSENCIA', empleado.rol, empleadoId, startDate);
            totalDeduction += diasAusencia * pAusencia;
            deductionNotes.push(`${diasAusencia} ausencias`);
        }

        if (diasVacaciones > 0) {
            const pVacaciones = await getTarifaValue('DESCUENTO_VACACIONES', empleado.rol, empleadoId, startDate);
            totalDeduction += diasVacaciones * pVacaciones;
            deductionNotes.push(`${diasVacaciones} vacaciones`);
        }

        if (totalDeduction > 0) {
            prod = Math.max(0, prod - totalDeduction);
        }

        // Generate Final Lines
        // Add info about origin in Dietas note
        const originNote = `Gen: ${totalKm}km, ${totalDescargas}desc, ${totalViajes}viaj` +
            (dietasFijasValue > 0 ? ` + Base ${dietasFijasValue}` : '') +
            (totalDeduction > 0 ? ` - ${deductionNotes.join(', ')}` : '');

        if (dietasToPay > 0) {
            lineas.push({ codigo: 'DIETAS', nombre: 'Dietas', cantidad: 1, rate: dietasToPay, importe: dietasToPay, notas: originNote });
        }

        if (disp > 0) {
            lineas.push({ codigo: 'DISPONIBILIDAD', nombre: 'Disponibilidad', cantidad: 1, rate: disp, importe: disp });
        }

        if (prod > 0) {
            const prodNote = totalDeduction > 0 ? `Dto por ${deductionNotes.join(' y ')}` : undefined;
            lineas.push({ codigo: 'PRODUCTIVIDAD', nombre: 'Productividad', cantidad: 1, rate: prod, importe: prod, notas: prodNote });
        }

    } else if (empleado.rol === 'OFICINA') {
        // Extras
        const extras = empleado.horasExtra || 0;
        if (extras > 0) {
            const pExtra = await getTarifaValue('HORAS_EXTRA', 'OFICINA', empleadoId, startDate);
            lineas.push({ codigo: 'HORAS_EXTRA', nombre: 'Horas Extra', cantidad: extras, rate: pExtra, importe: extras * pExtra });
        }
    } else if (empleado.rol === 'COMERCIAL') {
        // 1. Litros
        // Cast to any to avoid TS issues with 'include' (Prisma types work-around if needed)
        const litrosRecord = (empleado as any).comercialLitros?.[0];
        const litros = litrosRecord?.litros || 0;
        const pLitro = await getTarifaValue('PRECIO_LITRO', 'COMERCIAL', empleadoId, startDate);
        const impLitros = litros * pLitro;

        if (litros > 0) lineas.push({ codigo: 'LITROS_VENDIDOS', nombre: 'Variables Litros', cantidad: litros, rate: pLitro, importe: impLitros });

        // 2. Diets (Fixed typically)
        const dietasCom = await getTarifaValue('DIETAS_COMERCIAL', 'COMERCIAL', empleadoId, startDate);
        if (dietasCom > 0) lineas.push({ codigo: 'DIETAS_COMERCIAL', nombre: 'Dietas Comercial', cantidad: 1, rate: dietasCom, importe: dietasCom });
    }

    // --- GLOBAL CONCEPTS (ALL ROLES) ---

    // 1. PRODUCTIVIDAD_FIJA (Applies to anyone with this tariff)
    const prodFija = await getTarifaValue('PRODUCTIVIDAD_FIJA', empleado.rol, empleadoId, startDate);
    if (prodFija > 0) {
        lineas.push({ codigo: 'PRODUCTIVIDAD_FIJA', nombre: 'Productividad Fija', cantidad: 1, rate: prodFija, importe: prodFija });
    }

    // 2. INCENTIVOS
    const incentivos = await getTarifaValue('INCENTIVOS', empleado.rol, empleadoId, startDate);
    if (incentivos > 0) {
        lineas.push({ codigo: 'INCENTIVOS', nombre: 'Incentivos', cantidad: 1, rate: incentivos, importe: incentivos });
    }

    // 3. DIETAS (Fixed/Global) - Check if not already added by logic
    // This allows Admin/Office to have 'DIETAS' configured in tariffs and applied here if logic missed it.
    const hasDietas = lineas.some(l => l.codigo === 'DIETAS');
    if (!hasDietas) {
        const dietasFijas = await getTarifaValue('DIETAS', empleado.rol, empleadoId, startDate);
        if (dietasFijas > 0) {
            lineas.push({ codigo: 'DIETAS', nombre: 'Dietas', cantidad: 1, rate: dietasFijas, importe: dietasFijas });
        }
    }

    // 4. DIETAS_FIJAS (Specific Legacy/Override key)
    const dietasFijasKey = await getTarifaValue('DIETAS_FIJAS', empleado.rol, empleadoId, startDate);
    if (dietasFijasKey > 0) {
        lineas.push({ codigo: 'DIETAS_FIJAS', nombre: 'Dietas Fijas', cantidad: 1, rate: dietasFijasKey, importe: dietasFijasKey });
    }

    return lineas;
}
