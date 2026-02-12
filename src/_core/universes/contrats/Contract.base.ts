// Contract.base.ts

import { NodeGraph } from "@_core/index.ts";


export type ContractApplyMode = 'initial' | 'swap';

export default abstract class ContractBase {
  public abstract readonly id: string;

  /**
   * Retourne la liste d'ids de nodes qui doivent être montés lorsque ce contract est actif.
   * (Le Contract ne possède pas les nodes, il ne fait que les sélectionner.)
   */
  public abstract getActiveNodeIds(): string[];

  /**
   * Applique ce contrat via le graph.
   * - Unmount des nodes sortants (await beforeUnmount en parallèle)
   * - Mount des nodes entrants (onMounted déclenche l'entrée visuelle)
   */
  public async apply(params: {
    graph: NodeGraph;
    prev: ContractBase | null;
    mode?: ContractApplyMode;
  }): Promise<void> {
    const { graph, prev, mode = 'swap' } = params;

    const nextIds = this.getActiveNodeIds();
    const prevIds = prev?.getActiveNodeIds() ?? [];

    // Initial: mount tout, pas de sortie
    if (!prev || mode === 'initial') {
      await graph.mountMany(nextIds);
      return;
    }

    const prevSet = new Set(prevIds);
    const nextSet = new Set(nextIds);

    const exiting: string[] = [];
    const entering: string[] = [];

    for (const id of prevSet) if (!nextSet.has(id)) exiting.push(id);
    for (const id of nextSet) if (!prevSet.has(id)) entering.push(id);

    // Sorties en parallèle, puis entrées
    await graph.unmountMany(exiting);
    await graph.mountMany(entering);
  }
}
