import ContractBase from "@/_core/universes/contrats/Contract.base";

// NodeSwapContract.ts
export class NodeSwapContract extends ContractBase {
  public readonly id: string;
  private readonly _activeNodeIds: string[];
  constructor(
    id: string,
    activeNodeIds: string[],
  ) {
    super();
    this.id = id;
    this._activeNodeIds = activeNodeIds;
  }

  getActiveNodeIds(): string[] { return this._activeNodeIds; }
}
