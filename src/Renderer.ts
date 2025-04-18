import {
    DEFAULT_PROJECTILE,
    DOT_MORALE_BASELINE_IN_SQUAD,
    DOT_MORALE_FLEE_LEVEL,
    DOT_MORALE_MAX,
} from "./consts";
import type { DotsGrid } from "./DotsGrid";
import type { Game } from "./Game";
import type { Building, BuildingBase } from "./Game/BuildingsController";
import type { Dot } from "./Game/DotsController";
import type { Projectile } from "./Game/ProjectilesController";
import type { Slot, Squad } from "./Game/SquadsController";
import { RendererUtils } from "./RendererUtils";
import { getPolygonCenter } from "./shapes";
import type { UI } from "./UI/UI";
import {
    getIntersectionFirstPolygon,
    getIntersectionFirstRect,
    getRectCenter,
    rotatePoint,
    type Point,
    type Rect,
} from "./shapes";
import { prop, sort, sortBy, take, takeLast } from "remeda";

const DOT_MORALE_BAR_WIDTH = 8;
const DOT_MORALE_BAR_HEIGHT = 2;
const DOT_MORALE_BAR_OFFSET = 1;
const HEALTH_BAR_OFFSET = DOT_MORALE_BAR_HEIGHT + DOT_MORALE_BAR_OFFSET + 0.5;
const HEALTH_BAR_HEIGHT = 2;
const HEALTH_BAR_WIDTH = DOT_MORALE_BAR_WIDTH;

interface Renderer {
    game: Game;
    ui: UI;
}

export class RendererCanvasSimple implements Renderer {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    constructor(
        readonly game: Game,
        readonly ui: UI,
        canvas: HTMLCanvasElement,
    ) {
        this.ctx = canvas.getContext("2d")!;
        this.width = canvas.width;
        this.height = canvas.height;
    }

    lastRenderTimestamp: number | null = null;
    render(renderDebugFigures?: (ctx: CanvasRenderingContext2D) => void) {
        const {
            dotsController,
            buildingsController,
            projectilesController,
            squadsController,
        } = this.game.getPrivateStaffYouShouldNotUse();

        this.ctx.clearRect(0, 0, this.width, this.height);
        this.adjustViewport();

        this.renderDotsGrid(dotsController.dotsGrid);

        renderDebugFigures?.(this.ctx);

        for (const dot of dotsController.dotsDead) {
            this.renderDotDead(dot);
        }

        for (const building of buildingsController.buildings) {
            this.renderBuilding(building);
        }

        if (this.ui.buildingPlacingGhost) {
            this.renderBuildingGhost(this.ui.buildingPlacingGhost);
        }

        for (const dot of dotsController.dots) {
            if (
                (dot.attackTargetDot || dot.attackTargetBuilding) &&
                dot.attackCooldownLeft === 0
            ) {
                const attackTargetPosition =
                    dot.attackTargetBuilding?.center ||
                    dot.attackTargetDot?.position;

                if (!attackTargetPosition) {
                    global.panic("attack target position must be valid", {
                        dot,
                        attackTargetPosition,
                    });
                }

                this.renderDotAttackTargetArrow(dot, attackTargetPosition);
            }
        }

        for (const squad of squadsController.squads) {
            for (const slot of squad.slots) {
                this.renderSlot(slot);
            }
        }

        for (const dot of dotsController.dots) {
            if (dot.attackCooldownLeft === 0) {
                this.renderDotWeaponRaised(dot);
            }

            this.renderDot(dot);
        }

        for (const dot of dotsController.dots) {
            this.renderDotMorale(dot);
            this.renderDotHealth(dot);
        }

        for (const squad of squadsController.squads) {
            const isSelected = this.ui.squadsSelected.includes(squad);

            this.renderSquadFrameActual(squad);
            this.renderSquadFrameTarget(squad, isSelected);
        }

        for (const projectile of projectilesController.projectiles) {
            this.renderProjectile(projectile);
        }

        for (const squad of squadsController.squads) {
            for (const squadTarget of squad.attackTargetSquads) {
                const squadFrameTarget = squadsController.squads.find(
                    (sf) => sf === squadTarget,
                );

                if (squadFrameTarget) {
                    this.renderSquadFrameAttackArrowToSquad(
                        squad,
                        squadFrameTarget,
                    );
                }
            }

            for (const buildingTarget of squad.attackTargetBuildings) {
                this.renderSquadFrameAttackArrowToBuilding(
                    squad,
                    buildingTarget,
                );
            }

            this.renderSquadMorale(squad);
        }

        if (this.ui.selection) {
            this.renderSelection(this.ui.selection);
        }

        if (this.ui.destination) {
            this.renderDestination(this.ui.destination);
        }

        if (this.ui.focusPoint) {
            this.ctx.fillRect(this.ui.focusPoint.x, this.ui.focusPoint.y, 2, 2);
        }

        this.ctx.resetTransform();
        this.renderPerformance();
        this.renderTime(this.game.getTime());
    }

    adjustViewport() {
        this.ctx.setTransform(...this.ui.viewPort.matrix.value);
    }

    lastFPS: number[] = [];
    renderPerformance() {
        // TODO: move to measurements module
        const dateNow = Date.now();
        const timeBetweenRenders =
            dateNow - (this.lastRenderTimestamp ?? dateNow);
        this.lastRenderTimestamp = dateNow;

        const fps = timeBetweenRenders === 0 ? 69 : 1000 / timeBetweenRenders;
        this.lastFPS.push(fps);

        if (this.lastFPS.length > 100) {
            this.lastFPS.splice(0, 1);
        }

        const fpsAverage =
            this.lastFPS.reduce((acc, val) => acc + val, 0) /
            this.lastFPS.length;
        const fpsLowest = this.lastFPS.reduce(
            (acc, val) => Math.min(acc, val),
            Infinity,
        );

        const str = `average: ${fpsAverage.toFixed(0)} lowest: ${fpsLowest.toFixed(0)}`;

        this.setupText({});
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = "white";
        this.ctx.strokeText(str, 2, 10);

        this.ctx.lineWidth = 6;
        this.ctx.fillStyle = "black";
        this.ctx.fillText(str, 2, 10);
    }

    renderTime(time: number) {
        const timeSeconds = time / 1000;

        const str = `time passed: ${timeSeconds.toFixed(1)}s`;

        this.setupText({});
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = "white";
        this.ctx.strokeText(str, 2, 20);

        this.ctx.lineWidth = 6;
        this.ctx.fillStyle = "black";
        this.ctx.fillText(str, 2, 20);
    }

    private setupText({
        textAlign,
        font,
        textBaseline,
    }: {
        textAlign?: CanvasTextAlign;
        font?: string;
        textBaseline?: CanvasTextBaseline;
    }) {
        this.ctx.textAlign = textAlign ?? "left";
        this.ctx.textBaseline = textBaseline ?? "top";
        this.ctx.font = font ?? "10px sans-serif";
    }

    private renderBuildingGhost(building: BuildingBase) {
        this.ctx.strokeStyle = "gray";
        this.ctx.lineWidth = 1;

        RendererUtils.drawPolygon(this.ctx, building.frame);

        this.ctx.stroke();

        const center = getPolygonCenter(building.frame);

        this.setupText({
            font: "16px sans-serif",
            textBaseline: "middle",
            textAlign: "center",
        });
        this.ctx.fillStyle = "gray";
        this.ctx.fillText(building.kind, center.x, center.y);
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeText(building.kind, center.x, center.y);
    }

    private renderBuilding(building: BuildingBase) {
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 1;

        RendererUtils.drawPolygon(this.ctx, building.frame);

        this.ctx.stroke();

        const center = getPolygonCenter(building.frame);

        const lineHeight = 18;
        this.setupText({
            font: "16px sans-serif",
            textBaseline: "middle",
            textAlign: "center",
        });
        this.ctx.fillStyle = this.getTeamColor(building.team?.index ?? -1);
        this.ctx.fillText(building.kind, center.x, center.y - lineHeight / 2);
        this.ctx.fillText(
            `${building.health}`,
            center.x,
            center.y + lineHeight / 2,
        );
        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeText(building.kind, center.x, center.y - lineHeight / 2);
        this.ctx.strokeText(
            `${building.health}`,
            center.x,
            center.y + lineHeight / 2,
        );
    }

    private getDotColor(dot: Dot) {
        if (dot.health <= 0) {
            return "lightcoral";
        }

        if (this.ui.isDotSelected(dot)) {
            return "darkgoldenrod";
        }

        return "black";
    }

    private getTeamColor(teamIndex: number) {
        switch (teamIndex) {
            case 0:
                return "red";
            case 1:
                return "blue";
            case 2:
                return "green";
            case 3:
                return "darkorange";
            default:
                return "black";
        }
    }

    private getDotTeamColor(dot: Dot) {
        return this.getTeamColor(dot.team.index);
    }

    renderSlot(slot: Slot) {
        this.ctx.strokeStyle = "khaki";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(slot.position.x, slot.position.y, 2, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    renderDotWeaponRaised(dot: Dot) {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "gray";

        const length = 4;
        const endPoint = rotatePoint(
            { x: dot.position.x, y: dot.position.y + dot.height / 2 + length },
            dot.position,
            dot.angle,
        );

        this.ctx.beginPath();
        this.ctx.moveTo(dot.position.x, dot.position.y);
        this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.closePath();

        this.ctx.stroke();
    }

    renderDot(dot: Dot) {
        this.ctx.fillStyle = this.getDotColor(dot);
        this.ctx.strokeStyle = this.getDotTeamColor(dot);
        this.ctx.lineWidth = 1;

        RendererUtils.drawRect(this.ctx, dot.hitBox);

        this.ctx.fill();
        this.ctx.stroke();
    }

    renderDotDead(dot: Dot) {
        this.ctx.fillStyle = "rgba(128, 128, 128, 0.1)";

        RendererUtils.drawRect(this.ctx, dot.hitBox);

        this.ctx.fill();
    }

    renderDotHealth(dot: Dot) {
        const hitBoxPointsExceptP1 = [
            dot.hitBox.p2,
            dot.hitBox.p3,
            dot.hitBox.p4,
        ];

        let topPoint = dot.hitBox.p1;
        for (const point of hitBoxPointsExceptP1) {
            if (point.y < topPoint.y) {
                topPoint = point;
            }
        }

        const healthBarBottomCenter = {
            x: dot.position.x,
            y: topPoint.y - HEALTH_BAR_OFFSET,
        };

        const healthBarContainerRect = {
            p1: {
                x: healthBarBottomCenter.x - HEALTH_BAR_WIDTH / 2,
                y: healthBarBottomCenter.y - HEALTH_BAR_HEIGHT,
            },
            p2: {
                x: healthBarBottomCenter.x + HEALTH_BAR_WIDTH / 2,
                y: healthBarBottomCenter.y - HEALTH_BAR_HEIGHT,
            },
            p3: {
                x: healthBarBottomCenter.x + HEALTH_BAR_WIDTH / 2,
                y: healthBarBottomCenter.y,
            },
            p4: {
                x: healthBarBottomCenter.x - HEALTH_BAR_WIDTH / 2,
                y: healthBarBottomCenter.y,
            },
        };

        const healthLevelPercent = dot.health / dot.healthMax;
        const healthLevelPixels =
            HEALTH_BAR_WIDTH - healthLevelPercent * HEALTH_BAR_WIDTH;

        const healthBarValueRect = {
            p1: healthBarContainerRect.p1,
            p2: {
                x: healthBarContainerRect.p2.x - healthLevelPixels,
                y: healthBarContainerRect.p2.y,
            },
            p3: {
                x: healthBarContainerRect.p3.x - healthLevelPixels,
                y: healthBarContainerRect.p3.y,
            },
            p4: healthBarContainerRect.p4,
        };

        this.ctx.strokeStyle = "black";
        this.ctx.fillStyle =
            dot.health < Math.ceil(dot.healthMax / 2) ? "red" : "green";
        this.ctx.lineWidth = 0.1;
        RendererUtils.drawRect(this.ctx, healthBarValueRect);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.strokeStyle = "black";
        this.ctx.lineWidth = 0.3;
        RendererUtils.drawRect(this.ctx, healthBarContainerRect);
        this.ctx.stroke();
    }

    renderSquadMorale(squad: Squad) {
        const middle = getRectCenter(squad.frameTarget);

        const moraleBarBottomCenter = middle;

        const width = 100;
        const height = 30;

        const moraleBarContainerRect = {
            p1: {
                x: moraleBarBottomCenter.x - width / 2,
                y: moraleBarBottomCenter.y - height,
            },
            p2: {
                x: moraleBarBottomCenter.x + width / 2,
                y: moraleBarBottomCenter.y - height,
            },
            p3: {
                x: moraleBarBottomCenter.x + width / 2,
                y: moraleBarBottomCenter.y,
            },
            p4: {
                x: moraleBarBottomCenter.x - width / 2,
                y: moraleBarBottomCenter.y,
            },
        };

        const dotsAll = squad.slots
            .filter((slot) => slot.dot)
            .map((slot) => slot.dot!);
        const dotsSortedByMorale = sortBy(dotsAll, prop("morale"));
        const dots = take(dotsSortedByMorale, Math.floor(dotsAll.length * 0.3));

        let squadMoraleSum = 0;
        let squadMoraleMax = 0;
        let dotsCount = 0;
        for (const dot of dots) {
            squadMoraleSum += dot.morale;
            squadMoraleMax += DOT_MORALE_BASELINE_IN_SQUAD;
            dotsCount++;
        }

        const moraleLevelPercent = squadMoraleSum / squadMoraleMax;
        const moraleLevelPixels = width - moraleLevelPercent * width;

        const moraleBarValueRect = {
            p1: moraleBarContainerRect.p1,
            p2: {
                x: moraleBarContainerRect.p2.x - moraleLevelPixels,
                y: moraleBarContainerRect.p2.y,
            },
            p3: {
                x: moraleBarContainerRect.p3.x - moraleLevelPixels,
                y: moraleBarContainerRect.p3.y,
            },
            p4: moraleBarContainerRect.p4,
        };

        this.ctx.strokeStyle = "black";
        this.ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
        this.ctx.lineWidth = 1;
        RendererUtils.drawRect(this.ctx, moraleBarValueRect);
        this.ctx.fill();
        this.ctx.stroke();

        const averageMorale = squadMoraleSum / dotsCount;
        const isVeryLow = averageMorale < DOT_MORALE_FLEE_LEVEL + 10;
        this.ctx.strokeStyle = isVeryLow ? "red" : "black";
        this.ctx.lineWidth = 0.5;
        RendererUtils.drawRect(this.ctx, moraleBarContainerRect);
        this.ctx.stroke();
    }

    renderDotMorale(dot: Dot) {
        const hitBoxPointsExceptP1 = [
            dot.hitBox.p2,
            dot.hitBox.p3,
            dot.hitBox.p4,
        ];

        let topPoint = dot.hitBox.p1;
        for (const point of hitBoxPointsExceptP1) {
            if (point.y < topPoint.y) {
                topPoint = point;
            }
        }

        const moraleBarBottomCenter = {
            x: dot.position.x,
            y: topPoint.y - DOT_MORALE_BAR_OFFSET,
        };

        const moraleBarContainerRect = {
            p1: {
                x: moraleBarBottomCenter.x - DOT_MORALE_BAR_WIDTH / 2,
                y: moraleBarBottomCenter.y - DOT_MORALE_BAR_HEIGHT,
            },
            p2: {
                x: moraleBarBottomCenter.x + DOT_MORALE_BAR_WIDTH / 2,
                y: moraleBarBottomCenter.y - DOT_MORALE_BAR_HEIGHT,
            },
            p3: {
                x: moraleBarBottomCenter.x + DOT_MORALE_BAR_WIDTH / 2,
                y: moraleBarBottomCenter.y,
            },
            p4: {
                x: moraleBarBottomCenter.x - DOT_MORALE_BAR_WIDTH / 2,
                y: moraleBarBottomCenter.y,
            },
        };

        const moraleLevelPercent = dot.morale / DOT_MORALE_MAX;
        const moraleLevelPixels =
            DOT_MORALE_BAR_WIDTH - moraleLevelPercent * DOT_MORALE_BAR_WIDTH;

        const moraleBarValueRect = {
            p1: moraleBarContainerRect.p1,
            p2: {
                x: moraleBarContainerRect.p2.x - moraleLevelPixels,
                y: moraleBarContainerRect.p2.y,
            },
            p3: {
                x: moraleBarContainerRect.p3.x - moraleLevelPixels,
                y: moraleBarContainerRect.p3.y,
            },
            p4: moraleBarContainerRect.p4,
        };

        this.ctx.strokeStyle = "black";
        this.ctx.fillStyle = "yellow";
        this.ctx.lineWidth = 0.1;
        RendererUtils.drawRect(this.ctx, moraleBarValueRect);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.strokeStyle = dot.isFleeing ? "red" : "black";
        this.ctx.lineWidth = 0.3;
        RendererUtils.drawRect(this.ctx, moraleBarContainerRect);
        this.ctx.stroke();
    }

    renderSelection(selection: Rect) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "yellowgreen";

        RendererUtils.drawRect(this.ctx, selection);

        this.ctx.stroke();
    }

    renderDestination(destination: Rect) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "olive";

        RendererUtils.drawRect(this.ctx, destination);

        this.ctx.stroke();
    }

    renderSquadFrameTarget(squad: Squad, isSelected: boolean) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = isSelected
            ? "darkkhaki"
            : this.getTeamColor(squad.team.index);

        RendererUtils.drawRect(this.ctx, squad.frameTarget);

        this.ctx.stroke();
    }

    renderSquadFrameActual(squad: Squad) {
        this.ctx.lineWidth = 0.8;
        this.ctx.strokeStyle = "gray";

        RendererUtils.drawRect(this.ctx, squad.frameActual);

        this.ctx.stroke();
    }

    renderDotAttackTargetArrow(dotFrom: Dot, pointTo: Point) {
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeStyle = "palevioletred";

        RendererUtils.drawPolygon(this.ctx, [dotFrom.position, pointTo]);
        this.ctx.stroke();
        RendererUtils.drawArrowHead(this.ctx, dotFrom.position, pointTo, 7);
        this.ctx.stroke();
    }

    renderSquadFrameAttackArrowToSquad(squadFrom: Squad, squadTo: Squad) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "red";

        const from = getRectCenter(squadFrom.frameTarget);
        const to = getRectCenter(squadTo.frameTarget);

        const lineCenterToCenter = { p1: from, p2: to };
        const start = getIntersectionFirstRect(
            lineCenterToCenter,
            squadFrom.frameTarget,
        );
        const end = getIntersectionFirstRect(
            lineCenterToCenter,
            squadTo.frameTarget,
        );

        if (!start || !end) {
            return;
        }

        RendererUtils.drawPolygon(this.ctx, [start, end]);
        this.ctx.stroke();
        RendererUtils.drawArrowHead(this.ctx, start, end, 10);
        this.ctx.stroke();
    }

    renderSquadFrameAttackArrowToBuilding(
        squadFrom: Squad,
        buildingTo: Building,
    ) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "red";

        const from = getRectCenter(squadFrom.frameTarget);
        const to = getPolygonCenter(buildingTo.frame);

        const lineCenterToCenter = { p1: from, p2: to };
        const start = getIntersectionFirstRect(
            lineCenterToCenter,
            squadFrom.frameTarget,
        );
        const end = getIntersectionFirstPolygon(
            lineCenterToCenter,
            buildingTo.frame,
        );

        if (!start || !end) {
            return;
        }

        RendererUtils.drawPolygon(this.ctx, [start, end]);
        this.ctx.stroke();
        RendererUtils.drawArrowHead(this.ctx, start, end, 10);
        this.ctx.stroke();
    }

    renderProjectile(projectile: Projectile) {
        this.ctx.fillStyle = "gray";
        this.ctx.beginPath();
        this.ctx.arc(
            projectile.position.x,
            projectile.position.y,
            DEFAULT_PROJECTILE.radius / 2,
            0,
            Math.PI * 2,
        );
        this.ctx.closePath();
        this.ctx.fill();
    }

    renderDotsGrid(dotsGrid: DotsGrid) {
        this.ctx.strokeStyle = "gray";
        this.ctx.lineWidth = 0.5;

        this.ctx.beginPath();

        for (let col = 0; col < dotsGrid.dotsGridCols; col++) {
            this.ctx.moveTo(col * dotsGrid.dotsGridSquareSize, 0);
            this.ctx.lineTo(
                col * dotsGrid.dotsGridSquareSize,
                dotsGrid.dotsGridRows * dotsGrid.dotsGridSquareSize,
            );
        }

        for (let row = 0; row < dotsGrid.dotsGridRows; row++) {
            this.ctx.moveTo(0, row * dotsGrid.dotsGridSquareSize);
            this.ctx.lineTo(
                dotsGrid.dotsGridCols * dotsGrid.dotsGridSquareSize,
                row * dotsGrid.dotsGridSquareSize,
            );
        }

        this.ctx.closePath();

        this.ctx.stroke();
    }

    renderDotsGridTitles(dotsGrid: DotsGrid) {
        this.setupText({ textAlign: "left", font: "8px" });
        for (let row = 0; row < dotsGrid.dotsGridRows; row++) {
            for (let col = 0; col < dotsGrid.dotsGridCols; col++) {
                this.ctx.strokeText(
                    dotsGrid.calcIndexFromXY(col, row).toString(),
                    col * dotsGrid.dotsGridSquareSize + 5,
                    row * dotsGrid.dotsGridSquareSize + 10,
                );
            }
        }
    }
}
