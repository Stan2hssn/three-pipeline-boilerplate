import type { FrameTiming } from "../types/Frame.type.ts";

export interface PassContext {
  scene: unknown;
  camera: unknown;
  [key: string]: unknown;
}

export default interface IPass {
  beforeMount(): Promise<void>;
  onMounted(): void;
  beforeUnmount(): Promise<void>;
  onUnmounted(): void;

  render(frame: FrameTiming, ctx: PassContext): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
