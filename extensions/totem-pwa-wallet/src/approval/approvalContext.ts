/**
 * approvalContext — shared, security-reviewed origin/return handling for the
 * dApp approval popups (SendApproval, VerifyApproval).
 *
 * Trust model
 * -----------
 * - `document.referrer` is set by the browser for popups opened from a page and
 *   cannot be set via URL query manipulation. It is the only trusted source for
 *   the *displayed* caller origin.
 * - `?origin=` is caller-supplied. It is NEVER used for display. It may be used
 *   as a postMessage targetOrigin only because postMessage enforces it against
 *   the opener's real origin (a mismatched target simply drops the message).
 * - `returnUrl` is only honored for http(s), except when `source=protocol-handler`
 *   (native app), where custom schemes are required to hand control back.
 * - The BroadcastChannel response channel is scoped with a per-request nonce so
 *   other pages on the wallet origin cannot observe responses.
 */

export interface ApprovalContext {
  /** Display-only origin, derived from trusted/validated sources. */
  origin: string;
  /** Origin to use as postMessage targetOrigin (trusted referrer first). */
  targetOrigin: string | null;
  /** True when the request came through the native protocol handler. */
  isProtocolHandler: boolean;
  /** Validated return URL (http/https, or custom scheme for protocol-handler). */
  returnUrl: string | null;
  /** Per-request nonce scoping the BroadcastChannel. */
  nonce: string;
  /** Request id used to correlate the response. */
  reqId: string;
}

function parseOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.origin && u.origin !== 'null' ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * Custom schemes the native protocol handler is allowed to return to.
 * Mirrors protocol-handler-main's allowlist. Anything else (javascript:,
 * data:, unknown app schemes) is rejected rather than blindly navigated to.
 */
const ALLOWED_CUSTOM_SCHEMES = new Set(['myapp:', 'totem:', 'web+totem:']);

export function isCustomScheme(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return !['https:', 'http:'].includes(protocol) && ALLOWED_CUSTOM_SCHEMES.has(protocol);
  } catch {
    return false;
  }
}

export function parseApprovalContext(): ApprovalContext {
  const params = new URLSearchParams(window.location.search);
  const isProtocolHandler = params.get('source') === 'protocol-handler';

  // Trusted opener origin — referrer is browser-set and cannot be spoofed.
  const referrerOrigin = parseOrigin(document.referrer);

  // Caller-supplied origin — safe ONLY as a postMessage targetOrigin fallback.
  const paramOrigin = parseOrigin(params.get('origin'));

  // Validate returnUrl: http(s) always; custom schemes only for native handler.
  const rawReturn = params.get('returnUrl');
  let returnUrl: string | null = null;
  if (rawReturn) {
    try {
      const r = new URL(rawReturn);
      const httpish = r.protocol === 'https:' || r.protocol === 'http:';
      if (httpish || (isProtocolHandler && isCustomScheme(rawReturn))) {
        returnUrl = r.toString();
      }
    } catch { /* invalid returnUrl */ }
  }

  let origin: string;
  if (isProtocolHandler) {
    origin = 'Native App';
  } else if (referrerOrigin) {
    origin = referrerOrigin;
  } else if (returnUrl) {
    try { origin = new URL(returnUrl).origin; } catch { origin = 'Unknown dApp'; }
  } else {
    origin = 'Unknown dApp';
  }

  return {
    origin,
    targetOrigin: referrerOrigin ?? paramOrigin,
    isProtocolHandler,
    returnUrl,
    nonce: params.get('nonce') ?? '',
    reqId: params.get('reqId') ?? '',
  };
}

function redirectWithResult(
  returnUrl: string,
  result: unknown,
  error: string | undefined,
  reqId: string,
): void {
  const ret = new URL(returnUrl);
  ret.searchParams.set('totem_result', btoa(JSON.stringify(error ? { error } : result)));
  if (reqId) ret.searchParams.set('totem_reqid', reqId);
  window.location.href = ret.toString();
}

/**
 * Deliver an approval result back to the caller.
 *
 * Order:
 *  1. Native protocol handler with a custom-scheme returnUrl → redirect.
 *  2. Nonce-scoped BroadcastChannel (same-origin listeners only).
 *  3. Popup → postMessage to the opener with an explicit targetOrigin.
 *  4. Validated http(s) returnUrl → redirect.
 *  5. Otherwise close without leaking the payload.
 */
export function sendApprovalResult(
  ctx: ApprovalContext,
  result: unknown,
  error?: string,
): void {
  const payload = { type: 'totem_response', reqId: ctx.reqId, result, error };

  // 1. Native app: custom-scheme return is the only way back.
  if (ctx.isProtocolHandler && ctx.returnUrl && isCustomScheme(ctx.returnUrl)) {
    redirectWithResult(ctx.returnUrl, result, error, ctx.reqId);
    return;
  }

  // 2. Nonce-scoped BroadcastChannel fallback.
  if (ctx.reqId && ctx.nonce) {
    try {
      const bc = new BroadcastChannel(`totem_response_${ctx.reqId}_${ctx.nonce}`);
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 200);
    } catch { /* BroadcastChannel not supported */ }
  }

  // 3. Popup: never post with '*'; only deliver to a known origin.
  if (window.opener && ctx.targetOrigin) {
    window.opener.postMessage(payload, ctx.targetOrigin);
    setTimeout(() => window.close(), 100);
    return;
  }

  // 4. Full-page redirect fallback (http/https only).
  if (ctx.returnUrl) {
    redirectWithResult(ctx.returnUrl, result, error, ctx.reqId);
    return;
  }

  // 5. No trusted delivery path — close without exposing the payload.
  if (window.opener) {
    setTimeout(() => window.close(), 100);
  }
}
