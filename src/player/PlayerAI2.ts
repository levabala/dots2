import {
    DOT_ATTACK_RANGE,
    DOT_COST_COINS,
    DOT_COST_FOOD,
    DOT_HEIGHT,
    DOT_IN_SQUAD_RADIUS_AROUND,
} from "../consts";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import type { Resource } from "../Game/ResourcesController";
import type { Team } from "../Game/TeamController";
import { mapValues, randomInteger } from "remeda";
import {
    angleBetweenPoints,
    createMultiPolygon,
    distanceBetween,
    getFacingSidesOfConvexPolygon,
    getRectCenter,
    getVectorEndPoint,
    groupByOverlapping,
    hasIntersectionPolygons,
    orthogonalRect,
    rectToPolygon,
    resizeRectByChange,
    rotateRect,
    translateRect,
    type Point,
    type Polygon,
} from "../shapes";
import type { Dot } from "../Game/DotsController";
import type { Squad } from "../Game/SquadsController";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";
import { RendererUtils } from "../RendererUtils";
import type { PlayerInterface } from "./PlayerInterface";

const PLANNING_HORIZON_SECONDS = 10;
const MY_SQUAD_MIN_SIZE = 30;
const DANGER_HQ_PROXIMITY = 800;

export class PlayerAI2 {
    economist: Economist;
    warlord: Warlord;

    actIntervalBetween: number = 100;

    constructor(
        readonly playerInterface: PlayerInterface,
        readonly team: Team,
    ) {
        this.economist = new Economist(playerInterface, team);
        this.warlord = new Warlord(playerInterface, team);
    }

    startAI() {
        setInterval(() => {
            this.act();
        }, this.actIntervalBetween);

        // setInterval(() => {
        //     this.economist.log();
        // }, 1000);
    }

    drawDebugFigures(ctx: CanvasRenderingContext2D) {
        this.warlord.drawDebugFigures(ctx);
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

type SquadGroupWithFrontLine = SquadGroup & {
    frontLine: Point[];
    squadsMy: Squad[];
};

class Warlord {
    squadsToRepel: Squad[] = [];
    baseCenter: Point;
    enemySquadGroups: SquadGroup[] = [];
    enemySquadGroupsToAttack: SquadGroup[] = [];
    enemySquadGroupsAssignments: SquadGroupWithFrontLine[] = [];

    constructor(
        readonly playerInterface: PlayerInterface,
        readonly team: Team,
    ) {
        this.baseCenter = this.calcBaseCenter();
    }

    private calcBaseCenter() {
        const buildings = this.playerInterface.getBuildings();

        for (const building of buildings) {
            if (building.team !== this.team) {
                continue;
            }

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
        const dots = this.playerInterface.getDots();
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

    private isSquadDangerousToHQ(squad: Squad) {
        const squadCenter = getRectCenter(squad.frame);

        const distance = distanceBetween(squadCenter, this.baseCenter);

        return distance <= DANGER_HQ_PROXIMITY;
    }

    private getSquadsDangerousToHQ() {
        const squads = this.playerInterface.getSquads();
        const squadsDangerousToHQ = [];

        for (const squad of squads) {
            if (!this.isSquadDangerousToHQ(squad)) {
                continue;
            }

            squadsDangerousToHQ.push(squad);
        }

        return squadsDangerousToHQ;
    }

    private calcSquadGroupsDangerousToHQ() {
        const squadGroups = [];

        for (const squadGroup of this.enemySquadGroups) {
            const isDangerousToHQ = squadGroup.squads.some((squad) =>
                this.isSquadDangerousToHQ(squad),
            );

            if (!isDangerousToHQ) {
                continue;
            }

            squadGroups.push(squadGroup);
        }

        return squadGroups;
    }

    private calcSquadsToRepel() {
        const squadsDangerousToHQ = this.getSquadsDangerousToHQ();

        return squadsDangerousToHQ;
    }

    private calcAvailableSquads() {
        const squads = this.playerInterface.getSquads();
        const squadsAvailable = [];

        for (const squad of squads) {
            if (squad.team !== this.team) {
                continue;
            }

            squadsAvailable.push(squad);
        }

        return squadsAvailable;
    }

    private getSquadNewFrame(
        squad: Squad,
        angle: number,
        frontLineCenter: Point,
    ) {
        const rowHeight = DOT_HEIGHT + DOT_IN_SQUAD_RADIUS_AROUND;
        const sideLength = rowHeight * 3;

        const frontLength = SquadFrameUtils.calcSquadFrontLength(
            squad.slots.length,
            sideLength,
        );

        const frameOrthZero = orthogonalRect(
            { x: -frontLength / 2, y: 0 },
            { x: frontLength / 2, y: sideLength },
        );

        const frameZero = rotateRect({
            rect: frameOrthZero,
            anchor: { x: 0, y: 0 },
            angle: angle + Math.PI / 2,
        });

        const frame = translateRect(
            frameZero,
            frontLineCenter.x,
            frontLineCenter.y,
        );

        return frame;
    }

    // private calcSquadGroupsAssignments(): SquadGroupWithFrontLine[] {

    // }

    debugFrontLines: Point[][] = [];
    private assignSquads() {
        const squadsAvailable = this.calcAvailableSquads();

        this.debugFrontLines = [];
        for (const squadGroupToAttack of this.enemySquadGroupsToAttack) {
            if (!squadsAvailable.length) {
                return;
            }

            const frontLine = this.calcAttackFrontline(
                this.baseCenter,
                squadGroupToAttack,
            );

            this.debugFrontLines.push(frontLine);

            global.assert(
                frontLine.length > 1,
                "front line must be a line at least",
                {
                    frontLine,
                },
            );

            const frontLineSegments = [];
            let frontLineLength = 0;
            for (let i = 1; i < frontLine.length; i++) {
                const pPrev = frontLine[i - 1];
                const pCurr = frontLine[i];

                frontLineSegments.push({
                    segment: { p1: pPrev, p2: pCurr },
                    distanceStart: frontLineLength,
                });
                frontLineLength += distanceBetween(pPrev, pCurr);
            }

            global.assert(
                frontLineSegments.length > 0,
                "front line segments must be positive",
                {
                    frontLineSegments,
                    frontLine,
                },
            );

            const squadsToAssignDesired = 3; // TODO: calc
            const squadsToAssign = Math.min(
                squadsToAssignDesired,
                squadsAvailable.length,
            );
            const lengthPerSquad = frontLineLength / squadsToAssign;

            const startGap = lengthPerSquad * 0.5;

            const squadsAssigned = squadsAvailable.splice(0, squadsToAssign);
            for (let i = 0; i < squadsToAssign; i++) {
                const squad = squadsAssigned.pop();

                if (!squad) {
                    global.panic("squad must be available");
                }

                const frontLineDistance = startGap + i * lengthPerSquad;

                const frontLineSegment = frontLineSegments.findLast(
                    (segment) => frontLineDistance >= segment.distanceStart,
                );

                if (!frontLineSegment) {
                    global.panic("front line segment must be found", {
                        frontLineSegments,
                        frontLineDistance,
                    });
                }

                const frontLineSegmentAngle = angleBetweenPoints(
                    frontLineSegment.segment.p1,
                    frontLineSegment.segment.p2,
                );
                const squadFrameAngleNew = frontLineSegmentAngle - Math.PI / 2;
                const frontLineCenterNew = getVectorEndPoint(
                    frontLineSegment.segment.p1,
                    frontLineSegmentAngle,
                    frontLineDistance - frontLineSegment.distanceStart,
                );
                const squadFrameNew = this.getSquadNewFrame(
                    squad,
                    squadFrameAngleNew,
                    frontLineCenterNew,
                );

                this.playerInterface.moveSquadToRect(squad, squadFrameNew);
            }
        }
    }

    private calcSquadAttackRangePolygon(
        squadEnemy: Squad,
        { rowsDeep }: { rowsDeep: number } = { rowsDeep: 0 },
    ): Polygon {
        const rowHeight = DOT_HEIGHT + DOT_IN_SQUAD_RADIUS_AROUND;
        const rowsHeight = rowHeight * rowsDeep;

        const attackRangeRect = resizeRectByChange(
            squadEnemy.frame,
            DOT_ATTACK_RANGE * 2 - rowsHeight,
            DOT_ATTACK_RANGE * 2 - rowsHeight,
        );

        return rectToPolygon(attackRangeRect);
    }

    private calcAttackFrontline(
        origin: Point,
        squadGroup: SquadGroup,
    ): Point[] {
        const multiPolygonForAttack = createMultiPolygon(
            squadGroup.squads.map((squad) =>
                this.calcSquadAttackRangePolygon(squad, { rowsDeep: 6 }),
            ),
        );

        global.assert(
            multiPolygonForAttack.length > 2,
            "multiPolygonForAttack must be more than 0",
            {
                multiPolygonForAttack,
            },
        );

        const facingPoints = getFacingSidesOfConvexPolygon(
            origin,
            multiPolygonForAttack,
        );

        if (facingPoints.length < 2) {
            return [...multiPolygonForAttack];
        }

        return facingPoints;
    }

    private calcEnemySquadGroups(): typeof this.enemySquadGroups {
        const teamToSquads = new Map<Team, Squad[]>();

        for (const squad of this.playerInterface.getSquads()) {
            if (squad.team === this.team) {
                continue;
            }

            let squadArr = teamToSquads.get(squad.team);

            if (!squadArr) {
                squadArr = [];
                teamToSquads.set(squad.team, squadArr);
            }

            squadArr.push(squad);
        }

        const squadGroups = [];
        for (const squads of teamToSquads.values()) {
            const squadsWithAttackRangePolygons = squads.map((squad) => ({
                squad,
                polygon: this.calcSquadAttackRangePolygon(squad),
            }));

            const squadsGroupedByAttackRangeOverlapping = groupByOverlapping(
                squadsWithAttackRangePolygons,
                (sp1, sp2) => hasIntersectionPolygons(sp1.polygon, sp2.polygon),
            );

            for (const squadsGrouped of squadsGroupedByAttackRangeOverlapping) {
                squadGroups.push({
                    squads: squadsGrouped.map((sp) => sp.squad),
                    polygon: createMultiPolygon(
                        squadsGrouped.map((sp) => sp.polygon),
                    ),
                });
            }
        }

        return squadGroups;
    }

    private updateInfo() {
        this.squadsToRepel = this.calcSquadsToRepel();
        this.enemySquadGroups = this.calcEnemySquadGroups();
        this.enemySquadGroupsToAttack = this.calcSquadGroupsDangerousToHQ();
        // this.enemySquadGroupsAssignments = this.calcSquadGroupsAssignments();
    }

    act() {
        this.updateInfo();
        this.createSquadIfNeeded();
        this.assignSquads();
    }

    drawDebugFigures(ctx: CanvasRenderingContext2D) {
        const drawSquadGroup = (_squads: Squad[], polygon: Polygon) => {
            ctx.strokeStyle = "gray";
            RendererUtils.drawPolygon(ctx, polygon);
            ctx.stroke();
        };

        const drawFrontLine = (points: Point[]) => {
            ctx.strokeStyle = "green";
            ctx.lineWidth = 4;

            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];

                ctx.setLineDash([8, 16]);
                RendererUtils.drawPolygon(ctx, [p1, p2]);
                ctx.stroke();
                ctx.setLineDash([]);

                RendererUtils.drawArrowHead(ctx, p1, p2, 10);
                ctx.stroke();
            }
        };

        for (const { squads, polygon } of this.enemySquadGroups) {
            drawSquadGroup(squads, polygon);
        }

        for (const frontLine of this.debugFrontLines) {
            drawFrontLine(frontLine);
        }
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

    constructor(
        readonly playerInterface: PlayerInterface,
        readonly team: Team,
    ) {
        this.baseCenter = this.calcBaseCenter();
    }

    private calcBaseCenter() {
        const buildings = this.playerInterface.getBuildings();

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

        const teamResources = this.playerInterface.getTeamResources();
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
        const buildings = this.playerInterface.getBuildings();

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

        for (const building of this.playerInterface.getBuildings()) {
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
            mapValues(this.playerInterface.getTeamResources(), (v) =>
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
            Array.from(this.playerInterface.getBuildings()).filter(
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
