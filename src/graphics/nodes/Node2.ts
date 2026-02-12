// Node2.ts
import type { IObject3DNode } from '@/_core/nodes/Object3DNode.interface';
import { getGsap } from '@/plugins/gsap';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';

export class Node2 implements IObject3DNode {
    public readonly id = 'node-2';
    public readonly name = 'Node 2';
    public readonly active = true;
    public readonly mounted = false;

    private readonly mesh: Mesh;
    private readonly material: MeshBasicMaterial;
    private readonly geometry: BoxGeometry;

    constructor() {
        const geo = new BoxGeometry(1, 1, 1);
        const mat = new MeshBasicMaterial({ color: 0x55aaff });
        this.geometry = geo;
        this.material = mat;
        this.mesh = new Mesh(this.geometry, this.material);
        this.mesh.position.x = 2;

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
                duration: 1.6, // slower entry
                ease: "expo.out",
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
                    duration: 0.5, // fast exit
                    ease: "power2.in",
                    onComplete: () => resolve(),
                });
            });
        });
    }

    onUnmounted(): void { }

    update(_time: number, _dt: number): void {
        this.mesh.rotation.y += 0.01;
        this.mesh.rotation.z -= 0.01;
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}
