export default defineNuxtConfig({
  compatibilityDate: '2026-11-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  app: { head: { title: 'Consensish · Decide together', meta: [{ name: 'description', content: 'A little structure for decisions made together. Asynchronous consensus for groups and communities.' }] } },
  nitro: { preset: 'node-server', externals: { external: ['node:sqlite'] } },
})
