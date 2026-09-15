import { NoBlending, ShaderMaterial, type Texture } from "three";
import fragmentShader from "./copy.frag?raw";
import vertexShader from "./fullscreen.vert?raw";

export class CopyMaterial extends ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: { inputBuffer: { value: null } },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }

  // `colorspace_fragment` encode selon la cible courante : `toScreen` ne sert qu'en TSL.
  update(input: Texture, _toScreen: boolean): void {
    this.uniforms.inputBuffer.value = input;
  }
}
