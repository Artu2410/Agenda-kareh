import { Router } from 'express';
import {
  listConversations,
  listMessages,
  markConversationRead,
  deleteConversation,
  sendConversationMessage,
} from '../controllers/whatsapp.controller.js';

export default function createWhatsAppRoutes(prisma) {
  const router = Router();

  router.get('/conversations', (req, res) => listConversations(req, res, prisma));
  router.get('/conversations/:id/messages', (req, res) => listMessages(req, res, prisma));
  router.post('/conversations/:id/messages', (req, res) => sendConversationMessage(req, res, prisma));
  router.post('/conversations/:id/read', (req, res) => markConversationRead(req, res, prisma));
  router.delete('/conversations/:id', (req, res) => deleteConversation(req, res, prisma));

  return router;
}
