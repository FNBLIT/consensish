export default defineNuxtConfig({
  compatibilityDate: '2026-11-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  app: { head: { title: 'Consensish · Group decisions', meta: [{ name: 'description', content: 'Review proposals, respond, and record consensus decisions for your group.' }] } },
  nitro: { preset: 'node-server', externals: { external: ['node:sqlite'] } },
})
