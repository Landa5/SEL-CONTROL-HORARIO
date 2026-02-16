import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding training courses...');

    // Find an admin to be the creator
    const admin = await prisma.empleado.findFirst({
        where: { rol: 'ADMIN' }
    });

    if (!admin) {
        console.error('No admin found to create courses');
        return;
    }

    // Curso 1: Atención al Cliente
    const customerService = await prisma.moduloFormacion.create({
        data: {
            titulo: 'Atención al Cliente y Protocolo',
            descripcion: 'Curso fundamental para conductores y personal sobre cómo interactuar profesionalmente con clientes, gestionar conflictos y representar a la empresa.',
            fechaInicio: new Date(),
            fechaFin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year validity
            duracionEstimada: 45,
            activo: true,
            creadoPorId: admin.id,
            temas: {
                create: [
                    {
                        titulo: 'Introducción al Servicio al Cliente',
                        contenido: 'El servicio al cliente no es solo departamental, es una actitud. Cada interacción cuenta.',
                        orden: 1,
                        tipo: 'TEXTO'
                    },
                    {
                        titulo: 'Protocolo de Entrega',
                        contenido: '1. Saludar presentándose. 2. Confirmar mercancía. 3. Solicitar firma/sello. 4. Despedirse cordialmente.',
                        orden: 2,
                        tipo: 'TEXTO'
                    },
                    {
                        titulo: 'Gestión de Quejas',
                        contenido: 'Escuchar activamente, no interrumpir, pedir disculpas por las molestias (no necesariamente admitir culpa si no la hay) y ofrecer solución o escalar.',
                        orden: 3,
                        tipo: 'TEXTO'
                    }
                ]
            },
            preguntas: {
                create: [
                    {
                        texto: '¿Cuál es el primer paso en el protocolo de entrega?',
                        opcionA: 'Descargar la mercancía rápidamente',
                        opcionB: 'Saludar y presentarse',
                        opcionC: 'Pedir el albarán firmado',
                        correcta: 'B',
                        puntos: 10
                    },
                    {
                        texto: 'Ante una queja de un cliente enfadado, ¿qué NO debes hacer?',
                        opcionA: 'Escuchar activamente',
                        opcionB: 'Mantener la calma',
                        opcionC: 'Discutir y elevar la voz para imponerse',
                        correcta: 'C',
                        puntos: 10
                    }
                ]
            }
        }
    });

    console.log(`Created course: ${customerService.titulo}`);

    // Curso 2: Conducción Eficiente
    const ecoDriving = await prisma.moduloFormacion.create({
        data: {
            titulo: 'Conducción Eficiente y Segura',
            descripcion: 'Técnicas para reducir el consumo de combustible, desgaste del vehículo y mejorar la seguridad en carretera.',
            fechaInicio: new Date(),
            fechaFin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            duracionEstimada: 60,
            activo: true,
            creadoPorId: admin.id,
            temas: {
                create: [
                    {
                        titulo: 'Anticipación',
                        contenido: 'Mirar lejos para anticipar paradas y levantar el pie del acelerador antes de frenar bruscamente.',
                        orden: 1,
                        tipo: 'TEXTO'
                    },
                    {
                        titulo: 'Uso de las Marchas',
                        contenido: 'Circular en la marcha más larga posible. Cambiar de marcha en la zona verde del tacómetro.',
                        orden: 2,
                        tipo: 'TEXTO'
                    },
                    {
                        titulo: 'Ralentí',
                        contenido: 'Apagar el motor en paradas prolongadas (más de 1-2 minutos). El ralentí consume combustible innecesariamente.',
                        orden: 3,
                        tipo: 'TEXTO'
                    }
                ]
            },
            preguntas: {
                create: [
                    {
                        texto: '¿Qué acción ayuda a ahorrar combustible?',
                        opcionA: 'Acelerar bruscamente',
                        opcionB: 'Circular en marchas cortas',
                        opcionC: 'Anticipar el tráfico y usar la inercia',
                        correcta: 'C',
                        puntos: 10
                    },
                    {
                        texto: '¿Cuándo se debe apagar el motor?',
                        opcionA: 'Solo al finalizar la jornada',
                        opcionB: 'En paradas prolongadas de más de 2 minutos',
                        opcionC: 'Nunca, para mantener el turbo caliente',
                        correcta: 'B',
                        puntos: 10
                    }
                ]
            }
        }
    });

    console.log(`Created course: ${ecoDriving.titulo}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
