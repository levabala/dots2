import { filter, randomInteger, times } from "remeda";
import type { BuildingKind } from "../Game/BuildingsController";
import "../setupGlobalAuto";
import {
    type GameTestGenerator,
    setupGameTest,
    initOneTeamWithHQ,
    spanGameTimeUntil,
    TIME_1_SEC,
    TIME_1_MIN,
} from "../tests/testUtils";
import { PlayerAI2 } from "./PlayerAI2";
import { PlayerInterface } from "./PlayerInterface";

export function* testBuildBasicBase(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { squadsController, dotsController } = game._controllers;

    const { team } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });

    const playerInterface = new PlayerInterface(game, team);

    const ai = new PlayerAI2(playerInterface, team);

    yield { game, mark: "init" };
    yield* spanGameTimeUntil(
        game,
        () =>
            (["barracks", "farm", "lumberMill"] satisfies BuildingKind[]).every(
                (kind) =>
                    playerInterface
                        .getBuildings()
                        .some((building) => building.kind === kind),
            ),
        TIME_1_MIN * 10,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "barracks, farm, lumber mill built" };

    return { game };
}

export function* testSpawnUnits(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2000, y: 1000 });

    times(10, () => {
        return dotsController.addDot({
            ...dotsController.generateDotRandom(),
            position: { x: 1900, y: randomInteger(1000, 1100) },
            team: team2,
            allowAttack: false,
        });
    });

    const playerInterface1 = new PlayerInterface(game, team1);

    const ai = new PlayerAI2(playerInterface1, team1);

    yield { game, mark: "init" };
    yield* spanGameTimeUntil(
        game,
        () => {
            const dotsSpawnedTotal1 =
                Array.from(dotsController.dots).filter(
                    (dot) => dot.team === team1,
                ).length +
                Array.from(dotsController.dotsDead).filter(
                    (dot) => dot.team === team1,
                ).length;

            return dotsSpawnedTotal1 > 4;
        },
        TIME_1_MIN * 10,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "4 dots spawned" };

    return { game };
}

export function* testCreateSquads(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2000, y: 1000 });

    times(10, () => {
        return dotsController.addDot({
            ...dotsController.generateDotRandom(),
            position: { x: 1900, y: randomInteger(1000, 1100) },
            team: team2,
            allowAttack: false,
        });
    });

    const playerInterface1 = new PlayerInterface(game, team1);

    const ai = new PlayerAI2(playerInterface1, team1);

    yield { game, mark: "init" };
    yield* spanGameTimeUntil(
        game,
        () => {
            return playerInterface1.getSquads().length > 0;
        },
        TIME_1_MIN * 10,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "1 squad created" };

    return { game };
}

describe("PlayerAI2", () => {
    test("builds a base", () => {
        for (const _ of testBuildBasicBase());
    });

    test("builds some units", () => {
        for (const _ of testSpawnUnits());
    });

    test("creates squads", () => {
        for (const _ of testCreateSquads());
    });
});
