import type { Game } from "../Game";
import type { Team } from "../Game/TeamController";

// @deprecated
export class PlayerLegacy {
    constructor(readonly game: Game, readonly team: Team) {}
}
