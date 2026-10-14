import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DriveMyWay — Live Tracker',
        short_name: 'Trip Tracker',
        description: 'Track your family member\'s DriveMyWay trip in real time',
        theme_color: '#1A6B5A',
        background_color: '#F5F7FA',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    // Keep chunk size small — this page must load fast on slow mobile connections
    rollupOptions: {
      output: {
        manualChunks: {
          'socket-io': ['socket.io-client'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
