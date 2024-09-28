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
    createMultiPolygon,
    distanceBetween,
    getFacingSidesOfConvexPolygon,
    getIntersectionFirstRect,
    getRectCenter,
    getVectorEndPoint,
    groupByOverlapping,
    hasIntersectionPolygons,
    orthogonalRect,
    rectToPolygon,
    resizeRect,
    resizeRectByChange,
    rotateRect,
    translateRect,
    type Line,
    type Point,
    type Polygon,
    type Rect,
} from "../utils";
import type { Dot } from "../Game/DotsController";
import type { Squad } from "../Game/SquadsController";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";
import { RendererUtils } from "../RendererUtils";

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

        // setInterval(() => {
        //     this.economist.log();
        // }, 1000);
    }

    drawDebugFigures(ctx: CanvasRenderingContext2D) {
        this.warlord.drawDebugFigures(ctx);
    }

    private act() {
        this.economist.act();
        this.warlord.act();
    }
}

type SquadGroup = {
    squads: Squad[];
    polygon: Polygon;
};

class Warlord {
    squadsToRepel: Squad[] = [];
    baseCenter: Point;
    enemySquadGroups: SquadGroup[] = [];
    enemySquadGroupsToAttack: SquadGroup[] = [];

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

    private isSquadDangerousToHQ(squad: Squad) {
        const squadCenter = getRectCenter(squad.frame);

        const distance = distanceBetween(squadCenter, this.baseCenter);

        return distance <= DANGER_HQ_PROXIMITY;
    }

    private getSquadsDangerousToHQ() {
        const squads = this.game.getSquads();
        const squadsDangerousToHQ = [];

        for (const squad of squads) {
            if (squad.team === this.team) {
                continue;
            }

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

    private placeSquadAlongLine(
        squad: Squad,
        line: Line,
        distanceFromStart: number,
    ) {}

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

        const frame = this.getSquadNewFrame(
            squadMy,
            angleToEnemyFromBase,
            myFrontlineCenter,
        );

        this.game.moveSquadTo([squadMy], frame);
    }

    private assignSquadToRepel(squadMy: Squad, squadToRepel: Squad) {
        this.placeSquadInFrontOfSquad(squadMy, squadToRepel, REPEL_DISTANCE);
    }

    debugFrontLines: Point[][] = [];
    private assignSquads() {
        const squadsAvailable = this.calcAvaiableSquads();

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

            window.assert(
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

            window.assert(
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
                    window.panic("squad must be available");
                }

                const frontLineDistance = startGap + i * lengthPerSquad;

                const frontLineSegment = frontLineSegments.findLast(
                    (segment) => frontLineDistance >= segment.distanceStart,
                );

                if (!frontLineSegment) {
                    window.panic("front line segment must be found", {
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

                this.game.moveSquadTo([squad], squadFrameNew);
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

        window.assert(
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

    private calcSquadGroupForces(squadGroup: SquadGroup): {
        dotsCount: number;
    } {
        let dotsCount = 0;

        for (const squad of squadGroup.squads) {
            // TODO: replace with squad.dots
            dotsCount += squad.slots.length;
        }

        return { dotsCount };
    }

    private calcEnemySquadGroups(): typeof this.enemySquadGroups {
        const teamToSquads = new Map<Team, Squad[]>();

        for (const squad of this.game.getSquads()) {
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
    }

    act() {
        this.updateInfo();
        this.createSquadIfNeeded();
        this.assignSquads();
    }

    drawDebugFigures(ctx: CanvasRenderingContext2D) {
        const drawSquadGroup = (squads: Squad[], polygon: Polygon) => {
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

        const cost = this.game.getBuildingCost(
            buildingNeededConfig.kind,
            this.team,
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

        const canBuild = this.game.canBuild(buildingKind, this.team);

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

        // this.log();
        // console.log("isBuilt", isBuilt, building);
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
