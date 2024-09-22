import type { Team } from "./TeamController";

export type ResourcesState = {
    food: number;
    foodCapacity: number;
    housing: number;
    wood: number;
    woodCapacity: number;
};

export class ResourcesController {
    teamToState = new Map<Team, ResourcesState>();

    constructor() {}

    initTeamResourcesState(team: Team) {
        this.teamToState.set(team, {
            food: 0,
            foodCapacity: 0,
            housing: 0,
            wood: 0,
            woodCapacity: 0,
        });
    }

    changeFood(team: Team, foodDelta: number) {
        const state = this.getState(team);

        state.food = Math.min(state.food + foodDelta, state.foodCapacity);

        window.assert(state.food >= 0, "food must be positive", {
            food: state.food,
        });
    }

    setHousing(team: Team, housing: number) {
        const state = this.getState(team);

        state.housing = housing;
    }

    setFoodCapacity(team: Team, foodCapacity: number) {
        const state = this.getState(team);

        state.foodCapacity = foodCapacity;
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
