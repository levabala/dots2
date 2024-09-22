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
        cost: {
            wood: 50,
            coins: 100,
        },
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
        cost: {
            wood: 20,
            coins: 20,
        },
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
        cost: {
            wood: 80,

            coins: 50,
        },
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
        cost: {
            wood: 80,
            coins: 50,
        },
    },
    lumberMill: {
        kind: "lumberMill",
        frameRelative: [
            { x: -50, y: -50 },
            { x: 50, y: -50 },
            { x: 50, y: 50 },
            { x: -50, y: 50 },
        ],
        health: 100,
        woodPerSecond: 5,
        woodCapacity: 100,
        cost: {
            wood: 0,
            coins: 20,
        },
    },
};
