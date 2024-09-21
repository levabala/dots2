import { DOT_FOOD_COST } from "../consts";
import { randomPointInPolygon, type Polygon } from "../utils";
import type { Dot, DotTemplate, Team } from "./Game";

export type BuildingKind = "house" | "barracks" | "farm";

export type BuildingBase = {
    kind: BuildingKind;
    frame: Polygon;
    health: number;
    team: Team;
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
}

export type Building = BuildingBarracks | BuildingHouse | BuildingFarm;

export type DotSpawned = DotTemplate & Pick<Dot, "position" | "team">;

export type BuildingsControllerTickEffects = {
    dotsSpawned: DotSpawned[];
    resourcesChangeByMap: Map<
        Team,
        {
            foodProduced: number;
            foodConsumed: number;
        }
    >;
};

export type BuildingsControllerArgs = {
    teamToResources: Map<
        Team,
        {
            food: number;
            housing: number;
        }
    >;
};

export class BuildingsController {
    buildings = new Set<Building>();

    constructor() {}

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

    tick(
        timeDelta: number,
        args: BuildingsControllerArgs,
    ): BuildingsControllerTickEffects {
        const effectsInitial = {
            foodProduced: 0,
            foodConsumed: 0,
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

        const tickBarracks = (building: BuildingBarracks) => {
            if (!building.spawnQueue.length) {
                return;
            }

            if (!building.isSpawning) {
                if (!building.spawnQueue.length) {
                    return;
                }

                if (getFoodAvailable(building.team) < DOT_FOOD_COST) {
                    return;
                }

                if (getResources(building.team).housing < 1) {
                    return;
                }

                getResourcesChange(building.team).foodConsumed += DOT_FOOD_COST;
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
        }

        for (const building of this.buildings) {
            switch (building.kind) {
                case "barracks":
                    tickBarracks(building);
                    break;
                case "farm":
                    tickFarm(building);
                    break;
            }
        }

        return effects;
    }
}
