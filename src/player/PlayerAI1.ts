import {
    DOT_ATTACK_RANGE,
    DOT_COST_COINS,
    DOT_COST_FOOD,
    DOT_HEIGHT,
    DOT_IN_SQUAD_RADIUS_AROUND,
} from "../consts";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import type { Resource } from "../Game/ResourcesController";
import type { Team } from "../Game/TeamController";
import { mapValues, randomInteger } from "remeda";
import {
    angleBetweenPoints,
    distanceBetween,
    getIntersectionFirstRect,
    getRectCenter,
    getVectorEndPoint,
    orthogonalRect,
    rotateRect,
    translateRect,
    type Point,
} from "../utils";
import type { Dot } from "../Game/DotsController";
import type { Squad } from "../Game/SquadsController";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";

const PLANNING_HORIZON_SECONDS = 10;
const MY_SQUAD_MIN_SIZE = 30;
const DANGER_HQ_PROXIMITY = 800;
const REPEL_DISTANCE = DOT_ATTACK_RANGE - 10;

export class PlayerAI {
    economist: Economist;
    warlord: Warlord;

    actIntervalBetween: number = 100;

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        this.economist = new Economist(game, team);
        this.warlord = new Warlord(game, team);
    }

    startAI() {
        setInterval(() => {
            this.act();
        }, this.actIntervalBetween);

        setInterval(() => {
            this.economist.log();
        }, 1000);
    }

    private act() {
        this.economist.act();
        this.warlord.act();
    }
}

class Warlord {
    squadEnemyToSquadMy = new Map<Squad, Squad>();
    squadsToRepel: Squad[] = [];
    baseCenter: Point;

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

    private calcRallyPoint() {
        return this.baseCenter;
    }

    private getDotsWithoutSquad() {
        const dots = this.game.getDots();
        const dotsWithoutSquad = [];

        for (const dot of dots) {
            if (dot.team !== this.team) {
                continue;
            }

            if (dot.squad) {
                continue;
            }

            dotsWithoutSquad.push(dot);
        }

        return dotsWithoutSquad;
    }

    private createSquad(dots: Dot[]) {
        const center = this.calcRallyPoint();

        this.game.createSquad(dots, this.team, center);
    }

    private createSquadIfNeeded() {
        const dots = this.getDotsWithoutSquad();

        if (dots.length < MY_SQUAD_MIN_SIZE) {
            return;
        }

        this.createSquad(dots);
    }

    private getSquadsDangerousToHQ() {
        const squads = this.game.getSquads();
        const squadsDangerousToHQ = [];

        for (const squad of squads) {
            if (squad.team === this.team) {
                continue;
            }

            const squadCenter = getRectCenter(squad.frame);

            const distance = distanceBetween(squadCenter, this.baseCenter);

            if (distance > DANGER_HQ_PROXIMITY) {
                continue;
            }

            squadsDangerousToHQ.push(squad);
        }

        return squadsDangerousToHQ;
    }

    private calcSquadsToRepel() {
        const squadsDangerousToHQ = this.getSquadsDangerousToHQ();

        return squadsDangerousToHQ;
    }

    private calcAvaiableSquads() {
        const squads = this.game.getSquads();
        const squadsAvailable = [];

        for (const squad of squads) {
            if (squad.team !== this.team) {
                continue;
            }

            squadsAvailable.push(squad);
        }

        return squadsAvailable;
    }

    private placeSquadInFrontOfSquad(
        squadMy: Squad,
        squadEnemy: Squad,
        distance: number,
    ) {
        const enemyFrontlineCenter = getIntersectionFirstRect(
            { p1: this.baseCenter, p2: getRectCenter(squadEnemy.frame) },
            squadEnemy.frame,
        );

        if (!enemyFrontlineCenter) {
            window.panic("can't find an intersection", {
                squadMy,
                squadEnemy,
            });
        }

        const angleToEnemyFromBase = angleBetweenPoints(
            this.baseCenter,
            enemyFrontlineCenter,
        );

        const distanceToEnemyFromBase = distanceBetween(
            this.baseCenter,
            enemyFrontlineCenter,
        );

        const myFrontlineCenter = getVectorEndPoint(
            this.baseCenter,
            angleToEnemyFromBase,
            distanceToEnemyFromBase - distance,
        );

        const rowHeight = DOT_HEIGHT + DOT_IN_SQUAD_RADIUS_AROUND;
        const sideLength = rowHeight * 3;

        const frontLength = SquadFrameUtils.calcSquadFrontLength(
            squadMy.slots.length,
            sideLength,
        );

        const frameOrthZero = orthogonalRect(
            { x: -frontLength / 2, y: 0 },
            { x: frontLength / 2, y: sideLength },
        );

        const frameZero = rotateRect({
            rect: frameOrthZero,
            anchor: { x: 0, y: 0 },
            angle: angleToEnemyFromBase + Math.PI / 2,
        });

        const frame = translateRect(
            frameZero,
            myFrontlineCenter.x,
            myFrontlineCenter.y,
        );

        this.game.moveSquadTo([squadMy], frame);
    }

    private assignSquadToRepel(squadMy: Squad, squadToRepel: Squad) {
        this.placeSquadInFrontOfSquad(squadMy, squadToRepel, REPEL_DISTANCE);
    }

    private assignSquads() {
        for (const [squadToRepel, squadMy] of this.squadEnemyToSquadMy) {
            if (
                !this.game.getSquads().includes(squadMy) ||
                !this.game.getSquads().includes(squadToRepel)
            ) {
                this.squadEnemyToSquadMy.delete(squadToRepel);
            }
        }

        const squadsAvailable = this.calcAvaiableSquads();

        for (const squadToRepel of this.squadsToRepel) {
            if (!squadsAvailable.length) {
                return;
            }

            const squadAssigned = this.squadEnemyToSquadMy.get(squadToRepel);

            if (squadAssigned) {
                this.assignSquadToRepel(squadAssigned, squadToRepel);
                squadsAvailable.splice(
                    squadsAvailable.indexOf(squadAssigned),
                    1,
                );
                continue;
            }

            let squadMyTheClosest: Squad | null = null;
            let distance = Infinity;
            let index = -1;
            for (const [i, squadMy] of squadsAvailable.entries()) {
                const distanceToEnemy = distanceBetween(
                    getRectCenter(squadMy.frame),
                    getRectCenter(squadToRepel.frame),
                );

                if (distanceToEnemy < distance) {
                    squadMyTheClosest = squadMy;
                    distance = distanceToEnemy;
                    index = i;
                }
            }

            const squadMy = squadsAvailable.splice(index, 1)[0];

            this.assignSquadToRepel(squadMy, squadToRepel);
            this.squadEnemyToSquadMy.set(squadToRepel, squadMy);
        }
    }

    private updateInfo() {
        this.squadsToRepel = this.calcSquadsToRepel();
    }

    act() {
        this.updateInfo();
        this.createSquadIfNeeded();
        this.assignSquads();
    }
}

const ResourceToBuildingToBeProductedBy: Record<Resource, BuildingKind> = {
    food: "farm",
    wood: "lumberMill",
    coins: "coinMiner",
    housing: "house",
};

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

        const cost = this.game.getBuildingCost(buildingNeededConfig.kind, this.team);

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
            buildingKind,
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
