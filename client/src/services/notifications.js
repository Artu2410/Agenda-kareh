import api from './api';

let pushConfigPromise = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function fetchPushConfig() {
  if (!pushConfigPromise) {
    pushConfigPromise = api
      .get('/notifications/config')
      .then((response) => response.data || { enabled: false, publicKey: null })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('No se pudo cargar la configuración push:', error?.message || error);
        }
        return { enabled: false, publicKey: null };
      })
      .finally(() => {
        pushConfigPromise = null;
      });
  }

  return pushConfigPromise;
}

async function syncSubscription(subscription) {
  await api.post('/notifications/subscribe', {
    subscription,
    email: localStorage.getItem('userEmail'),
  });
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registrado:', registration);
    return registration;
  } catch (error) {
    console.error('Error al registrar Service Worker:', error);
    return null;
  }
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    if (import.meta.env.DEV) {
      console.warn('Notificaciones Push no soportadas');
    }
    return null;
  }

  const pushConfig = await fetchPushConfig();
  if (!pushConfig?.enabled || !pushConfig?.publicKey) {
    if (import.meta.env.DEV) {
      console.info('Notificaciones Push deshabilitadas: VAPID no configurado en backend');
    }
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      await syncSubscription(existingSubscription);
      return existingSubscription;
    }

    const currentPermission = Notification.permission;
    const permission = currentPermission === 'default'
      ? await Notification.requestPermission()
      : currentPermission;

    if (permission !== 'granted') {
      if (import.meta.env.DEV) {
        console.warn('Permiso de notificación no concedido');
      }
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
    });

    await syncSubscription(subscription);
    console.log('Suscrito a notificaciones Push');
    return subscription;
  } catch (error) {
    const errorName = String(error?.name || '');
    const errorMessage = String(error?.message || '');
    const isRecoverable =
      errorName === 'AbortError' ||
      errorName === 'InvalidStateError' ||
      errorMessage.toLowerCase().includes('push service');

    if (isRecoverable) {
      console.warn('No se pudo activar Push en este dispositivo o navegador:', errorMessage || errorName);
      return null;
    }

    console.error('Error al suscribirse a notificaciones Push:', error);
    return null;
  }
}

export function playNotificationSound() {
  const audio = new Audio('/notification-sound.mp3');
  audio.play().catch((error) => console.warn('Error al reproducir sonido:', error));
}

export function updateAppBadge(count) {
  if ('setAppBadge' in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count);
    } else {
      navigator.clearAppBadge();
    }
  }
}
