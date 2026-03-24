export const NODE_ID = {
    NODE_1: "node-1",
    NODE_1B: "node-1b",
    NODE_2: "node-2",
    FISH_NODE: "fish-node",
    CAMERA_MAIN: "camera-main",
    GRID_NODE: "grid-node",
    SPLINE_DRAWER_NODE: "spline-drawer-node",
    SPHERE_INTERACTOR: "sphere-interactor",
    FISH_TEST_NODE: "fish-test-node",
} as const;

export type NodeId = (typeof NODE_ID)[keyof typeof NODE_ID];
