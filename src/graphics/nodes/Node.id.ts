export const NODE_ID = {
    NODE_1: "node-1",
    NODE_1B: "node-1b",
    NODE_2: "node-2",
    CAMERA_MAIN: "camera-main",
} as const;

export type NodeId = (typeof NODE_ID)[keyof typeof NODE_ID];
