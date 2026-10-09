import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        telecom: resolve(import.meta.dirname, "telecom.html"),
        phone: resolve(import.meta.dirname, "phone.html"),
        printer: resolve(import.meta.dirname, "printer.html"),
        command: resolve(import.meta.dirname, "command.html"),
        confirmation: resolve(import.meta.dirname, "Confirmation.html"),
        submit: resolve(import.meta.dirname, "submit.html"),
      },
    },
  },
});