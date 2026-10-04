import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (file server, artifact, GitHub Pages).
export default defineConfig({
  base: './',
});
