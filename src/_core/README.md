# `_core` — référence du moteur

Ce document décrit le fonctionnement **réel** du `_core`, tel que le code l'implémente. Il fait foi sur les autres documents : `README.md` (racine), `NodeContract.md` et `docs/AUDIT_AND_PLAN.md` sont en partie obsolètes (voir [Documents existants](#documents-existants)).

## Règle de portage

Le `_core` est partagé par tous les projets issus de ce template. **Un projet ne le modifie pas pour ses besoins propres** : ce qui est spécifique va dans `src/graphics/`.

Quand une modification du `_core` est inévitable (un manque du moteur, pas un besoin du projet) :

1. vérifier d'abord qu'aucune solution côté `graphics/` ne suffit, et le dire ;
2. faire la modification dans le projet **et** dans ce template, à l'identique quand le contexte le permet ;
3. l'inscrire au [Journal des modifications](#journal-des-modifications) ci-dessous : quoi, pourquoi, fichiers, projet d'origine ;
4. lister dans [Écarts connus](#écarts-connus-avec-les-projets) ce qu'un projet porte encore sans que le template l'ait.

Un changement du `_core` qui ne vit que dans un projet est perdu pour les suivants.

## Carte des modules

| Dossier | Rôle | Exporté par `index.ts` |
|---|---|---|
| `systems/` | Orchestration : `ThreeDevice` (bootstrap), `Runtime`, `RAF`, `Input`, `Output`, `State` | `Input`, `Output`, `RAF`, `Runtime`, `State`, `Viewport` — **pas** `ThreeDevice` |
| `universes/` | `UniverseBase` : scène, caméra, graphe de nodes, pipeline, contrats | `UniverseBase`, `IUniverseContract` |
| `registries/` | `UniverseRegistry` : fabriques d'univers paresseuses (`define`, `getOrCreate`, `getDefaultId`) | `UniverseRegistry` |
| `nodes/` | `NodeBase`, `Object3DNodeBase`, `InteractiveObject3DNodeBase`, `GroupNodeBase`, `NodeGroupBase`, `NodeGraph` | tous, avec leurs interfaces |
| `pipeline/` | `IPass`, `IPipeline`, `PipelineBase`, `PassContext` | tous |
| `interaction/` | `InteractionManager` : raycast différé, survol, clic, capture pendant le drag | `InteractionManager` |
| `assets/` | Manifeste typé, `AssetStore` (chargement, cache, groupes) | **rien** — importer `@_core/assets/index.ts` |
| `shaders/` | `defineShaders`, `createShaderKeys`, `createShaderStore`, `ShaderStore` | tous |
| `debug/` | `DebugManager` (Tweakpane, onglets, abonnements, instantanés) | `debug`, `DebugManager`, types de config |
| `stats/` | `StatsManager` (stats-gl, three-perf, chargés à la demande) | `StatsManager` |
| `helpers/event/` | Constantes d'événements souris et clavier | `EventMouse`, `EventKeyboard` |
| `types/` | `FrameTiming { time, deltaTime }`, en millisecondes | `FrameTiming` |
| `lifecycle/` | `ILifecycle` : noms qui ne correspondent plus au contrat réel, quasi mort | — |

Dans les faits, `graphics/` importe par chemins profonds (`@_core/nodes/...`) plutôt que par le barrel.

## Démarrage

1. `app/pages/index.vue` monte `<ThreeStage>`. Au `nextTick`, le composant importe dynamiquement `ThreeDevice` et appelle `ThreeDevice.create(canvas, config)`.
2. Le constructeur de `ThreeDevice` :
   - crée le `WebGLRenderer` (sRGB, pixel ratio ≤ 2), l'`AssetStore` du `ASSET_MANIFEST`, le `ShaderStore`, le `StatsManager` et le `State` ;
   - déclare chaque entrée de `UNIVERSE_MANIFEST` dans le registre, sans l'instancier ;
   - crée le `Runtime`, qui crée `Input`, `Output` (avec ses deux `PostProcessingPass`) et `RAF`.
3. `init()` :
   1. taille et viewport ;
   2. `await preloadGroup("boot")` ;
   3. `debug.init`, puis attache des entrées DOM ;
   4. `await runtime.activateUniverse(registry.getDefaultId())` ;
   5. `start()`.
4. Le composant publie le device (`useThreeStage().publish`) et appelle `device.dispose()` au démontage.

## Boucle par image

`RAF._tick` enchaîne, à chaque image :

```
Input.update           remet deltaX, deltaY et wheel a 0
Output.update          pour chaque univers actif ET monte :
  Universe.update        InteractionManager.update(camera), puis NodeGraph.update (nodes montes)
Output.render
  1. prepare           pipeline.prepare?.(frame, ctx) pour CHAQUE univers monte
  2. etat du renderer  sRGB, NoToneMapping, exposition 1, viewport et scissor pleins, clear
  3. un seul chemin parmi :
     - postFx actif (defaut)            -> PostProcessingPass sur l'univers primaire
     - sinon correction finale (defaut) -> PostProcessingPass de correction
     - sinon                            -> pipeline.render(frame, ctx) de chaque univers monte
```

L'univers primaire est le dernier activé (`activeMounted.at(-1)`). `ctx` vaut `{ scene, camera, renderer }`.

**Conséquence majeure** : postFx et correction finale sont actifs par défaut, et rien n'appelle `setPostFxEnabled(false)`. **`pipeline.render` — donc `ForwardRenderPass` — ne tourne jamais dans la configuration par défaut.** Tout travail qui doit s'exécuter à chaque image indépendamment du chemin de sortie va dans `prepare`, jamais dans `render`.

## Pipeline et passes

Un pipeline est une liste ordonnée de passes. `PipelineBase` délègue chaque méthode à ses passes, dans l'ordre (`before*` en parallèle via `Promise.all`).

| Méthode de `IPass` | Quand |
|---|---|
| `beforeMount` / `onMounted` / `beforeUnmount` / `onUnmounted` | Cycle de vie de l'univers |
| `prepare?(frame, ctx)` | À chaque image, **avant tout rendu à l'écran**, quel que soit le chemin de sortie |
| `render(frame, ctx)` | À chaque image, **seulement** si postFx et correction finale sont coupés |
| `resize`, `dispose` | Redimensionnement, destruction |

### Travail GPU hors écran (`prepare`)

Précalculs de textures, simulations, ping-pong : tout ce qui dessine dans une `WebGLRenderTarget` avant l'image. Contrat :

- la passe **rend la main avec la cible par défaut active** (`renderer.setRenderTarget(null)` ou la cible trouvée en entrant) ;
- elle peut déplacer viewport et scissor : `Output` les remet à plat juste après ;
- elle garde les appels de rendu : les nodes décrivent le travail (cible, scène, caméra, drapeau « à redessiner ») et la passe l'exécute. `renderer.render()` n'a rien à faire dans un node.

```ts
export class OffscreenPass implements IPass {
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
  render(): void {}
  // lifecycle, resize, dispose : vides
}

// Dans l'univers : la passe hors ecran en tete du pipeline.
const horsEcran = new OffscreenPass();
const pipeline = new PipelineBase([horsEcran, new ForwardRenderPass()]);
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

## Assets

- `defineAssets` type un arbre d'entrées `{ src, type, group?, lazy?, postProcess? }`. Types : `texture | gltf | json | audio | video`.
- `createAssetKeys` en tire des clés pointées typées (`ASSET_KEYS.scene.main`).
- `AssetStore.load(clé)` : cache, puis promesse en vol dédupliquée, puis loader, puis `postProcess`, puis mise en cache.
  - `get` rend `undefined` si non chargé ; `require` jette sans charger ; `has` signifie « chargé ».
- `preloadGroup(groupe, { includeLazy })` : les entrées `lazy` sont exclues par défaut. Un node qui en a besoin les demande lui-même avec `load`.
- `dispose*` libère textures, vidéos et glTF (pas le JSON ni l'audio). Draco se charge depuis `/draco/`.
- Aucun espace colorimétrique n'est posé par défaut : c'est le rôle de `postProcess`.

## Debug, stats, shaders

- **`DebugManager`** : `init(config)` une seule fois. Les abonnements `subscribe({ ownerId, tabId, folderId?, mount(target) → cleanup? })` faits avant `init` sont montés à l'init. Il n'y a pas d'API de binding : `mount` reçoit la cible Tweakpane et appelle `addBinding`. `registerSnapshot` alimente le bouton « Copy All Config ».
- **`StatsManager`** : chargé à la demande et piloté depuis le panneau debug de `ThreeDevice`.
- **`ShaderStore`** : `has` / `get` / `require` sur des chaînes GLSL issues d'imports `?raw`.

## Pièges connus

- **Deltas d'entrée** : `Input.update` remet `deltaX`, `deltaY` et `wheel` à 0 **avant** `Universe.update`. Lus en polling dans `update`, ils valent toujours 0 ; il faut s'abonner aux événements.
- **`pipeline.render` court-circuité** par défaut (voir [Boucle par image](#boucle-par-image)).
- **Démonter un univers ne démonte pas ses nodes** : `NodeGraph` n'a pas de méthodes de cycle de vie, et les appels `(graph as any).beforeMount?.()` de `UniverseBase` ne font rien. `_currentContractId` n'est pas remis à `null`.
- **`InteractionManager`** n'existe que si `input` est passé au constructeur de `UniverseBase`.
- **Le `_core` dépend de `graphics/`** : c'est une dette, pas un modèle. Imports concernés :
  - `Output` → `PostProcessingPass`, `POSTFX_PRESETS`, `PostFxConfig` ;
  - `ThreeDevice` → manifestes d'assets, d'univers et de shaders, `DEBUG_CONFIG`, identifiants de debug, `OrbitCameraHelper`, `DOMInputAdapter` ;
  - `UniverseBase`, `UniverseContract.type` → `NodeId`.
  
  Un projet qui renomme ces fichiers casse le `_core`.
- **Contrats dormants** : `universes/contrats/Contract.base.ts` n'est ni exporté ni utilisé par `UniverseBase`.

## Journal des modifications

| Date | Modification | Fichiers | Origine | Pourquoi |
|---|---|---|---|---|
| 2026-09-15 | Étape `prepare?(frame, ctx)` sur `IPass` et `IPipeline`, implémentée par `PipelineBase`, appelée par `Output.render` pour chaque univers monté avant tout rendu à l'écran. Viewport et scissor remis à plat après. | `pipeline/Pass.interface.ts`, `pipeline/Pipeline.interface.ts`, `pipeline/Pipeline.base.ts`, `systems/Output.ts` | lacoste, `2ba6a32` | `Output` rend par postFx ou correction finale sans passer par le pipeline de l'univers : une passe hors écran (texture précalculée, simulation) n'y tournait jamais. |

## Écarts connus avec les projets

État relevé le 2026-09-15 : le `_core` de **lacoste** (`Dev/PP/RD/lacoste`) comparé à celui-ci.

### Génériques, à porter

| Écart | Fichiers (lacoste) | Raison |
|---|---|---|
| `renderer.info.autoReset = false` et un seul `info.reset()` par image | `systems/Output.ts` | L'EffectComposer fait plusieurs `render()` par image : les compteurs n'affichaient que la dernière passe (« 1 draw call »). |
| Type d'asset `binary`, qui rend un `ArrayBuffer` | `assets/types.ts`, `assets/AssetStore.ts` | Formats binaires maison (géométrie précalculée). |
| Persistance des réglages debug : `DebugValueStore`, `bind(target \| null, objet, clé, opts, chemin?)`, bouton « Sauvegarder », exports `DebugBinding` / `DebugTarget` | `debug/DebugValues.ts`, `debug/DebugManager.ts`, `debug/types.ts`, `debug/index.ts` | Réglages perdus au rechargement ; ce sont la configuration de la scène, appliquée même sans panneau. API en français à renommer au portage ; l'adaptateur d'écriture reste côté projet. |
| Panneau et stats sur demande de l'URL (`?debug`, `?stats`, mémorisé dans l'onglet) | `debug/debugDemande.ts`, `systems/ThreeDevice.ts` | Outils disponibles sur un déploiement et sur mobile sans les montrer aux visiteurs. Clés `lacoste:*` à paramétrer. |
| Stats de base coupées par défaut | `stats/StatsManager.ts` | Ne pas afficher FPS/GPU en production. |
| Carte d'ombres activée (`PCFSoftShadowMap`) | `systems/ThreeDevice.ts` | Sans elle, `castShadow` est inerte sans avertissement. Choix de rendu : défaut à documenter. |

### Spécifiques au projet, à ne pas porter en l'état

| Écart | Fichiers (lacoste) | Raison |
|---|---|---|
| `Output.setCompositingLuts` alimenté par des clés d'assets du projet | `systems/Output.ts`, `systems/ThreeDevice.ts` | LUT du compositing Blender de lacoste. |
| Inclinaison mobile (`_bindTiltControls`, getter `inputAdapter`) | `systems/ThreeDevice.ts` | Dépend du `DOMInputAdapter` à inclinaison de lacoste, non porté. |
| Types de timeline (`TimelineTheatre`, `TimelineKeyframe`) | `devtools/Timeline.contract.ts` | Aucun consommateur dans le `_core` : à déplacer dans `graphics/` côté projet. |

## Documents existants

- `README.md` (racine) : démarrage Nuxt à jour. Principes core / graphics **en partie obsolètes** :
  - place `ThreeDevice` dans `graphics/` et dit le core sans Three.js ni postprocessing ;
  - cite `onUnmount` et `Universe.render`, qui n'existent pas ;
  - ignore nodes, contrats, assets, shaders, debug, stats et `prepare`.
- `NodeContract.md` : note de conception Node / NodeGraph / Contract / Pipeline, proche du code mais rédigée comme un plan. Elle cite `remove(node)`, qui n'existe pas, et ignore le court-circuit du pipeline par le postFx.
- `docs/AUDIT_AND_PLAN.md` : **obsolète**, cite des fichiers supprimés (`pipeline/types.ts`, `Pass.base.ts`, `defineUniverse`…).
