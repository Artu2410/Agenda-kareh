import { Router } from 'express';
import { withProfessionalScope, assertScopedProfessionalId } from '../utils/accessScope.js';
import { auditActions, safeWriteAuditLog } from '../utils/audit.js';

export default function createClinicalHistoryRoutes(prisma) {
  const router = Router();

  // GET: Obtener historial
  router.get('/:patientId', async (req, res) => {
    try {
      if (String(req.user?.role || '').toUpperCase() === 'PROFESSIONAL') {
        assertScopedProfessionalId(req.user);
      }
      const professionalScope = withProfessionalScope(req.user);
      const history = await prisma.clinicalHistory.findMany({
        where: {
          patientId: req.params.patientId,
          ...professionalScope,
        },
        include: {
          professional: {
            select: {
              id: true,
              fullName: true,
              specialty: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener historial' });
    }
  });

  // POST: Crear entrada y actualizar alertas (Atómico)
  router.post('/', async (req, res) => {
    const { patientId, diagnosis, evolution, attachments, medicalConditions, createdAt } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: 'El ID del paciente es requerido' });
    }

    try {
      const professionalId = String(req.user?.role || '').toUpperCase() === 'PROFESSIONAL'
        ? assertScopedProfessionalId(req.user)
        : (req.body.professionalId || null);

      const result = await prisma.$transaction(async (tx) => {
        // 1. Crear la entrada
        const requestedDate = createdAt ? new Date(createdAt) : new Date();
        const newEntry = await tx.clinicalHistory.create({
          data: {
            patientId,
            professionalId,
            diagnosis: diagnosis || '',
            evolution: evolution || '',
            attachments: attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : "[]",
            createdAt: requestedDate,
            date: requestedDate,
          },
        });

        // 2. Actualizar condiciones médicas del paciente
        if (medicalConditions) {
          await tx.patient.update({
            where: { id: patientId },
            data: {
              hasMarcapasos: !!medicalConditions.hasMarcapasos,
              hasCancer: !!medicalConditions.hasCancer,
              usesEA: !!medicalConditions.usesEA,
            },
            select: { id: true },
          });
        }
        return newEntry;
      });

      await safeWriteAuditLog(prisma, req, {
        action: auditActions.clinicalHistoryCreated,
        resource: 'CLINICAL_HISTORY',
        resourceId: result.id,
        newValues: result,
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("ERROR EN POST HISTORIAL:", error);
      res.status(500).json({ message: 'Error al guardar la sesión' });
    }
  });

  // PUT: Actualizar una entrada existente (Sincronizado con ClinicalHistoryPage.jsx)
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { diagnosis, evolution, createdAt, attachments } = req.body;

    try {
      const existingEntry = await prisma.clinicalHistory.findUnique({
        where: { id },
      });

      if (!existingEntry) {
        return res.status(404).json({ message: 'La entrada no existe' });
      }

      if (String(req.user?.role || '').toUpperCase() === 'PROFESSIONAL' && existingEntry.professionalId !== assertScopedProfessionalId(req.user)) {
        return res.status(403).json({ message: 'No autorizado para editar esta evolución' });
      }

      const updated = await prisma.clinicalHistory.update({
        where: { id: id },
        data: { 
          diagnosis: diagnosis || '', 
          evolution: evolution || '', 
          // Si el frontend envía 'date' o 'createdAt', lo procesamos:
          createdAt: createdAt ? new Date(createdAt) : undefined,
          date: createdAt ? new Date(createdAt) : undefined,
          // Validamos que los adjuntos se guarden siempre como string
          attachments: attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : "[]",
        }
      });

      await safeWriteAuditLog(prisma, req, {
        action: auditActions.clinicalHistoryUpdated,
        resource: 'CLINICAL_HISTORY',
        resourceId: updated.id,
        oldValues: existingEntry,
        newValues: updated,
      });
      res.json(updated);
    } catch (error) {
      console.error("ERROR EN PUT HISTORIAL:", error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'La entrada no existe' });
      }
      res.status(500).json({ message: 'Error al actualizar la sesión' });
    }
  });

  // DELETE: Eliminar entrada
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const existingEntry = await prisma.clinicalHistory.findUnique({
        where: { id },
      });

      if (!existingEntry) {
        return res.status(404).json({ message: 'La entrada ya no existe' });
      }

      if (String(req.user?.role || '').toUpperCase() === 'PROFESSIONAL' && existingEntry.professionalId !== assertScopedProfessionalId(req.user)) {
        return res.status(403).json({ message: 'No autorizado para eliminar esta evolución' });
      }

      await prisma.clinicalHistory.delete({
        where: { id: id }
      });

      await safeWriteAuditLog(prisma, req, {
        action: auditActions.clinicalHistoryDeleted,
        resource: 'CLINICAL_HISTORY',
        resourceId: id,
        oldValues: existingEntry,
      });
      res.json({ message: 'Sesión eliminada correctamente' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'La entrada ya no existe' });
      }
      res.status(500).json({ message: 'Error al eliminar' });
    }
  });

  return router;
}
