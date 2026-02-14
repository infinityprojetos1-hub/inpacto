const CACHE_NAME = 'orcamentos-inpacto-v1';
const BASE_PATH = '/inpacto';

const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/js/config.js`,
  `${BASE_PATH}/js/firebase-config.js`,
  `${BASE_PATH}/js/ui-controller.js`,
  `${BASE_PATH}/js/orcamentos.js`,
  `${BASE_PATH}/js/pdf-concorrentes.js`,
  `${BASE_PATH}/js/pdf-generator.js`,
  `${BASE_PATH}/js/empresa-ggproauto.js`,
  `${BASE_PATH}/js/empresa-stv.js`,
  `${BASE_PATH}/js/empresa-upservicos.js`,
  `${BASE_PATH}/js/empresa-sena.js`,
  `${BASE_PATH}/js/empresa-instalassom.js`,
  `${BASE_PATH}/js/empresa-megaeventos.js`,
  `${BASE_PATH}/js/empresa-glauber.js`,
  `${BASE_PATH}/js/notas-fiscais.js`,
  `${BASE_PATH}/js/relatorio-tecnico.js`,
  `${BASE_PATH}/js/material-manager.js`,
  `${BASE_PATH}/js/checklist-manager.js`,
  `${BASE_PATH}/js/main.js`,
  `${BASE_PATH}/js/relatorio.js`,
  `${BASE_PATH}/manifest.json`
];

// Instala o Service Worker e faz cache dos recursos
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: Fazendo cache dos arquivos');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativa o Service Worker e limpa caches antigos
self.addEventListener('activate', event => {
  console.log('✅ Service Worker: Ativando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepta requisições e serve do cache quando possível
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se existir
        if (response) {
          return response;
        }
        
        // Senão, busca da rede
        return fetch(event.request)
          .then(response => {
            // Verifica se é uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clona a resposta
            const responseToCache = response.clone();
            
            // Adiciona ao cache para próximas vezes
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Se falhar, retorna página offline (opcional)
            return caches.match(`${BASE_PATH}/index.html`);
          });
      })
  );
});

// Sincronização em background (quando voltar online)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-firebase') {
    event.waitUntil(syncFirebase());
  }
});

async function syncFirebase() {
  console.log('🔄 Service Worker: Sincronizando com Firebase...');
  // A sincronização real será feita pelo firebase-config.js
}

// Notificações push (futuro)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nova atualização disponível!',
    icon: `${BASE_PATH}/icon-192.png`,
    badge: `${BASE_PATH}/icon-192.png`,
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification('Gerador de Orçamentos', options)
  );
});

console.log('🚀 Service Worker carregado!');
