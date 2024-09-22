import {
    assertUnreachable,
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
import { GameEventTickName, type Game } from "../Game/Game";
import {
    CommandPanelUI,
    type CommandPanelCallbacks,
    type CommandPanelState,
} from "./CommandPanel";
import { isNonNull } from "remeda";
import { ViewPort } from "./ViewPort";
import type { Dot } from "../Game/DotsController";
import type { Squad, Slot } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import { createPolygonOffset } from "../shapes";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";

export type SquadFrame = { index: number; squad: Squad; frame: Rect };

export class UI {
    focusPoint: Point | null = null;

    viewPort: ViewPort;

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

    buildingPlacingGhost: Building | null = null;

    constructor(
        readonly element: HTMLElement,
        readonly game: Game,
        readonly isRunningRef: { current: boolean },
        readonly start: () => void,
        readonly pause: () => void,
    ) {
        this.commandPanelUI = new CommandPanelUI(this.initCommandPanelNode());
        this.viewPort = new ViewPort(
            element.clientWidth,
            element.clientHeight,
            Math.PI / 2,
            element.clientWidth / element.clientHeight,
            700,
            {
                x: 1500,
                y: 1400,
            },
        );
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

        node.addEventListener("mousemove", (e) => {
            e.stopPropagation();
        });
        node.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });
        node.addEventListener("mouseup", (e) => {
            e.stopPropagation();
        });
        node.addEventListener("wheel", (e) => {
            e.stopPropagation();
        });

        return node;
    }

    initGameEventListeners() {
        this.game.addEventListener(GameEventTickName.dotsRemoved, () =>
            this.renderCommandPanel(),
        );

        this.game.addEventListener(GameEventTickName.resourcesChanged, () =>
            this.renderCommandPanel(),
        );

        this.game.addEventListener(
            GameEventTickName.squadsRemoved,
            ({ squads }) => {
                for (const squad of squads) {
                    this.removeSquadFrameBySquad(squad);
                }
            },
        );
    }

    initUserEventListeners() {
        let isMouseDown = false;
        this.element.addEventListener("mousedown", (e) => {
            if (this.buildingPlacingGhost) {
                return;
            }

            isMouseDown = true;
            switch (e.button) {
                case 0:
                    this.startSelection(
                        this.viewPort.matrix.transformPointReverse({
                            x: e.offsetX,
                            y: e.offsetY,
                        }),
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
                    if (this.buildingPlacingGhost) {
                        this.game.buildings.addBuilding(
                            this.buildingPlacingGhost,
                        );
                        this.buildingPlacingGhost = null;
                        return;
                    }

                    this.trySelectSquadFrame(
                        this.viewPort.matrix.transformPointReverse({
                            x: e.offsetX,
                            y: e.offsetY,
                        }),
                        { deselectPrevious: !e.shiftKey },
                    );
                    this.trySelectDot(
                        this.viewPort.matrix.transformPointReverse({
                            x: e.offsetX,
                            y: e.offsetY,
                        }),
                    );
                    break;
                case 2:
                    if (this.buildingPlacingGhost) {
                        this.buildingPlacingGhost = null;
                        return;
                    }

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
                if (this.buildingPlacingGhost) {
                    this.buildingPlacingGhost.center =
                        this.viewPort.matrix.transformPointReverse({
                            x: e.offsetX,
                            y: e.offsetY,
                        });
                    this.buildingPlacingGhost.frame = createPolygonOffset(
                        this.buildingPlacingGhost.frameRelative,
                        this.buildingPlacingGhost.center,
                    );
                }
                return;
            }

            switch (e.buttons) {
                case 1:
                    this.extendSelection(
                        this.viewPort.matrix.transformPointReverse({
                            x: e.offsetX,
                            y: e.offsetY,
                        }),
                    );
                    break;
                case 2:
                    this.adjustDestination(
                        this.viewPort.matrix.transformPointReverse({
                            x: e.offsetX,
                            y: e.offsetY,
                        }),
                    );
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
        this.element.addEventListener("wheel", (e) =>
            this.zoom(e.deltaY, { x: e.offsetX, y: e.offsetY }),
        );

        window.addEventListener("keypress", this.handleKeypress.bind(this));
    }

    // chatgpt (c)
    zoom(delta: number, anchor: Point) {
        // Store the old view dimensions
        const oldViewWidth = this.viewPort.rect.right - this.viewPort.rect.left;
        const oldViewHeight = oldViewWidth / this.viewPort.aspectRatio;

        // Update the view elevation (zoom level) using the addElevation method
        this.viewPort.addElevation(delta); // Ensures viewElevation doesn't go below 100

        // Calculate the new view dimensions
        const newViewWidth = this.viewPort.rect.right - this.viewPort.rect.left;
        const newViewHeight = newViewWidth / this.viewPort.aspectRatio;

        // Compute the change in offset to keep the anchor point fixed
        const deltaOffsetX =
            (newViewWidth - oldViewWidth) *
            (0.5 - anchor.x / this.viewPort.canvasWidth);
        const deltaOffsetY =
            (newViewHeight - oldViewHeight) *
            (0.5 - anchor.y / this.viewPort.canvasHeight);

        // Update the viewport offset using the translate method
        this.viewPort.translate(deltaOffsetX, deltaOffsetY);
    }

    createTestSquads() {
        for (const dot of this.game.dotsController.dots) {
            if (dot.team.name === "red") {
                this.dotsSelected.add(dot);
            }
        }

        this.createSquad();

        this.startDestination({ x: 1500, y: 1100 });
        this.adjustDestination({ x: 1500, y: 1600 });
        this.commandMove();

        this.cancelSelection();
        this.clearDestination();
        this.dotsAllUnselect();
        this.squadFramesSelected.splice(0, this.squadFramesSelected.length);

        for (const dot of this.game.dotsController.dots) {
            if (dot.team.name === "blue") {
                this.dotsSelected.add(dot);
            }
        }

        this.createSquad();

        this.startDestination({ x: 1600, y: 1600 });
        this.adjustDestination({ x: 1600, y: 1100 });
        this.commandMove();

        this.cancelSelection();
        this.squadFramesSelected.splice(0, this.squadFramesSelected.length);
        this.selectSquadFrame(this.squadFrames[0]);
    }

    dotSelect(dot: Dot) {
        this.dotsSelected.add(dot);

        this.selectTeam(dot.team);
    }

    dotSelectAllWithoutSquad() {
        this.dotsSelected = new Set(this.game.dotsController.dots);

        for (const squad of this.game.squadsController.squads) {
            for (const slot of squad.slots) {
                if (slot.dot) {
                    this.dotsSelected.delete(slot.dot);
                }
            }
        }
    }

    createCommandPanelState(): CommandPanelState {
        const team =
            (this.squadFramesSelected[0]?.squad as Squad | undefined)?.team ||
            (this.dotsSelected.values().next()?.value as Dot | undefined)
                ?.team ||
            null;

        const teamToState = team
            ? this.game.resourcesController.teamToState.get(team)
            : null;

        return {
            team,
            squads: this.squadFramesSelected.map((sf) => sf.squad),
            resources: teamToState
                ? {
                      food: teamToState.food,
                      foodCapacity: teamToState.foodCapacity,
                      housing: teamToState.housing,
                      wood: teamToState.wood,
                      woodCapacity: teamToState.woodCapacity,
                  }
                : null,
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
                    squad.dotsToShootOnce.forEach(
                        (dot) => (dot.allowAttack = true),
                    );
                } else {
                    squad.dotsToShootOnce.clear();
                }
            }

            this.renderCommandPanel();
        },
        selectBuilding: (buildingKind: BuildingKind) => {
            if (!this.currentTeam) {
                return;
            }

            this.buildingPlacingGhost = {
                ...BUILDINGS_CONFIGS[buildingKind],
                kind: buildingKind,
                team: this.currentTeam,
                frame: BUILDINGS_CONFIGS.barracks.frameRelative,
                center: { x: 0, y: 0 },
            } as Building;
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
            this.viewPort.matrix.transformPointReverse({
                x: e.offsetX,
                y: e.offsetY,
            }),
        );

        const teamSelected = this.squadFramesSelected[0]?.squad.team;

        if (
            squadFrameClicked &&
            !this.squadFramesSelected.includes(squadFrameClicked) &&
            teamSelected !== squadFrameClicked.squad.team
        ) {
            return;
        }

        this.startDestination(
            this.viewPort.matrix.transformPointReverse({
                x: e.offsetX,
                y: e.offsetY,
            }),
        );
    }

    handleRightButtonUp(e: MouseEvent) {
        const squadFrameClicked = this.getSquadFrameByPosition(
            this.viewPort.matrix.transformPointReverse({
                x: e.offsetX,
                y: e.offsetY,
            }),
        );

        const teamSelected = this.squadFramesSelected[0]?.squad.team;

        if (
            this.squadFramesSelected.length &&
            squadFrameClicked &&
            !this.squadFramesSelected.includes(squadFrameClicked) &&
            squadFrameClicked.squad.team !== teamSelected
        ) {
            if (!e.shiftKey) {
                for (const squadFrame of this.squadFramesSelected) {
                    this.cancelAttackAll(squadFrame);
                }
            }

            this.attackSquadSelected(squadFrameClicked);
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

            case "KeyA": {
                for (const squadFrame of this.squadFramesSelected) {
                    squadFrame.squad.allowAttack =
                        !squadFrame.squad.allowAttack;
                }
                break;
            }
        }
    }

    cancelAttackAll(squadFrame: SquadFrame) {
        this.game.cancelAttackSquadAll(squadFrame.squad);

        this.renderCommandPanel();
    }

    cancelAttackSelected() {
        this.squadFramesSelected.forEach(this.cancelAttackAll.bind(this));

        this.renderCommandPanel();
    }

    attackSquadSelected(squadFrameTarget: SquadFrame) {
        for (const squadFrame of this.squadFramesSelected) {
            this.game.attackSquad({
                squadAttacker: squadFrame.squad,
                squadTarget: squadFrameTarget.squad,
            });
        }

        this.renderCommandPanel();
    }

    getSquadFrameByPosition({ x, y }: Point): SquadFrame | null {
        for (const squadFrame of this.squadFrames) {
            if (isPointInRect({ x, y }, squadFrame.frame)) {
                return squadFrame;
            }
        }

        return null;
    }

    getDotByPosition(x: number, y: number): Dot | null {
        const point = { x, y };
        for (const dot of this.game.dotsController.dots) {
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

        const squadFrameClicked = this.getSquadFrameByPosition({ x, y });

        if (squadFrameClicked) {
            this.selectSquadFrame(squadFrameClicked);
            return { selected: true };
        }

        return { selected: false };
    }

    trySelectDot({ x, y }: Point) {
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

        const squad = this.game.squadsController.createSquad(slots, team);

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
            this.game.squadsController.removeSquad(squadFrame.squad);
            this.removeSquadFrameBySquad(squadFrame.squad);
        }

        this.deselectSquadFramesAll();
    }

    fillSlotsMutate(slots: Slot[], dots: Dot[]) {
        for (const [index, slot] of slots.entries()) {
            if (index >= dots.length) {
                return;
            }

            this.game.squadsController.assignDotToSlot(dots[index], slot);
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
                    this.game.squadsController.assignDotToSlot(
                        slot.dot,
                        closestSlot,
                    );
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

    extendSelection({ x, y }: Point) {
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

    startDestination({ x, y }: Point) {
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
    adjustDestination({ x, y }: Point) {
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

        for (const dot of this.game.dotsController.dots) {
            if (
                isPointInRect(dot.position, this.selection) &&
                !this.game.squadsController.isInSquad(dot)
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
