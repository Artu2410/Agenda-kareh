import webpush from 'web-push';
import logger from '../config/logger.js';
import { createInternalError } from '../errors/AppError.js';

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:centrokareh@gmail.com',
    publicKey,
    privateKey
  );
}

export const getConfig = async (req, res) => {
  res.json({
    enabled: Boolean(publicKey && privateKey),
    publicKey: publicKey || null,
  });
};

export const subscribe = async (req, res, prisma) => {
  try {
    const { subscription, email } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Suscripción push inválida' });
    }
    
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        email: email || null,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        email: email || null,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    res.status(201).json({ success: true });
  } catch (error) {
    throw createInternalError(error, 'Internal server error');
  }
};

export const unsubscribe = async (req, res, prisma) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
    res.status(200).json({ success: true });
  } catch (error) {
    throw createInternalError(error, 'Internal server error');
  }
};

export const sendNotificationToAll = async (prisma, payload) => {
  const subscriptions = await prisma.pushSubscription.findMany();
  
  const notifications = subscriptions.map(sub => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      }
    };

    return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
      .catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          logger.info('Subscription expired or no longer valid', { endpoint: sub.endpoint });
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          logger.error('Error sending notification', { errorMessage: err.message, statusCode: err.statusCode });
        }
      });
  });

  await Promise.all(notifications);
};
