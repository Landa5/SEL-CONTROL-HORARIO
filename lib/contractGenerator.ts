
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ContractData {
    plazaNumero: number;
    cliente: {
        nombre: string;
        nif?: string;
        direccion?: string;
        poblacion?: string;
        provincia?: string;
        codigoPostal?: string;
    };
    matricula: string;
    precioMensual: number;
    fechaInicio: string | Date;
}

export const generateRentalContract = (data: ContractData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Helper for multiline text
    const addText = (text: string, y: number, fontSize: number = 10, align: 'left' | 'center' | 'justify' = 'left', isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        const splitText = doc.splitTextToSize(text, contentWidth);

        if (align === 'center') {
            doc.text(text, pageWidth / 2, y, { align: 'center' });
            return y + (fontSize * 0.5); // Single line approx
        } else {
            doc.text(splitText, margin, y, { align: align });
            return y + (splitText.length * (fontSize * 0.45)); // Approx line height
        }
    };

    let y = 20;

    // TITLE
    y = addText('CONTRATO DE CESIÓN DE PLAZA DE APARCAMIENTO', y, 14, 'center', true);
    y = addText('VEHÍCULOS CON MERCANCÍAS PELIGROSAS (ADR)', y + 6, 12, 'center', true);

    y += 10;

    // DATE
    const today = new Date();
    y = addText(`En Sagunto, a ${format(today, 'dd de MMMM de yyyy', { locale: es })}`, y, 10, 'left');

    y += 10;

    // REUNIDOS
    y = addText('REUNIDOS', y, 11, 'left', true);
    y += 6;

    const propietarioText = `De una parte, Suministros Energéticos de Levante S.A, con CIF A-96064928, domicilio social en Pol. Sepes Cl Galileo Galilei, 43 de Sagunto, 46520 (Valencia), representada por D./Dña. Jose Luis Mendez Rodriguez, en su calidad de Administrador, en adelante LA PROPIETARIA.`;
    y = addText(propietarioText, y, 10, 'justify');

    y += 6;

    const nif = data.cliente.nif || '____________________';
    const direccion = [data.cliente.direccion, data.cliente.codigoPostal, data.cliente.poblacion, data.cliente.provincia].filter(Boolean).join(', ') || '__________________________________________________';

    const usuarioText = `Y de otra, ${data.cliente.nombre}, con CIF ${nif}, domicilio social en ${direccion}, representada por D./Dña. __________________________, en su calidad de __________________________, en adelante LA USUARIA.`;
    y = addText(usuarioText, y, 10, 'justify');

    y += 6;
    y = addText('Ambas partes, reconociéndose capacidad legal suficiente,', y, 10, 'justify');

    y += 10;

    // CLAUSULAS
    y = addText('ACUERDAN LAS SIGUIENTES CLÁUSULAS', y, 11, 'center', true);
    y += 8;

    // 1. Objeto
    y = addText('1. Objeto', y, 10, 'left', true);
    y += 5;
    const objetoText = `LA PROPIETARIA cede a LA USUARIA el uso no exclusivo de la plaza de aparcamiento nº ${data.plazaNumero} situada en el recinto ubicado en Pol. Sepes Cl Galileo Galilei, 43 de Sagunto, 46520. La plaza se destinará exclusivamente al estacionamiento del vehículo industrial matrícula ${data.matricula}, pudiendo estar cargado con mercancías peligrosas conforme al ADR vigente.`;
    y = addText(objetoText, y, 10, 'justify');
    y += 6;

    // 2. Naturaleza
    y = addText('2. Naturaleza jurídica', y, 10, 'left', true);
    y += 5;
    const naturalezaText = `El presente contrato tiene naturaleza de arrendamiento de espacio sin custodia ni depósito, no existiendo obligación de vigilancia por parte de LA PROPIETARIA.`;
    y = addText(naturalezaText, y, 10, 'justify');
    y += 6;

    // 3. Duración
    y = addText('3. Duración', y, 10, 'left', true);
    y += 5;
    const fechaInicioStr = format(new Date(data.fechaInicio), 'dd/MM/yyyy');
    const duracionText = `El contrato tendrá una duración de 1 AÑO, comenzando el día ${fechaInicioStr}. Se renovará automáticamente por periodos de 1 año salvo preaviso escrito con 60 días de antelación.`;
    y = addText(duracionText, y, 10, 'justify');
    y += 6;

    // 4. Precio
    y = addText('4. Precio e Impuestos', y, 10, 'left', true);
    y += 5;
    const precio = data.precioMensual || 90;
    const precioText = `LA USUARIA abonará la cantidad de ${precio} € mensuales. A esta cantidad se le añadirá el IVA correspondiente y se le aplicará la retención de IRPF exigida por la ley vigente, pagaderos por adelantado dentro de los primeros 5 días de cada mes.`;
    y = addText(precioText, y, 10, 'justify');
    y += 6;

    // Page Break Check? Usually 297mm height. We are at ~160mm maybe.

    // 5. Declaraciones
    y = addText('5. Declaraciones y obligaciones de la USUARIA', y, 10, 'left', true);
    y += 5;
    const declText = `LA USUARIA declara y garantiza que:`;
    y = addText(declText, y, 10, 'justify');
    y += 4;
    const bullets = [
        `• El vehículo cumple íntegramente la normativa ADR vigente.`,
        `• El conductor dispone de certificado ADR en vigor.`,
        `• La mercancía está correctamente clasificada, señalizada y documentada.`,
        `• Dispone de póliza de seguro en vigor que cubre: Responsabilidad civil, Daños medioambientales, Incendio y explosión. Se compromete a aportar copia anual actualizada.`
    ];
    bullets.forEach(b => {
        y = addText(b, y, 10, 'left');
        y += 2;
    });
    y += 4;

    // 6. Exclusión
    y = addText('6. Exclusión y limitación de responsabilidad', y, 10, 'left', true);
    y += 5;
    const exclusionText = `LA PROPIETARIA no asume custodia ni vigilancia del vehículo ni de su carga, ni responderá por robos, fenómenos atmosféricos o daños de terceros. Únicamente responderá en caso de dolo o culpa grave acreditada.`;
    y = addText(exclusionText, y, 10, 'justify');
    y += 6;

    // Check page break
    if (y > 250) {
        doc.addPage();
        y = 20;
    }

    // 7. Indemnidad
    y = addText('7. Cláusula de indemnidad', y, 10, 'left', true);
    y += 5;
    const indemnidadText = `LA USUARIA mantendrá indemne a LA PROPIETARIA frente a sanciones, reclamaciones, costes de emergencias, limpieza ambiental o daños a terceros causados por el vehículo o su carga.`;
    y = addText(indemnidadText, y, 10, 'justify');
    y += 6;

    // 8. Uso
    y = addText('8. Condiciones de uso y Protocolo de Emergencias', y, 10, 'left', true);
    y += 5;
    const usoText = `Queda prohibido realizar trasvases, mantenimiento o reparaciones en el recinto. El vehículo deberá permanecer cerrado y señalizado. Está prohibida la cesión a terceros. Protocolo de Emergencias: En caso de derrame, fuga o cualquier incidente, LA USUARIA se obliga a notificarlo inmediatamente a LA PROPIETARIA y a los servicios de emergencia (112).`;
    y = addText(usoText, y, 10, 'justify');
    y += 6;

    // 9. Seguro y garantía
    y = addText('9. Seguro y garantía obligatoria', y, 10, 'left', true);
    y += 5;
    const hasFianza = false; // Assuming no separate variable for now, hardcoded blank or same as price?
    const fianza = precio * 2; // Typically 2 months? Leaving blank as per template request to fill based on data created. Template says "__________ €". Let's put the monthly price as fianza or leave blank to fill by hand? The user said "rellena los huecos... importe". 
    // Usually fianza is one or two months. Let's make it equal to monthly price if not specified.

    // User request: "rellena los huecos en blacon, como matrícula, importe, fecha de inicio y datos de la empresa usuaria"
    // Does not specify fianza. I will use the monthly price.
    const fianzaText = `A la firma de este contrato, LA USUARIA entrega a LA PROPIETARIA la cantidad de ${precio} € en concepto de fianza. Igualmente, entrega en este acto una copia del recibo del seguro en vigor detallado en la cláusula 5.`;
    y = addText(fianzaText, y, 10, 'justify');
    y += 6;

    // 10. Resolución
    y = addText('10. Resolución', y, 10, 'left', true);
    y += 5;
    const resText = `El incumplimiento de la normativa ADR o de las obligaciones contractuales facultará a LA PROPIETARIA a resolver el contrato de forma inmediata.`;
    y = addText(resText, y, 10, 'justify');
    y += 6;

    // 11. Legislación
    y = addText('11. Legislación y jurisdicción', y, 10, 'left', true);
    y += 5;
    const legText = `Al tratarse del alquiler de una plaza de aparcamiento independiente, el presente contrato se rige por la voluntad de las partes y por lo dispuesto en el Código Civil español, quedando excluida la Ley de Arrendamientos Urbanos (LAU). Para cualquier controversia, se someten a los Juzgados de Sagunto.`;
    y = addText(legText, y, 10, 'justify');
    y += 6;

    // 12. RGPD
    y = addText('12. Protección de Datos (RGPD)', y, 10, 'left', true);
    y += 5;
    const rgpdText = `Las partes consienten el tratamiento de sus datos personales exclusivamente para el mantenimiento y cumplimiento de este contrato. Podrán ejercer sus derechos de acceso, rectificación, supresión y oposición dirigiéndose a los domicilios sociales indicados en el encabezado.`;
    y = addText(rgpdText, y, 10, 'justify');
    y += 15;

    // FIRMAS
    if (y > 230) {
        doc.addPage();
        y = 20;
    }

    y = addText('FIRMAS', y, 12, 'center', true);
    y += 10;

    // Two columns for signatures
    const colWidth = contentWidth / 2;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Por LA PROPIETARIA', margin, y);
    doc.text('Por LA USUARIA', margin + colWidth, y);

    y += 30; // Space for signature

    doc.setFont('helvetica', 'normal');
    doc.text('Firma: __________________________', margin, y);
    doc.text('Firma: __________________________', margin + colWidth, y);

    y += 10;
    doc.text('Nombre: Jose Luis Mendez Rodriguez', margin, y);
    doc.text(`Nombre: _________________________`, margin + colWidth, y); // Rep name not in DB

    y += 10;
    doc.text('Cargo: Administrador', margin, y);
    doc.text('Cargo: __________________________', margin + colWidth, y);

    // Save
    doc.save(`Contrato_Alquiler_Plaza_${data.plazaNumero}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
