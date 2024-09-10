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
import { DOT_TARGET_MOVE_SPACE, DOT_WIDTH } from "./consts";
import type { Dot, Game, Slot, Squad } from "./game";

export type SquadFrame = { index: number; squad: Squad; frame: Rect };

export class UI {
    dotsSelected = new Set<Dot>();

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
                    this.handleRightButtonDown(e);
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

            isMouseDown = false;
            this.cancelSelection();
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

        this.game.addEventListener("squad-removed", ({ squad }) =>
            this.removeSquadFrameBySquad(squad),
        );

        this.createTestSquads();
    }

    createTestSquads() {
        for (const dot of this.game.dots) {
            if (dot.team.name === "red") {
                this.dotsSelected.add(dot);
            }
        }

        this.createSquad();

        this.startDestination(500, 100);
        this.adjustDestination(500, 600);
        this.commandMove();

        this.cancelSelection();
        this.clearDestination();
        this.dotsAllUnselect();
        this.squadFramesSelected.splice(0, this.squadFramesSelected.length);

        for (const dot of this.game.dots) {
            if (dot.team.name === "blue") {
                this.dotsSelected.add(dot);
            }
        }

        this.createSquad();

        this.startDestination(600, 600);
        this.adjustDestination(600, 100);
        this.commandMove();
    }

    dotSelect(dot: Dot) {
        this.dotsSelected.add(dot);
    }

    dotSelectAllWithoutSquad() {
        this.dotsSelected = new Set(this.game.dots);

        for (const squad of this.game.squads) {
            for (const slot of squad.slots) {
                if (slot.dot) {
                    this.dotsSelected.delete(slot.dot);
                }
            }
        }
    }

    dotUnselect(dot: Dot) {
        this.dotsSelected.delete(dot);
    }

    dotsAllUnselect() {
        this.dotsSelected.clear();
    }

    isDotSelected(dot: Dot) {
        return this.dotsSelected.has(dot);
    }

    removeSquadFrameBySquad(squad: Squad) {
        this.squadFrames.splice(
            this.squadFrames.findIndex((sf) => sf.squad === squad),
            1,
        );
    }

    handleRightButtonDown(e: MouseEvent) {
        this.destinationStartPoint = null;

        const squadFrameClicked = this.getSquadFrameByPosition(
            e.offsetX,
            e.offsetY,
        );

        const teamSelected = this.squadFramesSelected[0]?.squad.team;

        if (
            squadFrameClicked &&
            !this.squadFramesSelected.includes(squadFrameClicked) &&
            teamSelected !== squadFrameClicked.squad.team
        ) {
            return;
        }

        this.startDestination(e.offsetX, e.offsetY);
    }

    handleRightButtonUp(e: MouseEvent) {
        const squadFrameClicked = this.getSquadFrameByPosition(
            e.offsetX,
            e.offsetY,
        );

        const teamSelected = this.squadFramesSelected[0]?.squad.team;

        if (
            this.squadFramesSelected.length &&
            squadFrameClicked &&
            !this.squadFramesSelected.includes(squadFrameClicked) &&
            squadFrameClicked.squad.team !== teamSelected
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
        const dots = Array.from(this.dotsSelected);

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

        const team = dots[0].team;

        const squad = this.game.createSquad(slots, team);

        const squadFrame = { index: this.squadFrames.length, squad, frame };
        this.squadFrames.push(squadFrame);

        this.squadFramesSelected = [squadFrame];

        this.dotsAllUnselect();
    }

    destroySquad() {
        if (!this.squadFramesSelected.length) {
            return;
        }

        for (const squadFrame of this.squadFramesSelected) {
            this.game.removeSquad(squadFrame.squad);
            this.squadFramesSelected = [];
        }
    }

    fillSlotsMutate(slots: Slot[], dots: Dot[]) {
        for (const [index, slot] of slots.entries()) {
            if (index >= dots.length) {
                return;
            }

            this.game.assignDotToSlot(dots[index], slot);
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

        // Calculate the front direction angle from p1 to p2
        const frontAngle = Math.atan2(
            newFrame.p2.y - newFrame.p1.y,
            newFrame.p2.x - newFrame.p1.x,
        ) + Math.PI;

        // Update slot positions and angles based on the front direction of the frame
        oldSlots.forEach((slot, index) => {
            slot.position = newPositions[index];
            slot.angle = frontAngle; // Set the angle towards the front of the frame
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
                    this.game.assignDotToSlot(slot.dot, closestSlot);
                    slot.dot = null;
                }
            }
        });

        return squadFrame;
    }

    createSlots(rect: Rect, count: number) {
        const positions = this.createSlotPositions(rect, count);

        const angle = Math.atan2(rect.p3.y - rect.p2.y, rect.p3.x - rect.p2.x);

        return positions.map<Slot>((position) => ({
            position,
            dot: null,
            angle,
        }));
    }

    startSelection(x: number, y: number) {
        this.dotsAllUnselect();
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

        return this.dotsSelected.size;
    }

    startDestination(x: number, y: number) {
        this.destinationStartPoint = { x, y };
        const dotCountToMove = this.getDotCountForDestination();
        const targetRect = this.createSquadSquare(
            dotCountToMove,
            this.destinationStartPoint,
        );

        this.destination = targetRect;
        window.assert(
            Object.values(this.destination).every(
                (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
            ),
            "destination rect must be valid",
            {
                destination: this.destination,
                destinationStartPoint: this.destinationStartPoint,
                targetRect,
                dotCountToMove,
            },
        );
    }

    adjustDestination(x: number, y: number) {
        if (
            !this.destinationStartPoint ||
            (this.destinationStartPoint.x === x &&
                this.destinationStartPoint.y === y)
        ) {
            return;
        }

        const dotCountToMove = this.getDotCountForDestination();
        const destinationRectArea = dotCountToMove * DOT_TARGET_MOVE_SPACE;

        const frontLength = distanceBetween(
            { x, y },
            this.destinationStartPoint,
        );

        if (frontLength < DOT_WIDTH) {
            return;
        }

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
        window.assert(
            Object.values(this.destination).every(
                (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
            ),
            "destination rect must be valid",
            {
                destination: this.destination,
                destinationStartPoint: this.destinationStartPoint,
                destinationRaw,
                dotCountToMove,
            },
        );
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
                this.dotSelect(dot);
            }
        }
    }

    markDotsAll() {
        this.dotSelectAllWithoutSquad();
    }

    cancelSelection() {
        this.selectionStartPoint = null;
        this.selection = null;
    }

    clearDestination() {
        this.destination = null;
        this.destinationStartPoint = null;
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
            this.destination = null;
            return;
        }

        const dotIndexesToMove = Array.from(this.dotsSelected);
        this.commandMoveDots(dotIndexesToMove);
    }
}
