import type { Game, GameEventTick, GameEventListener } from "../Game";
import type {
    Building,
    BuildingKind,
    BuildingCost,
} from "../Game/BuildingsController";
import type { Dot } from "../Game/DotsController";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import {
    createPolygonOffset,
    getPointOffset,
    getRectCenter,
    polygonToRect,
    rectToPolygon,
    type Point,
    type Rect,
} from "../shapes";

// TODO: wrap all returns in a Proxy that denies mutations
export class PlayerInterface {
    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {}

    getMapSize() {
        return { width: this.game.width, height: this.game.height };
    }

    getDotsMy() {
        return Array.from(this.game.getDots()).filter(
            (dot) => dot.team === this.team,
        );
    }

    getDotsAll() {
        return Array.from(this.game.getDots());
    }

    getSquadsMy() {
        return Array.from(this.game.getSquads()).filter(
            (squad) => squad.team === this.team,
        );
    }

    getSquadsAll() {
        return Array.from(this.game.getSquads());
    }

    getBuildingsMy() {
        return Array.from(this.game.getBuildings()).filter(
            (building) => building.team === this.team,
        );
    }

    getBuildingsAll() {
        return Array.from(this.game.getBuildings());
    }

    addEventListener<Name extends GameEventTick["name"]>(
        name: Name,
        listener: GameEventListener<Name>,
    ) {
        this.game.addEventListener(name, listener);
    }

    removeEventListener<Name extends GameEventTick["name"]>(
        name: Name,
        listener: GameEventListener<Name>,
    ) {
        this.game.removeEventListener(name, listener);
    }

    orderAttackOnlySquad({
        squadAttacker,
        squadTarget,
    }: {
        squadAttacker: Squad;
        squadTarget: Squad;
    }) {
        if (squadAttacker.team !== this.team) {
            throw new Error("squadAttacker must be owned by this player");
        }

        this.game.orderAttackOnlySquad({
            squadAttacker,
            squadTarget,
        });
    }

    orderAttackOnlyBuilding({
        squadAttacker,
        buildingTarget,
    }: {
        squadAttacker: Squad;
        buildingTarget: Building;
    }) {
        if (squadAttacker.team !== this.team) {
            throw new Error("squadAttacker must be owned by this player");
        }

        this.game.orderAttackOnlyBuilding({
            squadAttacker,
            buildingTarget,
        });
    }

    cancelAttackSquadAll(squadAttacker: Squad) {
        if (squadAttacker.team !== this.team) {
            throw new Error("squadAttacker must be owned by this player");
        }

        this.game.cancelAttackSquadAll(squadAttacker);
    }

    dotWithoutSquadMoveTo(dot: Dot, destination: Point) {
        if (dot.team !== this.team) {
            throw new Error("dot must be owned by this player");
        }

        this.game.dotWithoutSquadMoveTo(dot, destination);
    }

    tryBuild(kind: BuildingKind, center: Point) {
        return this.game.tryBuild(kind, center, this.team);
    }

    canBuild(buildingKind: BuildingKind) {
        return this.game.canBuild(buildingKind, this.team);
    }

    getTeamResourcesMy() {
        return this.game.getTeamResources(this.team);
    }

    createSquad(dots: Dot[], center: Point) {
        for (const dot of dots) {
            if (dot.team !== this.team) {
                throw new Error("dots must be owned by this player");
            }
        }

        return this.game.createSquad(dots, this.team, center);
    }

    removeSquad(squad: Squad) {
        if (squad.team !== this.team) {
            throw new Error("squad must be owned by this player");
        }

        return this.game.removeSquad(squad);
    }

    isInSquad(dot: Dot) {
        return this.game.isInSquad(dot);
    }

    moveSquadToRect(squad: Squad, targetFrame: Rect) {
        if (squad.team !== this.team) {
            throw new Error("squad must be owned by this player");
        }

        return this.game.moveSquadTo(squad, targetFrame);
    }

    moveSquadToPoint(squad: Squad, targetPoint: Point) {
        const offset = getPointOffset(getRectCenter(squad.frameTarget), targetPoint);

        return this.moveSquadToRect(
            squad,
            polygonToRect(
                createPolygonOffset(rectToPolygon(squad.frameTarget), offset),
            ),
        );
    }

    getBuildingCost(buildingKind: BuildingKind): BuildingCost {
        return this.game.getBuildingCost(buildingKind, this.team);
    }

    orderAttackDot({ attacker, target }: { attacker: Dot; target: Dot }) {
        if (attacker.team !== this.team) {
            throw new Error("attacker must be owned by this player");
        }

        this.game.orderAttackDot({ attacker, target });
    }
}
