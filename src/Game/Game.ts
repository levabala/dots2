import { type Point, type Rect } from "../shapes";
import {
    BuildingsController,
    type Building,
    type BuildingCost,
    type BuildingKind,
} from "./BuildingsController";
import { DotsController, type Dot } from "./DotsController";
import { ProjectilesController } from "./ProjectilesController";
import { SquadsController, type Squad } from "./SquadsController";
import { ResourcesController } from "./ResourcesController";
import { TeamController, type Team } from "./TeamController";
import { createPolygonOffset } from "../shapes";
import { BUILDINGS_CONFIGS } from "./buildingsConfigs";

export enum GameEventName {
    squadsRemoved = "squads-removed",
    dotsAdded = "dots-added",
    dotsRemoved = "dots-removed",
    dotsMoved = "dots-moved",
    resourcesChanged = "resources-changed",
    buildingsAdded = "buildings-added",
}

export type GameEventTick =
    | { name: GameEventName.squadsRemoved; payload: { squads: Squad[] } }
    | { name: GameEventName.dotsAdded; payload: { dots: Dot[] } }
    | { name: GameEventName.dotsRemoved; payload: { dots: Dot[] } }
    | { name: GameEventName.dotsMoved; payload: { dots: Dot[] } }
    | {
          name: GameEventName.resourcesChanged;
          payload: null;
      }
    | {
          name: GameEventName.buildingsAdded;
          payload: { buildings: Building[] };
      };

export type GameEventFromName<Name extends GameEventTick["name"]> = Extract<
    GameEventTick,
    { name: Name }
>;

export type GameEventListener<Name extends GameEventTick["name"]> = (
    payload: GameEventFromName<Name>["payload"],
) => void;

export class Game {
    private time = 0;

    private dotsController: DotsController;
    private projectilesController: ProjectilesController;
    private squadsController: SquadsController;
    private buildingsController: BuildingsController;
    private resourcesController: ResourcesController;
    private teamController: TeamController;

    public _controllers;

    private eventListeners: {
        [key in GameEventTick["name"]]: Set<GameEventListener<key>>;
    } = {
        [GameEventName.squadsRemoved]: new Set(),
        [GameEventName.dotsAdded]: new Set(),
        [GameEventName.dotsRemoved]: new Set(),
        [GameEventName.dotsMoved]: new Set(),
        [GameEventName.resourcesChanged]: new Set(),
        [GameEventName.buildingsAdded]: new Set(),
    };

    constructor(
        readonly width: number,
        readonly height: number,
    ) {
        this.teamController = new TeamController();
        this.dotsController = new DotsController(width, height);
        this.buildingsController = new BuildingsController();
        this.projectilesController = new ProjectilesController(
            this.dotsController.dots,
            this.buildingsController.buildings,
        );
        this.squadsController = new SquadsController();
        this.resourcesController = new ResourcesController();

        this._controllers = {
            dotsController: this.dotsController,
            projectilesController: this.projectilesController,
            squadsController: this.squadsController,
            buildingsController: this.buildingsController,
            resourcesController: this.resourcesController,
            teamController: this.teamController,
        };
    }

    getTime() {
        return this.time;
    }

    getPrivateStaffYouShouldNotUse() {
        return this._controllers;
    }

    getDots() {
        return this.dotsController.dots;
    }

    getSquads() {
        return this.squadsController.squads;
    }

    getBuildings() {
        return this.buildingsController.buildings;
    }

    getTeamToResources() {
        return this.resourcesController.teamToState;
    }

    private emitEvent<Name extends GameEventTick["name"]>(
        name: Name,
        payload: GameEventFromName<Name>["payload"],
    ) {
        for (const listener of this.eventListeners[name]) {
            listener(payload as GameEventFromName<Name>["payload"]);
        }
    }

    addEventListener<Name extends GameEventTick["name"]>(
        name: Name,
        listener: GameEventListener<Name>,
    ) {
        this.eventListeners[name].add(listener);
    }

    removeEventListener<Name extends GameEventTick["name"]>(
        name: Name,
        listener: GameEventListener<Name>,
    ) {
        this.eventListeners[name].delete(listener);
    }

    orderAttackDot({ attacker, target }: { attacker: Dot; target: Dot }) {
        this.dotsController.orderAttackDot({ attacker, target });
    }

    orderAttackOnlySquad({
        squadAttacker,
        squadTarget,
    }: {
        squadAttacker: Squad;
        squadTarget: Squad;
    }) {
        squadAttacker.attackTargetSquads.add(squadTarget);
        squadTarget.attackTargetedBySquads.add(squadAttacker);
    }

    orderAttackOnlyBuilding({
        squadAttacker,
        buildingTarget,
    }: {
        squadAttacker: Squad;
        buildingTarget: Building;
    }) {
        squadAttacker.attackTargetBuildings.add(buildingTarget);
    }

    cancelAttackSquadAll(squadAttacker: Squad) {
        for (const squadTarget of squadAttacker.attackTargetSquads) {
            squadTarget.attackTargetedBySquads.delete(squadAttacker);
        }

        squadAttacker.attackTargetSquads.clear();
        squadAttacker.attackTargetBuildings.clear();

        for (const slot of squadAttacker.slots) {
            if (!slot.dot) {
                continue;
            }

            slot.dot.attackTargetDot = null;
            slot.dot.attackTargetBuilding = null;
        }
    }

    dotWithoutSquadMoveTo(dot: Dot, destination: Point) {
        this.dotsController.dotMoveTo(dot, destination);
    }

    tryBuild(kind: BuildingKind, center: Point, team: Team) {
        const building: Building = {
            center,
            frame: createPolygonOffset(
                BUILDINGS_CONFIGS[kind].frameRelative,
                center,
            ),
            team,
            ...BUILDINGS_CONFIGS[kind],
        };

        const resources = this.resourcesController.getState(building.team);

        const cost = this.buildingsController.getBuildingCost(
            building.kind,
            building.team,
        );
        if (!BuildingsController.canBuild(cost, resources)) {
            return false;
        }

        this.buildingsController.addBuilding(building);

        this.resourcesController.changeWood(building.team, -cost.wood);
        this.resourcesController.changeCoins(building.team, -cost.coins);

        this.emitEvent(GameEventName.buildingsAdded, {
            buildings: [building],
        });

        return true;
    }

    canBuild(buildingKind: BuildingKind, team: Team) {
        return BuildingsController.canBuild(
            this.buildingsController.getBuildingCost(buildingKind, team),
            this.resourcesController.getState(team),
        );
    }

    getTeamResources(team: Team) {
        return this.resourcesController.getState(team);
    }

    createSquad(dots: Dot[], team: Team, center: Point) {
        return this.squadsController.createSquad(dots, team, center);
    }

    removeSquad(squad: Squad) {
        this.squadsController.removeSquad(squad);
    }

    isInSquad(dot: Dot) {
        return this.squadsController.isInSquad(dot);
    }

    /** @deprecated */
    moveSquadsTo(squads: Squad[], targetFrame: Rect) {
        return this.squadsController.moveSquadsTo(squads, targetFrame);
    }

    moveSquadTo(squad: Squad, targetFrame: Rect) {
        return this.squadsController.moveSquadTo(squad, targetFrame);
    }

    getBuildingCost(buildingKind: BuildingKind, team: Team): BuildingCost {
        return this.buildingsController.getBuildingCost(buildingKind, team);
    }

    tick(timeDelta: number) {
        const effectsSquads = this.squadsController.tick(timeDelta);
        const effectsDots = this.dotsController.tick(timeDelta);

        for (const projectileToShoot of effectsDots.projectilesToShoot) {
            this.projectilesController.shootProjectile(
                projectileToShoot.fromDot,
                projectileToShoot.toPoint,
                projectileToShoot.params,
            );
        }

        for (const team of this.teamController.teams) {
            this.resourcesController.setHousing(
                team,
                this.buildingsController.countHousing(team),
            );
            this.resourcesController.setFoodCapacity(
                team,
                this.buildingsController.countFoodCapacity(team),
            );
            this.resourcesController.setWoodCapacity(
                team,
                this.buildingsController.countWoodCapacity(team),
            );
        }

        for (const building of this.buildingsController.buildings) {
            if (building.kind === "barracks") {
                if (building.spawnQueue.length === 0) {
                    building.spawnQueue.push(
                        this.dotsController.generateDotRandom(),
                    );
                }
            }
        }

        const effectsProjectiles = this.projectilesController.tick(timeDelta);

        this.dotsController.updateDotsMoraleByHits(
            effectsProjectiles.dotsHitNotKilled,
        );
        this.dotsController.updateDotsMoraleByKills(
            effectsProjectiles.dotsKilled,
        );

        const effectsBuildings = this.buildingsController.tick(timeDelta, {
            teamToResources: new Map(this.resourcesController.teamToState),
        });

        for (const [
            team,
            resourcesChange,
        ] of effectsBuildings.resourcesChangeByMap) {
            this.resourcesController.changeFood(
                team,
                resourcesChange.foodProduced - resourcesChange.foodConsumed,
            );
            this.resourcesController.changeWood(
                team,
                resourcesChange.woodProduced - resourcesChange.woodConsumed,
            );
            this.resourcesController.changeCoins(
                team,
                resourcesChange.coinsProduced - resourcesChange.coinsConsumed,
            );
        }

        this.emitEvent(GameEventName.resourcesChanged, null);

        for (const dotSpawned of effectsBuildings.dotsSpawned) {
            this.dotsController.addDot(this.dotsController.initDot(dotSpawned));
        }

        if (effectsDots.dotsRemoved.length) {
            this.emitEvent(GameEventName.dotsRemoved, {
                dots: effectsDots.dotsRemoved,
            });
        }

        if (effectsSquads.squadsRemoved.length) {
            this.emitEvent(GameEventName.squadsRemoved, {
                squads: effectsSquads.squadsRemoved,
            });
        }

        this.time += timeDelta;
    }
}
