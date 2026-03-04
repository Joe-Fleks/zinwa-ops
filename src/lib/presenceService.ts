import { supabase } from './supabase';

const HEARTBEAT_INTERVAL = 60_000;
const IDLE_TIMEOUT = 10 * 60_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isIdle = false;
let currentUserId: string | null = null;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

async function sendHeartbeat() {
  if (!currentUserId) return;
  await supabase
    .from('user_presence')
    .upsert(
      {
        user_id: currentUserId,
        last_active_at: new Date().toISOString(),
        is_idle: isIdle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
}

function resetIdleTimer() {
  if (isIdle) {
    isIdle = false;
    sendHeartbeat();
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    isIdle = true;
    sendHeartbeat();
  }, IDLE_TIMEOUT);
}

function handleActivity() {
  resetIdleTimer();
}

export function startPresenceTracking(userId: string) {
  stopPresenceTracking();
  currentUserId = userId;
  isIdle = false;

  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  resetIdleTimer();

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, handleActivity, { passive: true });
  }
}

export function stopPresenceTracking() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  for (const event of ACTIVITY_EVENTS) {
    window.removeEventListener(event, handleActivity);
  }

  currentUserId = null;
  isIdle = false;
}
