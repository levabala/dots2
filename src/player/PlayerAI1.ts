import { DOT_COST_COINS, DOT_COST_FOOD } from "../consts";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import type { Resource } from "../Game/ResourcesController";
import type { Team } from "../Game/TeamController";
import { mapValues, randomInteger } from "remeda";
import type { Point } from "../utils";

const PLANNING_HORIZON_SECONDS = 10;

export class PlayerAI {
    economy: Economy;

    actIntervalBetween: number = 100;

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        this.economy = new Economy(game, team);
    }

    startAI() {
        setInterval(() => {
            this.act();
        }, this.actIntervalBetween);

        setInterval(() => {
            this.economy.log();
        }, 1000);
    }

    private act() {
        this.economy.act();
    }
}

const ResourceToBuildingToBeProductedBy: Record<Resource, BuildingKind> = {
    food: "farm",
    wood: "lumberMill",
    coins: "coinMiner",
    housing: "house",
};

class Economy {
    resourcesProductionBalance: Record<Resource, number> = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
    };
    expectedProductionPerSecond: Record<Resource | "units", number> = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
        units: 0,
    };
    expectedConsumptionPerSecond: Record<Resource, number> = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
    };
    buildingsWanted: Record<
        BuildingKind,
        { count: number; inSeconds: number }
    > = {
        farm: { count: 0, inSeconds: 0 },
        house: { count: 0, inSeconds: 0 },
        lumberMill: { count: 0, inSeconds: 0 },
        barracks: { count: 0, inSeconds: 0 },
        coinMiner: { count: 0, inSeconds: 0 },
        granary: { count: 0, inSeconds: 0 },
        hq: { count: 0, inSeconds: 0 },
    };
    resourcesAtHorizon: Record<Resource, number> = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
    };
    unitsWanted: number = 0;
    baseCenter: Point;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debugInfo: Record<string, any> = {};

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        this.baseCenter = this.calcBaseCenter();
    }

    private calcBaseCenter() {
        const buildings = this.game.getBuildings();

        for (const building of buildings) {
            if (building.team !== this.team) {
                continue;
            }

            if (building.kind === "hq") {
                return building.center;
            }
        }

        return { x: this.game.width / 2, y: this.game.height / 2 };
    }

    private calcBuildingsWanted(): typeof this.buildingsWanted {
        const buildingsWanted = {
            farm: {
                count: 0,
                inSeconds: 0,
            },
            house: {
                count: 0,
                inSeconds: 0,
            },
            lumberMill: {
                count: 0,
                inSeconds: 0,
            },
            barracks: {
                count: 0,
                inSeconds: 0,
            },
            coinMiner: {
                count: 0,
                inSeconds: 0,
            },
            granary: {
                count: 0,
                inSeconds: 0,
            },
            hq: {
                count: 0,
                inSeconds: 0,
            },
        };

        this.debugInfo.resourcesAtHorizon = this.resourcesAtHorizon;

        const resourcesNeededSorted = (
            Object.entries(this.resourcesAtHorizon) as Array<[Resource, number]>
        ).filter(([, countAtHorizon]) => countAtHorizon <= 0);

        if (resourcesNeededSorted.length > 0) {
            resourcesNeededSorted.sort((a, b) => a[1] - b[1]);
        }

        const resourceMostNeeded = resourcesNeededSorted[0] as
            | [Resource, number]
            | undefined;

        const mostNecessity = resourceMostNeeded && {
            resource: resourceMostNeeded[0],
            countAtHorizon: resourceMostNeeded[1],
        };

        this.debugInfo.mostNecessity = mostNecessity;

        if (!mostNecessity || mostNecessity.countAtHorizon > 0) {
            buildingsWanted.barracks.count = 1;
            buildingsWanted.barracks.inSeconds = PLANNING_HORIZON_SECONDS;

            return buildingsWanted;
        }

        const buildingWanted =
            ResourceToBuildingToBeProductedBy[mostNecessity.resource];

        buildingsWanted[buildingWanted] = {
            count: 1,
            inSeconds: 30,
        };

        return buildingsWanted;
    }

    private calcResourcesAtHorizon() {
        const resourcesAtHorizon: Record<Resource, number> = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
        };

        for (const [resource, productionPerSecond] of Object.entries(
            this.resourcesProductionBalance,
        )) {
            resourcesAtHorizon[resource as Resource] +=
                productionPerSecond * PLANNING_HORIZON_SECONDS;
        }

        const teamResources = this.game.getTeamResources(this.team);
        for (const [resource, storage] of Object.entries(teamResources)) {
            if (resourcesAtHorizon[resource as Resource] === undefined) {
                continue;
            }

            resourcesAtHorizon[resource as Resource] += storage;
        }

        const buildingToBuildRaw = Object.entries(this.buildingsWanted).sort(
            (a, b) => b[1].count - a[1].count,
        )[0];
        const buildingToBuild = {
            kind: buildingToBuildRaw[0] as BuildingKind,
            count: buildingToBuildRaw[1].count,
            inSeconds: buildingToBuildRaw[1].inSeconds,
        };

        const buildingNeededConfig = BUILDINGS_CONFIGS[buildingToBuild.kind];

        resourcesAtHorizon.wood -= buildingNeededConfig.cost.wood;
        resourcesAtHorizon.coins -= buildingNeededConfig.cost.coins;

        // TODO: iterate
        resourcesAtHorizon.food = Math.min(
            resourcesAtHorizon.food,
            teamResources.foodCapacity,
        );
        resourcesAtHorizon.wood = Math.min(
            resourcesAtHorizon.wood,
            teamResources.woodCapacity,
        );
        resourcesAtHorizon.coins = Math.min(
            resourcesAtHorizon.coins,
            teamResources.coinsCapacity,
        );
        resourcesAtHorizon.housing = Math.min(
            resourcesAtHorizon.housing,
            teamResources.housing,
        );

        return resourcesAtHorizon;
    }

    private calcUnitsWanted(): number {
        return 10;
    }

    private calcExpectedProduction(): Record<Resource | "units", number> {
        const buildings = this.game.getBuildings();

        const production: Record<Resource | "units", number> = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
            units: 0,
        };

        for (const building of buildings) {
            if (building.team !== this.team) {
                continue;
            }

            switch (building.kind) {
                case "farm":
                    production.food += building.foodPerSecond;
                    break;
                case "lumberMill":
                    production.wood += building.woodPerSecond;
                    break;
                case "barracks":
                    production.units += 1 / (building.spawnDuration / 1000);
                    break;
                case "coinMiner":
                    production.coins += building.coinsPerSecond;
                    break;
                case "hq":
                    production.coins += building.coinsPerSecond;
                    break;
            }
        }

        return production;
    }

    private calcExpectedConsumption(): Record<Resource, number> {
        const consumption: Record<Resource, number> = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
        };

        const unitsPerSecond = this.expectedProductionPerSecond.units;

        consumption.food += unitsPerSecond * DOT_COST_FOOD;
        consumption.coins += unitsPerSecond * DOT_COST_COINS;
        consumption.housing += unitsPerSecond;

        return consumption;
    }

    private calcResourcesProductionBalance(): Record<Resource, number> {
        const resourcesProductionBalance: Record<Resource, number> = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
        };

        const consumption = this.expectedConsumptionPerSecond;
        const production = this.expectedProductionPerSecond;

        for (const [resource, value] of Object.entries(consumption)) {
            resourcesProductionBalance[resource as Resource] -= value;
        }

        for (const [resource, value] of Object.entries(production)) {
            resourcesProductionBalance[resource as Resource] += value;
        }

        return resourcesProductionBalance;
    }

    private updateInfo() {
        this.baseCenter = this.calcBaseCenter();
        this.unitsWanted = this.calcUnitsWanted();
        this.resourcesProductionBalance = this.calcResourcesProductionBalance();
        this.resourcesAtHorizon = this.calcResourcesAtHorizon();
        this.buildingsWanted = this.calcBuildingsWanted();
        this.expectedProductionPerSecond = this.calcExpectedProduction();
        this.expectedConsumptionPerSecond = this.calcExpectedConsumption();
    }

    private controlUnitProduction() {
        const isInCoinsDeficit = this.resourcesAtHorizon.coins < 0;

        for (const building of this.game.getBuildings()) {
            if (building.team !== this.team) {
                continue;
            }

            if (building.kind === "barracks") {
                if (isInCoinsDeficit) {
                    if (building.allowSpawning) {
                        building.allowSpawning = false;
                        return;
                    }
                } else {
                    if (!building.allowSpawning) {
                        building.allowSpawning = true;
                        return;
                    }
                }
            }
        }
    }

    private build() {
        const buildingKind = Object.entries(this.buildingsWanted).sort(
            (a, b) => b[1].count - a[1].count,
        )[0][0] as BuildingKind;

        const canBuild = this.game.canBuild(
            BUILDINGS_CONFIGS[buildingKind].cost,
            this.team,
        );

        if (!canBuild) {
            return;
        }

        const building: Building = {
            ...BUILDINGS_CONFIGS[buildingKind],
            kind: buildingKind,
            team: this.team,
            frame: BUILDINGS_CONFIGS.barracks.frameRelative,
            center: {
                x: this.baseCenter.x + randomInteger(-100, 300),
                y: this.baseCenter.y + randomInteger(-100, 300),
            },
        } as Building;

        const isBuilt = this.game.tryBuild(building);

        this.log();
        console.log("isBuilt", isBuilt, building);
    }

    log() {
        console.log(
            "resources",
            mapValues(this.game.getTeamResources(this.team), (v) =>
                Math.floor(v),
            ),
            "buildingsWanted",
            mapValues(this.buildingsWanted, (v) => v.count),
            "expectedProductionPerSecond",
            mapValues(this.expectedProductionPerSecond, (v) => v.toFixed(1)),
            "expectedConsumptionPerSecond",
            mapValues(this.expectedConsumptionPerSecond, (v) => v.toFixed(1)),
            "resourcesAtHorizon",
            mapValues(this.debugInfo.resourcesAtHorizon, (v) => v.toFixed(1)),
            "\nmostNecessity",
            this.debugInfo.mostNecessity,
            "\nbarracks online",
            Array.from(this.game.getBuildings()).filter(
                (b) =>
                    b.kind === "barracks" &&
                    b.team === this.team &&
                    b.allowSpawning,
            ).length,
        );
    }

    act() {
        this.updateInfo();
        this.build();
        this.controlUnitProduction();
    }
}
