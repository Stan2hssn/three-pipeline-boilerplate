// Node1.ts

import { Object3DNodeBase } from "@/_core";
import { getGsap } from "@/plugins/gsap";
import { NODE_ID } from "@graphics/nodes/Node.id.ts";
import { BoxGeometry, Material, Mesh, MeshBasicMaterial } from "three";

export class Node1 extends Object3DNodeBase {
    private readonly mesh: Mesh;

    constructor() {
        const geo = new BoxGeometry(1, 1, 1);
        const mat = new MeshBasicMaterial({ color: 0xFFFDB6 });
        const mesh = new Mesh(geo, mat);
        super(NODE_ID.NODE_1, "Node 1", mesh);

        this.mesh = mesh;
        this.mesh.position.x = 2;

        // Start hidden; entry anim happens onMounted (fire-and-forget)
        this.mesh.scale.set(0, 0, 0);
    }

    beforeMount(): void {
        // Setup only (no anim by your rule)
        // Example: reset to hidden so entry anim always starts from 0
        this.mesh.scale.set(0, 0, 0);
    }

    onMounted(): void {
        super.onMounted();
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
        super.onUnmounted();
        // Structural cleanup only
        // (scene.remove is handled by NodeGraph)
    }

    update(_time: number, _dt: number): void {
        //
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as Material).dispose();
    }
}
