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

export function* testBuildBase(): GameTestGenerator {
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
            (["barracks", "farm", 'lumberMill'] satisfies BuildingKind[]).every((kind) =>
                playerInterface
                    .getBuildings()
                    .some((building) => building.kind === kind),
            ),
        TIME_1_MIN * 10,
        (i) => {
            if (i % 100 === 0) {
                ai.act();
                // ai.economist.log.bind(ai.economist)();
            }
        },
    );
    yield { game, mark: "barracks, farm, lumber mill built" };

    return { game };
}

describe("PlayerAI2", () => {
    test("builds a base", () => {
        for (const _ of testBuildBase());
    });
});
