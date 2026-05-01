import express from 'express';
import * as notificationsController from '../controllers/notifications.controller.js';

const router = express.Router();

export default (prisma) => {
  router.post('/subscribe', (req, res) => notificationsController.subscribe(req, res, prisma));
  router.post('/unsubscribe', (req, res) => notificationsController.unsubscribe(req, res, prisma));
  
  return router;
};
