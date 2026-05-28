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
      .catch(() => ({ enabled: false, publicKey: null }))
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
    return registration;
  } catch {
    return null;
  }
}

export async function subscribeToPushNotifications() {
  if (!isPushSupported()) {
    return null;
  }

  const pushConfig = await fetchPushConfig();
  if (!pushConfig?.enabled || !pushConfig?.publicKey) {
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
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
    });

    await syncSubscription(subscription);
    return subscription;
  } catch (error) {
    const errorName = String(error?.name || '');
    const errorMessage = String(error?.message || '');
    const isRecoverable =
      errorName === 'AbortError' ||
      errorName === 'InvalidStateError' ||
      errorMessage.toLowerCase().includes('push service');

    if (isRecoverable) {
      return null;
    }

    return null;
  }
}

export function playNotificationSound() {
  const audio = new Audio('/notification-sound.mp3');
  audio.play().catch(() => {});
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

