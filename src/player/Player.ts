import type { Game } from "../Game";
import type { Team } from "../Game/TeamController";

export class Player {
    constructor(readonly game: Game, readonly team: Team) {}
}
