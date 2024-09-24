import {
    distanceBetween,
    isPointInPolygon,
    isPointInRect,
    orthogonalRect,
    randomPointInRect,
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
    type CommandPanelLog,
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

    logs: CommandPanelLog[] = [];

    constructor(
        readonly element: HTMLElement,
        private readonly game: Game,
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
                        const success = this.game.tryBuild(
                            this.buildingPlacingGhost,
                        );
                        this.buildingPlacingGhost = null;

                        if (!success) {
                            this.addLog("Building can't be placed");
                        }

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

    addLog(content: string) {
        this.logs.push({
            timestamp: new Date(),
            content,
        });
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
                      coins: teamToState.coins,
                  }
                : null,
            logs: this.logs,
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
        const index = this.squadFrames.findIndex((sf) => sf.squad === squad);

        if (index === -1) {
            return;
        }

        this.squadFrames.splice(index, 1);
    }

    handleRightButtonDown(e: MouseEvent) {
        this.destinationStartPoint = null;

        const clickPoint = this.viewPort.matrix.transformPointReverse({
            x: e.offsetX,
            y: e.offsetY,
        });
        const squadFrameClicked = this.getSquadFrameByPosition(clickPoint);

        const teamSelected = this.squadFramesSelected[0]?.squad.team;

        if (
            squadFrameClicked &&
            !this.squadFramesSelected.includes(squadFrameClicked) &&
            teamSelected !== squadFrameClicked.squad.team
        ) {
            return;
        }

        const building = this.getBuildingByPosition(clickPoint);

        if (building && building.team !== this.currentTeam) {
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
        const clickPoint = this.viewPort.matrix.transformPointReverse({
            x: e.offsetX,
            y: e.offsetY,
        });
        const squadFrameClicked = this.getSquadFrameByPosition(clickPoint);

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
            return;
        }

        const building = this.getBuildingByPosition(clickPoint);

        if (building && building.team !== this.currentTeam) {
            this.attackBuildingBySquadSelected(building);
            return;
        }

        this.commandMove();
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

    attackBuildingBySquadSelected(buildingTarget: Building) {
        for (const squadFrame of this.squadFramesSelected) {
            this.game.attackBuilding({
                squadAttacker: squadFrame.squad,
                buildingTarget,
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

    getBuildingByPosition({ x, y }: Point): Building | null {
        const point = { x, y };
        for (const building of this.game.buildingsController.buildings) {
            if (isPointInPolygon(point, building.frame)) {
                return building;
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
        const slots = this.game.squadsController.createSlots(
            frame,
            dots.length,
        );

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

    commandMoveSquads(squadFrames: SquadFrame[], targetFrame: Rect) {
        const squadRects =
            this.game.squadsController.generateAndUpdateSlotsAfterMove(
                squadFrames.map((sf) => sf.squad),
                targetFrame,
            ) as Array<Rect | undefined>;

        squadFrames.forEach((sf, i) => {
            if (!squadRects[i]) return;
            sf.frame = squadRects[i];
        });
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
