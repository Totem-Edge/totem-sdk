/**
 * Totem dApp Starter — Backend Server
 *
 * This Express server proxies Axia API calls so the API key
 * never leaves the server. The frontend only talks to /api/*.
 *
 * Required environment variable:
 *   AXIA_API_KEY — your Axia API key (from https://api.axia.to)
 *
 * Optional:
 *   PORT           — server port (default: 3001)
 *   SESSION_SECRET — HMAC secret for session tokens (auto-generated if omitted;
 *                    MUST be set in production so tokens survive restarts and
 *                    work across multiple server instances)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Auth Session Contract (§4.3)
 *
 * Token format: base64url(header) + "." + base64url(payload) + "." + sig
 *   header:  { alg: "HS256", typ: "JWT" }
 *   payload: { address, origin, iat, exp, jti, type }
 *     type = "session"  → short-lived token (TTL: SESSION_TTL_MS, 24 h)
 *     type = "refresh"  → max-lifetime marker (TTL: REFRESH_MAX_MS, 7 d)
 *
 * Four endpoints:
 *   POST /api/auth/verify  — consumes WOTS proof, mints session token
 *   GET  /api/auth/session — validates existing token AND server-side record
 *   POST /api/auth/refresh — exchanges token within max-lifetime for new one
 *   POST /api/auth/logout  — immediately invalidates the session server-side
 *
 * The session token is returned BOTH as an HttpOnly cookie (for browser
 * clients) and in the response body (for non-browser / dApp backends).
 *
 * Server-side session store:
 *   Active sessions are tracked in sessionStore (Map<jti, record>).
 *   This enables instant revocation on logout and is the authoritative
 *   source of truth — a valid token signature alone is not sufficient.
 *   For multi-server deployments, replace sessionStore with a shared
 *   Redis/Valkey store (see README for instructions).
 * ─────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();

const crypto = require('crypto');
const express = require('express');

const app = express();
app.use(express.json());

const AXIA_PROJECT_ID = process.env.AXIA_PROJECT_ID || '';
// For private projects: set AXIA_PROJECT_SECRET to your project secret (x-axia-project-secret header).
// For public projects: leave unset — the projectId in the URL is sufficient.
const AXIA_PROJECT_SECRET = process.env.AXIA_PROJECT_SECRET || '';
const AXIA_BASE = 'https://api.axia.to';
const PORT = parseInt(process.env.PORT || '3001', 10);

if (!AXIA_PROJECT_ID) {
  console.warn('[server] WARNING: AXIA_PROJECT_ID is not set — portfolio and price calls will fail with 410.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Session token configuration
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;      // 24 hours
const REFRESH_MAX_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days max lifetime
const COOKIE_NAME = 'totem_session';

if (!process.env.SESSION_SECRET) {
  console.warn('[server] WARNING: SESSION_SECRET is not set — tokens will not survive server restarts.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-side session store
//
// Maps jti → { address, origin, exp, maxLifetimeExp }
//
// This is the authoritative source of truth for active sessions.
// A cryptographically valid token whose jti is absent from this store is
// treated as revoked (e.g., after explicit logout).
//
// Two backends are supported and selected automatically at startup:
//
//   REDIS_URL set → Redis adapter (persistent, multi-server safe)
//     Records expire automatically via Redis TTL.
//     All server instances must share the same REDIS_URL and SESSION_SECRET.
//
//   REDIS_URL not set → in-memory Map adapter (development only)
//     Records are lost when the process exits.
//     Sessions are therefore invalidated on server restart.
//     Sufficient for local development; NOT suitable for production.
//
// ─────────────────────────────────────────────────────────────────────────────

async function createSessionStore() {
  const REDIS_URL = process.env.REDIS_URL;

  if (REDIS_URL) {
    const { createClient } = require('redis');
    const redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('[server] Redis error:', err.message));

    await redisClient.connect();
    console.log('[server] Session store: Redis connected —', REDIS_URL.replace(/:\/\/.*@/, '://***@'));

    return {
      async get(jti) {
        const val = await redisClient.get(`sess:${jti}`);
        return val ? JSON.parse(val) : undefined;
      },
      async set(jti, record) {
        const ttlMs = record.exp - Date.now();
        if (ttlMs <= 0) return;
        await redisClient.set(`sess:${jti}`, JSON.stringify(record), { PX: ttlMs });
      },
      async delete(jti) {
        await redisClient.del(`sess:${jti}`);
      },
    };
  }

  console.warn(
    '[server] Session store: using in-memory Map — sessions will be lost on restart.' +
    ' Set REDIS_URL in .env for persistent, multi-server-safe sessions.'
  );

  const _map = new Map();
  const PURGE_INTERVAL_MS = 60 * 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const [jti, record] of _map) {
      if (record.exp < now) _map.delete(jti);
    }
  }, PURGE_INTERVAL_MS).unref();

  return {
    async get(jti) { return _map.get(jti); },
    async set(jti, record) { _map.set(jti, record); },
    async delete(jti) { _map.delete(jti); },
  };
}

let sessionStore;

// ─────────────────────────────────────────────────────────────────────────────
// Minimal HMAC-SHA256 JWT helpers (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expectedSig))) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function mintSessionToken(address, origin, maxLifetimeExp) {
  const now = Date.now();
  const jti = crypto.randomBytes(16).toString('hex');
  const exp = now + SESSION_TTL_MS;
  const resolvedMaxLifetimeExp = maxLifetimeExp || now + REFRESH_MAX_MS;
  const token = signToken({
    address,
    origin,
    iat: now,
    exp,
    jti,
    type: 'session',
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(exp).toISOString(),
    maxLifetimeExp: resolvedMaxLifetimeExp,
  });
  return { token, jti, exp, maxLifetimeExp: resolvedMaxLifetimeExp };
}

function parseCookies(req) {
  const raw = req.headers['cookie'] || '';
  const cookies = {};
  for (const part of raw.split(';')) {
    const [key, ...vals] = part.trim().split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(vals.join('='));
  }
  return cookies;
}

function getRequestToken(req) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.body?.sessionToken || null;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_TTL_MS / 1000;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Path=/`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Axia API helpers
// ─────────────────────────────────────────────────────────────────────────────
function axiaHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  // Only send the project secret header for private projects.
  if (AXIA_PROJECT_SECRET) headers['x-axia-project-secret'] = AXIA_PROJECT_SECRET;
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portfolio/:address
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/portfolio/:address', async (req, res) => {
  const { address } = req.params;
  try {
    const upstream = await fetch(`${AXIA_BASE}/v1/${AXIA_PROJECT_ID}/portfolio/${address}`, {
      headers: axiaHeaders(),
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    console.error('[server] /api/portfolio error:', err.message);
    res.status(502).json({ success: false, error: 'Upstream request failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/price
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/price', async (req, res) => {
  try {
    const vs = req.query.vs || 'usd';
    const upstream = await fetch(`${AXIA_BASE}/v1/${AXIA_PROJECT_ID}/price/minima?vs=${vs}`, {
      headers: axiaHeaders(),
    });
    const body = await upstream.json();
    if (!upstream.ok) {
      // Forward upstream "price unavailable" state to dApps without inventing a fallback price.
      console.warn(`[server] /api/price upstream returned ${upstream.status}:`, JSON.stringify(body));
    }
    res.status(upstream.status).json(body);
  } catch (err) {
    console.error('[server] /api/price error:', err.message);
    res.status(502).json({ success: false, error: 'Upstream request failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ws-token
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/ws-token', async (req, res) => {
  try {
    const upstream = await fetch(`${AXIA_BASE}/v1/wallet/ws-token`, {
      method: 'POST',
      headers: {
        ...axiaHeaders(),
        // Pass the project ID so the backend can scope the JWT correctly.
        // Falls back to 'totem-shared' if no project ID is configured,
        // which keeps backward compatibility with the Totem wallet pattern.
        'x-api-key': AXIA_PROJECT_ID || 'totem-shared',
      },
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    console.error('[server] /api/ws-token error:', err.message);
    res.status(502).json({ success: false, error: 'Upstream request failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify
//
// Receives a TOTEM_VERIFY proof, cryptographically verifies the WOTS
// signature against the connected spend address's public key, and on success
// issues a session token. After a successful verification the client can
// call GET /api/auth/session (or POST /api/auth/refresh) for all subsequent
// page loads without triggering a new WOTS signing operation.
//
// Body: { address, signature, publicKey, message, origin? }
// Response: { success, address, sessionToken, sessionExpiresAt }
// Side-effect: sets HttpOnly "totem_session" cookie
//
// Validation order:
//   1. All required fields present                       → 400 if missing
//   2. WOTS signature + address↔publicKey binding        → 401 if invalid
//      verified via @totemsdk/core verifySignatureDetailed
//
// In TOTEM_CONNECT v4.1, TOTEM_VERIFY signs from the connected spend
// address's per-address TreeKey, so `deriveAddress(publicKey) === address`
// holds. The high-level verifySignatureDetailed(address, message, sig,
// publicKey) one-liner re-derives the Minima address from `publicKey`,
// parses the TreeSignature, and verifies it against sha3_256(message) — a
// single call covers both the binding and the WOTS check.
// ─────────────────────────────────────────────────────────────────────────────

let sdkCorePromise;
function loadSdkCore() {
  if (!sdkCorePromise) {
    sdkCorePromise = import('@totemsdk/core');
  }
  return sdkCorePromise;
}

async function verifyTotemProof({ address, message, signature, publicKey }) {
  const { verifySignatureDetailed } = await loadSdkCore();
  return verifySignatureDetailed(address, String(message), signature, publicKey);
}

app.post('/api/auth/verify', async (req, res) => {
  const { address, signature, publicKey, message, origin } = req.body;

  if (!address || !signature || !publicKey || !message) {
    return res.status(400).json({ success: false, error: 'Missing verification fields' });
  }

  let verifyResult;
  try {
    verifyResult = await verifyTotemProof({ address, message, signature, publicKey });
  } catch (err) {
    console.error('[server] /api/auth/verify — WOTS verification crashed:', err.message);
    return res.status(500).json({ success: false, error: 'Signature verification failed (internal error)' });
  }

  if (!verifyResult.valid) {
    console.warn('[server] /api/auth/verify — signature rejected:', verifyResult.error);
    return res.status(401).json({
      success: false,
      error: `Signature verification failed: ${verifyResult.error}`,
    });
  }

  console.log('[server] TOTEM_VERIFY proof verified for address:', address);

  const requestOrigin = origin || req.headers['origin'] || '*';
  const { token, jti, exp, maxLifetimeExp } = mintSessionToken(address, requestOrigin);

  try {
    await sessionStore.set(jti, { address, origin: requestOrigin, exp, maxLifetimeExp });
  } catch (err) {
    console.error('[server] /api/auth/verify — session store error:', err.message);
    return res.status(503).json({ success: false, error: 'Session store unavailable' });
  }

  setSessionCookie(res, token);

  res.json({
    success: true,
    address,
    sessionToken: token,
    sessionExpiresAt: exp,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/session
//
// Validates the current session token without any WOTS signing.
// Returns { valid, address, expiresAt } — the client caches this to decide
// whether to skip TOTEM_VERIFY on the next page load or reconnect.
//
// Token is read from the HttpOnly cookie or Authorization: Bearer header.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/auth/session', async (req, res) => {
  const token = getRequestToken(req);
  if (!token) {
    return res.json({ valid: false });
  }

  const payload = verifyToken(token);
  if (!payload) {
    clearSessionCookie(res);
    return res.json({ valid: false });
  }

  const now = Date.now();
  if (payload.exp < now) {
    try { await sessionStore.delete(payload.jti); } catch (_) {}
    clearSessionCookie(res);
    return res.json({ valid: false, reason: 'expired' });
  }

  let record;
  try {
    record = await sessionStore.get(payload.jti);
  } catch (err) {
    console.error('[server] /api/auth/session — session store error:', err.message);
    return res.status(503).json({ valid: false, reason: 'store_unavailable' });
  }

  if (!record) {
    clearSessionCookie(res);
    return res.json({ valid: false, reason: 'revoked' });
  }

  res.json({
    valid: true,
    address: payload.address,
    origin: payload.origin,
    expiresAt: payload.exp,
    issuedAt: payload.iat,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
//
// Extends the session within its max-lifetime window (7 days from first
// issuance) without requiring a new WOTS signature. Returns a new session
// token with a reset 24-hour TTL.
//
// If the max-lifetime window has expired, returns { valid: false } and the
// client must call TOTEM_VERIFY again to re-authenticate.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/refresh', async (req, res) => {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ valid: false, reason: 'no_token' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    clearSessionCookie(res);
    return res.status(401).json({ valid: false, reason: 'invalid_token' });
  }

  let record;
  try {
    record = await sessionStore.get(payload.jti);
  } catch (err) {
    console.error('[server] /api/auth/refresh — session store error:', err.message);
    return res.status(503).json({ valid: false, reason: 'store_unavailable' });
  }

  if (!record) {
    clearSessionCookie(res);
    return res.status(401).json({ valid: false, reason: 'revoked' });
  }

  const now = Date.now();

  if (now > payload.maxLifetimeExp) {
    try { await sessionStore.delete(payload.jti); } catch (_) {}
    clearSessionCookie(res);
    return res.status(401).json({ valid: false, reason: 'max_lifetime_expired' });
  }

  const { token: newToken, jti: newJti, exp } = mintSessionToken(
    payload.address,
    payload.origin,
    payload.maxLifetimeExp,
  );

  try {
    await sessionStore.delete(payload.jti);
    await sessionStore.set(newJti, {
      address: payload.address,
      origin: payload.origin,
      exp,
      maxLifetimeExp: payload.maxLifetimeExp,
    });
  } catch (err) {
    console.error('[server] /api/auth/refresh — session store error:', err.message);
    return res.status(503).json({ valid: false, reason: 'store_unavailable' });
  }

  setSessionCookie(res, newToken);

  res.json({
    valid: true,
    address: payload.address,
    sessionToken: newToken,
    sessionExpiresAt: exp,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-ownership
//
// Receives a Root Identity OwnershipProof (produced by TOTEM_PROVE_OWNERSHIP)
// and verifies it server-side via RootIdentityWallet.verifyOwnershipProof from
// @totemsdk/root-identity (pure crypto — no network access needed).
//
// Body: { proof: OwnershipProof }
// Response: { valid: boolean, rootAddress?: string, childAddresses?: string[], error?: string }
//
// Verification steps (all performed inside verifyOwnershipProof):
//   1. Rebuild canonical ownership message from rootAddress, childPublicKeys, timestamp.
//   2. Verify root WOTS signature against root public key.
//   3. Confirm each child public key correctly derives its child address.
// ─────────────────────────────────────────────────────────────────────────────

let rootIdentitySdkPromise;
function loadRootIdentitySdk() {
  if (!rootIdentitySdkPromise) {
    rootIdentitySdkPromise = import('@totemsdk/root-identity').catch((err) => {
      rootIdentitySdkPromise = null;
      throw new Error(`@totemsdk/root-identity failed to load: ${err?.message}. Ensure the package is installed.`);
    });
  }
  return rootIdentitySdkPromise;
}

app.post('/api/auth/verify-ownership', async (req, res) => {
  const { proof } = req.body;

  if (!proof || typeof proof !== 'object') {
    return res.status(400).json({ valid: false, error: 'Missing or malformed proof object' });
  }

  const { rootAddress, rootPublicKey, childAddresses, childPublicKeys, rootProof, timestamp } = proof;

  if (!rootAddress || !rootPublicKey || !rootProof || !timestamp ||
      !Array.isArray(childAddresses) || !Array.isArray(childPublicKeys) ||
      childAddresses.length === 0) {
    return res.status(400).json({ valid: false, error: 'Incomplete proof — missing required fields' });
  }

  let valid = false;
  try {
    const { RootIdentityWallet } = await loadRootIdentitySdk();
    valid = RootIdentityWallet.verifyOwnershipProof(proof);
  } catch (err) {
    console.error('[server] /api/auth/verify-ownership — verification crashed:', err.message);
    return res.status(500).json({ valid: false, error: 'Proof verification failed (internal error)' });
  }

  if (!valid) {
    console.warn('[server] /api/auth/verify-ownership — proof rejected for root:', rootAddress?.slice(0, 12));
    return res.status(401).json({ valid: false, error: 'Ownership proof is invalid' });
  }

  console.log('[server] /api/auth/verify-ownership — proof verified, root:', rootAddress?.slice(0, 12), 'children:', childAddresses.length);

  res.json({
    valid: true,
    rootAddress,
    childAddresses,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/proof/stamp
//
// Stamps an arbitrary hex hash on Minima via Integritas using
// @totemsdk/proof-integritas. The INTEGRITAS_API_KEY never leaves the server.
//
// Body:    { hash: string }   — hex-encoded hash to anchor (e.g. SHA-256)
// Returns: { ok, txId?, anchorRef?, timestamp?, error? }
// ─────────────────────────────────────────────────────────────────────────────

const INTEGRITAS_API_KEY = process.env.INTEGRITAS_API_KEY || '';
const INTEGRITAS_BASE_URL = process.env.INTEGRITAS_BASE_URL || 'https://integritas.minima.global/core/v2';

let proofIntegritasPromise;
function loadProofIntegritas() {
  if (!proofIntegritasPromise) {
    proofIntegritasPromise = import('@totemsdk/proof-integritas').catch((err) => {
      proofIntegritasPromise = null;
      throw new Error(`@totemsdk/proof-integritas failed to load: ${err?.message}. Ensure the package is installed.`);
    });
  }
  return proofIntegritasPromise;
}

app.post('/api/proof/stamp', async (req, res) => {
  const { hash } = req.body;

  if (!hash || typeof hash !== 'string' || !hash.trim()) {
    return res.status(400).json({ ok: false, error: 'Missing or empty hash' });
  }

  let createIntegritasProofProvider;
  try {
    ({ createIntegritasProofProvider } = await loadProofIntegritas());
  } catch (err) {
    console.error('[server] /api/proof/stamp — package load failed:', err.message);
    return res.status(503).json({ ok: false, error: 'Proof provider unavailable' });
  }

  const provider = createIntegritasProofProvider({
    baseUrl: INTEGRITAS_BASE_URL,
    apiKey: INTEGRITAS_API_KEY,
  });

  let result;
  try {
    result = await provider.stampHash({ hash: hash.trim() });
  } catch (err) {
    console.error('[server] /api/proof/stamp — Integritas error:', err.message);
    return res.status(502).json({ ok: false, error: 'Integritas request failed' });
  }

  if (!result.ok) {
    return res.status(200).json({ ok: false, error: result.error ?? 'Stamp failed' });
  }

  const data = result.data ?? {};
  res.json({
    ok: true,
    txId: data.txId ?? null,
    anchorRef: data.anchorRef ?? null,
    timestamp: data.timestamp ?? null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/proof/check
//
// Checks whether a previously stamped hex hash has been anchored on-chain via
// Integritas. Calls provider.checkHash() from @totemsdk/proof-integritas.
// The INTEGRITAS_API_KEY never leaves the server.
//
// Body:    { hash: string }   — hex-encoded hash to check (e.g. SHA-256)
// Returns: { ok, status?, txId?, anchorRef?, timestamp?, error? }
//   status values: "anchored" | "pending" | "not_found"
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/proof/check', async (req, res) => {
  const { hash } = req.body;

  if (!hash || typeof hash !== 'string' || !hash.trim()) {
    return res.status(400).json({ ok: false, error: 'Missing or empty hash' });
  }

  let createIntegritasProofProvider;
  try {
    ({ createIntegritasProofProvider } = await loadProofIntegritas());
  } catch (err) {
    console.error('[server] /api/proof/check — package load failed:', err.message);
    return res.status(503).json({ ok: false, error: 'Proof provider unavailable' });
  }

  const provider = createIntegritasProofProvider({
    baseUrl: INTEGRITAS_BASE_URL,
    apiKey: INTEGRITAS_API_KEY,
  });

  let result;
  try {
    result = await provider.checkHash({ hash: hash.trim() });
  } catch (err) {
    console.error('[server] /api/proof/check — Integritas error:', err.message);
    return res.status(502).json({ ok: false, error: 'Integritas request failed' });
  }

  if (!result.ok) {
    // The normalizer produces one of two error shapes:
    //   1. raw.message was set → error = raw.message  (e.g. "not found", "pending")
    //   2. raw.message absent  → error = "Integritas check failed (status: not_found)"
    // Handle both by: first try to extract "(status: <value>)" from the structured
    // template, then fall back to matching known keywords in the raw error text.
    const errLower = (result.error ?? '').toLowerCase();
    const statusPatternMatch = errLower.match(/\(status:\s*([^)]+)\)/);
    const extractedStatus = statusPatternMatch
      ? statusPatternMatch[1].trim()
      : null;

    let derivedStatus;
    if (
      extractedStatus === 'not_found' ||
      extractedStatus === 'not found' ||
      errLower === 'not found' ||
      errLower === 'not_found' ||
      errLower.startsWith('not found') ||
      errLower.startsWith('not_found')
    ) {
      derivedStatus = 'not_found';
    } else if (
      extractedStatus === 'pending' ||
      errLower === 'pending'
    ) {
      derivedStatus = 'pending';
    } else {
      derivedStatus = 'pending';
    }

    return res.status(200).json({
      ok: false,
      status: derivedStatus,
      error: result.error ?? 'Check failed',
    });
  }

  const data = result.data ?? {};
  res.json({
    ok: true,
    status: 'anchored',
    txId: data.txId ?? null,
    anchorRef: data.anchorRef ?? null,
    timestamp: data.timestamp ?? null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/proof/verify
//
// Full proof verification: runs a local WOTS signature check followed by
// an on-chain anchor check via Integritas.  Accepts a SignedProof object
// produced by anchorProof() and delegates to provider.verifyProof().
// The INTEGRITAS_API_KEY never leaves the server.
//
// Body:    { proof: SignedProof, skipLocalVerification?: boolean }
// Returns: { valid: boolean, signerAddress?: string, reason?: string, error?: string }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/proof/verify', async (req, res) => {
  const { proof, skipLocalVerification } = req.body;

  if (!proof || typeof proof !== 'object') {
    return res.status(400).json({ valid: false, error: 'Missing or malformed proof object' });
  }

  if (!proof.signature || !proof.payload) {
    return res.status(400).json({
      valid: false,
      error: 'Incomplete SignedProof — must contain signature and payload fields',
    });
  }

  let createIntegritasProofProvider;
  try {
    ({ createIntegritasProofProvider } = await loadProofIntegritas());
  } catch (err) {
    console.error('[server] /api/proof/verify — package load failed:', err.message);
    return res.status(503).json({ valid: false, error: 'Proof provider unavailable' });
  }

  const provider = createIntegritasProofProvider({
    baseUrl: INTEGRITAS_BASE_URL,
    apiKey: INTEGRITAS_API_KEY,
  });

  let result;
  try {
    result = await provider.verifyProof(proof, {
      skipLocalVerification: skipLocalVerification === true,
    });
  } catch (err) {
    console.error('[server] /api/proof/verify — verification crashed:', err.message);
    return res.status(500).json({ valid: false, error: 'Proof verification failed (internal error)' });
  }

  if (!result.valid) {
    console.warn('[server] /api/proof/verify — proof rejected:', result.reason);
    return res.status(200).json({
      valid: false,
      reason: result.reason ?? 'Verification failed',
    });
  }

  console.log('[server] /api/proof/verify — proof verified, signer:', result.signerAddress?.slice(0, 12));

  res.json({
    valid: true,
    signerAddress: result.signerAddress ?? null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
//
// Immediately invalidates the session by removing its server-side record.
// The cookie is also cleared so the browser does not send a stale token.
// Safe to call even when no valid session exists.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  const token = getRequestToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.jti) {
      try {
        await sessionStore.delete(payload.jti);
      } catch (err) {
        console.error('[server] /api/auth/logout — session store error:', err.message);
      }
    }
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

const ready = createSessionStore()
  .then((store) => {
    sessionStore = store;
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`[server] Totem dApp Starter backend running on http://localhost:${PORT}`);
        console.log(`[server] AXIA_API_KEY: ${AXIA_API_KEY ? '(set)' : '(NOT SET — set AXIA_API_KEY in .env)'}`);
        console.log(`[server] SESSION_SECRET: ${process.env.SESSION_SECRET ? '(set)' : '(auto-generated — set SESSION_SECRET in .env for persistence)'}`);
        console.log(`[server] REDIS_URL: ${process.env.REDIS_URL ? '(set — using Redis session store)' : '(not set — using in-memory session store)'}`);
      });
    }
  })
  .catch((err) => {
    console.error('[server] FATAL: Failed to initialize session store:', err.message);
    if (process.env.REDIS_URL) {
      console.error('[server] REDIS_URL is set but the Redis server is unreachable. Refusing to start.');
      console.error('[server] Fix REDIS_URL or unset it to use the in-memory fallback.');
    }
    process.exit(1);
  });

module.exports = { app, ready };
