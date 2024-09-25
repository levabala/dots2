import { type Point, type Rect } from "../utils";
import {
    BuildingsController,
    type Building,
    type BuildingBarracks,
    type BuildingCost,
} from "./BuildingsController";
import { DotsController, type Dot } from "./DotsController";
import { ProjectilesController } from "./ProjectilesController";
import { SquadsController, type Squad } from "./SquadsController";
import { ResourcesController } from "./ResourcesController";
import { TeamController, type Team } from "./TeamController";
import { createPolygonOffset } from "../shapes";

export enum GameEventTickName {
    squadsRemoved = "squads-removed",
    dotsAdded = "dots-added",
    dotsRemoved = "dots-removed",
    dotsMoved = "dots-moved",
    resourcesChanged = "resources-changed",
    buildingsAdded = "buildings-added",
}

export type GameEventTick =
    | { name: GameEventTickName.squadsRemoved; payload: { squads: Squad[] } }
    | { name: GameEventTickName.dotsAdded; payload: { dots: Dot[] } }
    | { name: GameEventTickName.dotsRemoved; payload: { dots: Dot[] } }
    | { name: GameEventTickName.dotsMoved; payload: { dots: Dot[] } }
    | {
          name: GameEventTickName.resourcesChanged;
          payload: null;
      }
    | {
          name: GameEventTickName.buildingsAdded;
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
    private dotsController: DotsController;
    private projectilesController: ProjectilesController;
    private squadsController: SquadsController;
    private buildingsController: BuildingsController;
    private resourcesController: ResourcesController;
    private teamController: TeamController;

    private eventListeners: {
        [key in GameEventTick["name"]]: Set<GameEventListener<key>>;
    } = {
        [GameEventTickName.squadsRemoved]: new Set(),
        [GameEventTickName.dotsAdded]: new Set(),
        [GameEventTickName.dotsRemoved]: new Set(),
        [GameEventTickName.dotsMoved]: new Set(),
        [GameEventTickName.resourcesChanged]: new Set(),
        [GameEventTickName.buildingsAdded]: new Set(),
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
    }

    getPrivateStaffYouShouldNotUse() {
        return {
            dotsController: this.dotsController,
            projectilesController: this.projectilesController,
            squadsController: this.squadsController,
            buildingsController: this.buildingsController,
            resourcesController: this.resourcesController,
            teamController: this.teamController,
        };
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

    tryBuild(buildingWithoutFrame: Omit<Building, "frame">) {
        const building: Building = {
            ...buildingWithoutFrame,
            frame: createPolygonOffset(
                buildingWithoutFrame.frameRelative,
                buildingWithoutFrame.center,
            ),
        } as Building;

        const resources = this.resourcesController.getState(building.team);

        if (!BuildingsController.canBuild(building.cost, resources)) {
            return false;
        }

        this.buildingsController.addBuilding(building);

        this.resourcesController.changeWood(building.team, -building.cost.wood);
        this.resourcesController.changeCoins(
            building.team,
            -building.cost.coins,
        );

        this.emitEvent(GameEventTickName.buildingsAdded, {
            buildings: [building],
        });

        return true;
    }

    canBuild(cost: BuildingCost, team: Team) {
        return BuildingsController.canBuild(
            cost,
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

    moveSquadTo(squads: Squad[], targetFrame: Rect) {
        return this.squadsController.moveSquadTo(squads, targetFrame);
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

        this.projectilesController.tick(timeDelta);
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

        this.emitEvent(GameEventTickName.resourcesChanged, null);

        for (const dotSpawned of effectsBuildings.dotsSpawned) {
            this.dotsController.addDot(this.dotsController.initDot(dotSpawned));
        }

        if (effectsDots.dotsRemoved.length) {
            this.emitEvent(GameEventTickName.dotsRemoved, {
                dots: effectsDots.dotsRemoved,
            });
        }

        if (effectsSquads.squadsRemoved.length) {
            this.emitEvent(GameEventTickName.squadsRemoved, {
                squads: effectsSquads.squadsRemoved,
            });
        }
    }
}
