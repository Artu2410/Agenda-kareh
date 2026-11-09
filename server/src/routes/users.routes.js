import { Router } from 'express';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  updateUserRole,
} from '../controllers/users.controller.js';
import { checkRole } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import {
  createUserBodySchema,
  idParamsSchema,
  updateUserBodySchema,
  updateUserRoleBodySchema,
} from '../validations/adminSchemas.js';

export default function createUsersRoutes(prisma) {
  const router = Router();

  router.get('/', checkRole('SUPER_USER', 'ADMIN'), (req, res) => listUsers(req, res, prisma));
  router.post('/', checkRole('SUPER_USER', 'ADMIN'), validate({ body: createUserBodySchema }), (req, res) => createUser(req, res, prisma));
  router.put('/:id', checkRole('SUPER_USER', 'ADMIN'), validate({ params: idParamsSchema, body: updateUserBodySchema }), (req, res) => updateUser(req, res, prisma));
  router.put('/:id/role', checkRole('SUPER_USER', 'ADMIN'), validate({ params: idParamsSchema, body: updateUserRoleBodySchema }), (req, res) => updateUserRole(req, res, prisma));
  router.delete('/:id', checkRole('SUPER_USER', 'ADMIN'), (req, res) => deleteUser(req, res, prisma));

  return router;
}
