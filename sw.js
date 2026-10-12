const CACHE='og-app-80b3add2d0cd';
const FILES=['./','./index.html','./style.css','./app.js','./calculator.js','./format.js','./help.js','./i18n.js','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png','./fonts/chinese-ui.woff2','./fonts/OFL.txt'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('og-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
