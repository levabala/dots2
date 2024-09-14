import { DEFAULT_PROJECTILE } from "./consts";
import type { DotsGrid } from "./DotsGrid";
import type { Game, Dot, Projectile, Slot } from "./Game";
import type { SquadFrame, UI } from "./UI";
import {
    getIntersectionFirst,
    getRectCenter,
    rotatePoint,
    type Point,
    type Rect,
} from "./utils";

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
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.renderDotsGrid(this.game.dotsGrid);

        for (const dot of this.game.dots) {
            if (dot.attackTargetDot && dot.attackCooldownLeft === 0) {
                this.renderDotAttackTargetArrow(dot, dot.attackTargetDot);
            }
        }

        for (const squad of this.game.squads) {
            for (const slot of squad.slots) {
                this.renderSlot(slot);
            }
        }

        for (const dot of this.game.dots) {
            if (dot.attackCooldownLeft === 0) {
                this.renderDotWeaponRaised(dot);
            }

            this.renderDot(dot);
        }

        for (const squadFrame of this.ui.squadFrames) {
            const isSelected = this.ui.squadFramesSelected.includes(squadFrame);
            this.renderSquadFrames(squadFrame, isSelected);
        }

        for (const projectile of this.game.projectiles) {
            this.renderProjectile(projectile);
        }

        for (const squadFrame of this.ui.squadFrames) {
            if (squadFrame.squad.attackTargetSquad) {
                const squadFrameTarget = this.ui.squadFrames.find(
                    (sf) => sf.squad === squadFrame.squad.attackTargetSquad,
                );
                if (squadFrameTarget) {
                    this.renderSquadFrameAttackArrow(
                        squadFrame,
                        squadFrameTarget,
                    );
                }
            }
        }

        if (this.ui.selection) {
            this.renderSelection(this.ui.selection);
        }

        if (this.ui.destination) {
            this.renderDestination(this.ui.destination);
        }

        this.renderPerformance();
    }

    lastFPS: number[] = [];
    renderPerformance() {
        // TODO: move to measurements module
        const dateNow = Date.now();
        const timeBetweenRenders =
            dateNow - (this.lastRenderTimestamp ?? dateNow);
        this.lastRenderTimestamp = dateNow;

        const fps = 1000 / timeBetweenRenders;
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

        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(str, 2, 10);
        this.ctx.fillStyle = "black";
        this.ctx.lineWidth = 6;
        this.ctx.fillText(str, 2, 10);
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

    private getDotTeamColor(dot: Dot) {
        switch (dot.team.index) {
            case 0:
                return "red";
            case 1:
                return "blue";
            default:
                return "black";
        }
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

        this.drawRect(dot.hitBox);

        this.ctx.fill();
        this.ctx.stroke();
    }

    private drawPolygon(points: Point[]) {
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);

        for (const point of points) {
            this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.closePath();
    }

    private drawRect(rect: Rect) {
        this.drawPolygon([rect.p1, rect.p2, rect.p3, rect.p4]);
    }

    renderSelection(selection: Rect) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "yellowgreen";

        this.drawRect(selection);

        this.ctx.stroke();
    }

    renderDestination(destination: Rect) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "olive";

        this.drawRect(destination);

        this.ctx.stroke();
    }

    renderSquadFrames(squadFrame: SquadFrame, isSelected: boolean) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = isSelected ? "darkkhaki" : "brown";

        this.drawRect(squadFrame.frame);

        this.ctx.stroke();
    }

    // chatgpt (c)
    private drawArrow(p1: Point, p2: Point, headLength: number) {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        // Draw the line
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);

        // Draw the arrowhead
        this.ctx.lineTo(
            p2.x - headLength * Math.cos(angle - Math.PI / 6),
            p2.y - headLength * Math.sin(angle - Math.PI / 6),
        );
        this.ctx.moveTo(p2.x, p2.y);
        this.ctx.lineTo(
            p2.x - headLength * Math.cos(angle + Math.PI / 6),
            p2.y - headLength * Math.sin(angle + Math.PI / 6),
        );

        this.ctx.closePath();
    }

    renderDotAttackTargetArrow(dotFrom: Dot, dotTo: Dot) {
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeStyle = "palevioletred";

        this.drawArrow(dotFrom.position, dotTo.position, 7);

        this.ctx.stroke();
    }

    renderSquadFrameAttackArrow(
        squadFrameFrom: SquadFrame,
        squadFrameTo: SquadFrame,
    ) {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "red";

        const centerFrom = getRectCenter(squadFrameFrom.frame);
        const centerTo = getRectCenter(squadFrameTo.frame);

        const lineCenterToCenter = { p1: centerFrom, p2: centerTo };
        const start = getIntersectionFirst(
            lineCenterToCenter,
            squadFrameFrom.frame,
        );
        const end = getIntersectionFirst(
            lineCenterToCenter,
            squadFrameTo.frame,
        );

        if (!start || !end) {
            return;
        }

        this.drawArrow(start, end, 10);

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
            this.ctx.moveTo(col * dotsGrid.dotsGridSquadSize, 0);
            this.ctx.lineTo(
                col * dotsGrid.dotsGridSquadSize,
                dotsGrid.dotsGridRows * dotsGrid.dotsGridSquadSize,
            );
        }

        for (let row = 0; row < dotsGrid.dotsGridRows; row++) {
            this.ctx.moveTo(0, row * dotsGrid.dotsGridSquadSize);
            this.ctx.lineTo(
                dotsGrid.dotsGridCols * dotsGrid.dotsGridSquadSize,
                row * dotsGrid.dotsGridSquadSize,
            );
        }

        this.ctx.closePath();

        this.ctx.stroke();
    }

    private renderDotsGridTitles(dotsGrid: DotsGrid) {
        this.ctx.font = "8px";
        for (let row = 0; row < dotsGrid.dotsGridRows; row++) {
            for (let col = 0; col < dotsGrid.dotsGridCols; col++) {
                this.ctx.strokeText(
                    dotsGrid.calcIndexFromXY(col, row).toString(),
                    col * dotsGrid.dotsGridSquadSize + 5,
                    row * dotsGrid.dotsGridSquadSize + 10,
                );
            }
        }
    }
}