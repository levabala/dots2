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
} from "../utils";
import {
    DOT_TARGET_MOVE_SPACE,
    DOT_WIDTH,
    BETWEEN_SQUADS_GAP,
} from "../consts";
import type { Dot, Game, Slot, Squad, Team } from "../Game";
import {
    CommandPanelUI,
    type CommandPanelCallbacks,
    type CommandPanelState,
} from "./CommandPanel";
import { isNonNull } from "remeda";

export type SquadFrame = { index: number; squad: Squad; frame: Rect };

export class UI {
    dotsSelected = new Set<Dot>();

    selectionStartPoint: Point | null = null;
    selection: Rect | null = null;

    destinationStartPoint: Point | null = null;
    destination: Rect | null = null;

    squadFrames: SquadFrame[] = [];
    squadFramesSelected: SquadFrame[] = [];

    squadFramesAllowAttackOnce: SquadFrame[] = [];

    commandPanelUI: CommandPanelUI;

    currentTeam: Team | null = null;

    constructor(
        readonly element: HTMLElement,
        readonly game: Game,
        readonly isRunningRef: { current: boolean },
        readonly start: () => void,
        readonly pause: () => void,
    ) {
        this.commandPanelUI = new CommandPanelUI(this.initCommandPanelNode());
    }

    init() {
        this.initUserEventListeners();
        this.initGameEventListeners();

        this.createTestSquads();

        this.renderCommandPanel();
    }

    initCommandPanelNode() {
        const node = document.createElement("div");
        node.style.position = "absolute";
        node.style.bottom = "0";
        node.style.left = "0";
        node.style.right = "0";
        node.style.height = "150px";

        this.element.appendChild(node);

        node.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });
        node.addEventListener("mouseup", (e) => {
            e.stopPropagation();
        });

        return node;
    }

    initGameEventListeners() {
        this.game.addEventListener("dot-removed", () =>
            this.renderCommandPanel(),
        );

        this.game.addEventListener("squad-removed", ({ squad }) =>
            this.removeSquadFrameBySquad(squad),
        );
    }

    initUserEventListeners() {
        let isMouseDown = false;
        this.element.addEventListener("mousedown", (e) => {
            isMouseDown = true;
            switch (e.button) {
                case 0:
                    this.startSelection(
                        { x: e.offsetX, y: e.offsetY },
                        { deselectPrevious: !e.shiftKey },
                    );
                    break;
                case 2:
                    this.handleRightButtonDown(e);
                    break;
            }
        });
        this.element.addEventListener("mouseup", (e) => {
            switch (e.button) {
                case 0:
                    this.trySelectSquadFrame(
                        { x: e.offsetX, y: e.offsetY },
                        { deselectPrevious: !e.shiftKey },
                    );
                    this.trySelectDot(e.offsetX, e.offsetY);
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

        // TODO: debug shooting to one's own team by adding dot click-to-console-log

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

        this.selectTeam(dot.team);
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

    createCommandPanelState(): CommandPanelState {
        return {
            team:
                (this.squadFramesSelected[0]?.squad as Squad | undefined)
                    ?.team ||
                (this.dotsSelected.values().next()?.value as Dot | undefined)
                    ?.team ||
                null,
            squads: this.squadFramesSelected.map((sf) => sf.squad),
        };
    }

    commandPanelCallbacks: CommandPanelCallbacks = {
        changeAllowAttack: (squads, allowAttack) => {
            for (const squad of squads) {
                squad.allowAttack = allowAttack;
            }

            this.renderCommandPanel();
        },
        changeAllowAttackOnce: (squads, allowAttackOnce) => {
            for (const squad of squads) {
                squad.allowShootOnce = allowAttackOnce;

                if (allowAttackOnce) {
                    squad.dotsToShootOnce = new Set(
                        squad.slots.map((slot) => slot.dot).filter(isNonNull),
                    );
                } else {
                    squad.dotsToShootOnce.clear();
                }
            }

            this.renderCommandPanel();
        },
    };

    renderCommandPanel() {
        this.commandPanelUI.render(
            this.createCommandPanelState(),
            this.commandPanelCallbacks,
        );
    }

    selectTeam(team: Team) {
        this.currentTeam = team;
        this.renderCommandPanel();
    }

    deselectTeam() {
        this.currentTeam = null;
        this.renderCommandPanel();
    }

    dotUnselect(dot: Dot) {
        this.dotsSelected.delete(dot);

        if (this.dotsSelected.size === 0) {
            this.deselectTeam();
        }
    }

    dotsAllUnselect() {
        this.dotsSelected.clear();

        if (this.dotsSelected.size === 0) {
            this.deselectTeam();
        }
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
            case "KeyP": {
                if (this.isRunningRef.current) {
                    this.pause();
                } else {
                    this.start();
                }
                break;
            }

            case "KeyS": {
                this.createSquad();
                break;
            }

            case "KeyD": {
                this.destroySquad();
                break;
            }

            case "KeyC": {
                this.cancelAttackSelected();
                break;
            }
        }
    }

    cancelAttack(squadFrame: SquadFrame) {
        this.game.cancelAttackSquad(squadFrame.squad);

        this.renderCommandPanel();
    }

    cancelAttackSelected() {
        this.squadFramesSelected.forEach(this.cancelAttack.bind(this));

        this.renderCommandPanel();
    }

    attackSquad(squadFrameTarget: SquadFrame) {
        for (const squadFrame of this.squadFramesSelected) {
            this.game.attackSquad({
                squadAttacker: squadFrame.squad,
                squadTarget: squadFrameTarget.squad,
            });
        }

        this.renderCommandPanel();
    }

    getSquadFrameByPosition(x: number, y: number): SquadFrame | null {
        for (const squadFrame of this.squadFrames) {
            if (isPointInRect({ x, y }, squadFrame.frame)) {
                return squadFrame;
            }
        }

        return null;
    }

    getDotByPosition(x: number, y: number): Dot | null {
        const point = { x, y };
        for (const dot of this.game.dots) {
            if (isPointInRect(point, dot.hitBox)) {
                return dot;
            }
        }

        return null;
    }

    selectSquadFrame(squadFrame: SquadFrame) {
        this.squadFramesSelected.push(squadFrame);

        this.selectTeam(squadFrame.squad.team);
    }

    deselectSquadFrame(squadFrame: SquadFrame) {
        this.squadFramesSelected.splice(
            this.squadFramesSelected.indexOf(squadFrame),
            1,
        );

        if (this.squadFramesSelected.length) {
            this.selectTeam(this.squadFramesSelected[0].squad.team);
        } else {
            this.deselectTeam();
        }
    }

    deselectSquadFramesAll() {
        this.squadFramesSelected = [];
        this.deselectTeam();
    }

    trySelectSquadFrame(
        { x, y }: Point,
        { deselectPrevious }: { deselectPrevious: boolean },
    ) {
        if (deselectPrevious) {
            this.deselectSquadFramesAll();
        }

        const squadFrameClicked = this.getSquadFrameByPosition(x, y);

        if (squadFrameClicked) {
            this.selectSquadFrame(squadFrameClicked);
            return { selected: true };
        }

        return { selected: false };
    }

    trySelectDot(x: number, y: number) {
        const dotClicked = this.getDotByPosition(x, y);

        if (dotClicked) {
            this.dotSelect(dotClicked);
            return { selected: true };
        }

        return { selected: false };
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
        }

        this.deselectSquadFramesAll();
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
        const frontAngle =
            Math.atan2(
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

    startSelection(
        { x, y }: Point,
        { deselectPrevious }: { deselectPrevious: boolean },
    ) {
        if (deselectPrevious) {
            this.dotsAllUnselect();
            this.squadFramesSelected = [];
        }

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

    // chatgpt (c)
    adjustDestination(x: number, y: number) {
        if (
            !this.destinationStartPoint ||
            (this.destinationStartPoint.x === x &&
                this.destinationStartPoint.y === y)
        ) {
            return;
        }

        const totalDotsToMove = this.squadFramesSelected.reduce(
            (sum, squadFrame) => sum + squadFrame.squad.slots.length,
            0,
        );

        const totalGapsLength =
            BETWEEN_SQUADS_GAP * (this.squadFramesSelected.length - 1);

        const frontLength = distanceBetween(
            { x, y },
            this.destinationStartPoint,
        );

        if (frontLength < DOT_WIDTH + totalGapsLength) {
            return;
        }

        const availableFrontLength = frontLength - totalGapsLength;
        const totalAreaNeeded = totalDotsToMove * DOT_TARGET_MOVE_SPACE;
        const sideLength = totalAreaNeeded / availableFrontLength;

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
                totalDotsToMove,
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

    // chatgpt (c)
    commandMoveSquads(squadFrames: SquadFrame[], targetFrame: Rect) {
        const N = squadFrames.length;
        if (N === 0) return;

        const totalLength = distanceBetween(targetFrame.p1, targetFrame.p2);
        const sideLength = distanceBetween(targetFrame.p1, targetFrame.p4);
        const density = DOT_TARGET_MOVE_SPACE; // Area per unit

        const frontDirection = {
            x: (targetFrame.p2.x - targetFrame.p1.x) / totalLength,
            y: (targetFrame.p2.y - targetFrame.p1.y) / totalLength,
        };

        const sideDirection = {
            x: targetFrame.p4.x - targetFrame.p1.x,
            y: targetFrame.p4.y - targetFrame.p1.y,
        };

        let currentOffset = 0;
        for (const squadFrame of squadFrames) {
            const squadUnits = squadFrame.squad.slots.length;

            const squadArea = squadUnits * density;
            const squadLength = squadArea / sideLength;

            const start = {
                x: targetFrame.p1.x + frontDirection.x * currentOffset,
                y: targetFrame.p1.y + frontDirection.y * currentOffset,
            };
            const end = {
                x: start.x + frontDirection.x * squadLength,
                y: start.y + frontDirection.y * squadLength,
            };

            const squadRect: Rect = {
                p1: start,
                p2: end,
                p3: {
                    x: end.x + sideDirection.x,
                    y: end.y + sideDirection.y,
                },
                p4: {
                    x: start.x + sideDirection.x,
                    y: start.y + sideDirection.y,
                },
            };

            this.updateSlotPositionsAndReassignDots(squadFrame, squadRect);
            squadFrame.frame = squadRect;

            currentOffset += squadLength + BETWEEN_SQUADS_GAP;
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
