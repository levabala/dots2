/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import type { Game } from "../Game";
import {
    BUILDINGS_CONFIGS,
    type BuildingConfig,
} from "../Game/buildingsConfigs";
import {
    type Building,
    type BuildingHQ,
    type BuildingKind,
    type BuildingBarracks,
    BuildingsController,
    type BuildingFarm,
    type BuildingGranary,
    type BuildingHouse,
    type BuildingLumberMill,
} from "../Game/BuildingsController";
import type { DotTemplate, Dot } from "../Game/DotsController";
import type { ResourcesState } from "../Game/ResourcesController";
import type { Slot, Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import {
    orthogonalRect,
    type Point,
    type Polygon,
    type Rect,
    type RectOrth,
} from "../utils";
import { Player } from "./Player";

export class PlayerAI extends Player {
    private actionsLog: string[] = [];
    private eventListeners: Set<(log: string) => void> = new Set();
    private aiIntervalId: number | null = null;
    private intentionIntervalId: number | null = null;
    private lastIntention: string = "";

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        super(game, team);
    }

    public addEventListener(listener: (log: string) => void): void {
        this.eventListeners.add(listener);
    }

    public removeEventListener(listener: (log: string) => void): void {
        this.eventListeners.delete(listener);
    }

    public startAI(): void {
        this.aiIntervalId = window.setInterval(() => this.runAI(), 200);
        this.intentionIntervalId = window.setInterval(
            () => this.logIntention(),
            1000,
        );
    }

    private emitLog(log: string): void {
        this.actionsLog.push(log);
        for (const listener of this.eventListeners) {
            listener(log);
        }
    }

    private logIntention(): void {
        if (this.lastIntention) {
            this.emitLog("Intention: " + this.lastIntention);
            this.lastIntention = "";
        }
    }

    private runAI(): void {
        try {
            const resources = this.game.resourcesController.getState(this.team);

            this.tryToBuildBuildings(resources);
            this.tryToTrainUnits(resources);
            this.manageSquads();
            this.attackEnemy();
        } catch (error) {
            console.error("AI encountered an error:", error);
        }
    }

    private tryToBuildBuildings(resources: ResourcesState): void {
        const myBuildings = Array.from(
            this.game.buildingsController.buildings,
        ).filter((building) => building.team === this.team);

        const hasHQ = myBuildings.some((building) => building.kind === "hq");
        if (!hasHQ) return;

        const basePositions = myBuildings.map((building) => building.center);

        if (resources.food < 50) {
            const farmConfig = BUILDINGS_CONFIGS.farm;
            if (BuildingsController.canBuild(farmConfig.cost, resources)) {
                const position = this.findBuildingPosition(
                    farmConfig.frameRelative,
                    basePositions,
                );
                if (position) {
                    const farm: BuildingFarm = {
                        ...farmConfig,
                        team: this.team,
                        frame: this.translatePolygon(
                            farmConfig.frameRelative,
                            position,
                        ),
                        center: position,
                    };

                    const success = this.game.tryBuild(farm);
                    if (success) {
                        this.emitLog(
                            "Built a farm at " + JSON.stringify(position),
                        );
                        this.lastIntention =
                            "Building a farm to increase food production.";
                    }
                }
            }
        }

        if (resources.housing < 50) {
            const houseConfig = BUILDINGS_CONFIGS.house;
            if (BuildingsController.canBuild(houseConfig.cost, resources)) {
                const position = this.findBuildingPosition(
                    houseConfig.frameRelative,
                    basePositions,
                );
                if (position) {
                    const house: BuildingHouse = {
                        ...houseConfig,
                        team: this.team,
                        frame: this.translatePolygon(
                            houseConfig.frameRelative,
                            position,
                        ),
                        center: position,
                    };

                    const success = this.game.tryBuild(house);
                    if (success) {
                        this.emitLog(
                            "Built a house at " + JSON.stringify(position),
                        );
                        this.lastIntention =
                            "Building a house to increase housing capacity.";
                    }
                }
            }
        }

        if (resources.wood < 50 && resources.coins >= 200) {
            const lumberMillConfig = BUILDINGS_CONFIGS.lumberMill;
            if (
                BuildingsController.canBuild(lumberMillConfig.cost, resources)
            ) {
                const position = this.findBuildingPosition(
                    lumberMillConfig.frameRelative,
                    basePositions,
                );
                if (position) {
                    const lumberMill: BuildingLumberMill = {
                        ...lumberMillConfig,
                        team: this.team,
                        frame: this.translatePolygon(
                            lumberMillConfig.frameRelative,
                            position,
                        ),
                        center: position,
                    };

                    const success = this.game.tryBuild(lumberMill);
                    if (success) {
                        this.emitLog(
                            "Built a lumber mill at " +
                                JSON.stringify(position),
                        );
                        this.lastIntention =
                            "Building a lumber mill to increase wood production.";
                    }
                }
            }
        }

        const hasBarracks = myBuildings.some(
            (building) => building.kind === "barracks",
        );
        if (!hasBarracks) {
            const barracksConfig = BUILDINGS_CONFIGS.barracks;
            if (BuildingsController.canBuild(barracksConfig.cost, resources)) {
                const position = this.findBuildingPosition(
                    barracksConfig.frameRelative,
                    basePositions,
                );
                if (position) {
                    const barracks: BuildingBarracks = {
                        ...barracksConfig,
                        team: this.team,
                        frame: this.translatePolygon(
                            barracksConfig.frameRelative,
                            position,
                        ),
                        center: position,
                    };

                    const success = this.game.tryBuild(barracks);
                    if (success) {
                        this.emitLog(
                            "Built a barracks at " + JSON.stringify(position),
                        );
                        this.lastIntention =
                            "Building a barracks to train units.";
                    }
                }
            }
        }
    }

    private findBuildingPosition(
        frameRelative: Polygon,
        basePositions: Point[],
    ): Point | null {
        const myBuildings = Array.from(
            this.game.buildingsController.buildings,
        ).filter((building) => building.team === this.team);
        const offsets = [
            { x: 100, y: 0 },
            { x: -100, y: 0 },
            { x: 0, y: 100 },
            { x: 0, y: -100 },
            { x: 150, y: 150 },
            { x: -150, y: -150 },
            { x: 150, y: -150 },
            { x: -150, y: 150 },
        ];

        for (const basePosition of basePositions) {
            const shuffledOffsets = offsets.sort(() => Math.random() - 0.5);

            for (const offset of shuffledOffsets) {
                const position = {
                    x: basePosition.x + offset.x,
                    y: basePosition.y + offset.y,
                };
                const frame = this.translatePolygon(frameRelative, position);

                const collision = myBuildings.some((building) =>
                    this.polygonsOverlap(building.frame, frame),
                );

                if (!collision) {
                    return position;
                }
            }
        }

        return null;
    }

    private translatePolygon(polygon: Polygon, position: Point): Polygon {
        return polygon.map((point) => ({
            x: point.x + position.x,
            y: point.y + position.y,
        }));
    }

    private polygonsOverlap(polygon1: Polygon, polygon2: Polygon): boolean {
        const rect1 = this.getBoundingRectFromPolygon(polygon1);
        const rect2 = this.getBoundingRectFromPolygon(polygon2);

        return !(
            rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom
        );
    }

    private getBoundingRectFromPolygon(polygon: Polygon): RectOrth {
        const xs = polygon.map((p) => p.x);
        const ys = polygon.map((p) => p.y);
        return {
            top: Math.min(...ys),
            bottom: Math.max(...ys),
            left: Math.min(...xs),
            right: Math.max(...xs),
        };
    }

    private tryToTrainUnits(resources: ResourcesState): void {
        const myBarracks = Array.from(
            this.game.buildingsController.buildings,
        ).filter(
            (building) =>
                building.team === this.team && building.kind === "barracks",
        ) as BuildingBarracks[];

        for (const barracks of myBarracks) {
            if (
                barracks.spawnQueue.length < 5 &&
                resources.food >= 10 &&
                resources.coins >= 10
            ) {
                const dotTemplate =
                    this.game.dotsController.generateDotRandom();
                barracks.spawnQueue.push(dotTemplate);
                this.emitLog(
                    "Queued a unit to train at barracks at " +
                        JSON.stringify(barracks.center),
                );
                this.lastIntention = "Training units for army expansion.";
            }
        }
    }

    private manageSquads(): void {
        const myDots = Array.from(this.game.dotsController.dots).filter(
            (dot) => dot.team === this.team && !dot.squad,
        );

        if (myDots.length >= 5) {
            const squadDots = myDots.slice(0, 5);

            const positions = squadDots.map((dot) => dot.position);
            const xs = positions.map((p) => p.x);
            const ys = positions.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const p1: Point = { x: minX, y: minY };
            const p3: Point = { x: maxX, y: maxY };
            const rect: Rect = orthogonalRect(p1, p3);

            const slots = this.game.squadsController.createSlots(
                rect,
                squadDots.length,
            );
            const squad = this.game.squadsController.createSquad(
                slots,
                this.team,
            );
            for (let i = 0; i < squadDots.length; i++) {
                const dot = squadDots[i];
                const slot = squad.slots[i];
                this.game.squadsController.assignDotToSlot(dot, slot);
            }
            this.emitLog(
                "Created squad " +
                    squad.key +
                    " with dots at positions: " +
                    squadDots
                        .map((dot) => JSON.stringify(dot.position))
                        .join("; "),
            );
            this.lastIntention = "Forming squads for military operations.";
        }
    }

    private attackEnemy(): void {
        const mySquads = this.game.squadsController.squads.filter(
            (squad) => squad.team === this.team && !squad.removed,
        );
        if (mySquads.length === 0) return;

        const enemyBuildings = Array.from(
            this.game.buildingsController.buildings,
        ).filter((building) => building.team !== this.team);

        const enemySquads = this.game.squadsController.squads.filter(
            (squad) => squad.team !== this.team && !squad.removed,
        );

        const squad = mySquads[0];

        if (enemySquads.length > 0) {
            const targetSquad = enemySquads[0];
            const targetPosition = this.getSquadCenter(targetSquad);
            const targetRect = this.getSquadTargetRect(squad, targetPosition);
            this.game.squadsController.generateAndUpdateSlotsAfterMove(
                [squad],
                targetRect,
            );
            this.emitLog(
                "Moved squad " +
                    squad.key +
                    " towards enemy squad at " +
                    JSON.stringify(targetPosition),
            );

            this.game.attackSquad({
                squadAttacker: squad,
                squadTarget: targetSquad,
            });
            squad.allowAttack = true;
            this.emitLog(
                "Squad " +
                    squad.key +
                    " attacking enemy squad at " +
                    JSON.stringify(targetPosition),
            );
            this.lastIntention =
                "Attacking enemy squads to reduce their military strength.";
        } else if (enemyBuildings.length > 0) {
            const targetBuilding = enemyBuildings[0];
            const targetPosition = targetBuilding.center;
            const targetRect = this.getSquadTargetRect(squad, targetPosition);
            this.game.squadsController.generateAndUpdateSlotsAfterMove(
                [squad],
                targetRect,
            );
            this.emitLog(
                "Moved squad " +
                    squad.key +
                    " towards enemy building at " +
                    JSON.stringify(targetPosition),
            );

            this.game.attackBuilding({
                squadAttacker: squad,
                buildingTarget: targetBuilding,
            });
            squad.allowAttack = true;
            this.emitLog(
                "Squad " +
                    squad.key +
                    " attacking enemy building at " +
                    JSON.stringify(targetPosition),
            );
            this.lastIntention =
                "Attacking enemy buildings to cripple their economy.";
        }
    }

    private getSquadCenter(squad: Squad): Point {
        const positions = squad.slots.map((slot) => slot.position);
        const xs = positions.map((p) => p.x);
        const ys = positions.map((p) => p.y);
        const avgX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
        const avgY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
        return { x: avgX, y: avgY };
    }

    private getSquadTargetRect(squad: Squad, targetPosition: Point): Rect {
        const squadSize = squad.slots.length;
        const width = Math.sqrt(squadSize) * 10;
        const height = Math.sqrt(squadSize) * 10;
        const p1 = {
            x: targetPosition.x - width / 2,
            y: targetPosition.y - height / 2,
        };
        const p3 = {
            x: targetPosition.x + width / 2,
            y: targetPosition.y + height / 2,
        };
        return orthogonalRect(p1, p3);
    }
}
