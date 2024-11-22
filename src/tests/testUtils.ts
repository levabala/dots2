import { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import { setupGlobal } from "../setupGlobal";
import { createPolygonOffset } from "../shapes";
import type { Point } from "../shapes";

const IS_DEBUG =
    typeof process !== "undefined" &&
    process.env.SPAN_GAME_TIME_DEBUG === "true";

const TICK_INTERVAL = 16;

export function* spanGameTime(game: Game, time: number) {
    const ticks = Math.ceil(time / TICK_INTERVAL);
    let averageTickDuration = 0;

    if (IS_DEBUG) {
        console.log(`spanGameTime for ${time.toFixed(1)}ms = ${ticks} ticks`);
    }

    for (let i = 0; i < ticks; i++) {
        const t1 = performance.now();
        game.tick(TICK_INTERVAL);
        const t2 = performance.now();

        averageTickDuration += t2 - t1;

        yield { game };
    }

    averageTickDuration /= ticks;

    if (IS_DEBUG) {
        console.log(`average tick duration: ${averageTickDuration.toFixed(5)}ms`);
    }

    return game;
}

export function* spanGameTimeUntil(game: Game, condition: () => boolean, timeout: number) {
    const maxTicks = Math.ceil(timeout / TICK_INTERVAL);
    let ticks = 0;
    let averageTickDuration = 0;

    if (IS_DEBUG) {
        console.log(`spanGameTimeUntil for max ${timeout.toFixed(1)}ms = ${ticks} ticks`);
    }

    while (!condition()) {
        const t1 = performance.now();
        game.tick(TICK_INTERVAL);
        const t2 = performance.now();

        averageTickDuration += t2 - t1;

        yield { game };

        ticks++;

        if (ticks >= maxTicks) {
            throw new Error('spanGameTimeUntil timeout reached');
        }
    }

    averageTickDuration /= ticks;

    if (IS_DEBUG) {
        console.log(`average tick duration: ${averageTickDuration.toFixed(5)}ms`);
    }

    return game;
}

export const TIME_MINIMAL = 1;
export const TIME_1_SEC = 1000;
export const TIME_1_MIN = 60 * TIME_1_SEC;

export function initOneTeamWithHQ(game: Game, hqPosition: Point, name = "red") {
    const { teamController, resourcesController, buildingsController } =
        game.getPrivateStaffYouShouldNotUse();

    const team = teamController.createTeam({ name });

    resourcesController.initTeamResourcesState(team);

    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.hq.frameRelative,
            hqPosition,
        ),
        center: hqPosition,
    });

    return { team };
}

export function setupGameTest() {
    const game = new Game(3000, 3000);
    setupGlobal(game);

    return game;
}

export type GameTestGeneratorStep = { game: Game; mark?: string };
export type GameTestGenerator = Generator<GameTestGeneratorStep, GameTestGeneratorStep>;
