/**
 * Self-hosted node consent registry (RFC-013 §11).
 *
 * Deliberately dependency-free so wallet config modules and unit tests can use
 * it without pulling in the Ed25519 signature stack. Populated ONLY after an
 * explicit, user-driven opt-in; never a build-time bypass.
 */

const consentedHosts = new Set<string>();

/** Extract hostname from URL for validation. */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

/** Register a self-hosted node host after explicit user consent. */
export function registerConsentedHost(url: string): void {
  consentedHosts.add(extractHostname(url));
}

/** Withdraw consent for a self-hosted node host. */
export function unregisterConsentedHost(url: string): void {
  consentedHosts.delete(extractHostname(url));
}

/** Clear all runtime consent (e.g. on reset). */
export function clearConsentedHosts(): void {
  consentedHosts.clear();
}

/** True when `url`'s host was explicitly consented to at runtime. */
export function isConsentedHost(url: string): boolean {
  return consentedHosts.has(extractHostname(url));
}

/**
 * Validate a self-hosted Minima node URL: scheme consent (HTTPS remote, http
 * loopback only) plus explicit runtime consent.
 */
export function validateNodeUrl(url: string): void {
  const parsed = new URL(url);
  const schemeOk =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname));
  if (!schemeOk) {
    throw new Error(
      'Self-hosted node URL must use HTTPS. Plain http is allowed only for localhost/127.0.0.1/::1.',
    );
  }
  if (!isConsentedHost(url)) {
    throw new Error(
      'Self-hosted node requires explicit user consent. Enable it in Network Settings before use.',
    );
  }
}
