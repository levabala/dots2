import '../setupGlobalAuto';
import { Game } from "../Game";
import { PlayerInterface } from "../player/PlayerInterface";
import { setupPanicAssert } from "../setupPanicAssert";
import {
    initOneTeamWithHQ,
    spanGameTime,
    TIME_1_MIN,
    setupGameTest,
    type GameTestGenerator,
} from "./testUtils";

export function* buildAllBuildings(): GameTestGenerator {
    const game = setupGameTest();
    yield { game };

    const { team } = initOneTeamWithHQ(game, { x: 3000, y: 3000 });

    yield* spanGameTime(game, TIME_1_MIN);

    const playerInterface = new PlayerInterface(game, team);

    expect(
        playerInterface.tryBuild("lumberMill", { x: 1000, y: 1000 }),
    ).toBeTrue();

    yield* spanGameTime(game, TIME_1_MIN);

    expect(playerInterface.tryBuild("farm", { x: 1200, y: 1000 })).toBeTrue();
    yield* spanGameTime(game, TIME_1_MIN);
    expect(playerInterface.tryBuild("house", { x: 1400, y: 1000 })).toBeTrue();
    yield* spanGameTime(game, TIME_1_MIN);
    expect(playerInterface.tryBuild("granary", { x: 1600, y: 1000 })).toBeTrue();
    yield* spanGameTime(game, TIME_1_MIN);
    expect(playerInterface.tryBuild("coinMiner", { x: 1800, y: 1000 })).toBeTrue();
    yield* spanGameTime(game, TIME_1_MIN);
    expect(playerInterface.tryBuild("barracks", { x: 2000, y: 1000 })).toBeTrue();

    return { game };
}

describe("economy", () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(3000, 3000);
        setupPanicAssert(game);
    });

    test("can build all building from just a hq", () => {
        for (const _ of buildAllBuildings());
    });
});
