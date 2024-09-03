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
import type { Dot, Game, Slot, Squad } from "./game";

export type SquadFrame = { index: number; squad: Squad; frame: Rect };

export class UI {
    selectionStartPoint: Point | null = null;
    selection: Rect | null = null;

    destinationStartPoint: Point | null = null;
    destination: Rect | null = null;

    squadFrames: SquadFrame[] = [];
    squadFramesSelected: SquadFrame[] = [];

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
                    this.handleRightButtonUp(e);
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

    handleRightButtonUp(e: MouseEvent) {
        const squadFrameClicked = this.getSquadFrameByPosition(
            e.offsetX,
            e.offsetY,
        );

        if (
            this.squadFramesSelected.length &&
            squadFrameClicked &&
            !this.squadFramesSelected.includes(squadFrameClicked)
        ) {
            this.attackSquad(squadFrameClicked);
        } else {
            this.commandMove();
        }
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

    attackSquad(squadFrameTarget: SquadFrame) {
        for (const squadFrame of this.squadFramesSelected) {
            this.game.attackSquad({
                squadAttacker: squadFrame.squad,
                squadTarget: squadFrameTarget.squad,
            });
        }
    }

    getSquadFrameByPosition(x: number, y: number): SquadFrame | null {
        for (const squadFrame of this.squadFrames) {
            if (isPointInRect({ x, y }, squadFrame.frame)) {
                return squadFrame;
            }
        }

        return null;
    }

    trySelectSquadFrame(x: number, y: number) {
        this.squadFramesSelected = [];

        const squadFrameClicked = this.getSquadFrameByPosition(x, y);

        if (squadFrameClicked) {
            this.squadFramesSelected.push(squadFrameClicked);
        }
    }

    createSquad() {
        const dots = Array.from(this.game.dotsSelected);

        if (!dots.length) {
            return;
        }

        const sumX = dots.reduce((acc, dot) => acc + dot.position.x, 0);
        const sumY = dots.reduce((acc, dot) => acc + dot.position.y, 0);
        const center = {
            x: sumX / dots.length,
            y: sumY / dots.length,
        };

        const frame = this.createSquadSquare(dots.length, center);
        const slots = this.createSlots(frame, dots.length);

        this.fillSlotsMutate(slots, dots);

        const squad = this.game.createSquad(slots);

        const squadFrame = { index: this.squadFrames.length, squad, frame };
        this.squadFrames.push(squadFrame);

        this.squadFramesSelected = [squadFrame];

        this.game.dotsSelected.clear();
    }

    destroySquad() {
        if (!this.squadFramesSelected.length) {
            return;
        }

        for (const squadFrame of this.squadFramesSelected) {
            this.game.removeSquad(squadFrame.squad);
            this.squadFrames.splice(this.squadFrames.indexOf(squadFrame), 1);
            this.squadFramesSelected = [];
        }
    }

    fillSlotsMutate(slots: Slot[], dots: Dot[]) {
        for (const [index, slot] of slots.entries()) {
            if (index >= dots.length) {
                return;
            }

            slot.dot = dots[index];
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

    // chatgpt (c)
    updateSlotPositionsAndReassignDots(squadFrame: SquadFrame, newFrame: Rect) {
        const oldSlots = squadFrame.squad.slots;
        const newPositions = this.createSlotPositions(
            newFrame,
            oldSlots.length,
        );

        // Update slot positions and preserve order
        oldSlots.forEach((slot, index) => {
            slot.position = newPositions[index];
        });

        // Reassign dots to maintain minimal position change
        oldSlots.forEach((slot) => {
            if (slot.dot) {
                let minDistance = Infinity;
                let closestSlot = slot;

                oldSlots.forEach((targetSlot) => {
                    const distance = distanceBetween(
                        slot.position,
                        targetSlot.position,
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestSlot = targetSlot;
                    }
                });

                if (closestSlot !== slot) {
                    closestSlot.dot = slot.dot;
                    slot.dot.slot = closestSlot;
                    slot.dot = null;
                }
            }
        });

        return squadFrame;
    }

    createSlots(rect: Rect, count: number) {
        const positions = this.createSlotPositions(rect, count);

        return positions.map<Slot>((position) => ({
            position,
            dot: null,
        }));
    }

    startSelection(x: number, y: number) {
        this.game.dotsAllUnselect();
        this.squadFramesSelected = [];

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
        if (this.squadFramesSelected.length) {
            let count = 0;
            for (const squadFrame of this.squadFramesSelected) {
                count += squadFrame.squad.slots.length;
            }

            return count;
        }

        return this.game.dotsSelected.size;
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
                isPointInRect(dot.position, this.selection) &&
                !this.game.isInSquad(dot)
            ) {
                this.game.dotSelect(dot);
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

    commandMoveDots(dots: Dot[]) {
        const positions = dots.map(() => randomPointInRect(this.destination!));

        for (const [positionIndex, dot] of dots.entries()) {
            this.game.dotMoveTo(dot, positions[positionIndex]);
        }
    }

    commandMoveSquads(squadFrames: SquadFrame[], targetFrame: Rect) {
        for (const squadFrame of squadFrames) {
            this.updateSlotPositionsAndReassignDots(squadFrame, targetFrame);
            squadFrame.frame = targetFrame;
        }
    }

    commandMove() {
        if (!this.destination) {
            return;
        }

        if (this.squadFramesSelected.length) {
            this.commandMoveSquads(this.squadFramesSelected, this.destination);
            return;
        }

        const dotIndexesToMove = Array.from(this.game.dotsSelected);
        this.commandMoveDots(dotIndexesToMove);
    }
}
