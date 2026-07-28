import { setAnnouncements, upsertAnnouncement, archiveAnnouncement, Announcement } from './store';

const DEFAULT_WS_URL = 'wss://api.axia.to/v1/events/ws';
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

let ws: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isSubscribed = false;
let announcementsStarted = false; // Idempotency guard for startAnnouncementSubscription

function getReconnectDelay(): number {
  return RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
}

/**
 * Resolve the Axia events WebSocket URL.
 *
 * Priority:
 *  1. AXIA_BASE from chrome storage (bootstrap config rpc_endpoint, set by AxiaRpcClient.loadBootstrapConfig)
 *  2. Default fallback: wss://api.axia.to/v1/events/ws
 *
 * Converts https→wss (or http→ws) and appends /v1/events/ws.
 */
async function resolveWsUrl(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(['AXIA_BASE']);
    const rpcEndpoint = stored.AXIA_BASE as string | undefined;
    if (rpcEndpoint) {
      const base = rpcEndpoint.replace(/\/$/, '');
      const wsBase = base.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws');
      return `${wsBase}/v1/events/ws`;
    }
  } catch { /* fall through to default */ }
  return DEFAULT_WS_URL;
}

async function connect(): Promise<void> {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  const wsUrl = await resolveWsUrl();
  console.log(`[AnnouncementsWS] Connecting to ${wsUrl}`);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[AnnouncementsWS] Connected to Axia events');
      reconnectAttempt = 0;
      
      ws?.send(JSON.stringify({ type: 'sub', topic: 'totem:announcements' }));
      isSubscribed = true;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'pub' && msg.topic === 'totem:announcements') {
          handleAnnouncementEvent(msg.payload);
        }
        
        if (msg.type === 'ping') {
          ws?.send(JSON.stringify({ type: 'pong', t: Date.now() }));
        }
      } catch (e) {
        console.error('[AnnouncementsWS] Parse error:', e);
      }
    };

    ws.onclose = (event) => {
      console.log('[AnnouncementsWS] Disconnected:', event.code);
      isSubscribed = false;
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[AnnouncementsWS] Error:', error);
      // Close and let onclose handler trigger reconnect
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
      }
    };
  } catch (e) {
    console.error('[AnnouncementsWS] Connection failed:', e);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  const delay = getReconnectDelay();
  reconnectAttempt++;
  console.log(`[AnnouncementsWS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
  
  reconnectTimer = setTimeout(() => {
    void connect();
  }, delay);
}

async function handleAnnouncementEvent(payload: any): Promise<void> {
  try {
    if (payload.type === 'snapshot' && Array.isArray(payload.announcements)) {
      console.log('[AnnouncementsWS] Received snapshot:', payload.announcements.length, 'announcements');
      await setAnnouncements(payload.announcements);
    }
    
    if (payload.type === 'upsert' && payload.announcement) {
      console.log('[AnnouncementsWS] Announcement upsert:', payload.announcement.id);
      await upsertAnnouncement(payload.announcement as Announcement);
    }
    
    if (payload.type === 'archive' && payload.announcement) {
      console.log('[AnnouncementsWS] Announcement archived:', payload.announcement.id);
      await archiveAnnouncement(payload.announcement.id);
    }
  } catch (e) {
    console.error('[AnnouncementsWS] Handler error:', e);
  }
}

export function startAnnouncementSubscription(): void {
  // Idempotency guard - only log and connect on first call
  if (announcementsStarted) {
    return; // Already started, skip silently
  }
  announcementsStarted = true;
  console.log('[AnnouncementsWS] Starting subscription');
  void connect();
}

export function stopAnnouncementSubscription(): void {
  console.log('[AnnouncementsWS] Stopping subscription');
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (ws) {
    if (isSubscribed) {
      ws.send(JSON.stringify({ type: 'unsub', topic: 'totem:announcements' }));
    }
    ws.close();
    ws = null;
  }
  
  isSubscribed = false;
  announcementsStarted = false; // Reset so it can be started again
}

export function isAnnouncementSubscriptionActive(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN && isSubscribed;
}
