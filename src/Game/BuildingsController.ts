import { DOT_COST_COINS, DOT_COST_FOOD } from "../consts";
import { randomPointInPolygon, type Point, type Polygon } from "../utils";
import type { DotTemplate, Dot } from "./DotsController";
import type { ResourcesState } from "./ResourcesController";
import type { Team } from "./TeamController";

export type BuildingCost = {
    coins: number;
    wood: number;
};

export type BuildingBase = {
    kind: string;
    frameRelative: Polygon;
    frame: Polygon;
    center: Point;
    health: number;
    team: Team;
    cost: BuildingCost;
};

export type BuildingBarracks = BuildingBase & {
    kind: "barracks";
    spawnDuration: number;
    spawnTimeLeft: number;
    spawnQueue: DotTemplate[];
    isSpawning: boolean;
};

export type BuildingHouse = BuildingBase & {
    kind: "house";
    capacity: number;
};

export type BuildingFarm = BuildingBase & {
    kind: "farm";
    foodPerSecond: number;
    foodCapacity: number;
};

export type BuildingGranary = BuildingBase & {
    kind: "granary";
    foodCapacity: number;
};

export type BuildingLumberMill = BuildingBase & {
    kind: "lumberMill";
    woodPerSecond: number;
    woodCapacity: number;
};

export type BuildingHQ = BuildingBase & {
    kind: "hq";
    coinsPerSecond: number;
};

export type Building =
    | BuildingBarracks
    | BuildingHouse
    | BuildingFarm
    | BuildingGranary
    | BuildingLumberMill
    | BuildingHQ;

export type BuildingKind = Building["kind"];

export type DotSpawned = DotTemplate & Pick<Dot, "position" | "team">;

export type BuildingsControllerTickEffects = {
    dotsSpawned: DotSpawned[];
    resourcesChangeByMap: Map<
        Team,
        {
            foodProduced: number;
            foodConsumed: number;
            woodProduced: number;
            woodConsumed: number;
            coinsProduced: number;
            coinsConsumed: number;
        }
    >;
};

export type BuildingsControllerArgs = {
    teamToResources: Map<
        Team,
        {
            food: number;
            housing: number;
            wood: number;
            coins: number;
        }
    >;
};

export class BuildingsController {
    buildings = new Set<Building>();

    constructor() {}

    static canBuild(buildingCost: BuildingCost, resources: ResourcesState) {
        return (
            buildingCost.wood <= resources.wood &&
            buildingCost.coins <= resources.coins
        );
    }

    addBuilding(building: Building) {
        this.buildings.add(building);
    }

    removeBuilding(building: Building) {
        this.buildings.delete(building);
    }

    countHousing(team: Team) {
        let count = 0;
        for (const building of this.buildings) {
            if (building.team !== team) {
                continue;
            }

            if (building.kind === "house") {
                count += building.capacity;
            }
        }

        count -= team.dotsCount;

        return count;
    }

    countFoodCapacity(team: Team) {
        let count = 0;
        for (const building of this.buildings) {
            if (building.team !== team) {
                continue;
            }

            if (building.kind === "farm" || building.kind === "granary") {
                count += building.foodCapacity;
            }
        }

        return count;
    }

    countWoodCapacity(team: Team) {
        let count = 0;
        for (const building of this.buildings) {
            if (building.team !== team) {
                continue;
            }

            if (building.kind === "lumberMill") {
                count += building.woodCapacity;
            }
        }

        return count;
    }

    tick(
        timeDelta: number,
        args: BuildingsControllerArgs,
    ): BuildingsControllerTickEffects {
        const effectsInitial = {
            foodProduced: 0,
            foodConsumed: 0,
            woodProduced: 0,
            woodConsumed: 0,
            coinsProduced: 0,
            coinsConsumed: 0,
        };

        const effects: BuildingsControllerTickEffects = {
            dotsSpawned: [],
            resourcesChangeByMap: new Map(),
        };

        for (const team of args.teamToResources.keys()) {
            effects.resourcesChangeByMap.set(team, { ...effectsInitial });
        }

        const getResources = (team: Team) => {
            const resources = args.teamToResources.get(team);

            if (resources === undefined) {
                window.panic("team must have resources", {
                    team,
                });
            }

            return resources;
        };

        const getResourcesChange = (team: Team) => {
            const resourcesChangeBy = effects.resourcesChangeByMap.get(team);

            if (resourcesChangeBy === undefined) {
                window.panic("team must have effects", {
                    team,
                });
            }

            return resourcesChangeBy;
        };

        const getFoodAvailable = (team: Team) => {
            const resources = getResources(team);
            const effects = getResourcesChange(team);

            return resources.food + effects.foodProduced - effects.foodConsumed;
        };

        // const getWoodAvailable = (team: Team) => {
        //     const resources = getResources(team);
        //     const effects = getResourcesChange(team);

        //     return resources.wood + effects.woodProduced - effects.woodConsumed;
        // };

        const getCoinsAvailable = (team: Team) => {
            const resources = getResources(team);
            const effects = getResourcesChange(team);

            return (
                resources.coins + effects.coinsProduced - effects.coinsConsumed
            );
        };

        const tickBarracks = (building: BuildingBarracks) => {
            if (!building.spawnQueue.length) {
                return;
            }

            if (!building.isSpawning) {
                if (!building.spawnQueue.length) {
                    return;
                }

                if (getFoodAvailable(building.team) < DOT_COST_FOOD) {
                    return;
                }

                if (getCoinsAvailable(building.team) < DOT_COST_COINS) {
                    return;
                }

                if (getResources(building.team).housing < 1) {
                    return;
                }

                getResourcesChange(building.team).foodConsumed += DOT_COST_FOOD;
                getResourcesChange(building.team).coinsConsumed +=
                    DOT_COST_COINS;
                building.isSpawning = true;
                building.spawnTimeLeft = building.spawnDuration;
            }

            if (building.spawnTimeLeft > 0) {
                building.spawnTimeLeft = Math.max(
                    building.spawnTimeLeft - timeDelta,
                    0,
                );
                return;
            }
            const dotTemplate = building.spawnQueue.shift();

            if (dotTemplate === undefined) {
                window.panic("spawned with empty queue");
            }

            const dot: DotSpawned = {
                ...dotTemplate,
                position: randomPointInPolygon(building.frame),
                team: building.team,
            };

            effects.dotsSpawned.push(dot);

            building.isSpawning = false;
        };

        const tickFarm = (building: BuildingFarm) => {
            const foodProduced = building.foodPerSecond * (timeDelta / 1000);

            getResourcesChange(building.team).foodProduced += foodProduced;
        };

        const tickLumberMill = (building: BuildingLumberMill) => {
            const woodProduced = building.woodPerSecond * (timeDelta / 1000);

            getResourcesChange(building.team).woodProduced += woodProduced;
        };

        const tickHQ = (building: BuildingHQ) => {
            const coinsProduced = building.coinsPerSecond * (timeDelta / 1000);

            getResourcesChange(building.team).coinsProduced += coinsProduced;
        };

        const removeIfDead = (building: Building) => {
            if (building.health <= 0) {
                this.removeBuilding(building);
            }
        };

        for (const building of this.buildings) {
            removeIfDead(building);
        }

        for (const building of this.buildings) {
            switch (building.kind) {
                case "barracks":
                    tickBarracks(building);
                    break;
                case "farm":
                    tickFarm(building);
                    break;
                case "lumberMill":
                    tickLumberMill(building);
                    break;
                case "hq":
                    tickHQ(building);
                    break;
            }
        }

        return effects;
    }
}
