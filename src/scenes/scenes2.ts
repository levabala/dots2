import { times } from "remeda";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import { createPolygonOffset } from "../shapes";

export function sceneOneTeam(game: Game) {
    const {
        teamController,
        resourcesController,
        dotsController,
        buildingsController,
    } = game.getPrivateStaffYouShouldNotUse();

    const team1 = teamController.createTeam({ name: "red" });

    resourcesController.initTeamResourcesState(team1);

    resourcesController.setCoins(team1, 1000);

    times(100, () => dotsController.addDotRandom(team1));

    const center1 = { x: 1000, y: 1000 };
    buildingsController.addBuilding({
        ...BUILDINGS_CONFIGS.hq,
        kind: "hq",
        team: team1,
        frame: createPolygonOffset(BUILDINGS_CONFIGS.hq.frameRelative, center1),
        center: center1,
    });

    resourcesController.setWood(team1, 70);

    return { team1 };
}
