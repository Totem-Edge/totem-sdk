/**
 * wallet.totem.ing gateway (Cloudflare Pages advanced mode).
 *
 * - /web/*  -> the Totem PWA wallet (this Pages project)
 * - everything else -> the portfolio app (Toteming Pages project)
 *
 * The PWA is built with VITE_BASE_PATH=/web/ so its assets, manifest,
 * service-worker scope and approval pages are namespaced under /web/.
 */
const PWA_PREFIX = "/web";
const DEFAULT_PORTFOLIO_ORIGIN = "https://toteming.pages.dev";

/**
 * Legacy service worker at the old root scope.
 *
 * Before the /web rebase the wallet registered a service worker at "/" that
 * precached the wallet shell. After the rebase the root belongs to the
 * portfolio, but existing clients would keep serving the cached wallet from
 * that registration. This kill-switch unregisters it and clears its caches on
 * the next update check.
 */
const LEGACY_SW = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (error) {}
    try { await self.registration.unregister(); } catch (error) {}
  })());
});
`;

function portfolioOrigin(env) {
  return env.PORTFOLIO_ORIGIN || DEFAULT_PORTFOLIO_ORIGIN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === PWA_PREFIX) {
      return Response.redirect(`${url.origin}${PWA_PREFIX}/`, 308);
    }

    if (url.pathname.startsWith(`${PWA_PREFIX}/`)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = url.pathname.slice(PWA_PREFIX.length) || "/";
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    // Retire the pre-/web service worker and repoint its manifest.
    if (url.pathname === "/sw.js") {
      return new Response(LEGACY_SW, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    if (url.pathname === "/manifest.webmanifest") {
      return Response.redirect(`${url.origin}${PWA_PREFIX}/manifest.webmanifest`, 302);
    }

    if (url.pathname === "/early-access" || url.pathname === "/early-access/") {
      return Response.redirect(`${url.origin}/`, 302);
    }

    const target = new URL(portfolioOrigin(env));
    target.pathname = url.pathname === "/" ? "/portfolio" : url.pathname;
    target.search = url.search;
    return fetch(new Request(target.toString(), request));
  },
};
