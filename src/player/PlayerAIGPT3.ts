// PlayerAI.ts

import { DOT_ATTACK_RANGE, DOT_COST_COINS, DOT_COST_FOOD } from "../consts";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import type { Resource } from "../Game/ResourcesController";
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
import type { PlayerInterface } from "./PlayerInterface";
import { PlayerUtils } from "./PlayerUtils";

const PLANNING_HORIZON_SECONDS = 10;
const MY_SQUAD_MIN_SIZE = 30;

export class PlayerAI {
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
    }

    act() {
        this.economist.act();
        this.warlord.act();
    }
}

enum WarStage {
    DefendBase = "DefendBase",
    DestroyEnemySquads = "DestroyEnemySquads",
    AttackEnemyBase = "AttackEnemyBase",
}

type Target = Squad | Building;

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
            const targetPosition = PlayerUtils.isBuilding(target)
                ? target.center
                : getRectCenter(target.frame);

            const squadCenter = getRectCenter(squadMy.frame);
            const distanceToTarget = distanceBetween(squadCenter, targetPosition);

            if (distanceToTarget <= DOT_ATTACK_RANGE) {
                // Stop moving to allow dots to shoot
                this.playerInterface.moveSquadToRect(squadMy, squadMy.frame);

                if (PlayerUtils.isBuilding(target)) {
                    this.playerInterface.orderAttackOnlyBuilding({
                        squadAttacker: squadMy,
                        buildingTarget: target,
                    });
                } else {
                    this.playerInterface.orderAttackOnlySquad({
                        squadAttacker: squadMy,
                        squadTarget: target,
                    });
                }
            } else {
                // Move closer to the target
                const frame = PlayerUtils.getNewSquadFrameInFrontOf(
                    squadMy,
                    targetPosition,
                    DOT_ATTACK_RANGE * 0.7,
                );

                this.playerInterface.moveSquadToRect(squadMy, frame);
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
                        .filter(
                            (building) =>
                                building.team !== this.playerInterface.team &&
                                building.kind === "hq",
                        ),
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
            resourcesNeededSorted.sort((a, b) => a[1] - b[1]); // Sort from most negative to less

            let priority = resourcesNeededSorted.length + 1;
            for (const [resource] of resourcesNeededSorted) {
                priority--;
                switch (resource) {
                    case "food":
                        buildingsWanted.farm.priority = priority;
                        buildingsWanted.granary.priority = priority - 1;
                        break;
                    case "wood":
                        buildingsWanted.lumberMill.priority = priority;
                        break;
                    case "coins":
                        buildingsWanted.coinMiner.priority = priority;
                        break;
                    case "housing":
                        buildingsWanted.house.priority = priority;
                        break;
                }
            }
        }

        // Always ensure at least one barracks is built
        const barracksCount = this.playerInterface
            .getBuildingsMy()
            .filter((b) => b.kind === "barracks").length;

        if (barracksCount === 0) {
            buildingsWanted.barracks.priority = resourcesNeededSorted.length + 2;
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

        // Adjust for resource capacity
        for (const resource of ["food", "wood", "coins"] as Resource[]) {
            const capacityKey = (resource + "Capacity") as keyof typeof teamResources;
            resourcesAtHorizon[resource] = Math.min(
                resourcesAtHorizon[resource],
                teamResources[capacityKey] || Infinity,
            );
        }

        // Subtract planned building costs
        const buildingToBuildRaw = Object.entries(this.buildingsWanted).sort(
            (a, b) => b[1].priority - a[1].priority,
        )[0];
        const buildingToBuild = {
            kind: buildingToBuildRaw[0] as BuildingKind,
            count: buildingToBuildRaw[1].priority,
        };

        if (buildingToBuild.count > 0) {
            const buildingNeededConfig = BUILDINGS_CONFIGS[buildingToBuild.kind];

            const cost = this.playerInterface.getBuildingCost(
                buildingNeededConfig.kind,
            );

            resourcesAtHorizon.wood -= cost.wood;
            resourcesAtHorizon.coins -= cost.coins;
        }

        return resourcesAtHorizon;
    }

    private calcUnitsWanted(): number {
        const enemySquads = this.playerInterface.getSquadsAll().filter(
            (squad) => squad.team !== this.playerInterface.team,
        );

        const enemyDotsCount = enemySquads.reduce(
            (acc, squad) => acc + squad.slots.filter((slot) => slot.dot).length,
            0,
        );

        return Math.max(enemyDotsCount * 1.5, 50);
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
                    if (building.allowSpawning) {
                        production.units += 1 / (building.spawnDuration / 1000);
                    }
                    break;
                case "coinMiner":
                    production.coins += building.coinsPerSecond;
                    break;
                case "hq":
                    production.coins += building.coinsPerSecond;
                    break;
                case "house":
                    production.housing +=
                        building.unitsCapacity / PLANNING_HORIZON_SECONDS;
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
            if (resource !== "units") {
                resourcesProductionBalance[resource as Resource] += value;
            }
        }

        return resourcesProductionBalance;
    }

    private updateInfo() {
        this.baseCenter = this.calcBaseCenter();
        this.unitsWanted = this.calcUnitsWanted();
        this.expectedProductionPerSecond = this.calcExpectedProduction();
        this.expectedConsumptionPerSecond = this.calcExpectedConsumption();
        this.resourcesProductionBalance = this.calcResourcesProductionBalance();
        this.resourcesAtHorizon = this.calcResourcesAtHorizon();
        this.buildingsWanted = this.calcBuildingsWanted();
    }

    private controlUnitProduction() {
        const isInCoinsDeficit = this.resourcesAtHorizon.coins < 0;
        const isInFoodDeficit = this.resourcesAtHorizon.food < 0;

        for (const building of this.playerInterface.getBuildingsMy()) {
            if (building.kind === "barracks") {
                if (isInCoinsDeficit || isInFoodDeficit) {
                    if (building.allowSpawning) {
                        building.allowSpawning = false;
                    }
                } else {
                    if (!building.allowSpawning) {
                        building.allowSpawning = true;
                    }
                }
            }
        }
    }

    private build() {
        // Prioritize buildings with higher priority
        const buildingsToBuild = Object.entries(this.buildingsWanted)
            .filter(([, { priority }]) => priority > 0)
            .sort(([, a], [, b]) => b.priority - a.priority);

        for (const [buildingKind] of buildingsToBuild) {
            const kind = buildingKind as BuildingKind;

            if (!this.playerInterface.canBuild(kind)) {
                continue;
            }

            const position = this.findBuildPosition(kind);
            if (this.playerInterface.tryBuild(kind, position)) {
                break; // Build one building at a time
            }
        }
    }

    private findBuildPosition(kind: BuildingKind): Point {
        // Place buildings without blocking units' line of sight
        const angleStep = (Math.PI * 2) / 8;
        for (let i = 0; i < 8; i++) {
            const angle = i * angleStep;
            const offset = 150 + Math.random() * 100;
            const position = {
                x: this.baseCenter.x + offset * Math.cos(angle),
                y: this.baseCenter.y + offset * Math.sin(angle),
            };

            // Check if the position is valid (not blocking units)
            if (this.isPositionValidForBuilding(position)) {
                return position;
            }
        }

        // Default position if no valid position found
        return {
            x: this.baseCenter.x + 200 * Math.cos(Math.random() * 2 * Math.PI),
            y: this.baseCenter.y + 200 * Math.sin(Math.random() * 2 * Math.PI),
        };
    }

    private isPositionValidForBuilding(position: Point): boolean {
        // Ensure the building does not block units' line of sight
        const squads = this.playerInterface.getSquadsMy();
        for (const squad of squads) {
            const squadCenter = getRectCenter(squad.frame);
            if (
                distanceBetween(squadCenter, position) < DOT_ATTACK_RANGE &&
                this.isBuildingBlockingLineOfSight(squadCenter, position)
            ) {
                return false;
            }
        }
        return true;
    }

    private isBuildingBlockingLineOfSight(
        from: Point,
        to: Point,
    ): boolean {
        // Simplified check: buildings close to the line between from and to
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);
        const buildings = this.playerInterface.getBuildingsMy();

        for (const building of buildings) {
            const buildingCenter = building.center;
            const t =
                ((buildingCenter.x - from.x) * dx +
                    (buildingCenter.y - from.y) * dy) /
                (distance * distance);
            if (t < 0 || t > 1) continue;
            const closestPoint = {
                x: from.x + t * dx,
                y: from.y + t * dy,
            };
            const distToLine = distanceBetween(buildingCenter, closestPoint);
            if (distToLine < 50) {
                return true;
            }
        }

        return false;
    }

    act() {
        this.updateInfo();
        this.build();
        this.controlUnitProduction();
    }
}
