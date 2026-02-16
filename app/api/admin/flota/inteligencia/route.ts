import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const truckId = searchParams.get('truckId');

    try {
        let from = fromStr ? parseISO(fromStr) : startOfMonth(new Date());
        let to = toStr ? parseISO(toStr) : endOfMonth(new Date());

        if (!isValid(from)) from = startOfMonth(new Date());
        if (!isValid(to)) to = endOfMonth(new Date());

        // 1. Fetch Trucks
        const whereTruck: any = {
            activo: true
        };
        if (truckId) whereTruck.id = parseInt(truckId);

        const trucks = await prisma.camion.findMany({
            where: whereTruck,
            include: {
                usos: {
                    where: {
                        horaInicio: {
                            gte: from,
                            lte: to
                        }
                    }
                },
                historialMantenimientos: {
                    where: {
                        fecha: {
                            gte: from,
                            lte: to
                        }
                    }
                }
            }
        });

        // 2. Fetch Business Config for defaults
        const config = await prisma.configuracionNegocio.findFirst();
        // Default Fuel Price: 1.5€/L if not configured (We don't have a specific field yet, assume generic cost)
        // Or calculate average from descargas? Too complex. Use constant or config.
        const FUEL_PRICE = 1.65; // Placeholder avg price
        const DRIVER_COST_PER_HOUR = 18.50; // Placeholder avg cost (salary + social security)

        const report = trucks.map(truck => {
            // A. Calculate Usage Metrics
            let totalKm = 0;
            let totalFuelLitres = 0;
            let totalHours = 0;

            truck.usos.forEach(uso => {
                totalKm += (uso.kmRecorridos || 0);
                totalFuelLitres += (uso.litrosRepostados || 0);

                const start = new Date(uso.horaInicio).getTime();
                const end = uso.horaFin ? new Date(uso.horaFin).getTime() : new Date().getTime();
                totalHours += (end - start) / (1000 * 60 * 60);
            });

            // B. Calculate Maintenance Costs
            let maintenanceCost = 0;
            truck.historialMantenimientos.forEach(m => {
                maintenanceCost += (m.costo || 0);
            });

            // C. Cost Estimates
            const fuelCost = totalFuelLitres * FUEL_PRICE;
            const driverCost = totalHours * DRIVER_COST_PER_HOUR;

            const totalOperationalCost = fuelCost + maintenanceCost + driverCost;
            const costPerKm = totalKm > 0 ? (totalOperationalCost / totalKm) : 0;

            // D. Consumption (L/100km)
            const consumption = totalKm > 0 ? (totalFuelLitres / totalKm) * 100 : 0;

            return {
                id: truck.id,
                matricula: truck.matricula,
                brand: truck.marca,
                model: truck.modelo,
                period: { from, to },
                metrics: {
                    totalKm,
                    totalHours: parseFloat(totalHours.toFixed(2)),
                    consumptionL100: parseFloat(consumption.toFixed(2)),
                    trips: truck.usos.length
                },
                costs: {
                    fuel: parseFloat(fuelCost.toFixed(2)),
                    maintenance: parseFloat(maintenanceCost.toFixed(2)),
                    driverEstimado: parseFloat(driverCost.toFixed(2)),
                    total: parseFloat(totalOperationalCost.toFixed(2)),
                    perKm: parseFloat(costPerKm.toFixed(3))
                }
            };
        });

        return NextResponse.json(report);

    } catch (error: any) {
        console.error("Error generating fleet intelligence report:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
