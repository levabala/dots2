import type { Team } from "./Game";

export type ResourcesState = {
    food: number;
    housing: number;
};

export class ResourcesController {
    teamToState = new Map<Team, ResourcesState>();

    constructor() {}

    initTeamResourcesState(team: Team) {
        this.teamToState.set(team, {
            food: 0,
            housing: 0,
        });
    }

    changeFood(team: Team, foodDelta: number) {
        const state = this.getState(team);

        state.food += foodDelta;

        window.assert(state.food >= 0, "food must be positive", {
            food: state.food,
        });
    }

    setHousing(team: Team, housing: number) {
        const state = this.getState(team);

        state.housing = housing;
    }

    private getState(team: Team) {
        const state = this.teamToState.get(team);

        if (state === undefined) {
            window.panic("team must have state", {
                team,
            });
        }

        return state;
    }
}
