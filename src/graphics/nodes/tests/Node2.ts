// Node2.ts
import { Object3DNodeBase } from "@/_core";
import { getGsap } from '@/plugins/gsap';
import { NODE_ID } from '@graphics/nodes/Node.id.ts';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';

export class Node2 extends Object3DNodeBase {
    private readonly mesh: Mesh;
    private readonly material: MeshBasicMaterial;
    private readonly geometry: BoxGeometry;

    constructor() {
        const geo = new BoxGeometry(1, 1, 1);
        const mat = new MeshBasicMaterial({ color: 0xFB6F64 });
        const mesh = new Mesh(geo, mat);
        super(NODE_ID.NODE_2, "Node 2", mesh);

        this.geometry = geo;
        this.material = mat;
        this.mesh = mesh;
        this.mesh.position.x = 2;

        this.mesh.scale.set(0, 0, 0);
    }

    beforeMount(): void {
        this.mesh.scale.set(0, 0, 0);
    }

    onMounted(): void {
        super.onMounted();
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

    onUnmounted(): void {
        super.onUnmounted();
    }

    update(_time: number, _dt: number): void {
        //
    }

    dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
}
