import {
    distanceBetween,
    isPointInRect,
    orthogonalRect,
    randomPointInRect,
    rotatePoint,
    rotateRect,
    sortRectPoints,
    type Point,
    type Rect,
} from "./utils";
import { DOT_TARGET_MOVE_SPACE } from "./consts";
import type { Game, Slot, Squad } from "./game";

export type SquadFrame = { squad: Squad; frame: Rect };

export class UI {
    selectionStartPoint: Point | null = null;
    selection: Rect | null = null;

    destinationStartPoint: Point | null = null;
    destination: Rect | null = null;

    squadFrames: SquadFrame[] = [];
    squadFrameSelected: SquadFrame | null = null;

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
                    this.startDestination(e.offsetX, e.offsetY);
                    break;
            }
        });
        this.element.addEventListener("mouseup", (e) => {
            switch (e.button) {
                case 0:
                    this.trySelectSquadFrame(e.offsetX, e.offsetY);
                    break;
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
        this.element.addEventListener("dblclick", this.markDotsAll.bind(this));
        window.addEventListener("keypress", this.handleKeypress.bind(this));
    }

    handleKeypress(e: KeyboardEvent) {
        console.log(e);
        switch (e.code) {
            case "KeyS": {
                this.createSquad();
                break;
            }

            case "KeyD": {
                this.destroySquad();
                break;
            }
        }
    }

    trySelectSquadFrame(x: number, y: number) {
        this.squadFrameSelected = null;

        for (const squadFrame of this.squadFrames) {
            if (isPointInRect({ x, y }, squadFrame.frame)) {
                this.squadFrameSelected = squadFrame;
                return;
            }
        }
    }

    createSquad() {
        const dotIndexes = Array.from(this.game.dotsSelectedIndexes);
        const sumX = dotIndexes.reduce(
            (acc, dotIndex) => acc + this.game.dots[dotIndex].x,
            0,
        );
        const sumY = dotIndexes.reduce(
            (acc, dotIndex) => acc + this.game.dots[dotIndex].y,
            0,
        );
        const center = {
            x: sumX / dotIndexes.length,
            y: sumY / dotIndexes.length,
        };

        const frame = this.createSquadSquare(dotIndexes.length, center);
        const slots = this.createSlots(frame, dotIndexes.length);

        this.fillSlotsMutate(slots, dotIndexes);

        const squad = this.game.createSquad(slots);

        const squadFrame = { squad, frame };
        this.squadFrames.push(squadFrame);

        this.squadFrameSelected = squadFrame;
    }

    destroySquad() {
        if (!this.squadFrameSelected) {
            return;
        }

        this.game.removeSquad(this.squadFrameSelected.squad);
        this.squadFrames.splice(this.squadFrames.indexOf(this.squadFrameSelected));
        this.squadFrameSelected = null;
    }

    fillSlotsMutate(slots: Slot[], dotIndexes: number[]) {
        for (const [index, slot] of slots.entries()) {
            if (index >= dotIndexes.length) {
                return;
            }

            slot.dotIndex = dotIndexes[index];
        }
    }

    createSlotPositions(rect: Rect, count: number) {
        const angle = Math.atan2(rect.p2.y - rect.p1.y, rect.p2.x - rect.p1.x);
        const rectOrth = rotateRect({ rect, anchor: rect.p1, angle: -angle });
        const lengthFront = rectOrth.p2.x - rectOrth.p1.x;
        const lengthSide = rectOrth.p4.y - rectOrth.p1.y;
        const columns = Math.ceil(
            Math.sqrt((count * lengthFront) / lengthSide),
        );
        const rows = Math.ceil(Math.sqrt((count * lengthSide) / lengthFront));

        const positions: Point[] = [];
        let countLeft = count;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                if (countLeft-- <= 0) {
                    break;
                }

                const pointOrth = {
                    x: rectOrth.p1.x + (lengthFront * c) / (columns - 1 || 1),
                    y: rectOrth.p1.y + (lengthSide * r) / (rows - 1 || 1),
                };
                positions.push(rotatePoint(pointOrth, rectOrth.p1, angle));
            }
        }

        return positions;
    }

    createSlots(rect: Rect, count: number) {
        const positions = this.createSlotPositions(rect, count);

        return positions.map<Slot>((position) => ({
            position,
            dotIndex: null,
        }));
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

    calcDotsSquadArea(dotsCount: number) {
        return dotsCount * DOT_TARGET_MOVE_SPACE;
    }

    createSquadSquare(dotsCount: number, center: Point) {
        const targetRectArea = this.calcDotsSquadArea(dotsCount);
        const sideLength = Math.ceil(Math.sqrt(targetRectArea));
        const targetRect = orthogonalRect(
            {
                x: center.x - sideLength / 2,
                y: center.y - sideLength / 2,
            },
            {
                x: center.x + sideLength / 2,
                y: center.y + sideLength / 2,
            },
        );

        return targetRect;
    }

    getDotCountForDestination() {
        if (this.squadFrameSelected) {
            return this.squadFrameSelected.squad.slots.reduce(
                (acc, slot) => acc + (slot.dotIndex !== null ? 1 : 0),
                0,
            );
        }

        return this.game.dotsSelectedIndexes.size;
    }

    startDestination(x: number, y: number) {
        this.destinationStartPoint = { x, y };
        const dotCountToMove = this.getDotCountForDestination();
        const targetRect = this.createSquadSquare(
            dotCountToMove,
            this.destinationStartPoint,
        );

        this.destination = targetRect;
    }

    adjustDestination(x: number, y: number) {
        if (!this.destinationStartPoint) {
            return;
        }

        const dotCountToMove = this.getDotCountForDestination();
        const destinationRectArea = dotCountToMove * DOT_TARGET_MOVE_SPACE;

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
            if (
                isPointInRect(dot, this.selection) &&
                !this.game.isInSquad(dot.index)
            ) {
                this.game.dotSelect(dot.index);
            }
        }
    }

    markDotsAll() {
        this.game.dotSelectAllWithoutSquad();
    }

    cancelSelection() {
        this.selectionStartPoint = null;
        this.selection = null;
    }

    commandMoveDots(dotIndexes: number[]) {
        const positions = dotIndexes.map(() =>
            randomPointInRect(this.destination!),
        );

        for (const [positionIndex, dotIndex] of dotIndexes.entries()) {
            const destination = positions[positionIndex];
            window.assert(!!destination, "destination must be valid");

            this.game.dotMoveTo(dotIndex, positions[positionIndex]);
        }
    }

    commandMoveSquad(squadFrame: SquadFrame, targetFrame: Rect) {
        const positionsNew = this.createSlotPositions(
            targetFrame,
            squadFrame.squad.slots.length,
        );

        for (const [index, slot] of squadFrame.squad.slots.entries()) {
            slot.position = positionsNew[index];
        }

        squadFrame.frame = targetFrame;
    }

    commandMove() {
        if (!this.destination) {
            return;
        }

        if (this.squadFrameSelected) {
            this.commandMoveSquad(this.squadFrameSelected, this.destination);
            return;
        }

        const dotIndexesToMove = Array.from(this.game.dotsSelectedIndexes);
        this.commandMoveDots(dotIndexesToMove);
    }
}
