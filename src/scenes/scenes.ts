import { times } from "remeda";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import { createPolygonOffset } from "../shapes";
import type { UI } from "../UI";

export function sceneTwoTeamsSomeBuildings(game: Game) {
    const {
        teamController,
        resourcesController,
        dotsController,
        buildingsController,
    } = game.getPrivateStaffYouShouldNotUse();

    const team1 = teamController.createTeam({ name: "red" });
    const team2 = teamController.createTeam({ name: "blue" });

    resourcesController.initTeamResourcesState(team1);
    resourcesController.initTeamResourcesState(team2);

    resourcesController.setCoins(team1, 1000);
    resourcesController.setCoins(team2, 1000);

    times(100, () => dotsController.addDotRandom(team1));
    times(100, () => dotsController.addDotRandom(team2));

    const center1 = { x: 1000, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center1,
        ),
        center: center1,
    });
    const center2 = { x: 900, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.house,
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.house.frameRelative,
            center2,
        ),
        center: center1,
    });
    const center3 = { x: 870, y: 1100 };
    buildingsController.addBuilding({
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
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.lumberMill,
        kind: "lumberMill",
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.lumberMill.frameRelative,
            center6,
        ),
        center: center6,
    });
    const center7 = { x: 850, y: 920 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team1,
        frame: createPolygonOffset(BUILDINGS_CONFIGS.hq.frameRelative, center7),
        center: center7,
    });

    const center4 = { x: 1700, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        kind: "barracks",
        team: team2,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center4,
        ),
        center: center4,
        spawnQueue: [],
    });
    const center5 = { x: 1850, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.house,
        kind: "house",
        team: team2,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.house.frameRelative,
            center5,
        ),
        center: center5,
    });
    const center8 = { x: 2000, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team2,
        frame: createPolygonOffset(BUILDINGS_CONFIGS.hq.frameRelative, center8),
        center: center8,
    });
    const center9 = { x: 2070, y: 1100 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.farm,
        kind: "farm",
        team: team2,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.farm.frameRelative,
            center9,
        ),
        center: center9,
    });
    const center10 = { x: 2070, y: 1300 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.lumberMill,
        kind: "lumberMill",
        team: team2,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.lumberMill.frameRelative,
            center10,
        ),
        center: center10,
    });

    resourcesController.setWood(team1, 70);
    resourcesController.setWood(team2, 70);

    return { team1, team2 };
}

export function sceneTwoSquads(game: Game, ui: UI) {
    const {
        dotsController,
        squadsController,
    } = game.getPrivateStaffYouShouldNotUse();

    for (const dot of dotsController.dots) {
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
    ui.squadsSelected.splice(0, ui.squadsSelected.length);

    for (const dot of dotsController.dots) {
        if (dot.team.name === "blue") {
            ui.dotsSelected.add(dot);
        }
    }

    ui.createSquad();

    ui.startDestination({ x: 1600, y: 1600 });
    ui.adjustDestination({ x: 1600, y: 1100 });
    ui.commandMove();

    ui.cancelSelection();
    ui.squadsSelected.splice(0, ui.squadsSelected.length);
    ui.selectSquadFrame(squadsController.squads[0]);
}

export function sceneOneTeamLeftBottom(game: Game) {
    const {
        teamController,
        resourcesController,
        buildingsController,
    } = game.getPrivateStaffYouShouldNotUse();

    const team = teamController.createTeam({ name: "green" });

    resourcesController.initTeamResourcesState(team);

    resourcesController.setCoins(team, 1000);

    const center1 = { x: 1000, y: 2000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center1,
        ),
        center: center1,
    });
    const center2 = { x: 900, y: 2000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.house,
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.house.frameRelative,
            center2,
        ),
        center: center1,
    });
    const center3 = { x: 870, y: 2100 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.farm,
        kind: "farm",
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.farm.frameRelative,
            center3,
        ),
        center: center3,
    });
    const center6 = { x: 1170, y: 2300 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.lumberMill,
        kind: "lumberMill",
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.lumberMill.frameRelative,
            center6,
        ),
        center: center6,
    });
    const center7 = { x: 850, y: 2320 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team,
        frame: createPolygonOffset(BUILDINGS_CONFIGS.hq.frameRelative, center7),
        center: center7,
    });

    resourcesController.setWood(team, 70);

    return team;
}

export function sceneOneTeamRightBottom(game: Game) {
    const {
        teamController,
        resourcesController,
        buildingsController,
    } = game.getPrivateStaffYouShouldNotUse();

    const team = teamController.createTeam({ name: "orange" });

    resourcesController.initTeamResourcesState(team);

    resourcesController.setCoins(team, 1000);

    const center1 = { x: 2000, y: 2000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center1,
        ),
        center: center1,
    });
    const center2 = { x: 2100, y: 2000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.house,
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.house.frameRelative,
            center2,
        ),
        center: center1,
    });
    const center3 = { x: 1870, y: 2100 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.farm,
        kind: "farm",
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.farm.frameRelative,
            center3,
        ),
        center: center3,
    });
    const center6 = { x: 2170, y: 2300 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.lumberMill,
        kind: "lumberMill",
        team: team,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.lumberMill.frameRelative,
            center6,
        ),
        center: center6,
    });
    const center7 = { x: 1850, y: 2320 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team,
        frame: createPolygonOffset(BUILDINGS_CONFIGS.hq.frameRelative, center7),
        center: center7,
    });

    resourcesController.setWood(team, 70);

    return team;
}
