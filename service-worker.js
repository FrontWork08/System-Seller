"use strict";
var CACHE = "system-seller-v20260917-5";
var SHELL = [
  "/", "/index.html", "/styles.css", "/modular.css", "/config.js",
  "/js/core.js", "/js/time.js", "/js/auth.js", "/js/pages.js", "/js/actions.js",
  "/js/customer-pricing.js", "/js/offline-sync.js", "/js/order-extensions.js", "/js/payments.js",
  "/js/modular-shell.js", "/js/quotes.js", "/js/production.js", "/js/calendar.js", "/js/offline-cache.js",
  "/js/costs.js", "/js/reports.js", "/js/attachments.js", "/js/three-d-pricing.js", "/js/inventory-3d.js", "/js/notifications.js", "/js/sync-conflicts.js",
  "/js/documents.js", "/js/backup-modular.js", "/js/pwa.js", "/js/three-d-pricing-ui.js", "/js/main.js",
  "/assets/system-seller-icon.png", "/assets/system-seller-logo.png", "/manifest.webmanifest"
];
var EXTERNAL_RUNTIME = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
];

async function cacheExternalRuntime(cache) {
  await Promise.all(EXTERNAL_RUNTIME.map(async function (url) {
    try {
      var req = new Request(url, { mode: "no-cors", cache: "reload" });
      var res = await fetch(req);
      await cache.put(req, res.clone());
    } catch (err) {
      // Best effort: the app can still work online and the next controlled visit retries.
    }
  }));
}

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(async function (cache) {
    await cache.addAll(SHELL);
    await cacheExternalRuntime(cache);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var isLocal = url.origin === self.location.origin;
  var isPinnedCdn = EXTERNAL_RUNTIME.indexOf(url.href) !== -1;
  if (!isLocal && !isPinnedCdn) return;

  if (isPinnedCdn) {
    event.respondWith(caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        return res;
      });
    }));
    return;
  }

  event.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && ["document", "script", "style", "image", "manifest"].indexOf(req.destination) !== -1) {
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (cached) { return cached || caches.match("/index.html"); });
  }));
});
