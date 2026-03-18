// Service worker mínimo para o jogo ser instalável (PWA)
const CACHE = 'campo-iluminado-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Rede primeiro; sem cache agressivo para sempre carregar a versão mais recente
  event.respondWith(fetch(event.request));
});
