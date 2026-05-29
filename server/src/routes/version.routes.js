import { Router } from 'express';
import { getRuntimeVersionInfo } from '../config/runtimeInfo.js';

export default function createVersionRoutes() {
  const router = Router();

  router.get('/version', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getRuntimeVersionInfo());
  });

  return router;
}
