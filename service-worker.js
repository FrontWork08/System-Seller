"use strict";
var CACHE = "system-seller-v20260917-1";
var SHELL = [
  "/", "/index.html", "/styles.css", "/modular.css", "/config.js",
  "/js/core.js", "/js/time.js", "/js/auth.js", "/js/pages.js", "/js/actions.js", "/js/payments.js",
  "/js/modular-shell.js", "/js/quotes.js", "/js/customer-pricing.js", "/js/production.js", "/js/calendar.js",
  "/js/costs.js", "/js/reports.js", "/js/attachments.js", "/js/inventory-3d.js", "/js/notifications.js",
  "/js/documents.js", "/js/offline-sync.js", "/js/backup-modular.js", "/js/pwa.js", "/js/main.js",
  "/assets/system-seller-icon.png", "/assets/system-seller-logo.png", "/manifest.webmanifest"
];
self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
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
  if (url.origin !== self.location.origin) return;
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
