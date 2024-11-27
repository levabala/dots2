import { randomInteger, times } from "remeda";
import type { BuildingKind } from "../Game/BuildingsController";
import "../setupGlobalAuto";
import {
    type GameTestGenerator,
    setupGameTest,
    initOneTeamWithHQ,
    spanGameTimeUntil,
    TIME_1_MIN,
} from "../tests/testUtils";
import { PlayerAI2 } from "./PlayerAI2";
import { PlayerInterface } from "./PlayerInterface";

export function* testBuildBasicBase(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

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
                        .getBuildingsMy()
                        .some((building) => building.kind === kind),
            ),
        TIME_1_MIN * 3,
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
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2000, y: 1100 });

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
        TIME_1_MIN * 3,
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
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2000, y: 1100 });

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
            return playerInterface1.getSquadsMy().length > 0;
        },
        TIME_1_MIN * 3,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "1 squad created" };

    return { game };
}

export function* testDestroyEnemyWithoutArmy(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2000, y: 1100 });

    times(10, () => {
        return dotsController.addDot({
            ...dotsController.generateDotRandom(),
            position: { x: 1900, y: randomInteger(1000, 1100) },
            team: team2,
            allowAttack: false,
        });
    });

    const playerInterface1 = new PlayerInterface(game, team1);
    const playerInterface2 = new PlayerInterface(game, team2);

    const ai = new PlayerAI2(playerInterface1, team1);

    yield { game, mark: "init" };
    yield* spanGameTimeUntil(
        game,
        () => {
            return playerInterface2.getBuildingsMy().length === 0;
        },
        TIME_1_MIN * 3,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "enemy destroyed" };

    return { game };
}

export function* prioritizeAttackCloseSquadInsteadOfHQ(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2300, y: 1100 });

    const playerInterface1 = new PlayerInterface(game, team1);
    const playerInterface2 = new PlayerInterface(game, team2);

    playerInterface2.createSquad(
        times(20, () => {
            return dotsController.addDot({
                ...dotsController.generateDotRandom(),
                position: { x: 1900, y: randomInteger(1000, 1100) },
                team: team2,
            });
        }),
        { x: 1900, y: 1000 },
    );
    playerInterface2.createSquad(
        times(20, () => {
            return dotsController.addDot({
                ...dotsController.generateDotRandom(),
                position: { x: 1900, y: randomInteger(1000, 1100) },
                team: team2,
            });
        }),
        { x: 1900, y: 1100 },
    );

    const ai = new PlayerAI2(playerInterface1, team1);

    yield { game, mark: "init" };
    yield* spanGameTimeUntil(
        game,
        () => {
            return playerInterface2.getSquadsMy().length === 0;
        },
        TIME_1_MIN * 3,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "enemy squads destroyed" };

    yield* spanGameTimeUntil(
        game,
        () => {
            return playerInterface2.getBuildingsMy().length === 0;
        },
        TIME_1_MIN * 3,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
            }
        },
    );
    yield { game, mark: "enemy hq destroyed" };

    const { my: deathsMy, enemy: deathsEnemy } = Array.from(
        dotsController.dotsDead,
    ).reduce(
        (acc, dot) => {
            if (dot.team === team2) {
                acc.enemy++;
            } else {
                acc.my++;
            }

            return acc;
        },
        { my: 0, enemy: 0 },
    );

    expect(
        deathsMy / deathsEnemy,
        "the death rate must be good enough",
    ).toBeLessThan(1.5);

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

    test("destroys enemy without army", () => {
        for (const _ of testDestroyEnemyWithoutArmy());
    });

    test("prioritize attacking a close squad instead of HQ", () => {
        for (const _ of prioritizeAttackCloseSquadInsteadOfHQ());
    });
});
