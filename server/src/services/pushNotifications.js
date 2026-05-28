import webpush from 'web-push';
import logger from '../config/logger.js';

const pushLogger = logger.child({ service: 'push-notifications' });

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:centrokareh@gmail.com',
    publicKey,
    privateKey,
  );
}

const buildPushSubscription = (subscription) => ({
  endpoint: subscription.endpoint,
  keys: {
    p256dh: subscription.p256dh,
    auth: subscription.auth,
  },
});

const sendToSubscriptions = async (prisma, subscriptions, payload) => Promise.all(
  subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(buildPushSubscription(subscription), JSON.stringify(payload));
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } });
        return;
      }

      pushLogger.error('Error enviando notificación push', {
        subscriptionId: subscription.id,
        errorMessage: error.message,
      });
    }
  }),
);

export const sendNotificationToEmails = async (prisma, emails = [], payload = {}) => {
  const normalizedEmails = [...new Set(
    emails
      .map((email) => String(email || '').trim().toLowerCase())
      .filter(Boolean),
  )];

  if (!normalizedEmails.length || !publicKey || !privateKey) {
    return { delivered: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      email: { in: normalizedEmails },
    },
  });

  await sendToSubscriptions(prisma, subscriptions, payload);

  return { delivered: subscriptions.length };
};
