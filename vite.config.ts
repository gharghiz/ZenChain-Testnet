import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/zenchain-swap/', // ← ⚠️ بدّل الاسم حسب الريبو ديالك
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

