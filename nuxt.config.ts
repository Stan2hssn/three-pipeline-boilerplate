import { fileURLToPath } from 'node:url'
import glsl from 'vite-plugin-glsl'

const engine = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2026-08-31',

  ssr: true,

  // Le moteur vit dans `src/`, hors du srcDir Nuxt. `@` est REDEFINI sur
  // `src/` : le moteur importe en `@/_core` et `@/graphics`, le code Vue
  // n'utilise que `~`, qui pointe toujours sur `app/`.
  alias: {
    '@': engine('./src'),
    '@_core': engine('./src/_core'),
    '@graphics': engine('./src/graphics'),
    '@postprocessing': engine('./src/graphics/postprocessing'),
    '@universes': engine('./src/graphics/universes'),
    '@adapters': engine('./src/graphics/adapters'),
  },

  // Sans cet ajout, `src/` reste hors du tsconfig genere : ni le moteur ni ses
  // declarations `*.frag` / `*.vert` ne seraient verifies par `nuxt typecheck`.
  // Chemin relatif a `.nuxt/`, ou le fichier est ecrit.
  typescript: {
    tsConfig: {
      include: ['../src/**/*'],
      compilerOptions: {
        // Nuxt ajoute ces deux flags, que le contrat du boilerplate ne pose
        // pas. Les laisser actifs ferait echouer `typecheck` sur les nodes de
        // demonstration livrees avec le template.
        noUncheckedIndexedAccess: false,
        noImplicitOverride: false,
      },
    },
  },

  css: ['~/assets/css/main.css'],

  build: {
    transpile: ['gsap'],
  },

  vite: {
    // Obligatoire et non cosmetique : les shaders du moteur utilisent
    // `#include`, que seul ce plugin resout. Un import `?raw` livrerait la
    // directive telle quelle au compilateur GLSL.
    plugins: [
      glsl({
        include: ['**/*.glsl', '**/*.wgsl', '**/*.vert', '**/*.frag', '**/*.vs', '**/*.fs'],
        warnDuplicatedImports: true,
        defaultExtension: 'glsl',
        watch: true,
      }),
    ],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      meta: [
        { name: 'theme-color', content: '#060606' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },
})
