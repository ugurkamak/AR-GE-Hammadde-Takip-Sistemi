import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages icin base yolu
// Depo adini degistirirsen burayi da degistir.
export default defineConfig({
  plugins: [react()],
  base: '/AR-GE-Hammadde-Takip-Sistemi/',
})
