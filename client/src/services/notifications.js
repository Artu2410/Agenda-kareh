import api from './api';

const VAPID_PUBLIC_KEY = 'BDRoSfKk6Oq8Dca1MhyMSoO5WkWMl87cyKzY05CEdvE2MzkQl-RvZ5RMJKosr6d9YTly85ZMHLa3hb_Ca_zGBqg';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', registration);
      return registration;
    } catch (error) {
      console.error('Error al registrar Service Worker:', error);
    }
  }
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Notificaciones Push no soportadas');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Solicitar permiso
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permiso de notificación denegado');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Enviar al servidor
    await api.post('/notifications/subscribe', {
      subscription,
      email: localStorage.getItem('userEmail') // Opcional
    });

    console.log('Suscrito a notificaciones Push');
  } catch (error) {
    console.error('Error al suscribirse a notificaciones Push:', error);
  }
}

export function playNotificationSound() {
  const audio = new Audio('/notification-sound.mp3');
  audio.play().catch(err => console.warn('Error al reproducir sonido:', err));
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
