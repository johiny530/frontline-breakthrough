import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (file server, artifact, GitHub Pages).
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1000, // three.js alone is ~600 kB
  },
});
