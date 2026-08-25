/* Офлайн-кеш приложения. Версия подставляется сборкой сайта (scripts/build-site.sh):
   при каждом деплое имя кеша меняется, старый удаляется, поэтому залипания не бывает. */
var VERSION = "dev";
var CACHE = "saa-c03-" + VERSION;

/* оболочка приложения: без этих файлов офлайн бесполезен */
var SHELL = [
  "./",
  "index.html",
  "config.js",
  "manifest.webmanifest",
  "icon.svg",
  "css/app.css",
  "data/bank.js",
  "data/theory.js",
  "data/explain.js",
  "js/storage.js",
  "js/quiz.js",
  "js/theory.js",
  "js/app.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) {
      return k === CACHE ? null : caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* сам воркер никогда не берём из кеша, иначе новая сборка не приедет */
  if (url.pathname === "/sw.js" || url.pathname.slice(-7) === "/sw.js") return;

  /* навигация: сначала сеть, при её отсутствии — сохранённая страница */
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(function () {
      return caches.match("index.html", { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("./", { ignoreSearch: true });
      });
    }));
    return;
  }

  /* кешируем только оболочку и картинки-экспонаты: всё остальное идёт в сеть как есть */
  var isShell = SHELL.some(function (f) {
    return url.pathname === new URL(f, self.registration.scope).pathname;
  });
  var isImage = url.pathname.indexOf("/images/") !== -1;
  if (!isShell && !isImage) return;

  e.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});
