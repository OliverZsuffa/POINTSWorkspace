import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const BASE_URL = '/POINTSWorkspace/';

function offlineAppShellPlugin() {
  return {
    name: 'points-offline-app-shell',
    apply: 'build' as const,
    closeBundle() {
      const manifestPath = resolve('dist/build-manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
        string,
        { file: string; css?: string[]; assets?: string[] }
      >;
      const assets = new Set([
        BASE_URL,
        `${BASE_URL}index.html`,
        `${BASE_URL}manifest.webmanifest`,
        `${BASE_URL}icons/icon.svg`,
      ]);
      for (const entry of Object.values(manifest)) {
        assets.add(BASE_URL + entry.file);
        for (const file of entry.css ?? []) assets.add(BASE_URL + file);
        for (const file of entry.assets ?? []) assets.add(BASE_URL + file);
      }

      const cacheName = `points-workspace-${Date.now()}`;
      const serviceWorker = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const SCOPE = ${JSON.stringify(BASE_URL)};
const PRECACHE_URLS = ${JSON.stringify([...assets])};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('points-workspace-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const appShellUrl = new URL('index.html', self.registration.scope).href;
      const cached = await cache.match(appShellUrl);
      if (cached) return cached;
      return fetch(request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline resource unavailable' });
    }
  })());
});
`;
      writeFileSync(resolve('dist/service-worker.js'), serviceWorker);
    },
  };
}

export default defineConfig({
  base: BASE_URL,
  plugins: [react(), offlineAppShellPlugin()],
  build: {
    manifest: 'build-manifest.json',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
