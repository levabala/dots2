/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
// PlayerAI.ts

import { DOT_ATTACK_RANGE, DOT_COST_COINS, DOT_COST_FOOD } from "../consts";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import type { Resource } from "../Game/ResourcesController";
import { mapValues } from "remeda";
import {
    distanceBetween,
    getRectCenter,
    type Point,
    type Rect, // Import Rect type
} from "../shapes";
import type { Dot } from "../Game/DotsController";
import type { Squad } from "../Game/SquadsController";
import type { PlayerInterface } from "./PlayerInterface";

// Ensure PlayerUtils is properly implemented
class PlayerUtils {
    static isBuilding(target: Squad | Building): target is Building {
        return (target as Building).kind !== undefined;
    }

    static getSquadFrameAtPosition(squad: Squad, position: Point): Rect {
        // Implement a method to get the squad's frame at a given position
        const width =
            Math.abs(squad.frameTarget.p2.x - squad.frameTarget.p1.x) || 50;
        const height =
            Math.abs(squad.frameTarget.p3.y - squad.frameTarget.p2.y) || 50;

        return {
            p1: { x: position.x - width / 2, y: position.y - height / 2 },
            p2: { x: position.x + width / 2, y: position.y - height / 2 },
            p3: { x: position.x + width / 2, y: position.y + height / 2 },
            p4: { x: position.x - width / 2, y: position.y + height / 2 },
        };
    }

    static getNewSquadFrameInFrontOf(
        squad: Squad,
        targetPosition: Point,
        distance: number,
    ): Rect {
        // Calculate a new frame for the squad at a certain distance in front of the target
        const squadCenter = getRectCenter(squad.frameActual);
        const angle = Math.atan2(
            targetPosition.y - squadCenter.y,
            targetPosition.x - squadCenter.x,
        );

        const newCenter = {
            x: targetPosition.x - Math.cos(angle) * distance,
            y: targetPosition.y - Math.sin(angle) * distance,
        };

        return this.getSquadFrameAtPosition(squad, newCenter);
    }
}

const PLANNING_HORIZON_SECONDS = 10;
const MY_SQUAD_MIN_SIZE = 30;
const MAX_SQUAD_SIZE = 50;
const SQUAD_SPACING = 100;

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
    baseCenter: Point;
    warStage: WarStage = WarStage.DefendBase;
    formations: Formation[] = [];
    attackTargets: Target[] = [];
    enemySquadsAroundMyBase: Array<{ squad: Squad; distance: number }> = [];
    baseCloseProximityDistance = DOT_ATTACK_RANGE * 3;

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

    act() {
        this.updateInfo();
        this.createSquadsIfNeeded();
        this.reinforceSquadsIfNeeded();
        this.updateFormations();
        this.controlFormations();
    }

    private getDotsWithoutSquad() {
        return this.playerInterface.getDotsMy().filter((dot) => !dot.squad);
    }

    private createSquad(dots: Dot[]) {
        const center = this.baseCenter;
        const result = this.playerInterface.createSquad(dots, center);
        if (result.isSuccess) {
            this.playerInterface.moveSquadToRect(result.squad, result.squad.frameTarget);
        }
    }

    private createSquadsIfNeeded() {
        const dots = this.getDotsWithoutSquad();
        while (dots.length >= MY_SQUAD_MIN_SIZE) {
            const squadDots = dots.splice(0, MAX_SQUAD_SIZE);
            this.createSquad(squadDots);
        }
    }

    private reinforceSquadsIfNeeded() {
        const squads = this.playerInterface.getSquadsMy();
        for (const squad of squads) {
            const currentSize = squad.slots.filter((slot) => slot.dot).length;
            if (currentSize <= MAX_SQUAD_SIZE * 0.2) {
                this.playerInterface.removeSquad(squad);
                const dotsAvailable = this.getDotsWithoutSquad();
                const dotsNeeded = MAX_SQUAD_SIZE - currentSize;
                const dotsToAdd = dotsAvailable.splice(0, dotsNeeded);
                const newDots = squad.slots
                    .filter((slot) => slot.dot)
                    .map((slot) => slot.dot!)
                    .concat(dotsToAdd);
                if (newDots.length >= MY_SQUAD_MIN_SIZE) {
                    this.createSquad(newDots);
                }
            }
        }
    }

    private updateFormations() {
        const squadsMy = this.playerInterface.getSquadsMy();
        const squadsPerFormation = 3;
        this.formations = [];

        for (let i = 0; i < squadsMy.length; i += squadsPerFormation) {
            const formationSquads = squadsMy.slice(i, i + squadsPerFormation);
            const formation = new Formation(formationSquads);
            this.formations.push(formation);
        }

        const targets = this.attackTargets.slice();
        for (const formation of this.formations) {
            if (!formation.target || !targets.includes(formation.target)) {
                formation.target = targets.shift() || null;
            }
        }
    }

    private controlFormations() {
        for (const formation of this.formations) {
            if (formation.target) {
                this.controlFormation(formation);
            }
        }
    }

    private controlFormation(formation: Formation) {
        const target = formation.target!;
        const targetPosition = PlayerUtils.isBuilding(target)
            ? target.center
            : getRectCenter(target.frameActual);

        const formationCenter = formation.getCenter();
        const distanceToTarget = distanceBetween(formationCenter, targetPosition);

        const safeDistance = DOT_ATTACK_RANGE * 0.9;

        if (distanceToTarget <= safeDistance) {
            formation.holdPosition(this.playerInterface);

            if (PlayerUtils.isBuilding(target)) {
                for (const squad of formation.squads) {
                    this.playerInterface.orderAttackOnlyBuilding({
                        squadAttacker: squad,
                        buildingTarget: target,
                    });
                }
            }
        } else {
            const directionToTarget = Math.atan2(
                targetPosition.y - formationCenter.y,
                targetPosition.x - formationCenter.x,
            );

            const formationPosition = {
                x: targetPosition.x - Math.cos(directionToTarget) * safeDistance,
                y: targetPosition.y - Math.sin(directionToTarget) * safeDistance,
            };

            formation.arrangeInLine(formationPosition, directionToTarget, SQUAD_SPACING);
            formation.moveToPositions(this.playerInterface);
        }
    }

    private calcEnemySquadsThreateningBuildings(): Squad[] {
        const myBuildings = this.playerInterface.getBuildingsMy();
        const enemySquads = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);

        const enemySquadsThreatening: Set<Squad> = new Set();

        for (const building of myBuildings) {
            for (const enemySquad of enemySquads) {
                const distance = distanceBetween(
                    building.center,
                    getRectCenter(enemySquad.frameActual),
                );
                if (distance <= DOT_ATTACK_RANGE * 3) {
                    enemySquadsThreatening.add(enemySquad);
                }
            }
        }

        return Array.from(enemySquadsThreatening);
    }

    private calcSquadsAroundMyBase() {
        const enemySquads = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);

        return enemySquads
            .map((squad) => ({
                squad,
                distance: distanceBetween(
                    getRectCenter(squad.frameActual),
                    this.baseCenter,
                ),
            }))
            .filter((pair) => pair.distance <= this.baseCloseProximityDistance);
    }

    private calcWarStage() {
        const myDotsCount = this.playerInterface
            .getSquadsMy()
            .reduce(
                (acc, squad) => acc + squad.slots.filter((slot) => slot.dot).length,
                0,
            );
        const enemyDotsCount = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team)
            .reduce(
                (acc, squad) => acc + squad.slots.filter((slot) => slot.dot).length,
                0,
            );

        const dotsAdvantage = myDotsCount - enemyDotsCount;
        const threshold = 30;

        if (this.enemySquadsAroundMyBase.length > 0) {
            return WarStage.DefendBase;
        } else if (dotsAdvantage > threshold) {
            return WarStage.AttackEnemyBase;
        } else {
            return WarStage.DestroyEnemySquads;
        }
    }

    private calcAttackTargets(): Target[] {
        const enemySquads = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);
        const enemyBuildings = this.playerInterface
            .getBuildingsAll()
            .filter((building) => building.team !== this.playerInterface.team);

        switch (this.warStage) {
            case WarStage.DefendBase:
                const enemySquadsThreateningBuildings = this.calcEnemySquadsThreateningBuildings();
                if (enemySquadsThreateningBuildings.length > 0) {
                    return enemySquadsThreateningBuildings;
                }
                return this.enemySquadsAroundMyBase.map((pair) => pair.squad);
            case WarStage.DestroyEnemySquads:
                return enemySquads;
            case WarStage.AttackEnemyBase:
                const enemyHQs = enemyBuildings.filter(
                    (building) => building.kind === "hq",
                );
                if (enemyHQs.length > 0) {
                    return enemyHQs;
                }
                if (enemyBuildings.length > 0) {
                    return enemyBuildings;
                }
                return enemySquads;
        }
    }

    private updateInfo() {
        this.baseCenter = this.calcBaseCenter();
        this.enemySquadsAroundMyBase = this.calcSquadsAroundMyBase();
        this.warStage = this.calcWarStage();
        this.attackTargets = this.calcAttackTargets();
    }
}

class Formation {
    squads: Squad[];
    target: Target | null = null;
    formationPositions: Point[] = [];

    constructor(squads: Squad[]) {
        this.squads = squads;
    }

    getCenter(): Point {
        const centers = this.squads.map((squad) => getRectCenter(squad.frameActual));
        const avgX = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
        const avgY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
        return { x: avgX, y: avgY };
    }

    arrangeInLine(position: Point, direction: number, spacing: number) {
        const numSquads = this.squads.length;
        const halfWidth = ((numSquads - 1) * spacing) / 2;

        for (let i = 0; i < numSquads; i++) {
            const offset = i * spacing - halfWidth;
            const offsetX = offset * Math.cos(direction + Math.PI / 2);
            const offsetY = offset * Math.sin(direction + Math.PI / 2);

            this.formationPositions[i] = {
                x: position.x + offsetX,
                y: position.y + offsetY,
            };
        }
    }

    moveToPositions(playerInterface: PlayerInterface) {
        for (let i = 0; i < this.squads.length; i++) {
            const squad = this.squads[i];
            const position = this.formationPositions[i];
            const frame = PlayerUtils.getSquadFrameAtPosition(squad, position);

            // Only move if the position has changed significantly
            const currentCenter = getRectCenter(squad.frameTarget);
            const distance = distanceBetween(currentCenter, position);
            if (distance > 20) {
                playerInterface.moveSquadToRect(squad, frame);
            }
        }
    }

    holdPosition(playerInterface: PlayerInterface) {
        // Do not issue any move commands to allow squads to shoot
        // Avoid moving squads to prevent shrinking or imploding
    }
}

class Economist {
    resourcesProductionBalance: Record<Resource, number> = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
    };
    expectedProductionPerSecond: Record<
        Resource | "units" | "housingCapacity",
        number
    > = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
        units: 0,
        housingCapacity: 0,
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
        hq: { priority: 0 },
        granary: { priority: 0 },
    };
    resourcesAtHorizon: Record<Resource, number> = {
        food: 0,
        wood: 0,
        coins: 0,
        housing: 0,
    };
    unitsWanted: number = 0;
    baseCenter: Point;

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

    private calcPotentialDanger(): number {
        const enemySquads = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);

        const enemyDotsCount = enemySquads.reduce(
            (acc, squad) => acc + squad.slots.filter((slot) => slot.dot).length,
            0,
        );

        const enemyProximity = enemySquads.reduce((acc, squad) => {
            const squadCenter = getRectCenter(squad.frameActual);
            const distance = distanceBetween(squadCenter, this.baseCenter);
            return acc + (distance < DOT_ATTACK_RANGE * 10 ? 1 : 0);
        }, 0);

        return enemyDotsCount + enemyProximity * 10;
    }

    private calcBuildingsWanted(): typeof this.buildingsWanted {
        const buildingsWanted = {
            farm: { priority: 0 },
            house: { priority: 0 },
            lumberMill: { priority: 0 },
            barracks: { priority: 0 },
            coinMiner: { priority: 0 },
            hq: { priority: 0 },
            granary: { priority: 0 },
        };

        const teamResources = this.playerInterface.getTeamResourcesMy();

        // Determine which resources are capped
        const cappedResources: Resource[] = [];

        for (const resource of ["food", "wood", "coins"] as Resource[]) {
            const capacityKey = (resource + "Capacity") as keyof typeof teamResources;
            const capacity = teamResources[capacityKey] || Infinity;
            const storage = teamResources[resource] || 0;

            if (storage >= capacity * 0.9) {
                cappedResources.push(resource as Resource);
            }
        }

        // Adjust building priorities based on capped resources
        for (const resource of cappedResources) {
            switch (resource) {
                case "wood":
                    buildingsWanted.lumberMill.priority = Math.max(
                        buildingsWanted.lumberMill.priority,
                        5,
                    );
                    break;
                case "coins":
                    // No building increases coin capacity currently
                    break;
            }
        }

        // Determine resources needed
        const resourcesNeededSorted = (
            Object.entries(this.resourcesAtHorizon) as Array<[Resource, number]>
        ).filter(([resource, countAtHorizon]) => countAtHorizon <= 0);

        if (resourcesNeededSorted.length > 0) {
            resourcesNeededSorted.sort((a, b) => a[1] - b[1]); // Sort from most negative to less

            let priority = resourcesNeededSorted.length + 1;
            for (const [resource] of resourcesNeededSorted) {
                priority--;
                switch (resource) {
                    case "food":
                        if (!cappedResources.includes("food")) {
                            buildingsWanted.farm.priority = Math.max(
                                buildingsWanted.farm.priority,
                                priority,
                            );
                        }
                        break;
                    case "wood":
                        if (!cappedResources.includes("wood")) {
                            buildingsWanted.lumberMill.priority = Math.max(
                                buildingsWanted.lumberMill.priority,
                                priority,
                            );
                        }
                        break;
                    case "coins":
                        if (!cappedResources.includes("coins")) {
                            buildingsWanted.coinMiner.priority = Math.max(
                                buildingsWanted.coinMiner.priority,
                                priority,
                            );
                        }
                        break;
                    case "housing":
                        buildingsWanted.house.priority = Math.max(
                            buildingsWanted.house.priority,
                            priority,
                        );
                        break;
                }
            }
        }

        // Scale unit production by scaling barracks count
        const barracksCount = this.playerInterface
            .getBuildingsMy()
            .filter((b) => b.kind === "barracks").length;

        const desiredBarracksCount = Math.ceil(this.unitsWanted / 50);

        if (barracksCount < desiredBarracksCount) {
            buildingsWanted.barracks.priority = Math.max(
                buildingsWanted.barracks.priority,
                (resourcesNeededSorted.length || 0) + 2,
            );
        }

        return buildingsWanted;
    }

    private build() {
        // Prioritize buildings with higher priority
        const buildingsToBuild = Object.entries(this.buildingsWanted)
            .filter(([, { priority }]) => priority > 0)
            .sort(([, a], [, b]) => b.priority - a.priority);

        // If no buildings are wanted, but resources are capped, build any building we can afford that consumes the capped resource
        if (buildingsToBuild.length === 0) {
            const teamResources = this.playerInterface.getTeamResourcesMy();

            for (const resource of ["food", "wood", "coins"] as Resource[]) {
                const capacityKey = (resource + "Capacity") as keyof typeof teamResources;
                const capacity = teamResources[capacityKey] || Infinity;
                const storage = teamResources[resource] || 0;

                if (storage >= capacity * 0.9) {
                    // Find buildings that cost this resource
                    const possibleBuildings: BuildingKind[] = [
                        "barracks",
                        "house",
                        "farm",
                        "lumberMill",
                        "coinMiner",
                    ];

                    for (const buildingKind of possibleBuildings) {
                        const kind = buildingKind as BuildingKind;

                        if (!this.playerInterface.canBuild(kind)) {
                            continue;
                        }

                        const cost = this.playerInterface.getBuildingCost(kind);

                        if ((cost as any)[resource] > 0) {
                            const position = this.findBuildPosition(kind);
                            if (this.playerInterface.tryBuild(kind, position)) {
                                return; // Built a building, exit the method
                            }
                        }
                    }
                }
            }
        } else {
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
    }

    private findBuildPosition(kind: BuildingKind): Point {
        // Place buildings without blocking units' line of sight
        const angleStep = (Math.PI * 2) / 16;
        for (let i = 0; i < 16; i++) {
            const angle = i * angleStep;
            const offset = 200 + Math.random() * 100;
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
            x: this.baseCenter.x + 250 * Math.cos(Math.random() * 2 * Math.PI),
            y: this.baseCenter.y + 250 * Math.sin(Math.random() * 2 * Math.PI),
        };
    }

    private isPositionValidForBuilding(position: Point): boolean {
        // Ensure the building does not block units' line of sight
        const squads = this.playerInterface.getSquadsMy();
        for (const squad of squads) {
            const squadCenter = getRectCenter(squad.frameActual);
            if (
                distanceBetween(squadCenter, position) < DOT_ATTACK_RANGE &&
                this.isBuildingBlockingLineOfSight(squadCenter, position)
            ) {
                return false;
            }
        }
        return true;
    }

    private isBuildingBlockingLineOfSight(from: Point, to: Point): boolean {
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

    private calcResourcesAtHorizon() {
        const resourcesAtHorizon: Record<Resource, number> = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
        };

        const teamResources = this.playerInterface.getTeamResourcesMy();

        // For resources with capacity (food, wood, coins)
        for (const resource of ["food", "wood", "coins"] as Resource[]) {
            const productionPerSecond = this.resourcesProductionBalance[resource];
            const storage = teamResources[resource] || 0;
            const capacity = teamResources[
                (resource + "Capacity") as keyof typeof teamResources
            ] || Infinity;

            // Compute net amount at horizon
            let amountAtHorizon =
                storage + productionPerSecond * PLANNING_HORIZON_SECONDS;

            // Adjust for capacity
            amountAtHorizon = Math.min(amountAtHorizon, capacity);

            // Store in resourcesAtHorizon
            resourcesAtHorizon[resource] = amountAtHorizon;
        }

        // For housing, compute capacity vs. demand
        const totalHousingCapacity = this.expectedProductionPerSecond.housingCapacity;
        const totalUnits = this.playerInterface.getDotsMy().length;
        const unitsExpectedToBeProducedOverHorizon =
            this.expectedProductionPerSecond.units * PLANNING_HORIZON_SECONDS;

        resourcesAtHorizon.housing =
            totalHousingCapacity - (totalUnits + unitsExpectedToBeProducedOverHorizon);

        // Subtract planned building costs
        const buildingToBuildRaw = Object.entries(this.buildingsWanted).sort(
            (a, b) => b[1].priority - a[1].priority,
        )[0];
        if (buildingToBuildRaw) {
            const buildingToBuild = {
                kind: buildingToBuildRaw[0] as BuildingKind,
                count: buildingToBuildRaw[1].priority,
            };

            if (buildingToBuild.count > 0) {
                const buildingNeededConfig =
                    BUILDINGS_CONFIGS[buildingToBuild.kind];

                const cost = this.playerInterface.getBuildingCost(
                    buildingNeededConfig.kind,
                );

                resourcesAtHorizon.wood -= cost.wood || 0;
                resourcesAtHorizon.coins -= cost.coins || 0;
            }
        }

        return resourcesAtHorizon;
    }

    private calcUnitsWanted(): number {
        const enemySquads = this.playerInterface
            .getSquadsAll()
            .filter((squad) => squad.team !== this.playerInterface.team);

        const enemyDotsCount = enemySquads.reduce(
            (acc, squad) => acc + squad.slots.filter((slot) => slot.dot).length,
            0,
        );

        return Math.max(enemyDotsCount * 2, 100);
    }

    private calcExpectedProduction(): Record<
        Resource | "units" | "housingCapacity",
        number
    > {
        const buildings = this.playerInterface.getBuildingsMy();

        const production: Record<
            Resource | "units" | "housingCapacity",
            number
        > = {
            food: 0,
            wood: 0,
            coins: 0,
            housing: 0,
            units: 0,
            housingCapacity: 0,
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
                    } else {
                        production.units += 0.5 / (building.spawnDuration / 1000); // Produce units at half rate when not allowed
                    }
                    break;
                case "coinMiner":
                    production.coins += building.coinsPerSecond;
                    break;
                case "hq":
                    production.coins += building.coinsPerSecond;
                    production.housingCapacity += building.unitsCapacity;
                    break;
                case "house":
                    production.housingCapacity += building.unitsCapacity;
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

        const totalUnits = this.playerInterface.getDotsMy().length;
        const unitsExpectedToBeProducedOverHorizon =
            unitsPerSecond * PLANNING_HORIZON_SECONDS;

        consumption.housing =
            totalUnits + unitsExpectedToBeProducedOverHorizon;

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

        for (const resource of ["food", "wood", "coins"] as Resource[]) {
            resourcesProductionBalance[resource] =
                (production[resource] || 0) - (consumption[resource] || 0);
        }

        // For housing, calculate capacity minus demand
        resourcesProductionBalance.housing =
            (production.housingCapacity || 0) - (consumption.housing || 0);

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
        const isInHousingDeficit = this.resourcesAtHorizon.housing < 0;

        const potentialDanger = this.calcPotentialDanger();

        for (const building of this.playerInterface.getBuildingsMy()) {
            if (building.kind === "barracks") {
                if (isInCoinsDeficit || isInFoodDeficit || isInHousingDeficit) {
                    if (potentialDanger > 50) {
                        // Continue producing units due to high danger
                        building.allowSpawning = true;
                    } else {
                        // Reduce unit production but don't stop completely
                        building.allowSpawning = true;
                    }
                } else {
                    building.allowSpawning = true;
                }
            }
        }
    }

    act() {
        this.updateInfo();
        this.build();
        this.controlUnitProduction();
    }
}
