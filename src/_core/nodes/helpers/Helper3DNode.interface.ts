import type { GridHelper, Object3D } from "three";
import type { IObject3DNode } from "../object3d/Object3DNode.interface";

export interface IHelper3DNode<Id extends string = string> extends IObject3DNode<Id> {
    readonly id: Id;
    readonly name: string;
    readonly active: boolean;
    readonly mounted: boolean;

    _helper: Object3D;

    getHelper(): GridHelper;
    getHelper3D(): Object3D;
    getAttachedNode(): IObject3DNode | null;
    attachNode(object3D: IObject3DNode): void;
    detachNode(): void;
}   