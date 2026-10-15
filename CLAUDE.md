# Projet issu de three-pipeline-boilerplate

Nuxt 4, three r181. `src/_core` est le moteur partagé par tous les projets issus du template, `src/graphics` est propre au projet.

## Avant d'explorer le moteur

**Lire [`src/_core/README.md`](src/_core/README.md), qui fait foi.** Il couvre :
- le démarrage et la boucle par image ;
- le cycle de vie des univers et des nodes, les contrats, les entrées ;
- les assets, le debug, les recettes, l'outillage de développement ;
- les pièges connus et les briques réutilisables des autres projets.

Ne relire le code du `_core` que pour ce que le README ne dit pas. Puis y reporter ce qu'on a appris, dans le template d'abord (`~/Dev/Templates/three-pipeline-boilerplate`), comme toute modification du `_core`.

## Règles

- `src/_core` ne se modifie pas pour un besoin du projet : passer par `DEVICE_CONFIG` (`graphics/device/device.config.ts`) et `src/graphics/`. Procédure de portage et journal dans le README du `_core`.
- `README.md` (racine), `NodeContract.md` et `docs/AUDIT_AND_PLAN.md` sont en partie obsolètes.
