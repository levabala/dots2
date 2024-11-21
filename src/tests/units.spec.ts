import { isNonNull, times } from "remeda";
import { PlayerInterface } from "../player/Player";
import "../setupGlobalAuto";
import {
    initOneTeamWithHQ,
    setupGameTest,
    spanGameTime,
    TIME_1_SEC,
} from "./testUtils";
import { isPointInRect, orthogonalRect } from "../utils";

export function* testCreateSquad() {
    const game = setupGameTest();
    yield game;

    const { squadsController, dotsController } = game._controllers;

    const { team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });

    // TODO: add dots not randomly
    const dots = times(10, () => dotsController.addDotRandom(team1));

    const playerInterface = new PlayerInterface(game, team1);

    playerInterface.createSquad(dots, { x: 1200, y: 1000 });

    expect(squadsController.squads.length).toBe(1);
    expect(squadsController.squads[0].slots.length).toBe(10);
    expect(
        squadsController.squads[0].slots
            .map((slot) => slot.dot)
            .filter(isNonNull)
            .sort((a, b) => a.id - b.id),
        "squad dots are the same as the dots passed to createSquad",
    ).toEqual(dots.sort((a, b) => a.id - b.id));

    return game;
}

export function* testMoveSquad() {
    const game = yield* testCreateSquad();

    const { squadsController, teamController } = game._controllers;

    const team1 = Array.from(teamController.teams)[0];
    const squad1 = squadsController.squads[0];

    const playerInterface = new PlayerInterface(game, team1);

    const targetRect = orthogonalRect(
        { x: 1300, y: 1100 },
        { x: 1350, y: 1150 },
    );
    playerInterface.moveSquadTo(squad1, targetRect);

    expect(squad1.frame).toEqual(targetRect);

    yield* spanGameTime(game, TIME_1_SEC * 10);

    for (const slot of squad1.slots) {
        if (!slot.dot) {
            continue;
        }

        expect(
            isPointInRect(slot.dot.position, targetRect),
            "all dots must be inside the target frame",
        ).toBeTrue();
    }

    return game;
}

describe("units", () => {
    test("create a squad", async () => {
        for (const _ of testCreateSquad());
    });

    test("move a squad", async () => {
        for (const _ of testMoveSquad());
    });
});
