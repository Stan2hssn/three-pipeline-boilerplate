# `_core` — référence du moteur

Ce document décrit le fonctionnement **réel** du `_core`, tel que le code l'implémente. Il fait foi sur les autres documents : `README.md` (racine), `NodeContract.md` et `docs/AUDIT_AND_PLAN.md` sont en partie obsolètes (voir [Documents existants](#documents-existants)).

## Règle de portage

Le `_core` est partagé par tous les projets issus de ce template. **Un projet ne le modifie pas pour ses besoins propres** : ce qui est spécifique va dans `src/graphics/`.

Quand une modification du `_core` est inévitable (un manque du moteur, pas un besoin du projet) :

1. vérifier d'abord qu'aucune solution côté `graphics/` ne suffit — le plus souvent, un crochet de [`DeviceConfig`](#ce-quun-projet-fournit-au-core) suffit — et le dire ;
2. faire la modification **dans ce template d'abord**, puis la recopier telle quelle dans chaque projet (voir [Projets alignés](#projets-alignés)) ;
3. l'inscrire au [Journal des modifications](#journal-des-modifications) : quoi, pourquoi, fichiers, projet d'origine.

Le `_core` d'un projet doit rester **identique octet pour octet** à celui du template. Pour synchroniser un projet :

```bash
rsync -a --delete --exclude .DS_Store ~/Dev/Templates/three-pipeline-boilerplate/src/_core/ src/_core/
diff -rq -x .DS_Store ~/Dev/Templates/three-pipeline-boilerplate/src/_core src/_core
```

Un changement du `_core` qui ne vit que dans un projet est perdu pour les suivants.

## Style de code

S'applique au `_core` comme à `graphics/` et `app/`.

- **Simple, concis, structuré.** Le code le plus court qui reste lisible gagne.
- **Typer ce qui sert** : signatures exportées et frontières entre modules. Le reste est inféré. Pas d'interface, de générique ni de surcharge sans deuxième usage réel. Si le typage est plus long que le code qu'il décrit, il est de trop : un `as` ponctuel vaut mieux qu'un échafaudage de types.
- **Commentaires, même règle** : une ligne, pour un *pourquoi* non évident. Ni paraphrase, ni historique (« avant, … ») — l'historique vit dans les commits et le journal ci-dessous.

```ts
// Non : 12 lignes de types et de récit pour 3 lignes utiles.
/**
 * Contrat structurel du renderer attendu ici. On ne l'importe pas de three
 * parce que, historiquement, le type a changé entre deux versions et que...
 */
interface RendererLike { setSize(w: number, h: number, u?: boolean): void }
type ResizeTarget<T extends RendererLike = RendererLike> = { renderer: T };
function resize<T extends RendererLike>(t: ResizeTarget<T>, w: number, h: number): void {
  t.renderer.setSize(w, h, false);
}

// Oui.
// `false` : la taille CSS appartient au canvas, pas au renderer.
const resize = (renderer: Renderer, w: number, h: number) => renderer.setSize(w, h, false);
```

## Carte des modules

| Dossier | Rôle | Exporté par `index.ts` |
|---|---|---|
| `systems/` | Orchestration : `ThreeDevice` (bootstrap), `Runtime`, `RAF`, `Input`, `Output`, `State` ; `DeviceConfig.type.ts`, le contrat d'extension du projet ; `Renderer.type.ts`, l'union WebGL / WebGPU | `Input`, `Output`, `RAF`, `Runtime`, `State`, `Viewport`, `Renderer`, `RendererBackend`, `RendererParameters` — **pas** `ThreeDevice` ni `DeviceConfig` (chemin profond) |
| `universes/` | `UniverseBase` : scène, caméra, graphe de nodes, pipeline, contrats | `UniverseBase`, `IUniverseContract` |
| `registries/` | `UniverseRegistry` : fabriques d'univers paresseuses (`define`, `getOrCreate`, `getDefaultId`) | `UniverseRegistry` |
| `nodes/` | `NodeBase`, `Object3DNodeBase`, `InteractiveObject3DNodeBase`, `GroupNodeBase`, `NodeGroupBase`, `NodeGraph` | tous, avec leurs interfaces |
| `pipeline/` | `IPass`, `IPipeline`, `PipelineBase`, `PassContext` | tous |
| `interaction/` | `InteractionManager` : raycast différé, survol, clic, capture pendant le drag | `InteractionManager` |
| `assets/` | Manifeste typé, `AssetStore` (chargement, cache, groupes) | **rien** — importer `@_core/assets/index.ts` |
| `shaders/` | `defineShaders`, `createShaderKeys`, `createShaderStore`, `ShaderStore` | tous |
| `debug/` | `DebugManager` (Tweakpane, onglets, abonnements, instantanés, bindings persistants), `DebugValues` (arbre de réglages enregistrés), `DebugFlags` (`?debug`, `?stats`, drapeaux d'URL retenus en session) | `debug`, `DebugManager`, `DebugValueStore`, `applyValue`, `isStorable`, `serialize`, types — **pas** `DebugFlags`, importé par son chemin pour rester léger |
| `stats/` | `StatsManager` (stats-gl, three-perf, chargés à la demande) | `StatsManager` |
| `helpers/event/` | Constantes d'événements souris et clavier | `EventMouse`, `EventKeyboard` |
| `types/` | `FrameTiming { time, deltaTime }`, en millisecondes | `FrameTiming` |
| `lifecycle/` | `ILifecycle` : noms qui ne correspondent plus au contrat réel, quasi mort | — |

Dans les faits, `graphics/` importe par chemins profonds (`@_core/nodes/...`) plutôt que par le barrel.

## Démarrage

1. `app/pages/index.vue` monte `<ThreeStage>`. Au `nextTick`, le composant importe dynamiquement `ThreeDevice` et appelle `ThreeDevice.create(canvas, config)`.
2. `create` construit le renderer selon `DEVICE_CONFIG.renderer.backend` (voir [WebGL et WebGPU](#webgl-et-webgpu)), puis le constructeur de `ThreeDevice` :
   - règle le renderer (sRGB, carte d'ombres et plafonds de pixel ratio lus dans `DEVICE_CONFIG.renderer`), crée l'`AssetStore` du `ASSET_MANIFEST`, le `ShaderStore`, le `StatsManager` et le `State` ;
   - déclare chaque entrée de `UNIVERSE_MANIFEST` dans le registre, sans l'instancier ;
   - crée le `Runtime`, qui crée `Input`, `Output` et `RAF`.
3. `init()` :
   1. taille et viewport ;
   2. `await preloadGroup("boot")`, puis `DEVICE_CONFIG.onBoot(device)` ;
   3. `runtime.init()` ;
   4. `debug.setPersistence(DEVICE_CONFIG.debugPersistence)` **toujours** — les réglages enregistrés sont la configuration de la scène ;
   5. `debug.init(DEBUG_CONFIG)` **seulement si** `?debug` ; stats de base si `?stats` ;
   6. entrées DOM, panneau des stats, puis `DEVICE_CONFIG.bindDebug(device)` ;
   7. `await runtime.activateUniverse(registry.getDefaultId())`, puis `runtime.resize` à la taille du canvas. L'univers par défaut est la **première** entrée du manifeste marquée `isDefault: true`, à défaut la première du manifeste. Un univers n'est instancié qu'à sa première activation (`getOrCreate`) ;
   8. `start()`.
4. Le composant publie le device (`useThreeStage().publish`) et appelle `device.dispose()` au démontage. En développement, il l'expose aussi sur `window.__stage` (voir [Outillage de développement](#outillage-de-développement)).

## Ce qu'un projet fournit au core

Le `_core` importe du code projet par des chemins fixes. Pour qu'un même `_core` compile partout, **chaque projet fournit ces modules avec ces exports** :

| Module (`src/graphics/…`) | Exports attendus | Utilisé par |
|---|---|---|
| `device/device.config.ts` | `DEVICE_CONFIG: DeviceConfig` | `ThreeDevice`, `Output` |
| `debug/debug.config.ts` | `DEBUG_CONFIG` (avec `sessionPrefix`) | `ThreeDevice`, `DebugFlags` — doit rester **léger** : il est lu avant le chargement de three |
| `debug/Debug.id.ts` | `TAB_ID.RENDER`, `FOLDER_ID.STATS` | panneau des stats de `ThreeDevice` |
| `assets/assets.manifest.ts` | `ASSET_MANIFEST`, `AppAssetManifest` | `ThreeDevice` |
| `shaders/shaders.manifest.ts` | `SHADER_MANIFEST`, `AppShaderManifest` | `ThreeDevice` |
| `universes/universes.manifest.ts`, `universes/Universe.id.ts` | `UNIVERSE_MANIFEST`, `UniverseId` | `ThreeDevice` |
| `adapters/systems/DOMInputAdapter.ts` | `DOMInputAdapter` (`attach`, `dispose`) | `ThreeDevice` |
| `adapters/helpers/OrbitCamera.helper.ts` | `OrbitCameraHelper` (`bindInput`, `resize`, `toggle`, `dispose`) | `ThreeDevice` |
| `nodes/Node.id.ts` | `NodeId` | `UniverseBase`, contrats |

### `DeviceConfig`

Tout ce qui est propre à un projet et touche au device passe par `DEVICE_CONFIG` (type : `systems/DeviceConfig.type.ts`) plutôt que par une modification de `ThreeDevice` ou d'`Output`.

| Champ | Défaut | Exemple d'usage |
|---|---|---|
| `renderer.backend` | `"webgl"` | map : `"webgpu"` |
| `renderer.maxPixelRatio` | `2` | — |
| `renderer.maxPixelRatioCoarse` | `maxPixelRatio` | grass, book : `1.5` en tactile |
| `renderer.shadowMap` | `PCFSoftShadowMap` | `false` pour couper |
| `renderer.toneMappingExposure` | `1`, relue à chaque image | grass, book : getter sur `SCENE_CONFIG` |
| `debugPersistence` | aucune | lacoste : `debug.values.json` relu, écrit par la route de la sonde |
| `onBoot(device)` | — | lacoste : LUT du compositing |
| `bindDebug(device)` | — | lacoste : inclinaison ; grass, book : inclinaison, PostFX, Godrays. Rend les désabonnements. |

## WebGL et WebGPU

| `renderer.backend` | Renderer | Matériaux |
|---|---|---|
| `"webgl"` (défaut du core) | `WebGLRenderer` | GLSL, `ShaderMaterial` |
| `"webgpu"` | `WebGPURenderer`, repli WebGL2 automatique si WebGPU manque | TSL, node materials |

Le post-traitement du template (`graphics/postprocessing/`, voir son README) est en TSL : il exige `"webgpu"`. La variante WebGL (matériaux GLSL) vit sur la branche `feat/core-webgpu` du template.

- `three/webgpu` est importé dynamiquement : un projet WebGL ne l'embarque pas.
- `device.renderer` est typé `Renderer` (union). Une API propre à un backend passe par un cast : `device.renderer as WebGLRenderer`.
- Le code GLSL (`ShaderMaterial`, `.frag`) ne tourne pas sous `WebGPURenderer`, même en repli WebGL2. Les matériaux standards (`MeshStandardMaterial`…) marchent sur les deux.
- three-perf est WebGL seulement ; stats-gl gère les deux.
- Tester le repli : `forceWebGL: true` dans la config passée à `ThreeDevice.create`.
- **WebGPU, sortie écran** : tout `render` ou `clear` sur le canvas avec `outputColorSpace` sRGB passe par une cible interne pleine résolution puis une recopie (three r181). La dernière passe encode donc elle-même (voir `PassBase.renderFullscreen`) et rien ne vide le canvas à part.

## Boucle par image

`RAF._tick` enchaîne, à chaque image :

```
Input.update           remet deltaX, deltaY et wheel a 0
Output.update          pour chaque univers actif ET monte :
  Universe.update        InteractionManager.update(camera), puis NodeGraph.update (nodes montes)
Output.render
  1. prepare           pipeline.prepare?.(frame, ctx) pour CHAQUE univers monte
  2. etat du renderer  sRGB, NoToneMapping, exposition 1, viewport et scissor pleins (pas de clear)
  3. par univers monte, dans l'ordre d'activation :
     pipeline.render(frame, ctx)       scene -> cible
     pipeline.postRender?.(frame, ctx) cible -> ecran
```

`time` et `dt` sont en **millisecondes**, partout : `Universe.update`, `Node.update`, `FrameTiming`. `dt` est multiplié par la cadence (`setRate`) et **n'est pas borné** (voir [Pièges connus](#pièges-connus)).

`ctx` vaut `{ scene, camera, renderer }`. Chaque passe vide sa propre cible (`autoClear`). Le post-traitement n'est pas dans le core : c'est le pipeline de l'univers, `EffectComposer` (`graphics/postprocessing/`, d'après pmndrs).

```ts
const pipeline = new EffectComposer([new RenderPass(), new EffectPass([/* effets */])], { multisampling: 0 });
```

- `prepare` : `inputBuffer` et `outputBuffer` suivent la taille du canvas (`getDrawingBufferSize`), `PassBase.setSize` est appelé.
- `render` : `RenderPass` dessine la scène dans `inputBuffer`.
- `postRender` : chaque passe lit `ctx.inputBuffer`, écrit `ctx.outputBuffer`, puis les deux s'échangent (`needsSwap`). La dernière passe rend à l'écran (`renderToScreen`).
- Les passes plein écran dessinent un triangle partagé (`PassBase.renderFullscreen`), pas un quad.
- Un effet = un `IEffect` (fonction TSL de la couleur + uniforms) dans une `EffectPass`. Sans effet, `EffectPass` copie l'entrée.

## Pipeline et passes

Un pipeline est une liste ordonnée de passes. `PipelineBase` délègue chaque méthode à ses passes, dans l'ordre (`before*` en parallèle via `Promise.all`).

| Méthode de `IPass` | Quand |
|---|---|
| `beforeMount` / `onMounted` / `beforeUnmount` / `onUnmounted` | Cycle de vie de l'univers |
| `prepare?(frame, ctx)` | À chaque image, avant tout rendu |
| `render(frame, ctx)` | À chaque image : la scène |
| `postRender?(frame, ctx)` | À chaque image, après `render` de toutes les passes : vers l'écran |
| `resize`, `dispose` | Redimensionnement, destruction |

### Travail GPU hors écran (`prepare`)

Précalculs de textures, simulations, ping-pong : tout ce qui dessine dans une `WebGLRenderTarget` avant l'image. Contrat :

- la passe **rend la main avec la cible par défaut active** (`renderer.setRenderTarget(null)` ou la cible trouvée en entrant) ;
- elle peut déplacer viewport et scissor : `Output` les remet à plat juste après ;
- elle garde les appels de rendu : les nodes décrivent le travail (cible, scène, caméra, drapeau « à redessiner ») et la passe l'exécute. `renderer.render()` n'a rien à faire dans un node.

```ts
export class OffscreenPass extends PassBase {
  private readonly _travaux = new Set<OffscreenJob>();
  ajouter(t: OffscreenJob): void { this._travaux.add(t); }
  retirer(t: OffscreenJob): void { this._travaux.delete(t); }

  prepare(_frame: FrameTiming, ctx: PassContext): void {
    const renderer = ctx.renderer as WebGLRenderer;
    const cible = renderer.getRenderTarget();
    for (const t of this._travaux) {
      if (!t.enAttente) continue;
      renderer.setRenderTarget(t.cible);
      renderer.render(t.scene, t.camera);
      t.termine();
    }
    renderer.setRenderTarget(cible);
  }
}

// Dans l'univers : la passe hors ecran en tete du pipeline.
const horsEcran = new OffscreenPass();
const pipeline = new EffectComposer([horsEcran, new RenderPass(), new EffectPass()]);
```

Implémentation complète, avec restauration de la couleur de fond et effacement à `(0, 0, 0, 0)` pour les données : `lacoste/src/graphics/passes/OffscreenPass.ts`.

## Cycle de vie

### Univers (`Output.activateUniverse` / `deactivateUniverse`)

- **Activation** : un jeton par univers (WeakMap) invalide les activations concurrentes. `active = true`, `await beforeMount()`, puis, si l'univers est toujours actif et le jeton inchangé, `onMounted()` et `markMounted()`. Si `beforeMount` jette, l'univers est retiré.
- **Désactivation** : symétrique. Si `beforeUnmount` jette, l'univers reste `mounted` mais inactif.
- **`UniverseBase.beforeMount`** : précharge les groupes de `getAssetPreloadGroups()`, **puis** en parallèle `nodeGroup.register` + `beforeMount`, `pipeline.beforeMount` et `graph.beforeMount?.()`.
- **`UniverseBase.onMounted`** : pipeline, graphe, groupes de nodes, `onDebugMount`.
- **`UniverseBase.onUnmounted`** : purge des abonnements debug, `onDebugUnmount`, groupes, pipeline, graphe.

### Nodes et `NodeGraph`

- `NodeGraph.mount(node)` : `await beforeMount`, `scene.add` si c'est un `Object3DNodeBase`, `onMounted` (non attendu : animation d'entrée possible), puis les observateurs.
- `NodeGraph.unmount(node)` : `await beforeUnmount` (animation de sortie), `scene.remove`, `onUnmounted`, observateurs.
- `NodeGraph.update` ne met à jour que les nodes montés ; `resize` et `dispose` touchent **tous** les nodes. Il n'existe pas de `remove`.
- `NodeBase` pose `mounted` dans `onMounted` / `onUnmounted` : toute surcharge doit appeler `super`. Les abonnements `inputSubscribe` sont nettoyés au démontage.

### Contrats

Le seul mécanisme d'activation de nodes du `_core`.

- `registerContract({ id, activeNodeIds })`, puis `applyContract(id)`.
- `applyContract` calcule le diff avec le contrat courant : `await unmountMany(sortants)`, puis `await mountMany(entrants)`. Un contrat déjà courant ne fait rien.
- Pendant une transition, seule la **dernière** demande est gardée ; elle est rejouée à la fin.
- Usage type : `applyContract` dans `onMounted` de l'univers.

## Entrées

- `Input` émet `mousemove`, `mousedown`, `mouseup`, `wheel`, `keydown` et `keyup`. Pour la souris, la charge utile vaut `{ mouse, smoothMouse, mouseMoved, sourceEvent }`.
- `mouse.x` et `mouse.y` sont en pixels CSS. `mouse.nx` et `mouse.ny` donnent la position sur le canvas, de -1 à 1, **y vers le haut** (comme des NDC). `smoothMouse` est la même position, lissée par l'adaptateur (`gsap.quickTo`).
- `mouse.buttons.left|middle|right` donne l'état courant. `mousedown` et `mouseup` partent après la mise à jour de la position.
- Le `DOMInputAdapter` (`graphics/adapters/`) traduit le DOM. Celui du template écoute la souris. ap-chapitre-4 l'a passé aux pointer events : un doigt émet les mêmes `mousedown` et `mouseup`, seul le pointeur principal compte, et le pointeur est capturé pendant le glisser.
- Dans un node : passer `input` au constructeur (`Object3DNodeBase(id, name, object3D, input)`), puis s'abonner dans `onInputMount` avec `inputSubscribe(type, handler)`. Les abonnements tombent au démontage.

## Assets

- `defineAssets` type un arbre d'entrées `{ src, type, group?, lazy?, postProcess? }`. Types : `texture | gltf | json | audio | video | binary` (`ArrayBuffer`).
- `createAssetKeys` en tire des clés pointées typées (`ASSET_KEYS.scene.main`).
- `AssetStore.load(clé)` : cache, puis promesse en vol dédupliquée, puis loader, puis `postProcess`, puis mise en cache.
  - `get` rend `undefined` si non chargé ; `require` jette sans charger ; `has` signifie « chargé ».
- `preloadGroup(groupe, { includeLazy })` : les entrées `lazy` sont exclues par défaut. Un node qui en a besoin les demande lui-même avec `load`.
- `dispose*` libère textures, vidéos et glTF (pas le JSON ni l'audio). Draco se charge depuis `/draco/`.
- Aucun espace colorimétrique n'est posé par défaut : c'est le rôle de `postProcess`.

## Debug, stats, shaders

- **`DebugManager`** : `init(config)` une seule fois. Les abonnements `subscribe({ ownerId, tabId, folderId?, mount(target) → cleanup? })` faits avant `init` sont montés à l'init. `registerSnapshot` alimente le bouton « Copy All Config ».
- **Bindings persistants** : `debug.bind(target | null, object, key, options, path?)` repose la valeur enregistrée sous `path` avant de créer le contrôle, et y renvoie chaque modification, en mémoire : seul le bouton « Save Settings » écrit le fichier. Avec `target = null`, la valeur s'applique et le contrôle rendu est inerte : on déclare les réglages **une fois** et on les consomme deux — une passe d'application au démarrage, un panneau quand il est demandé. `getSavedValue` / `setSavedValue` pour les réglages pilotés par du code.
- **Drapeaux d'URL** (`debug/DebugFlags.ts`) : `readUrlFlag(name)`, `isDebugRequested()`, `isStatsRequested()`. `?name` ouvre, `?name=0` referme, retenu dans `sessionStorage` sous `<sessionPrefix>:<name>`. Importer par le chemin du fichier, pas par le barrel (qui charge Tweakpane).
- **`StatsManager`** : stats de base **éteintes par défaut** ; chargé à la demande, allumé par `?stats` ou depuis le panneau debug de `ThreeDevice`.
- **`ShaderStore`** : `has` / `get` / `require` sur des chaînes GLSL issues d'imports `?raw`.

## Recettes

### Ajouter un univers

1. Un id dans `Universe.id.ts`, une entrée dans `UNIVERSE_MANIFEST`.
2. La classe dans `graphics/universes/impl/`. Elle étend `UniverseBase`, ou le socle commun du projet s'il en a un.

```ts
export class LabUniverse extends UniverseBase<UniverseId> {
  private readonly _lab: LabNode;
  private _registered = false;

  constructor(device: IThreeDeviceSlice) {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    super(UNIVERSE_ID.LAB, scene, camera, new NodeGraph(scene), new PipelineBase([/* passes */]),
      device.assets.preloadGroup.bind(device.assets), device.debug);
    this._lab = new LabNode(device.input);
    this.registerContract({ id: NODE_ID.LAB, activeNodeIds: [NODE_ID.LAB] });
  }

  override async beforeMount(): Promise<void> {
    // Une seule fois : un univers desactive peut etre remonte.
    if (!this._registered) {
      this.graph.add(this._lab);
      this._registered = true;
    }
    await super.beforeMount();
  }

  override onMounted(): void {
    super.onMounted();
    void this.applyContract(NODE_ID.LAB);
  }
}
```

### Scène de test isolée, ouverte par un drapeau d'URL

Une scène de test remplace l'univers principal sans route nouvelle ni changement du parcours :

```ts
// universes.manifest.ts
const LAB = readUrlFlag("lab");
// ...
{ id: UNIVERSE_ID.MAIN, ctor: MainUniverse, isDefault: !LAB },
{ id: UNIVERSE_ID.LAB, ctor: LabUniverse, isDefault: LAB },

// device.config.ts : le parcours du projet ne demarre pas.
onBoot: (device) => {
  if (readUrlFlag("lab")) return;
  experience.boot(device.runtime);
},
```

`?lab` ouvre la scène et `?lab=0` la referme : le drapeau est retenu pour la session. Exemple : `?vortex` dans ap-chapitre-4 (`Vortex.universe.ts`).

## Outillage de développement

- **`window.__stage`** : le device, exposé en développement par `ThreeStage` (la branche disparaît du build). Depuis la console :
  - `__stage._getActiveUniverse()` donne l'univers au sommet, avec sa `scene` et sa `camera` ;
  - `__stage._runtime._raf` offre `stop()`, `start()` et `setRate(r)`. Une cadence nulle fige le temps de scène sans arrêter le rendu ;
  - `__stage._runtime._output` offre `_activeUniverses` (un `Set`), `update(time, dtMs)` et `render({ time, deltaTime })`.
- **Capturer une image précise** :
  1. `_raf.stop()`, puis poser l'état voulu ;
  2. `output.update(t, dtMs)` si la scène doit avancer ;
  3. `output.render({ time, deltaTime: 0 })`. `deltaTime: 0` garde le grain et les bruits temporels stables ;
  4. `canvas.toDataURL()` **dans la même tâche**, car le canvas n'a pas `preserveDrawingBuffer` ;
  5. `_raf.start()` pour relancer.
- **Onglet ou panneau masqué** : `requestAnimationFrame` y est suspendu et la scène ne bouge plus, une intro reste bloquée. Il faut avancer à la main, avec `output.update(t, 1000 / 60)` en boucle (`dt` en millisecondes).
- **Régler une config à chaud depuis la console** : importer le module par son URL exacte.
  - Vite sert `src/` sous `/_nuxt/@fs/<chemin absolu>/src/…`.
  - Il ajoute `?t=<horodatage>` aux fichiers modifiés depuis le démarrage. Une URL sans ce suffixe charge une **seconde** instance du module, que la scène ne lit pas.
  - Pour trouver l'URL : `fetch` le module qui importe la config, puis la relever par regex dans son code transformé.
- **Mesure GPU** : sous ANGLE Metal (Chrome sur macOS), `EXT_disjoint_timer_query_webgl2` est exposé mais renvoie 0. Les temps GPU de stats-gl n'y valent rien.

## Pièges connus

- **Deltas d'entrée** : `Input.update` remet `deltaX`, `deltaY` et `wheel` à 0 **avant** `Universe.update`. Lus en polling dans `update`, ils valent toujours 0 ; il faut s'abonner aux événements.
- **Démonter un univers ne démonte pas ses nodes** : `NodeGraph` n'a pas de méthodes de cycle de vie, et les appels `(graph as any).beforeMount?.()` de `UniverseBase` ne font rien. `_currentContractId` n'est pas remis à `null`.
- **`InteractionManager`** n'existe que si `input` est passé au constructeur de `UniverseBase`.
- **`dt` non borné** : la RAF ne connaît pas `visibilitychange`. Au retour d'un onglet masqué, la première image porte toute l'absence, et inerties et timelines sautent à leur terme. Il faut borner `dt` côté projet (ap-chapitre-4 : `MAX_FRAME_SECONDS = 0.1`).
- **`RAF.start()` remet `time` à 0.**
- **Redimensionnement manqué** : `Output.resize` ne sert que les univers montés, et une activation n'en déclenche aucun. Seul l'univers initial reçoit la taille au démarrage. Un univers activé plus tard doit relire `renderer.getSize` dans son `onMounted`.
- **Ordre de mise à jour des nodes** : `NodeGraph.update` suit l'ordre de **fin de montage**, car `mountMany` monte en parallèle.
  - Avec des `beforeMount` synchrones, c'est l'ordre de `activeNodeIds` : un node qui lit l'état d'un autre dans la même image doit venir après lui.
  - Un `beforeMount` asynchrone casse cet ordre.
- **Perte de contexte WebGL** : le core ne la traite pas, et une cible de rendu cuite revient vide. Il faut écouter `webglcontextrestored` sur `renderer.domElement` et recuire (ap-chapitre-4 : `SkyBakePass`, `ChapterUniverse`).
- **Le `_core` dépend de `graphics/`** : c'est une dette, pas un modèle. La liste exacte est dans [Ce qu'un projet fournit au core](#ce-quun-projet-fournit-au-core) ; un projet qui renomme ces fichiers casse le `_core`.

## Journal des modifications

| Date | Modification | Fichiers | Origine | Pourquoi |
|---|---|---|---|---|
| 2026-10-15 | Documentation seule : univers par défaut, unités de temps, sections « Entrées », « Recettes », « Outillage de développement », « Briques réutilisables des projets », cinq pièges (`dt` non borné, `start` qui remet `time` à 0, redimensionnement manqué, ordre des nodes, perte de contexte). `CLAUDE.md` à la racine du template. | `README.md` | ap-chapitre-4 | Ces points étaient relus dans le code à chaque projet. **Au sync** : rien à migrer. |
| 2026-10-13 | Les réglages du panneau ne s'écrivent plus d'eux-mêmes 400 ms après chaque geste : seul « Save Settings » appelle le transport. | `debug/DebugValues.ts`, `debug/DebugManager.ts` | ap-chapitre-4 | On ne pouvait plus essayer un réglage sans écraser le fichier, et la copie `.bak` de la sonde ne gardait que l'état d'il y a 400 ms. Désormais elle garde l'enregistrement précédent. **Au sync** : un projet qui comptait sur l'écriture automatique enregistre à la main. |
| 2026-09-15 | `Output` ne vide plus l'écran avant les pipelines. | `systems/Output.ts` | map | En WebGPU, ce `clear` sur le canvas sRGB passait par une cible interne MSAA HalfFloat puis une recopie : 64 % du temps d'image (5,14 → 1,82 ms, canvas 1196×1726). Chaque passe vide sa cible. Template : `EffectComposer`, `RenderPass`, `CopyPass`, triangle plein écran partagé, `antialias: false` sur le canvas. **Au sync** : un pipeline qui rend directement à l'écran garde `renderer.autoClear` actif. |
| 2026-09-15 | Post-traitement sorti du core : étape `postRender?` sur `IPass` / `IPipeline` / `PipelineBase`, `Output` enchaîne `prepare` → `render` → `postRender` par univers. Retrait de `postFxPass`, `setPostFxEnabled`, `setFinalCorrectionEnabled`, `setPostFxGrainTexture`, `isPostFxEnabled` et de l'import de `graphics/postprocessing`. Template : `OutputPass` maison (`webgl/`, `webgpu/`), dépendance `postprocessing` retirée. | `pipeline/*`, `systems/Output.ts`, `systems/ThreeDevice.ts` | map | `pipeline.render` ne tournait jamais (court-circuité par le postFx) et le core dépendait d'une lib de post-traitement WebGL. **Au sync** : chaque projet déplace son `PostProcessingPass` dans le pipeline de ses univers (rendu écran en `postRender`) et remplace les usages de `device.postFxPass`. |
| 2026-09-15 | Backend `webgpu` optionnel : `DEVICE_CONFIG.renderer.backend`, type `Renderer` (union), renderer créé dans `ThreeDevice.create`, `PostProcessingPass` importé par `postprocessing/index.ts`, stats-gl sur WebGPU. Section « Style de code ». | `systems/Renderer.type.ts`, `systems/ThreeDevice.ts`, `systems/Output.ts`, `systems/Runtime.ts`, `systems/DeviceConfig.type.ts`, `stats/StatsManager.ts`, `index.ts` | map | WebGPU prioritaire avec repli WebGL2 pour map, sans casser les projets WebGL. **Au sync** : cast `as WebGLRenderer` là où un projet lit une API WebGL via `device.renderer` (grass, book : `capabilities.maxSamples`). |
| 2026-09-15 | Étape `prepare?(frame, ctx)` sur `IPass` et `IPipeline`, implémentée par `PipelineBase`, appelée par `Output.render` pour chaque univers monté avant tout rendu à l'écran. Viewport et scissor remis à plat après. | `pipeline/*`, `systems/Output.ts` | lacoste `2ba6a32` | `Output` rend par postFx ou correction finale sans passer par le pipeline de l'univers : une passe hors écran (texture précalculée, simulation) n'y tournait jamais. |
| 2026-09-15 | Type d'asset `binary` (`ArrayBuffer`). | `assets/types.ts`, `assets/AssetStore.ts` | lacoste | Formats maison qu'aucun loader three ne couvre. |
| 2026-09-15 | Retrait de `nodes/helpers/Helper3DNode.interface.ts` et `universes/contrats/Contract.base.ts` (et `graphics/universes/contracts/NodeSwapContract.ts` du template). | — | grass `48cbca8` | Jamais importés. |
| 2026-09-15 | Bindings persistants (`DebugValues.ts`, `DebugManager.bind`, `setPersistence`, `getSavedValue`, `setSavedValue`, « Save Settings »), exports `DebugBinding` / `DebugTarget`. | `debug/*` | lacoste `c7cd7cb`, `59ae60b` | Réglages perdus au rechargement ; ils sont la configuration de la scène et doivent s'appliquer sans panneau. API renommée en anglais au portage. |
| 2026-09-15 | Drapeaux d'URL `?debug` / `?stats` retenus en session, préfixe dans `DEBUG_CONFIG.sessionPrefix` ; panneau initialisé seulement sur demande ; stats de base éteintes par défaut. | `debug/DebugFlags.ts`, `debug/types.ts`, `stats/StatsManager.ts`, `systems/ThreeDevice.ts` | grass `6d946ce`, `a1ec660`, `2a97b08` ; lacoste | Outils disponibles sur un déploiement et sur mobile sans les montrer aux visiteurs. Préfixes auparavant en dur (`lacoste:`, `grass:`, `book:`). |
| 2026-09-15 | `DeviceConfig` (`DEVICE_CONFIG` fourni par le projet) : options du renderer, persistance, `onBoot`, `bindDebug`. `FINAL_CORRECTION_PRESET` fourni par le post-traitement du projet. Getter `inputAdapter`, `Output.isPostFxEnabled()`. | `systems/DeviceConfig.type.ts`, `systems/ThreeDevice.ts`, `systems/Output.ts` | alignement lacoste, grass, book | Chaque projet avait mis son code dans `ThreeDevice` et `Output` (panneaux PostFX/Godrays, inclinaison, LUT, preset, exposition) : les `_core` ne pouvaient plus être partagés. |
| 2026-09-15 | Compteurs `renderer.info` remis à zéro une fois par image, avant `prepare` ; carte d'ombres `PCFSoftShadowMap` par défaut. | `systems/Output.ts`, `systems/ThreeDevice.ts` | lacoste ; grass `dffaf38` | L'EffectComposer n'affichait que la dernière passe (« 1 draw call ») ; sans carte d'ombres, `castShadow` est inerte sans avertissement. |

## Projets alignés

État au 2026-09-15 : backend WebGPU et `postRender` portés dans map seulement. lacoste, grass et book sont sur un `_core` antérieur ; leur synchronisation demande la migration décrite au journal.

| Projet | Dépôt et branche | Commit d'alignement | Ce qui est sorti du `_core` vers le projet |
|---|---|---|---|
| lacoste | `Dev/PP/RD/lacoste`, `feat/sol-timeline` | `47af303` | LUT du compositing (`onBoot`), panneau d'inclinaison (`graphics/device/TiltDebug.helper.ts`), `Timeline.contract.ts` (`graphics/devtools/`) |
| grass | `Dev/PP/RD/grass`, `chore/core-alignement` | `b12c78d` | Panneaux PostFX, Godrays et inclinaison (`graphics/device/*Debug.helper.ts`), preset de correction, exposition, plafond tactile, `TiltWitness` (`graphics/debug/`), `Timeline.contract.ts` |
| book | `Dev/PP/RD/book` (dépôt créé le 2026-09-15, sans remote), `chore/core-alignement` | `e21a0f3` | Comme grass |
| map | `Dev/PV/Projects/map` (sans remote), `feat/core-webgpu` | — | Backend `webgpu`, post-traitement TSL identique à la branche `tsl` du template |
| ap-chapitre-4 | `Dev/PP/RD/audemars-piguet-chapitre-4`, `feat/chapitre-4-flow` | `e12ee3d` (import), `0f66a88` | Code du `_core` identique à `tsl`, cadence réglable comprise. Backend WebGL, post-traitement pmndrs `postprocessing` (`PostProcessingPass`, MSAA). Parcours démarré en `onBoot`, panneaux en `bindDebug`, `debugPersistence` (`debug.values.json`). Section post-traitement du README dans sa variante WebGL. |

Côté projet, une seule chose varie encore sans être du `_core` : grass et book enregistrent leurs réglages par un `_saveDebug` maison dans leur univers, là où lacoste passe par `DEVICE_CONFIG.debugPersistence`. Les migrer est optionnel.

## Briques réutilisables des projets

Avant d'écrire l'une de ces briques, partir de celle qui existe.

| Brique | Où | Rôle |
|---|---|---|
| `OffscreenPass` | lacoste, `graphics/passes/OffscreenPass.ts` | Travail GPU hors écran, en `prepare` (voir [Travail GPU hors écran](#travail-gpu-hors-écran-prepare)) |
| `gl-text` | ap-chapitre-4, `src/_lib/gl-text` (avec son README) | Texte du DOM répliqué en MSDF dans l'image WebGL, aligné au pixel. Atlas MTSDF par `scripts/fonts/atlas.mjs`. Sans dépendance au moteur. |
| `SkyBakePass` | ap-chapitre-4, `graphics/postprocessing/passes/` | Un fond procédural cuit une fois dans une cible : une lecture par pixel au lieu de huit bruits. Recuit à la perte de contexte. |
| `PostProcessingPass` | ap-chapitre-4, `graphics/postprocessing/passes/` | `EffectComposer` de pmndrs en passe de pipeline. Libère ses buffers plein écran au démontage de l'univers. |
| `Timeline.contract.ts`, théâtres | lacoste, grass, ap-chapitre-4 (`graphics/devtools/`, `graphics/theatres/`) | Timelines éditables dans SONDE |

## Documents existants

- `CLAUDE.md` (racine) : renvoie ici. Il est copié dans chaque projet avec le template.
- `README.md` (racine) : démarrage Nuxt à jour. Principes core / graphics **en partie obsolètes** :
  - place `ThreeDevice` dans `graphics/` et dit le core sans Three.js ni postprocessing ;
  - cite `onUnmount` et `Universe.render`, qui n'existent pas ;
  - ignore nodes, contrats, assets, shaders, debug, stats et `prepare`.
- `NodeContract.md` : note de conception Node / NodeGraph / Contract / Pipeline, proche du code mais rédigée comme un plan. Elle cite `remove(node)`, qui n'existe pas.
- `docs/AUDIT_AND_PLAN.md` : **obsolète**, cite des fichiers supprimés (`pipeline/types.ts`, `Pass.base.ts`, `defineUniverse`…).
