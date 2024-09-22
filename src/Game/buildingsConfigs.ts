import type { Building, BuildingKind } from "./BuildingsController";

export type BuildingConfig<B extends Building> = Omit<
    B,
    "frame" | "center" | "team"
>;

export const BUILDINGS_CONFIGS: {
    [Kind in BuildingKind]: BuildingConfig<Extract<Building, { kind: Kind }>>;
} = {
    barracks: {
        kind: "barracks",
        frameRelative: [
            { x: -50, y: -40 },
            { x: 50, y: -40 },
            { x: 50, y: 40 },
            { x: -50, y: 40 },
        ],
        health: 100,
        spawnDuration: 500,
        spawnTimeLeft: 500,
        spawnQueue: [],
        isSpawning: false,
    },
    house: {
        kind: "house",
        frameRelative: [
            { x: -25, y: -25 },
            { x: 25, y: -25 },
            { x: 25, y: 25 },
            { x: -25, y: 25 },
        ],
        health: 100,
        capacity: 110,
    },
    farm: {
        kind: "farm",
        frameRelative: [
            { x: -50, y: -50 },
            { x: 50, y: -50 },
            { x: 50, y: 50 },
            { x: -50, y: 50 },
        ],
        health: 100,
        foodPerSecond: 5,
        foodCapacity: 100,
    },
    granary: {
        kind: "granary",
        frameRelative: [
            { x: -30, y: -30 },
            { x: 30, y: -30 },
            { x: 30, y: 30 },
            { x: -30, y: 30 },
        ],
        health: 100,
        foodCapacity: 100,
    },
};
