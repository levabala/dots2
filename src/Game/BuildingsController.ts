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
};

export type BuildingHouse = BuildingBase & {
    kind: "house";
    capacity: number;
};

export type Building = BuildingBarracks | BuildingHouse;

export type DotSpawned = DotTemplate & Pick<Dot, "position" | "team">;

export type BuildingsProduction = {
    dots: DotSpawned[];
    food: number;
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

    tick(timeDelta: number): BuildingsProduction {
        const production: BuildingsProduction = {
            dots: [],
            food: 0,
        };

        const tickBarracks = (building: BuildingBarracks) => {
            if (!building.team) {
                return;
            }

            if (!building.spawnQueue.length) {
                return;
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

            production.dots.push(dot);

            building.spawnTimeLeft = building.spawnDuration;
        };

        for (const building of this.buildings) {
            switch (building.kind) {
                case "barracks":
                    tickBarracks(building);
                    break;
            }
        }

        return production;
    }
}
