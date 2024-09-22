import { times } from "remeda";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import { createPolygonOffset } from "../shapes";
import type { UI } from "../UI";

export function sceneTwoTeamsSomeBuildings(game: Game) {
    const team1 = game.teamController.createTeam({ name: "red" });
    const team2 = game.teamController.createTeam({ name: "blue" });

    game.resourcesController.initTeamResourcesState(team1);
    game.resourcesController.initTeamResourcesState(team2);

    game.resourcesController.setCoins(team1, 1000);
    game.resourcesController.setCoins(team2, 1000);

    times(100, () => game.dotsController.addDotRandom(team1));
    times(100, () => game.dotsController.addDotRandom(team2));

    const center1 = { x: 1000, y: 1000 };
    game.buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center1,
        ),
        center: center1,
    });
    const center2 = { x: 900, y: 1000 };
    game.buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.house,
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.house.frameRelative,
            center2,
        ),
        center: center1,
    });
    const center3 = { x: 870, y: 1100 };
    game.buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.farm,
        kind: "farm",
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.farm.frameRelative,
            center3,
        ),
        center: center3,
    });
    const center6 = { x: 870, y: 1300 };
    game.buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.lumberMill,
        kind: "lumberMill",
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.lumberMill.frameRelative,
            center6,
        ),
        center: center6,
    });

    const center4 = { x: 1700, y: 1000 };
    game.buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        kind: "barracks",
        team: team2,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center4,
        ),
        center: center4,
        spawnQueue: times(50, () => game.dotsController.generateDotRandom()),
    });
    const center5 = { x: 1850, y: 1000 };
    game.buildingsController.addBuilding({
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

export function sceneTwoSquads(ui: UI) {
    for (const dot of ui.game.dotsController.dots) {
        if (dot.team.name === "red") {
            ui.dotsSelected.add(dot);
        }
    }

    ui.createSquad();

    ui.startDestination({ x: 1500, y: 1100 });
    ui.adjustDestination({ x: 1500, y: 1600 });
    ui.commandMove();

    ui.cancelSelection();
    ui.clearDestination();
    ui.dotsAllUnselect();
    ui.squadFramesSelected.splice(0, ui.squadFramesSelected.length);

    for (const dot of ui.game.dotsController.dots) {
        if (dot.team.name === "blue") {
            ui.dotsSelected.add(dot);
        }
    }

    ui.createSquad();

    ui.startDestination({ x: 1600, y: 1600 });
    ui.adjustDestination({ x: 1600, y: 1100 });
    ui.commandMove();

    ui.cancelSelection();
    ui.squadFramesSelected.splice(0, ui.squadFramesSelected.length);
    ui.selectSquadFrame(ui.squadFrames[0]);
}
