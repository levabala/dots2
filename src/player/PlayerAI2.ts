import { DOT_ATTACK_RANGE, DOT_COST_COINS, DOT_COST_FOOD } from "../consts";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import type { Resource } from "../Game/ResourcesController";
import type { Team } from "../Game/TeamController";
import { mapValues, randomInteger } from "remeda";
import {
    distanceBetween,
    getPolygonCenter,
    getRectCenter,
    rectToPolygon,
    type Point,
    type Polygon,
} from "../shapes";
import type { Dot } from "../Game/DotsController";
import type { Squad } from "../Game/SquadsController";
import { RendererUtils } from "../RendererUtils";
import type { PlayerInterface } from "./PlayerInterface";
import { PlayerUtils } from "./PlayerUtils";

const PLANNING_HORIZON_SECONDS = 10;
const MY_SQUAD_MIN_SIZE = 30;

export class PlayerAI2 {
    economist: Economist;
    warlord: Warlord;

    actIntervalBetween: number = 100;

    constructor(readonly playerInterface: PlayerInterface) {
        this.economist = new Economist(playerInterface);
        this.warlord = new Warlord(playerInterface);
    }

    startAI() {
        setInterval(() => {
            this.act();
        }, this.actIntervalBetween);

        // setInterval(() => {
        //     this.economist.log();
        // }, 1000);
    }

    act() {
        this.economist.act();
        this.warlord.act();
    }
}

type SquadGroup = {
    squads: Squad[];
    polygon: Polygon;
};

type Target = Squad | Building;

enum WarStage {
    DefendBase = "DefendBase",
    DestroyEnemySquads = "DestroyEnemySquads",
    AttackEnemyBase = "AttackEnemyBase",
}

class Warlord {
    squadsToRepel: Squad[] = [];
    baseCenter: Point;
    warStage: WarStage = WarStage.DefendBase;

    constructor(readonly playerInterface: PlayerInterface) {
        this.baseCenter = this.calcBaseCenter();
    }

    private calcBaseCenter() {
        const buildings = this.playerInterface.getBuildingsMy();

        for (const building of buildings) {
            if (building.kind === "hq") {
                return building.center;
            }
        }

        const mapSize = this.playerInterface.getMapSize();
        return { x: mapSize.width / 2, y: mapSize.height / 2 };
    }

    private calcRallyPoint() {
        return this.baseCenter;
    }

    private getDotsWithoutSquad() {
        const dots = this.playerInterface.getDotsMy();
        const dotsWithoutSquad = [];

        for (const dot of dots) {
            if (dot.squad) {
                continue;
            }

            dotsWithoutSquad.push(dot);
        }

        return dotsWithoutSquad;
    }

    private createSquad(dots: Dot[]) {
        const center = this.calcRallyPoint();

        this.playerInterface.createSquad(dots, center);
    }

    private createSquadIfNeeded() {
        const dots = this.getDotsWithoutSquad();

        if (dots.length < MY_SQUAD_MIN_SIZE) {
            return;
        }

        this.createSquad(dots);
    }

    squadsAssignments: Map<Squad, Target> = new Map();
    private updateSquadsAssignments() {
        const squadsMy = this.playerInterface.getSquadsMy();
        const targets = this.attackTargets;
        const targetsWithoutSquadMy = new Set(targets);
        const squadsMyWithoutTarget = new Set(squadsMy);

        for (const [squadMy, target] of this.squadsAssignments.entries()) {
            if (squadsMy.includes(squadMy) && targets.includes(target)) {
                targetsWithoutSquadMy.delete(target);
                squadsMyWithoutTarget.delete(squadMy);
                continue;
            }

            this.squadsAssignments.delete(squadMy);
        }

        const targetsToAssign = Array.from(targetsWithoutSquadMy);
        const squadsMyToAssign = Array.from(squadsMyWithoutTarget);
        for (const target of targetsToAssign) {
            const squadMy = squadsMyToAssign.pop();

            if (!squadMy) {
                return;
            }

            this.squadsAssignments.set(squadMy, target);
        }
    }

    private controlSquads() {
        for (const [squadMy, target] of this.squadsAssignments) {
            const targetFrame = PlayerUtils.isBuilding(target)
                ? target.frame
                : rectToPolygon(target.frame);

            const frame = PlayerUtils.getNewSquadFrameInFrontOf(
                squadMy,
                getPolygonCenter(targetFrame),
                DOT_ATTACK_RANGE * 0.7,
            );

            this.playerInterface.moveSquadToRect(squadMy, frame);

            if (PlayerUtils.isBuilding(target)) {
                this.playerInterface.orderAttackOnlyBuilding({
                    squadAttacker: squadMy,
                    buildingTarget: target,
                });
            }
        }
    }

    baseCloseProximityDistance = DOT_ATTACK_RANGE * 3;

    enemySquadsAroundMyBase: Array<{ squad: Squad; distance: number }> = [];
    private calcSquadsAroundMyBase(): typeof this.enemySquadsAroundMyBase {
        const squadsEnemy = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);

        return squadsEnemy
            .map((squad) => ({
                squad,
                distance: distanceBetween(
                    getRectCenter(squad.frame),
                    this.baseCenter,
                ),
            }))
            .filter((pair) => pair.distance <= this.baseCloseProximityDistance);
    }

    private calcWarStage() {
        const squadsMy = this.playerInterface.getSquadsMy();
        const squadsEnemy = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);

        const dotsMyCount = squadsMy.reduce(
            (acc, squad) =>
                acc +
                squad.slots.reduce((acc, slot) => acc + (slot.dot ? 1 : 0), 0),
            0,
        );
        const dotsEnemyCount = squadsEnemy.reduce(
            (acc, squad) =>
                acc +
                squad.slots.reduce((acc, slot) => acc + (slot.dot ? 1 : 0), 0),
            0,
        );
        const dotsAdvantage = dotsMyCount - dotsEnemyCount;

        const dotsCountThreshold = 20;

        switch (this.warStage) {
            case WarStage.DefendBase:
                if (dotsAdvantage > dotsCountThreshold) {
                    return WarStage.DestroyEnemySquads;
                }

                return WarStage.DefendBase;
            case WarStage.DestroyEnemySquads:
                if (dotsAdvantage < 0) {
                    return WarStage.DefendBase;
                }

                if (this.enemySquadsAroundMyBase.length === 0) {
                    return WarStage.AttackEnemyBase;
                }

                return WarStage.DestroyEnemySquads;
            case WarStage.AttackEnemyBase:
                if (this.enemySquadsAroundMyBase.length > 0) {
                    return WarStage.DestroyEnemySquads;
                }

                return WarStage.AttackEnemyBase;
        }
    }

    attackTargets: Array<Squad | Building> = [];
    private calcAttackTargets(): typeof this.attackTargets {
        switch (this.warStage) {
            case WarStage.DefendBase:
                return this.enemySquadsAroundMyBase
                    .sort((a, b) => b.distance - a.distance)
                    .map((pair) => pair.squad);
            case WarStage.DestroyEnemySquads:
                return this.playerInterface
                    .getSquadsAll()
                    .filter((squad) => squad.team !== this.playerInterface.team);
            case WarStage.AttackEnemyBase:
                return [
                    ...this.playerInterface
                        .getSquadsAll()
                        .filter((squad) => squad.team !== this.playerInterface.team),
                    ...this.playerInterface
                        .getBuildingsAll()
                        .filter((building) => building.team !== this.playerInterface.team),
                ];
        }
    }

    private updateInfo() {
        this.enemySquadsAroundMyBase = this.calcSquadsAroundMyBase();
        this.attackTargets = this.calcAttackTargets();
        this.warStage = this.calcWarStage();
    }

    act() {
        this.updateInfo();
        this.createSquadIfNeeded();
        this.updateSquadsAssignments();
        this.controlSquads();
    }
}

class Economist {
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
    buildingsWanted: Record<BuildingKind, { priority: number }> = {
        farm: { priority: 0 },
        house: { priority: 0 },
        lumberMill: { priority: 0 },
        barracks: { priority: 0 },
        coinMiner: { priority: 0 },
        granary: { priority: 0 },
        hq: { priority: 0 },
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

    constructor(readonly playerInterface: PlayerInterface) {
        this.baseCenter = this.calcBaseCenter();
    }

    private calcBaseCenter() {
        const buildings = this.playerInterface.getBuildingsMy();

        for (const building of buildings) {
            if (building.kind === "hq") {
                return building.center;
            }
        }

        const mapSize = this.playerInterface.getMapSize();

        return { x: mapSize.width / 2, y: mapSize.height / 2 };
    }

    private calcBuildingsWanted(): typeof this.buildingsWanted {
        const buildingsWanted = {
            farm: {
                priority: 0,
            },
            house: {
                priority: 0,
            },
            lumberMill: {
                priority: 0,
            },
            barracks: {
                priority: 0,
            },
            coinMiner: {
                priority: 0,
            },
            granary: {
                priority: 0,
            },
            hq: {
                priority: 0,
            },
        };

        this.debugInfo.resourcesAtHorizon = this.resourcesAtHorizon;

        const resourcesNeededSorted = (
            Object.entries(this.resourcesAtHorizon) as Array<[Resource, number]>
        ).filter(([, countAtHorizon]) => countAtHorizon <= 0);

        if (resourcesNeededSorted.length > 0) {
            resourcesNeededSorted.sort((a, b) => b[1] - a[1]);

            for (const [index, [resource]] of resourcesNeededSorted.entries()) {
                switch (resource) {
                    case "food":
                        buildingsWanted.farm.priority = index + 1;
                        break;
                    case "wood":
                        buildingsWanted.lumberMill.priority = index + 1;
                        break;
                    case "coins":
                        buildingsWanted.coinMiner.priority = index + 1;
                        break;
                    case "housing":
                        buildingsWanted.house.priority = index + 1;
                        break;
                }
            }
        } else {
            buildingsWanted.barracks.priority = 1;
        }

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

        const teamResources = this.playerInterface.getTeamResourcesMy();
        for (const [resource, storage] of Object.entries(teamResources)) {
            if (resourcesAtHorizon[resource as Resource] === undefined) {
                continue;
            }

            resourcesAtHorizon[resource as Resource] += storage;
        }

        const buildingToBuildRaw = Object.entries(this.buildingsWanted).sort(
            (a, b) => b[1].priority - a[1].priority,
        )[0];
        const buildingToBuild = {
            kind: buildingToBuildRaw[0] as BuildingKind,
            count: buildingToBuildRaw[1].priority,
        };

        const buildingNeededConfig = BUILDINGS_CONFIGS[buildingToBuild.kind];

        const cost = this.playerInterface.getBuildingCost(
            buildingNeededConfig.kind,
        );

        resourcesAtHorizon.wood -= cost.wood;
        resourcesAtHorizon.coins -= cost.coins;

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
        const buildings = this.playerInterface.getBuildingsMy();

        const production: Record<Resource | "units", number> = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
            units: 0,
        };

        for (const building of buildings) {
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

        for (const building of this.playerInterface.getBuildingsMy()) {
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
            (a, b) => b[1].priority - a[1].priority,
        )[0][0] as BuildingKind;

        const canBuild = this.playerInterface.canBuild(buildingKind);

        if (!canBuild) {
            return;
        }

        this.playerInterface.tryBuild(buildingKind, {
            x: this.baseCenter.x + randomInteger(-100, 300),
            y: this.baseCenter.y + randomInteger(-100, 300),
        });
    }

    log() {
        console.log(
            "resources",
            mapValues(this.playerInterface.getTeamResourcesMy(), (v) =>
                Math.floor(v),
            ),
            "buildingsWanted",
            mapValues(this.buildingsWanted, (v) => v.priority),
            "expectedProductionPerSecond",
            mapValues(this.expectedProductionPerSecond, (v) => v.toFixed(1)),
            "expectedConsumptionPerSecond",
            mapValues(this.expectedConsumptionPerSecond, (v) => v.toFixed(1)),
            "resourcesAtHorizon",
            mapValues(this.debugInfo.resourcesAtHorizon, (v) => v.toFixed(1)),
            "\nbarracks online",
            Array.from(this.playerInterface.getBuildingsMy()).filter(
                (b) =>
                    b.kind === "barracks" &&
                    b.team === this.playerInterface.team &&
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
