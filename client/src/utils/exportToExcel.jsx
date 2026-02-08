import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const exportWeeklyAppointmentsToExcel = (appointments, currentWeek) => {
  try {
    // 1. Preparamos los datos para que se vean bien en Excel
    const dataToExport = appointments.map((app) => ({
      Fecha: format(new Date(app.date), 'dd/MM/yyyy'),
      Hora: app.startTime,
      Paciente: app.patientName,
      DNI: app.patientDni || 'N/A',
      Teléfono: app.patientPhone || 'N/A',
      Tratamiento: app.diagnosis || 'Consulta',
      Estado: app.status || 'Programado'
    }));

    // 2. Creamos el libro de trabajo (Workbook)
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Agenda Semanal");

    // 3. Ajustamos el ancho de las columnas automáticamente
    const wscols = [
      { wch: 15 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 25 }, // Paciente
      { wch: 15 }, // DNI
      { wch: 15 }, // Teléfono
      { wch: 30 }, // Tratamiento
      { wch: 12 }  // Estado
    ];
    worksheet['!cols'] = wscols;

    // 4. Generamos el nombre del archivo con la fecha de la semana
    const fileName = `Agenda_Kareh_${format(currentWeek, 'dd-MM-yyyy')}.xlsx`;

    // 5. Descargamos el archivo
    XLSX.writeFile(workbook, fileName);
    
    return true;
  } catch (error) {
    console.error("Error detallado al exportar:", error);
    throw error;
  }
};