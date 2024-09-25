import type { Team } from "./TeamController";

export type Resource = "food" | "wood" | "coins" | "housing";

export type ResourcesState = { [key in Resource]: number } & {
    [key in Resource as `${key}Capacity`]: number;
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
            coins: 0,
            coinsCapacity: Infinity,
            housingCapacity: Infinity,
        });
    }

    changeFood(team: Team, foodDelta: number) {
        const state = this.getState(team);

        state.food = Math.min(state.food + foodDelta, state.foodCapacity);

        window.assert(state.food >= 0, "food must be positive", {
            food: state.food,
        });
    }

    changeWood(team: Team, woodDelta: number) {
        const state = this.getState(team);

        state.wood = Math.min(state.wood + woodDelta, state.woodCapacity);

        window.assert(state.wood >= 0, "wood must be positive", {
            wood: state.wood,
        });
    }

    setWood(team: Team, wood: number) {
        const state = this.getState(team);

        state.wood = wood;
    }

    changeCoins(team: Team, coinsDelta: number) {
        const state = this.getState(team);

        state.coins = state.coins + coinsDelta;

        window.assert(state.coins >= 0, "coins must be positive", {
            coins: state.coins,
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

    setWoodCapacity(team: Team, woodCapacity: number) {
        const state = this.getState(team);

        state.woodCapacity = woodCapacity;
    }

    setCoins(team: Team, coins: number) {
        const state = this.getState(team);

        state.coins = coins;
    }

    getState(team: Team) {
        const state = this.teamToState.get(team);

        if (state === undefined) {
            window.panic("team must have state", {
                team,
            });
        }

        return state;
    }
}
