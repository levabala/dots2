export type ResourcesState = {
    food: number;
}

export class ResourcesController implements ResourcesState {
    food = 0;

    constructor({ food }: { food: number }) {
        this.food = food;
    }

    changeFood(foodDelta: number) {
        this.food += foodDelta;

        window.assert(this.food >= 0, "food must be positive", {
            food: this.food,
        });
    }
}
