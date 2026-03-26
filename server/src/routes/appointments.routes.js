import { Router } from 'express';
import multer from 'multer';
import { 
  getWeekAppointments, 
  createAppointment, 
  updateAppointment,
  deleteAppointment, 
  updateEvolution, 
  cancelFutureAppointments,
  getAppointmentBatch,
  sendWhatsAppTicket,
  sendWhatsAppTicketDocument,
  sendWhatsAppTicketImage
} from '../controllers/AppointmentController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const validMimes = ['image/jpeg', 'image/png'];
    if (!validMimes.includes(file.mimetype)) {
      return cb(new Error('Solo se permiten imágenes JPEG o PNG'));
    }
    return cb(null, true);
  },
});

const createRouter = (prisma) => {
  const router = Router();

  // 1. Obtener turnos de la semana
  router.get('/week', (req, res) => getWeekAppointments(req, res, prisma));

  // 2. Ticket: Obtener lote de 10 sesiones
  router.get('/:id/batch', (req, res) => getAppointmentBatch(req, res, prisma));

  // 2b. Enviar ticket por WhatsApp (PDF)
  router.post('/:id/whatsapp-ticket', (req, res) => sendWhatsAppTicket(req, res, prisma));

  // 2c. Enviar ticket como imagen por WhatsApp (html2canvas)
  router.post('/:id/whatsapp-ticket-image', upload.single('image'), (req, res) => sendWhatsAppTicketImage(req, res, prisma));

  // 2d. Enviar ticket como documento por WhatsApp
  router.post('/:id/whatsapp-ticket-document', (req, res) => sendWhatsAppTicketDocument(req, res, prisma));

  // 3. Crear citas (Ciclo completo)
  router.post('/', (req, res) => createAppointment(req, res, prisma));

  // 4. Actualizar cita y datos del paciente
  router.put('/:id', (req, res) => updateAppointment(req, res, prisma));

  // 5. Actualizar evolución (Sincronización total con Paciente e Historia)
  router.patch('/:id/evolution', (req, res) => updateEvolution(req, res, prisma));

  // 6. Eliminar cita única
  router.delete('/:id', (req, res) => deleteAppointment(req, res, prisma));

  // 7. Cancelar sesiones futuras de un paciente
  router.post('/patients/:patientId/cancel-future', (req, res) => cancelFutureAppointments(req, res, prisma));

  return router;
};

export default createRouter;
