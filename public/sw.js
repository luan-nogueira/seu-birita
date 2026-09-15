self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  // Passa direto pra rede para sempre ter a versão mais recente
  // Isso garante que se houver atualização, o usuário recebe de imediato.
  e.respondWith(fetch(e.request));
});
