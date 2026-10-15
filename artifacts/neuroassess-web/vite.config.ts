import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';


const rawPort = process.env.PORT ?? '5000';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  define: {
    'process.env.NEXT_PUBLIC_APP_URL': JSON.stringify(process.env.NEXT_PUBLIC_APP_URL ?? ''),
    'process.env.NEXT_PUBLIC_PORTAL_URL': JSON.stringify(process.env.NEXT_PUBLIC_PORTAL_URL ?? ''),
    'process.env.NEXT_PUBLIC_CLINICIAN_PORTAL_URL': JSON.stringify(process.env.NEXT_PUBLIC_CLINICIAN_PORTAL_URL ?? ''),
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    // Feature-flag env layer baked at build time (client flags are rendering
    // only; the server independently enforces). Production flag defaults are
    // off, so deployments enable the shell/workspaces via NEUROCARE_FLAG_*.
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => key.startsWith('NEUROCARE_FLAG_'))
        .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value ?? '')]),
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
      '@neurocare/permissions': path.resolve(import.meta.dirname, '..', '..', 'packages', 'permissions', 'src', 'index.ts'),
      '@neurocare/journey': path.resolve(import.meta.dirname, '..', '..', 'packages', 'journey', 'src', 'index.ts'),
      '@neurocare/feature-flags': path.resolve(import.meta.dirname, '..', '..', 'packages', 'feature-flags', 'src', 'index.ts'),
      '@neurocare/audit': path.resolve(import.meta.dirname, '..', '..', 'packages', 'audit', 'src', 'index.ts'),
      '@neurocare/notifications': path.resolve(import.meta.dirname, '..', '..', 'packages', 'notifications', 'src', 'index.ts'),
      '@neurocare/timeline': path.resolve(import.meta.dirname, '..', '..', 'packages', 'timeline', 'src', 'index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
