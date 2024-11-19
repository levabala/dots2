import { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import { setupGlobal } from "../setupGlobal";
import { createPolygonOffset } from "../shapes";
import type { Point } from "../utils";

const TICK_INTERVAL = 60;

export function* spanGameTime(game: Game, time: number) {
    const ticks = Math.floor(time / TICK_INTERVAL);
    let averageTickDuration = 0;

    for (let i = 0; i < Math.floor(time / TICK_INTERVAL); i++) {
        const t1 = performance.now();
        game.tick(TICK_INTERVAL);
        const t2 = performance.now();

        averageTickDuration += t2 - t1;

        yield game;
    }

    averageTickDuration /= ticks;

    if (
        typeof process !== "undefined" &&
        process.env.SPAN_GAME_TIME_DEBUG === "true"
    ) {
        console.log(`average tick duration: ${averageTickDuration}ms`);
    }

    return game;
}

export const TIME_1_SEC = 1000;
export const TIME_1_MIN = 60 * TIME_1_SEC;

export function initOneTeamWithHQ(game: Game, hqPosition: Point) {
    const { teamController, resourcesController, buildingsController } =
        game.getPrivateStaffYouShouldNotUse();

    const team1 = teamController.createTeam({ name: "red" });

    resourcesController.initTeamResourcesState(team1);

    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.hq.frameRelative,
            hqPosition,
        ),
        center: hqPosition,
    });

    return { team1 };
}

export function setupGameTest() {
    const game = new Game(3000, 3000);
    setupGlobal(game);

    return game;
}
