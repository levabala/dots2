import type { Game } from "../Game";


export function oneTeam(game: Game) {
    const {
        teamController, resourcesController, dotsController, buildingsController,
    } = game.getPrivateStaffYouShouldNotUse();

    const team1 = teamController.createTeam({ name: "red" });

    resourcesController.initTeamResourcesState(team1);

    resourcesController.setCoins(team1, 1000);

    times(100, () => dotsController.addDotRandom(team1));

    const center1 = { x: 1000, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.barracks,
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.barracks.frameRelative,
            center1
        ),
        center: center1,
    });
    const center2 = { x: 900, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.house,
        team: team1,
        frame: createPolygonOffset(
            BUILDINGS_CONFIGS.house.frameRelative,
            center2
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
            center3
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
            center6
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
            center4
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
            center5
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
            center9
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
            center10
        ),
        center: center10,
    });

    resourcesController.setWood(team1, 70);
    resourcesController.setWood(team2, 70);

    return { team1, team2 };
}

