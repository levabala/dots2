import "../setupGlobalAuto";
import { isNonNull, times } from "remeda";
import { PlayerInterface } from "../player/PlayerInterface";
import {
    initOneTeamWithHQ,
    setupGameTest,
    spanGameTime,
    spanGameTimeUntil,
    TIME_1_SEC,
    TIME_MINIMAL,
    type GameTestGenerator,
} from "./testUtils";
import {
    distanceBetween,
    isPointInRect,
    orthogonalRect,
} from "../shapes";
import { PlayerUtils } from "../player/PlayerUtils";

export function* testCreateSquad(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { squadsController, dotsController } = game._controllers;

    const { team } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });

    // TODO: add dots not randomly
    const dots = times(10, () => dotsController.addDotRandom(team));

    const playerInterface = new PlayerInterface(game, team);

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

    return { game };
}

export function* testMoveSquad(): GameTestGenerator {
    const { game } = yield* testCreateSquad();

    const { squadsController, teamController } = game._controllers;

    const team = Array.from(teamController.teams)[0];
    const squad1 = squadsController.squads[0];

    const playerInterface = new PlayerInterface(game, team);

    const targetRect = orthogonalRect(
        { x: 1300, y: 1100 },
        { x: 1350, y: 1150 },
    );
    playerInterface.moveSquadToRect(squad1, targetRect);

    expect(squad1.frame).toEqual(targetRect);

    yield* spanGameTimeUntil(
        game,
        () => PlayerUtils.squadAllDotsInFrame(squad1),
        TIME_1_SEC * 10,
    );

    for (const slot of squad1.slots) {
        if (!slot.dot) {
            continue;
        }

        expect(
            isPointInRect(slot.dot.position, targetRect),
            "all dots must be inside the target frame",
        ).toBeTrue();
    }

    return { game };
}

export function* testAttackDotToDot(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { projectilesController, dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 1500, y: 1000 });

    const dot1 = dotsController.addDot({
        ...dotsController.generateDotRandom(),
        position: { x: 1200, y: 1000 },
        team: team1,
        allowAttack: true,
    });

    const dot2 = dotsController.addDot({
        ...dotsController.generateDotRandom(),
        position: { x: 1250, y: 1000 },
        team: team2,
        allowAttack: false,
        health: 5,
        healthMax: 5,
    });

    yield { game, mark: "dots created" };

    const health1Initial = dot1.health;
    const health2Initial = dot2.health;

    expect(health1Initial).toBeGreaterThan(0);
    expect(health2Initial).toBeGreaterThan(0);

    expect(projectilesController.projectiles.size).toBe(0);

    dotsController.orderAttackDot({ attacker: dot1, target: dot2 });

    yield { game, mark: "order to attack" };

    let shotsCompleted = 0;
    for (shotsCompleted = 0; dot2.health > 0; shotsCompleted++) {
        expect(dot1.attackTargetDot).toBe(dot2);

        yield* spanGameTime(game, dot1.aimingTimeLeft);
        yield { game, mark: "span time to aim and shoot" };

        expect(dot1.attackTargetDot).toBe(dot2);

        expect(projectilesController.projectiles.size).toEqual(1);
        const projectile = Array.from(projectilesController.projectiles)[0];

        expect(dot1.health).toEqual(health1Initial);
        expect(dot2.health).toEqual(
            health2Initial - projectile.damage * shotsCompleted,
        );

        yield* spanGameTime(
            game,
            distanceBetween(dot1.position, dot2.position) / projectile.speed,
        );
        yield* spanGameTime(game, TIME_MINIMAL);
        yield { game, mark: "span time to hit" };

        expect(projectilesController.projectiles.size).toBe(0);

        expect(dot1.health).toEqual(health1Initial);
        expect(dot2.health).toEqual(
            health2Initial - projectile.damage * (shotsCompleted + 1),
        );

        yield* spanGameTime(game, dot1.attackCooldownLeft);
    }

    expect(shotsCompleted).toBeGreaterThan(0);

    expect(dot2.health).toBe(0);
    expect(dotsController.dots.size).toBe(1);
    expect(Array.from(dotsController.dots)[0]).toBe(dot1);

    yield* spanGameTime(game, dot1.aimingTimeLeft);
    yield { game, mark: "span time to aim when the target is already dead" };

    expect(dot1.attackTargetDot, "a dot must not target a dead dot").toBe(null);
    expect(projectilesController.projectiles.size).toBe(0);

    return { game };
}

export function* testAttackDotToDotRespectsAllowAttack(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { projectilesController, dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 1500, y: 1000 });

    const dot1 = dotsController.addDot({
        ...dotsController.generateDotRandom(),
        position: { x: 1200, y: 1000 },
        team: team1,
        allowAttack: false,
    });

    const dot2 = dotsController.addDot({
        ...dotsController.generateDotRandom(),
        position: { x: 1250, y: 1000 },
        team: team2,
        allowAttack: false,
        health: 5,
        healthMax: 5,
    });

    yield { game, mark: "dots created" };

    const health1Initial = dot1.health;
    const health2Initial = dot2.health;

    expect(health1Initial).toBeGreaterThan(0);
    expect(health2Initial).toBeGreaterThan(0);

    expect(projectilesController.projectiles.size).toBe(0);

    dotsController.orderAttackDot({ attacker: dot1, target: dot2 });

    yield { game, mark: "order to attack" };

    expect(dot1.attackTargetDot).toBe(dot2);

    yield* spanGameTime(game, dot1.aimingTimeLeft);
    yield { game, mark: "span time to aim and shoot" };

    expect(dot1.attackTargetDot).toBe(dot2);

    expect(projectilesController.projectiles.size).toEqual(0);
    expect(dot1.health).toEqual(health1Initial);
    expect(dot2.health).toEqual(health2Initial);

    yield* spanGameTime(game, TIME_1_SEC);

    expect(projectilesController.projectiles.size).toEqual(0);

    expect(dot1.health).toEqual(health1Initial);
    expect(dot2.health).toEqual(health2Initial);

    return { game };
}

export function* testCreate2Teams2Squads(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { dotsController } = game._controllers;

    const { team: team1 } = initOneTeamWithHQ(game, { x: 1000, y: 1000 });
    const { team: team2 } = initOneTeamWithHQ(game, { x: 2000, y: 1300 });

    const dots1 = times(10, () => dotsController.addDotRandom(team1));
    const dots2 = times(10, () => dotsController.addDotRandom(team2));

    const playerInterface1 = new PlayerInterface(game, team1);
    const squad1Res = playerInterface1.createSquad(dots1, { x: 1200, y: 1000 });

    const playerInterface2 = new PlayerInterface(game, team2);
    const squad2Res = playerInterface2.createSquad(dots2, { x: 1700, y: 1300 });

    if (!squad1Res.isSuccess || !squad2Res.isSuccess) {
        throw new Error("create squad failed");
    }

    const squad1 = squad1Res.squad;
    const squad2 = squad2Res.squad;

    yield* spanGameTimeUntil(
        game,
        () => PlayerUtils.squadAllDotsInFrame(squad1) && PlayerUtils.squadAllDotsInFrame(squad2),
        TIME_1_SEC * 10,
    );

    expect(playerInterface1.getSquadsMy().length).toBe(1);
    expect(playerInterface2.getSquadsMy().length).toBe(1);

    return { game };
}

export function* testAttackSquadToSquad(): GameTestGenerator {
    const { game } = yield* testCreate2Teams2Squads();

    const { teamController } = game._controllers;

    const team1 = Array.from(teamController.teams).find(
        (team) => team.index === 0,
    )!;
    const team2 = Array.from(teamController.teams).find(
        (team) => team.index === 1,
    )!;

    const playerInterface1 = new PlayerInterface(game, team1);
    const playerInterface2 = new PlayerInterface(game, team2);

    const squad1 = playerInterface1.getSquadsMy()[0];
    const squad2 = playerInterface2.getSquadsMy()[0];

    squad1.allowAttack = false;
    squad2.allowAttack = false;

    const targetPoint = {
        x: squad2.frame.p1.x - 50,
        y: squad2.frame.p1.y - 50,
    };
    playerInterface1.moveSquadToPoint(squad1, targetPoint);

    yield { game, mark: "start moving" };
    yield* spanGameTimeUntil(
        game,
        () => PlayerUtils.squadAllDotsInFrame(squad1),
        TIME_1_SEC * 10,
    );
    yield { game, mark: "moved the squad to point to shoot" };

    expect(PlayerUtils.squadAllDotsInFrame(squad1)).toBeTrue();

    squad1.allowAttack = true;

    const squad2TotalHealthBefore = squad2.slots.reduce(
        (acc, slot) => (slot.dot ? acc + slot.dot.health : acc),
        0,
    );

    yield { game, mark: "start shooting" };

    let squad2TotalHealthAfter;
    yield* spanGameTimeUntil(
        game,
        () => {
            squad2TotalHealthAfter = squad2.slots.reduce(
                (acc, slot) => (slot.dot ? acc + slot.dot.health : acc),
                0,
            );

            return squad2TotalHealthAfter < squad2TotalHealthBefore;
        },
        TIME_1_SEC * 10,
    );

    expect(squad2TotalHealthAfter).toBeLessThan(squad2TotalHealthBefore);

    return { game };
}

describe("units", () => {
    test("create a squad", async () => {
        for (const _ of testCreateSquad());
    });

    test("move a squad", async () => {
        for (const _ of testMoveSquad());
    });

    test("dot attacks a dot", async () => {
        for (const _ of testAttackDotToDot());
    });

    test("dot does not attack a dot if allowAttack is false", async () => {
        for (const _ of testAttackDotToDotRespectsAllowAttack());
    });

    test("create two teams with one squad each", async () => {
        for (const _ of testCreate2Teams2Squads());
    });

    test("squad attacks a squad", async () => {
        for (const _ of testAttackSquadToSquad());
    });
});
