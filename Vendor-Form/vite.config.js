import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        command: resolve(__dirname, 'command.html'),
        confirmation: resolve(__dirname, 'Confirmation.html'),
        phone: resolve(__dirname, 'phone.html'),
        printer: resolve(__dirname, 'printer.html'),
        submit: resolve(__dirname, 'submit.html'),
        telecom: resolve(__dirname, 'telecom.html'),
      },
    },
  },
})