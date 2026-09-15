import type IPass from "@_core/pipeline/Pass.interface.ts";
import type { PassContext } from "@_core/pipeline/Pass.interface.ts";
import type { FrameTiming } from "@_core/types/Frame.type.ts";
import {
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import fragmentShader from "./output.frag?raw";
import vertexShader from "./output.vert?raw";

/** Scene rendue dans `target`, puis copiee a l'ecran en sRGB au `postRender`. */
export class OutputPass implements IPass {
  readonly target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  private readonly _size = new Vector2();
  private readonly _camera = new OrthographicCamera();
  private readonly _material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { tScene: { value: this.target.texture } },
    depthTest: false,
    depthWrite: false,
  });
  private readonly _quad = new Mesh(new PlaneGeometry(2, 2), this._material);

  constructor() {
    this._quad.frustumCulled = false;
  }

  beforeMount(): Promise<void> {
    return Promise.resolve();
  }
  onMounted(): void {}
  beforeUnmount(): Promise<void> {
    return Promise.resolve();
  }
  onUnmounted(): void {}

  // Avant `render` : la cible doit avoir la taille du canvas quand la scene y est dessinee.
  prepare(_frame: FrameTiming, ctx: PassContext): void {
    const { x, y } = (ctx.renderer as WebGLRenderer).getDrawingBufferSize(this._size);
    if (x !== this.target.width || y !== this.target.height) this.target.setSize(x, y);
  }

  render(): void {}

  postRender(_frame: FrameTiming, ctx: PassContext): void {
    const renderer = ctx.renderer as WebGLRenderer;
    renderer.setRenderTarget(null);
    renderer.render(this._quad, this._camera);
  }

  resize(): void {}

  dispose(): void {
    this.target.dispose();
    this._quad.geometry.dispose();
    this._material.dispose();
  }
}
