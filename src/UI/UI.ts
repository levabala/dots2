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
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import type { Building, BuildingKind } from "../Game/BuildingsController";
import { createPolygonOffset } from "../shapes";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";

export class UI {
    focusPoint: Point | null = null;

    viewPort: ViewPort;

    dotsSelected = new Set<Dot>();

    selectionStartPoint: Point | null = null;
    selection: Rect | null = null;

    destinationStartPoint: Point | null = null;
    destination: Rect | null = null;

    squadsSelected: Squad[] = [];

    squadsAllowAttackOnce: Squad[] = [];

    commandPanelUI: CommandPanelUI;

    currentTeam: Team | null = null;

    buildingPlacingGhost: Building | null = null;
    buildingsSelected: Set<Building> = new Set();

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
            GameEventTickName.buildingsAdded,
            ({ buildings }) => {
                for (const building of buildings) {
                    this.addLog(
                        `Built "${building.kind}" by ${building.team.name}`,
                    );
                }

                this.renderCommandPanel();
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
            const pointTransformed = this.viewPort.matrix.transformPointReverse(
                {
                    x: e.offsetX,
                    y: e.offsetY,
                },
            );

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

                    this.trySelectSquadFrame(pointTransformed, {
                        deselectPrevious: !e.shiftKey,
                    });
                    this.trySelectDot(pointTransformed);
                    this.trySelectBuilding(pointTransformed);
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
        this.dotsSelected = new Set(this.game.getDots());

        for (const squad of this.game.getSquads()) {
            for (const slot of squad.slots) {
                if (slot.dot) {
                    this.dotsSelected.delete(slot.dot);
                }
            }
        }
    }

    createCommandPanelState(): CommandPanelState {
        const team =
            (this.squadsSelected[0] as Squad | undefined)?.team ||
            (this.dotsSelected.values().next()?.value as Dot | undefined)
                ?.team ||
            (
                this.buildingsSelected.values().next()?.value as
                    | Building
                    | undefined
            )?.team ||
            null;

        const teamToState = team
            ? this.game.getTeamToResources().get(team)
            : null;

        return {
            team,
            squads: this.squadsSelected,
            resources: teamToState
                ? {
                      food: teamToState.food,
                      foodCapacity: teamToState.foodCapacity,
                      housing: teamToState.housing,
                      housingCapacity: teamToState.housingCapacity,
                      wood: teamToState.wood,
                      woodCapacity: teamToState.woodCapacity,
                      coins: teamToState.coins,
                      coinsCapacity: teamToState.coinsCapacity,
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

    handleRightButtonDown(e: MouseEvent) {
        this.destinationStartPoint = null;

        const clickPoint = this.viewPort.matrix.transformPointReverse({
            x: e.offsetX,
            y: e.offsetY,
        });
        const squadClicked = this.getSquadByPosition(clickPoint);

        const teamSelected = this.squadsSelected[0]?.team;

        if (
            squadClicked &&
            !this.squadsSelected.includes(squadClicked) &&
            teamSelected !== squadClicked.team
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
        const squadClicked = this.getSquadByPosition(clickPoint);

        const teamSelected = this.squadsSelected[0]?.team;

        if (
            this.squadsSelected.length &&
            squadClicked &&
            !this.squadsSelected.includes(squadClicked) &&
            squadClicked.team !== teamSelected
        ) {
            if (!e.shiftKey) {
                for (const squad of this.squadsSelected) {
                    this.cancelAttackAll(squad);
                }
            }

            this.attackSquadSelected(squadClicked);
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
                for (const squad of this.squadsSelected) {
                    squad.allowAttack = !squad.allowAttack;
                }
                break;
            }
        }
    }

    cancelAttackAll(squad: Squad) {
        this.game.cancelAttackSquadAll(squad);

        this.renderCommandPanel();
    }

    cancelAttackSelected() {
        this.squadsSelected.forEach(this.cancelAttackAll.bind(this));

        this.renderCommandPanel();
    }

    attackSquadSelected(squadTarget: Squad) {
        for (const squad of this.squadsSelected) {
            this.game.orderAttackOnlySquad({
                squadAttacker: squad,
                squadTarget: squadTarget,
            });
        }

        this.renderCommandPanel();
    }

    attackBuildingBySquadSelected(buildingTarget: Building) {
        for (const squad of this.squadsSelected) {
            this.game.orderAttackOnlyBuilding({
                squadAttacker: squad,
                buildingTarget,
            });
        }

        this.renderCommandPanel();
    }

    getSquadByPosition({ x, y }: Point): Squad | null {
        for (const squad of this.game.getSquads()) {
            if (isPointInRect({ x, y }, squad.frame)) {
                return squad;
            }
        }

        return null;
    }

    getBuildingByPosition({ x, y }: Point): Building | null {
        const point = { x, y };
        for (const building of this.game.getBuildings()) {
            if (isPointInPolygon(point, building.frame)) {
                return building;
            }
        }

        return null;
    }

    getDotByPosition(x: number, y: number): Dot | null {
        const point = { x, y };
        for (const dot of this.game.getDots()) {
            if (isPointInRect(point, dot.hitBox)) {
                return dot;
            }
        }

        return null;
    }

    selectSquadFrame(squad: Squad) {
        this.squadsSelected.push(squad);

        this.selectTeam(squad.team);
    }

    deselectSquadFrame(squad: Squad) {
        this.squadsSelected.splice(this.squadsSelected.indexOf(squad), 1);

        if (this.squadsSelected.length) {
            this.selectTeam(this.squadsSelected[0].team);
        } else {
            this.deselectTeam();
        }
    }

    deselectSquadFramesAll() {
        this.squadsSelected = [];
        this.deselectTeam();
    }

    trySelectSquadFrame(
        { x, y }: Point,
        { deselectPrevious }: { deselectPrevious: boolean },
    ) {
        if (deselectPrevious) {
            this.deselectSquadFramesAll();
        }

        const squadClicked = this.getSquadByPosition({ x, y });

        if (squadClicked) {
            this.selectSquadFrame(squadClicked);
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

    trySelectBuilding(point: Point) {
        const buildingClicked = this.getBuildingByPosition(point);

        console.log(buildingClicked);

        if (buildingClicked) {
            this.buildingsSelected.clear();
            this.buildingsSelected.add(buildingClicked);
            this.selectTeam(buildingClicked.team);

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

        const team = dots[0].team;

        const createSquadResult = this.game.createSquad(dots, team, center);

        if (createSquadResult.isSuccess) {
            this.squadsSelected = [createSquadResult.squad];
        }

        this.dotsAllUnselect();
    }

    destroySquad() {
        if (!this.squadsSelected.length) {
            return;
        }

        for (const squad of this.squadsSelected) {
            this.game.removeSquad(squad);
        }

        this.deselectSquadFramesAll();
    }

    startSelection(
        { x, y }: Point,
        { deselectPrevious }: { deselectPrevious: boolean },
    ) {
        if (deselectPrevious) {
            this.dotsAllUnselect();
            this.squadsSelected = [];
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

    getDotCountForDestination() {
        if (this.squadsSelected.length) {
            let count = 0;
            for (const squad of this.squadsSelected) {
                count += squad.slots.length;
            }

            return count;
        }

        return this.dotsSelected.size;
    }

    startDestination({ x, y }: Point) {
        this.destinationStartPoint = { x, y };
        const dotCountToMove = this.getDotCountForDestination();
        const targetRect = SquadFrameUtils.createSquadSquare(
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

        const totalDotsToMove = this.squadsSelected.reduce(
            (sum, squad) => sum + squad.slots.length,
            0,
        );

        const totalGapsLength =
            BETWEEN_SQUADS_GAP * (this.squadsSelected.length - 1);

        const frontLength = distanceBetween(
            { x, y },
            this.destinationStartPoint,
        );

        if (frontLength < DOT_WIDTH + totalGapsLength) {
            return;
        }

        const availableFrontLength = frontLength - totalGapsLength;
        const sideLength = SquadFrameUtils.calcSquadSideLength(
            totalDotsToMove,
            availableFrontLength,
        );

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

        for (const dot of this.game.getDots()) {
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
            this.game.dotWithoutSquadMoveTo(dot, positions[positionIndex]);
        }
    }

    commandMoveSquads(squads: Squad[], targetFrame: Rect) {
        const squadRects = this.game.moveSquadTo(squads, targetFrame) as Array<
            Rect | undefined
        >;

        squads.forEach((sf, i) => {
            if (!squadRects[i]) return;
            sf.frame = squadRects[i];
        });
    }

    commandMove() {
        if (!this.destination) {
            return;
        }

        if (this.squadsSelected.length) {
            this.commandMoveSquads(this.squadsSelected, this.destination);
            this.destination = null;
            return;
        }

        const dotIndexesToMove = Array.from(this.dotsSelected);
        this.commandMoveDots(dotIndexesToMove);
    }
}
