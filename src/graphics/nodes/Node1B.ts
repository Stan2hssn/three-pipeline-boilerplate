// Node1B.ts
import { getGsap } from '@/plugins/gsap';
import type { IObject3DNode } from '@_core/nodes/Object3DNode.interface';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';

/** Variante de Node1 (couleur/position différente) */
export class Node1B implements IObject3DNode {
  public readonly id = 'node-1b';
  public readonly name = 'Node 1B';
  public readonly active = true;
  public readonly mounted = false;

  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private readonly geometry: BoxGeometry;

  constructor() {
    const geo = new BoxGeometry(0.9, 0.9, 0.9);
    this.geometry = geo;
    const mat = new MeshBasicMaterial({ color: 0xffaa55 });
    this.material = mat;
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.x = -2;

    this.mesh.scale.set(0, 0, 0);
  }

  getObject3D(): Object3D {
    return this.mesh;
  }

  beforeMount(): void {
    this.mesh.scale.set(0, 0, 0);
  }

  onMounted(): void {
    getGsap().then((gsap) => {
      gsap.killTweensOf(this.mesh.scale);
      gsap.to(this.mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.1,
        ease: 'expo.out',
      });
    });
  }

  beforeUnmount(): Promise<void> {
    return getGsap().then((gsap) => {
      gsap.killTweensOf(this.mesh.scale);
      return new Promise<void>((resolve) => {
        gsap.to(this.mesh.scale, {
          x: 0,
          y: 0,
          z: 0,
          duration: 0.6,
          ease: 'power2.in',
          onComplete: () => resolve(),
        });
      });
    });
  }

  onUnmounted(): void { }

  update(_time: number, _dt: number): void {
    // this.mesh.rotation.y -= 0.01;
    // this.mesh.rotation.z += 0.01;

    const l = Math.sin(_time * 0.001) * 0.2 + 0.5;
    this.material.color.setHSL(0.7, 1, l);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
