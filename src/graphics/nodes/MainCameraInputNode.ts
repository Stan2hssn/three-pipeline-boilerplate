import { NodeBase } from "@_core/nodes/Node.base.ts";
import type Input from "@_core/systems/Input.ts";
import { NODE_ID } from "@graphics/nodes/Node.id.ts";
import { PerspectiveCamera } from "three";

export class MainCameraInputNode extends NodeBase {
  private readonly _camera: PerspectiveCamera;
  private readonly _baseX: number;
  private readonly _baseZ: number;
  private readonly _baseY: number;

  constructor(input: Input) {
    super(NODE_ID.CAMERA_MAIN, "Main Camera Input", input);
    this._camera = new PerspectiveCamera(
      80,
      globalThis.window?.innerWidth / (globalThis.window?.innerHeight ?? 1),
      0.1,
      100
    );
    this._baseX = 0;
    this._baseY = 2;
    this._baseZ = 4;

    this._camera.position.set(this._baseX, this._baseY, this._baseZ);
    this._camera.lookAt(0, 0, 0);
  }

  get camera(): PerspectiveCamera {
    return this._camera;
  }

  protected override onInputMount(): void {
    this.inputSubscribe("mousemove", ({ smoothMouse }) => {
      this._camera.position.x = this._baseX + smoothMouse.nx * 0.8;
      this._camera.position.y = this._baseY + smoothMouse.ny * 0.8;
      this._camera.position.z = this._baseZ + Math.abs(smoothMouse.nx) * 0.2;
      this._camera.lookAt(0, 0, 0);
    });
  }

  override resize(width: number, height: number): void {
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
  }
}
