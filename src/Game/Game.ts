import { type Point } from "../utils";
import { times } from "remeda";
import { BuildingsController } from "./BuildingsController";
import { createPolygonOffset } from "../shapes";
import { DotsController, type Dot } from "./DotsController";
import { ProjectilesController } from "./ProjectilesController";
import { SquadsController, type Squad } from "./SquadsController";
import { ResourcesController } from "./ResourcesController";
import { TeamController } from "./TeamController";
import { BUILDINGS_CONFIGS } from "./buildingsConfigs";

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
    buildings: BuildingsController;
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
        this.projectilesController = new ProjectilesController(
            this.dotsController.dots,
        );
        this.squadsController = new SquadsController(
            this.dotsController.checkHasShootIntersectionWithOwnTeam.bind(
                this.dotsController,
            ),
        );
        this.buildings = new BuildingsController();
        this.resourcesController = new ResourcesController();
    }

    init() {
        const team1 = this.teamController.createTeam({ name: "red" });
        const team2 = this.teamController.createTeam({ name: "blue" });

        this.resourcesController.initTeamResourcesState(team1);
        this.resourcesController.initTeamResourcesState(team2);

        times(100, () => this.dotsController.addDotRandom(team1));
        times(100, () => this.dotsController.addDotRandom(team2));

        const center1 = { x: 1000, y: 1000 };
        this.buildings.addBuilding({
            ...BUILDINGS_CONFIGS.barracks,
            team: team1,
            frame: createPolygonOffset(
                BUILDINGS_CONFIGS.barracks.frameRelative,
                center1,
            ),
            center: center1,
        });
        const center2 = { x: 900, y: 1000 };
        this.buildings.addBuilding({
            ...BUILDINGS_CONFIGS.house,
            team: team1,
            frame: createPolygonOffset(
                BUILDINGS_CONFIGS.house.frameRelative,
                center2,
            ),
            center: center1,
        });
        const center3 = { x: 870, y: 1100 };
        this.buildings.addBuilding({
            ...BUILDINGS_CONFIGS.farm,
            kind: "farm",
            team: team1,
            frame: createPolygonOffset(
                BUILDINGS_CONFIGS.farm.frameRelative,
                center3,
            ),
            center: center3,
        });

        const center4 = { x: 1700, y: 1000 };
        this.buildings.addBuilding({
            ...BUILDINGS_CONFIGS.barracks,
            kind: "barracks",
            team: team2,
            frame: createPolygonOffset(
                BUILDINGS_CONFIGS.barracks.frameRelative,
                center4,
            ),
            center: center4,
            spawnQueue: times(50, () =>
                this.dotsController.generateDotRandom(),
            ),
        });
        const center5 = { x: 1850, y: 1000 };
        this.buildings.addBuilding({
            ...BUILDINGS_CONFIGS.house,
            kind: "house",
            team: team2,
            frame: createPolygonOffset(
                BUILDINGS_CONFIGS.house.frameRelative,
                center5,
            ),
            center: center5,
        });
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

    cancelAttackSquadAll(squadAttacker: Squad) {
        for (const squadTarget of squadAttacker.attackTargetSquads) {
            squadTarget.attackTargetedBySquads.delete(squadAttacker);
        }

        squadAttacker.attackTargetSquads.clear();

        for (const slot of squadAttacker.slots) {
            if (!slot.dot) {
                continue;
            }

            slot.dot.attackTargetDot = null;
        }
    }

    dotMoveTo(dot: Dot, destination: Point) {
        dot.path = [destination];
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
                this.buildings.countHousing(team),
            );
            this.resourcesController.setFoodCapacity(
                team,
                this.buildings.countFoodCapacity(team),
            );
        }

        for (const building of this.buildings.buildings) {
            if (building.kind === "barracks") {
                if (building.spawnQueue.length === 0) {
                    building.spawnQueue.push(
                        this.dotsController.generateDotRandom(),
                    );
                }
            }
        }

        this.projectilesController.tick(timeDelta);
        const effectsBuildings = this.buildings.tick(timeDelta, {
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
