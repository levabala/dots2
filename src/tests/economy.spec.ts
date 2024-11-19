import '../setupGlobalAuto';
import { Game } from "../Game";
import { PlayerInterface } from "../player/Player";
import { setupGlobal } from "../setupGlobal";
import {
    initOneTeamWithHQ,
    spanGameTime,
    TIME_1_MIN,
    setupGameTest,
} from "./testUtils";

export function* buildAllBuildings() {
    const game = setupGameTest();
    yield game;

    const { team1 } = initOneTeamWithHQ(game, { x: 3000, y: 3000 });

    yield* spanGameTime(game, TIME_1_MIN);

    const playerInterface = new PlayerInterface(game, team1);

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

    return game;
}

describe("economy", () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(3000, 3000);
        setupGlobal(game);
    });

    test("can build all building from just a hq", () => {
        for (const _ of buildAllBuildings());
    });
});
