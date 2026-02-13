import type { IThreeDeviceSlice } from "@/_core/systems/ThreeDevice.ts";
import { NodeGraph } from "@_core/nodes/NodeGraph.ts";
import { PipelineBase } from "@_core/pipeline/Pipeline.base.ts";
import { UniverseBase } from "@_core/universes/Universe.base.ts";
import { FOLDER_ID, TAB_ID } from "@graphics/debug/Debug.id.ts";
import type { NodeId } from "@graphics/nodes/Node.id.ts";
import { NODE_ID } from "@graphics/nodes/Node.id.ts";
import { MainCameraInputNode } from "@graphics/nodes/MainCameraInputNode.ts";
import { Node1 } from "@graphics/nodes/Node1.ts";
import { Node1B } from "@graphics/nodes/Node1B.ts";
import { Node2 } from "@graphics/nodes/Node2.ts";
import { ForwardRenderPass } from "@graphics/passes/ForwardRenderPass.ts";
import { Scene } from "three";
import type { UniverseId } from "../Universe.id.ts";
import { UNIVERSE_ID } from "../Universe.id.ts";

const DEBUG = true;
const log = (msg: string) => DEBUG && console.log(`[MainUniverse] ${msg}`);

export class MainUniverse extends UniverseBase<UniverseId> {
  private readonly _device: IThreeDeviceSlice;
  private readonly _cameraNode: MainCameraInputNode;
  private _clickBound: (() => void) | null = null;
  private _nodesRegistered = false;

  constructor(device: IThreeDeviceSlice) {
    const scene = new Scene();
    const cameraNode = new MainCameraInputNode(device.input);
    const camera = cameraNode.camera;

    const graph = new NodeGraph(scene);
    const pipeline = new PipelineBase([new ForwardRenderPass()]);

    super(
      UNIVERSE_ID.MAIN,
      scene,
      camera,
      graph,
      pipeline,
      device.assets.preloadGroup.bind(device.assets),
      device.debug
    );

    this._device = device;
    this._cameraNode = cameraNode;

    // Register contracts (base class handles _isTransitioning / queue)
    this.registerContract({
      id: NODE_ID.NODE_1,
      activeNodeIds: [NODE_ID.CAMERA_MAIN, NODE_ID.NODE_1, NODE_ID.NODE_1B],
    });
    this.registerContract({
      id: NODE_ID.NODE_2,
      activeNodeIds: [NODE_ID.CAMERA_MAIN, NODE_ID.NODE_1B, NODE_ID.NODE_2],
    });

  }

  override async beforeMount(): Promise<void> {
    if (!this._nodesRegistered) {

      const nodes = [
        this._cameraNode,
        new Node1(),
        new Node1B(),
        new Node2(),
      ];

      this.graph.addMany(nodes);

      this._nodesRegistered = true;
    }

    await Promise.resolve(super.beforeMount());
  }

  protected override getAssetPreloadGroups(): string[] {
    return ["universe:main"];
  }

  override onMounted(): void {
    super.onMounted();
    log("onMounted");

    // Initial contract (base class applyContract)
    void this.applyContract(NODE_ID.NODE_1);

    this._clickBound = () => {
      const next: NodeId = this.currentContractId === NODE_ID.NODE_1 ? NODE_ID.NODE_2 : NODE_ID.NODE_1;
      log(`click → swap to ${next}`);
      void this.applyContract(next);
    };

    this._device.renderer.domElement.addEventListener("click", this._clickBound);
  }

  override beforeUnmount(): void | Promise<void> {
    if (this._clickBound) {
      this._device.renderer.domElement.removeEventListener("click", this._clickBound);
      this._clickBound = null;
    }
    log("beforeUnmount");
    return super.beforeUnmount();
  }

  protected override onDebugMount(): void {
    this.debugSubscribe({
      tabId: TAB_ID.UNIVERSE,
      folderId: FOLDER_ID.UNIVERSE_MAIN,
      mount: (target) => {
        const button = target.addButton({ title: "Swap Contract" });
        const onClick = () => {
          const next: NodeId =
            this.currentContractId === NODE_ID.NODE_1 ? NODE_ID.NODE_2 : NODE_ID.NODE_1;
          void this.applyContract(next);
        };
        button.on("click", onClick);
        return () => {
          button.dispose();
        };
      },
    });
  }

  override resize(width: number, height: number): void {
    super.resize(width, height);
  }
}
