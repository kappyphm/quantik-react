import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: React chạy ở :5173, Python (FastAPI) ở :8000. /api được proxy sang Python.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
});
