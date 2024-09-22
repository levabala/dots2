import { type Point } from "../utils";
import { BuildingsController, type Building } from "./BuildingsController";
import { DotsController, type Dot } from "./DotsController";
import { ProjectilesController } from "./ProjectilesController";
import { SquadsController, type Squad } from "./SquadsController";
import { ResourcesController } from "./ResourcesController";
import { TeamController } from "./TeamController";

export enum GameEventTickName {
    squadsRemoved = "squads-removed",
    dotsAdded = "dots-added",
    dotsRemoved = "dots-removed",
    dotsMoved = "dots-moved",
    resourcesChanged = "resources-changed",
}

export type GameEventTick =
    | { name: GameEventTickName.squadsRemoved; payload: { squads: Squad[] } }
    | { name: GameEventTickName.dotsAdded; payload: { dots: Dot[] } }
    | { name: GameEventTickName.dotsRemoved; payload: { dots: Dot[] } }
    | { name: GameEventTickName.dotsMoved; payload: { dots: Dot[] } }
    | {
          name: GameEventTickName.resourcesChanged;
          payload: null;
      };

export type GameEventFromName<Name extends GameEventTick["name"]> = Extract<
    GameEventTick,
    { name: Name }
>;

export type GameEventListener<Name extends GameEventTick["name"]> = (
    payload: GameEventFromName<Name>["payload"],
) => void;

export class Game {
    dotsController: DotsController;
    projectilesController: ProjectilesController;
    squadsController: SquadsController;
    buildingsController: BuildingsController;
    resourcesController: ResourcesController;
    teamController: TeamController;

    eventListeners: {
        [key in GameEventTick["name"]]: Set<GameEventListener<key>>;
    } = {
        [GameEventTickName.squadsRemoved]: new Set(),
        [GameEventTickName.dotsAdded]: new Set(),
        [GameEventTickName.dotsRemoved]: new Set(),
        [GameEventTickName.dotsMoved]: new Set(),
        [GameEventTickName.resourcesChanged]: new Set(),
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

    attackSquad({
        squadAttacker,
        squadTarget,
    }: {
        squadAttacker: Squad;
        squadTarget: Squad;
    }) {
        squadAttacker.attackTargetSquads.add(squadTarget);
        squadTarget.attackTargetedBySquads.add(squadAttacker);
    }

    attackBuilding({
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

    dotMoveTo(dot: Dot, destination: Point) {
        dot.path = [destination];
    }

    tryBuild(building: Building) {
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

        return true;
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
