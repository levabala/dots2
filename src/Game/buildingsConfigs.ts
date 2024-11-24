import type {
    Building,
    BuildingCost,
    BuildingKind,
} from "./BuildingsController";

function getArrayElementByIndexOrLast<T>(array: T[], index: number): T {
    return index < array.length ? array[index] : array[array.length - 1];
}

export type BuildingConfig<B extends Building> = Omit<
    B,
    "frame" | "center" | "team"
> & {
    getCost: (countAlreadyBuilt: number) => BuildingCost;
};

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
        allowSpawning: true,
        getCost: (countAlreadyBuilt: number) =>
            getArrayElementByIndexOrLast(
                [
                    {
                        wood: 50,
                        coins: 100,
                    },
                    {
                        wood: 100,
                        coins: 150,
                    },
                    {
                        wood: 300,
                        coins: 200,
                    },
                    {
                        wood: 600,
                        coins: 400,
                    },
                    {
                        wood: 1000,
                        coins: 1500,
                    },
                ],
                countAlreadyBuilt,
            ),
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
        unitsCapacity: 110,
        getCost: (countAlreadyBuilt: number) =>
            getArrayElementByIndexOrLast(
                [
                    {
                        wood: 20,
                        coins: 20,
                    },
                    {
                        wood: 40,
                        coins: 40,
                    },
                    {
                        wood: 80,
                        coins: 80,
                    },
                    {
                        wood: 300,
                        coins: 300,
                    },
                    {
                        wood: 1000,
                        coins: 1000,
                    },
                ],
                countAlreadyBuilt,
            ),
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
        foodPerSecond: 20,
        foodCapacity: 100,
        getCost: (countAlreadyBuilt: number) =>
            getArrayElementByIndexOrLast(
                [
                    {
                        wood: 80,
                        coins: 50,
                    },
                    {
                        wood: 160,
                        coins: 100,
                    },
                    {
                        wood: 320,
                        coins: 200,
                    },
                    {
                        wood: 640,
                        coins: 400,
                    },
                    {
                        wood: 1280,
                        coins: 1000,
                    },
                ],
                countAlreadyBuilt,
            ),
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
        getCost: (countAlreadyBuilt: number) =>
            getArrayElementByIndexOrLast(
                [
                    {
                        wood: 80,
                        coins: 50,
                    },
                    {
                        wood: 160,
                        coins: 100,
                    },
                    {
                        wood: 320,
                        coins: 200,
                    },
                    {
                        wood: 640,
                        coins: 400,
                    },
                    {
                        wood: 1280,
                        coins: 1000,
                    },
                ],
                countAlreadyBuilt,
            ),
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
        getCost: (countAlreadyBuilt: number) =>
            getArrayElementByIndexOrLast(
                [
                    {
                        wood: 0,
                        coins: 200,
                    },
                    {
                        wood: 0,
                        coins: 400,
                    },
                    {
                        wood: 0,
                        coins: 800,
                    },
                    {
                        wood: 0,
                        coins: 2000,
                    },
                    {
                        wood: 0,
                        coins: 5000,
                    },
                ],
                countAlreadyBuilt,
            ),
    },
    hq: {
        kind: "hq",
        frameRelative: [
            { x: -40, y: -50 },
            { x: 40, y: -50 },
            { x: 40, y: 50 },
            { x: -40, y: 50 },
        ],
        health: 100,
        coinsPerSecond: 10,
        unitsCapacity: 100,
        getCost: () => ({
            wood: Infinity,
            coins: Infinity,
        }),
    },
    coinMiner: {
        kind: "coinMiner",
        frameRelative: [
            { x: -60, y: -50 },
            { x: 60, y: -50 },
            { x: 60, y: 50 },
            { x: -60, y: 50 },
        ],
        health: 80,
        coinsPerSecond: 5,
        getCost: (countAlreadyBuilt: number) =>
            getArrayElementByIndexOrLast(
                [
                    {
                        wood: 100,
                        coins: 200,
                    },
                    {
                        wood: 200,
                        coins: 400,
                    },
                    {
                        wood: 400,
                        coins: 800,
                    },
                    {
                        wood: 800,
                        coins: 2000,
                    },
                    {
                        wood: 5000,
                        coins: 10000,
                    },
                ],
                countAlreadyBuilt,
            ),
    },
};
