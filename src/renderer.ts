import type { Game, Dot } from "./game";
import type { SquadFrame, UI } from "./ui";
import {
    getFirstIntersection,
    getRectCenter,
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

    dotWidth = 4;
    dotHeight = 4;

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

        this.game.dots.forEach(this.renderDot.bind(this));
        this.ui.squadFrames.forEach((squadFrame) => {
            const isSelected = this.ui.squadFramesSelected.includes(squadFrame);

            this.renderSquadFrames(squadFrame, isSelected);
        });

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

    renderDot(dot: Dot) {
        const color = this.game.isDotSelected(dot.index)
            ? "darkgoldenrod"
            : "black";
        this.ctx.fillStyle = color;

        this.ctx.fillRect(
            dot.x - this.dotWidth / 2,
            dot.y - this.dotHeight / 2,
            this.dotWidth,
            this.dotHeight,
        );
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
    private drawArrow(p1: Point, p2: Point) {
        const headLength = 10; // Length of the arrowhead
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

    renderSquadFrameAttackArrow(
        squadFrameFrom: SquadFrame,
        squadFrameTo: SquadFrame,
    ) {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "red";

        const centerFrom = getRectCenter(squadFrameFrom.frame);
        const centerTo = getRectCenter(squadFrameTo.frame);

        const lineCenterToCenter = { p1: centerFrom, p2: centerTo };
        const start = getFirstIntersection(
            lineCenterToCenter,
            squadFrameFrom.frame,
        );
        const end = getFirstIntersection(
            lineCenterToCenter,
            squadFrameTo.frame,
        );

        if (!start || !end) {
            return;
        }

        this.drawArrow(start, end);

        this.ctx.stroke();
    }
}
