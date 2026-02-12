// Node1.ts

import type { IObject3DNode } from "@/_core/nodes/Object3DNode.interface";
import { getGsap } from "@/plugins/gsap";
import { BoxGeometry, Material, Mesh, MeshBasicMaterial, Object3D } from "three";

export class Node1 implements IObject3DNode {
    public readonly id = 'node-1';
    public readonly name = 'Node 1';
    public readonly active = true;
    public readonly mounted = false;

    private readonly mesh: Mesh;

    constructor() {
        const geo = new BoxGeometry(1, 1, 1);
        const mat = new MeshBasicMaterial({ color: 0xff5555 });
        this.mesh = new Mesh(geo, mat);
        this.mesh.position.x = 2;

        // Start hidden; entry anim happens onMounted (fire-and-forget)
        this.mesh.scale.set(0, 0, 0);
    }

    getObject3D(): Object3D {
        return this.mesh;
    }

    beforeMount(): void {
        // Setup only (no anim by your rule)
        // Example: reset to hidden so entry anim always starts from 0
        this.mesh.scale.set(0, 0, 0);
    }

    onMounted(): void {
        // Entry animation (not awaited)
        getGsap().then((gsap) => {
            gsap.killTweensOf(this.mesh.scale);
            gsap.to(this.mesh.scale, {
                x: 1,
                y: 1,
                z: 1,
                duration: 0.8,
                ease: "back.out(1.7)",
            });
        });
    }

    beforeUnmount(): Promise<void> {
        // Exit animation (awaited by NodeGraph)
        return getGsap().then((gsap) => {
            gsap.killTweensOf(this.mesh.scale);
            return new Promise<void>((resolve) => {
                gsap.to(this.mesh.scale, {
                    x: 0,
                    y: 0,
                    z: 0,
                    duration: 1.4, // slower exit
                    onComplete: () => resolve(),
                    ease: "power3.in",
                });
            });
        });
    }

    onUnmounted(): void {
        // Structural cleanup only
        // (scene.remove is handled by NodeGraph)
    }

    update(_time: number, _dt: number): void {
        this.mesh.rotation.y += 0.01;
        this.mesh.rotation.x += 0.01;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as Material).dispose();
    }
}
