/**
 * Browser Push & Web Audio Alert Utility for Jowis Studio ERP
 */

/**
 * Check if the browser supports desktop notifications
 */
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Request notification permission from the user
 */
export async function requestBrowserNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  return Notification.permission;
}

/**
 * Play a discreet, pleasant synthesizer chime using Web Audio API
 */
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Pleasant dual chime chord
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (err) {
    // Audio context may require user interaction first
  }
}

/**
 * Send an authoritative browser desktop notification
 */
export function sendBrowserNotification(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    playNotificationSound();

    const notif = new Notification(title, {
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      body: options.body || 'New institutional update received.',
      tag: options.tag || 'jowis-erp-update',
      silent: false,
      ...options
    });

    notif.onclick = () => {
      window.focus();
      if (options.onClick) {
        options.onClick();
      }
      notif.close();
    };

    return notif;
  } catch (err) {
    console.warn('Failed to dispatch browser notification:', err);
    return null;
  }
}
