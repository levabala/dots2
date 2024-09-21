import { DOT_FOOD_COST } from "../consts";
import { randomPointInPolygon, type Polygon } from "../utils";
import type { Dot, DotTemplate, Team } from "./Game";

export type BuildingKind = "house" | "barracks";

export type BuildingBase = {
    kind: BuildingKind;
    frame: Polygon;
    health: number;
    team: Team | null;
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

export type Building = BuildingBarracks | BuildingHouse;

export type DotSpawned = DotTemplate & Pick<Dot, "position" | "team">;

export type BuildingsControllerTickEffects = {
    dotsSpawned: DotSpawned[];
    foodProduced: number;
    foodConsumed: number;
};

export type BuildingsControllerArgs = {
    availableFood: number;
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

    tick(
        timeDelta: number,
        args: BuildingsControllerArgs,
    ): BuildingsControllerTickEffects {
        const effects: BuildingsControllerTickEffects = {
            dotsSpawned: [],
            foodProduced: 0,
            foodConsumed: 0,
        };

        const getFoodAvailable = () => {
            return args.availableFood + effects.foodProduced - effects.foodConsumed;
        };

        const tickBarracks = (building: BuildingBarracks) => {
            if (!building.team || !building.spawnQueue.length) {
                return;
            }

            if (!building.isSpawning) {
                if (!building.spawnQueue.length) {
                    return;
                }

                if (getFoodAvailable() < DOT_FOOD_COST) {
                    return;
                }

                effects.foodConsumed += DOT_FOOD_COST;
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

        for (const building of this.buildings) {
            switch (building.kind) {
                case "barracks":
                    tickBarracks(building);
                    break;
            }
        }

        return effects;
    }
}
