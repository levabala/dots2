import { randomInteger, times } from "remeda";
import {
    distanceBetween,
    isPointInRect,
    orthogonalRect,
    randomPointInRect,
    rotateRect,
    sortRectPoints,
    type Point,
    type Rect,
} from "./utils";

const WIDTH = 700;
const HEIGHT = 700;

const DOT_SPEED = 200 / 1000;
const DOT_TARGET_MOVE_SPACE = 100;

const canvas = document.createElement("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.style.border = "solid gray 1px";

document.body.appendChild(canvas);

type Dot = Point & {
    index: number;
    speed: number;
    path: Point[];
};

class Game {
    dots: Dot[] = [];
    dotsSelectedIndexes = new Set<number>();
    width = WIDTH;
    height = HEIGHT;

    constructor() {}

    init() {
        times(100, () => this.addDotRandom());
    }

    addDotRandom() {
        this.dots.push({
            index: this.dots.length,
            x: randomInteger(0, this.width),
            y: randomInteger(0, this.height),
            path: [],
            speed: DOT_SPEED,
        });
    }

    dotSelect(dotIndex: number) {
        this.dotsSelectedIndexes.add(dotIndex);
    }

    dotSelectAll() {
        this.dotsSelectedIndexes = new Set(times(this.dots.length, (i) => i));
    }

    dotUnselect(dotIndex: number) {
        this.dotsSelectedIndexes.delete(dotIndex);
    }

    dotsAllUnselect() {
        this.dotsSelectedIndexes.clear();
    }

    isDotSelected(dotIndex: number) {
        return this.dotsSelectedIndexes.has(dotIndex);
    }

    dotMoveTo(dotIndex: number, destination: Point) {
        this.dots[dotIndex].path = [destination];
    }

    tick(timeDelta: number) {
        function move(dot: Dot) {
            const maxMoveDistance = timeDelta * DOT_SPEED;

            const target = dot.path[0];
            const dxRaw = target.x - dot.x;
            const dyRaw = target.y - dot.y;

            if (dxRaw === 0 && dyRaw === 0) {
                return;
            }

            const angle = Math.atan2(dyRaw, dxRaw);
            const lengthRaw = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
            const length = Math.min(lengthRaw, maxMoveDistance);

            if (length === 0) {
                return;
            }

            const dx = length * Math.cos(angle);
            const dy = length * Math.sin(angle);

            dot.x += dx;
            dot.y += dy;

            if (length < maxMoveDistance) {
                dot.path.splice(0, 1);
            }
        }

        for (const dot of this.dots) {
            if (dot.path.length) {
                move(dot);
            }
        }
    }
}

class UI {
    selectionStartPoint: Point | null = null;
    selection: Rect | null = null;

    destinationStartPoint: Point | null = null;
    destination: Rect | null = null;

    constructor(
        readonly element: HTMLElement,
        readonly game: Game,
    ) {}

    init() {
        let isMouseDown = false;
        this.element.addEventListener("mousedown", (e) => {
            isMouseDown = true;
            switch (e.button) {
                case 0:
                    this.startSelection(e.offsetX, e.offsetY);
                    break;
                case 2:
                    if (this.game.dotsSelectedIndexes.size) {
                        this.startDestination(e.offsetX, e.offsetY);
                    }
                    break;
            }
        });
        this.element.addEventListener("mouseup", (e) => {
            switch (e.button) {
                case 2:
                    e.preventDefault();
                    this.commandMove();
                    break;
            }
        });
        this.element.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
        this.element.addEventListener("mousemove", (e) => {
            if (!isMouseDown) {
                return;
            }

            switch (e.buttons) {
                case 1:
                    this.extendSelection(e.offsetX, e.offsetY);
                    break;
                case 2:
                    this.adjustDestination(e.offsetX, e.offsetY);
                    break;
            }
        });
        this.element.addEventListener("mouseup", () => {
            isMouseDown = false;
            this.cancelSelection();
        });
        this.element.addEventListener(
            "mouseleave",
            this.cancelSelection.bind(this),
        );
        this.element.addEventListener(
            "mouseout",
            this.cancelSelection.bind(this),
        );
        this.element.addEventListener(
            "dblclick",
            this.markDotsAll.bind(this),
        );
    }

    startSelection(x: number, y: number) {
        this.game.dotsAllUnselect();

        this.selectionStartPoint = { x, y };
    }

    extendSelection(x: number, y: number) {
        if (!this.selectionStartPoint) {
            return;
        }

        if (
            this.selectionStartPoint.x === x &&
            this.selectionStartPoint.y === y
        ) {
            return;
        }

        this.selection = sortRectPoints(
            orthogonalRect(this.selectionStartPoint, { x, y }),
        );

        this.markDotsInSelection();
    }

    startDestination(x: number, y: number) {
        this.destinationStartPoint = { x, y };
        const dotsIndexesToMove = Array.from(this.game.dotsSelectedIndexes);
        const targetRectArea = dotsIndexesToMove.length * DOT_TARGET_MOVE_SPACE;
        const sideLength = Math.ceil(Math.sqrt(targetRectArea));
        const targetRect = orthogonalRect(
            {
                x: x - sideLength / 2,
                y: y - sideLength / 2,
            },
            {
                x: x + sideLength / 2,
                y: y + sideLength / 2,
            },
        );

        this.destination = targetRect;
    }

    adjustDestination(x: number, y: number) {
        if (!this.destinationStartPoint) {
            return;
        }

        const dotsIndexesToMove = Array.from(this.game.dotsSelectedIndexes);
        const destinationRectArea =
            dotsIndexesToMove.length * DOT_TARGET_MOVE_SPACE;

        const frontLength = distanceBetween(
            { x, y },
            this.destinationStartPoint,
        );

        const sideLength = destinationRectArea / frontLength;

        const destinationRaw = orthogonalRect(
            {
                x: this.destinationStartPoint.x,
                y: this.destinationStartPoint.y,
            },
            {
                x: this.destinationStartPoint.x + frontLength,
                y: this.destinationStartPoint.y + sideLength,
            },
        );

        const angle = Math.atan2(
            y - this.destinationStartPoint.y,
            x - this.destinationStartPoint.x,
        );

        this.destination = rotateRect({
            rect: destinationRaw,
            anchor: destinationRaw.p1,
            angle,
        });
    }

    markDotsInSelection() {
        if (!this.selection) {
            return;
        }

        for (const dot of this.game.dots) {
            if (isPointInRect(dot, this.selection)) {
                this.game.dotSelect(dot.index);
            }
        }
    }

    markDotsAll() {
        this.game.dotSelectAll();
    }

    cancelSelection() {
        this.selectionStartPoint = null;
        this.selection = null;
    }

    commandMove() {
        if (!this.destination) {
            return;
        }

        const dotsIndexesToMove = Array.from(this.game.dotsSelectedIndexes);

        const positions = dotsIndexesToMove.map(() =>
            randomPointInRect(this.destination!),
        );

        for (const [positionIndex, dotIndex] of dotsIndexesToMove.entries()) {
            const destination = positions[positionIndex];
            assert(!!destination, "destination must be valid");

            this.game.dotMoveTo(dotIndex, positions[positionIndex]);
        }
    }
}

interface Renderer {
    game: Game;
    ui: UI;
}

class RendererCanvasSimple implements Renderer {
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

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.game.dots.forEach(this.renderDot.bind(this));

        if (this.ui.selection) {
            this.renderSelection(this.ui.selection);
        }

        if (this.ui.destination) {
            this.renderDestination(this.ui.destination);
        }
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

    renderSelection(selection: Rect) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "yellowgreen";

        this.drawPolygon([
            selection.p1,
            selection.p2,
            selection.p3,
            selection.p4,
        ]);

        this.ctx.stroke();
    }

    renderDestination(destination: Rect) {
        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = "olive";

        this.drawPolygon([
            destination.p1,
            destination.p2,
            destination.p3,
            destination.p4,
        ]);

        this.ctx.stroke();
    }
}

const game = new Game();
game.init();

const ui = new UI(canvas, game);
ui.init();

const renderer = new RendererCanvasSimple(game, ui, canvas);

function assert(condition: boolean, message: string, details?: object) {
    if (condition) {
        return;
    }

    console.trace("Failed:", message, details);
    console.log(game);
    console.log(ui);
    console.log(renderer);
    throw new Error("Assertion failed");
}

let time = Date.now();
function renderLoop() {
    const timeNew = Date.now();
    const delta = timeNew - time;

    game.tick(delta);
    renderer.render();

    time = timeNew;
    requestAnimationFrame(renderLoop);
}

console.log(game, ui, renderer);

renderLoop();
