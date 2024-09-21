import type { Team } from "./Game";

export class TeamController {
    teams = new Set<Team>();

    createTeam(teamParams: Omit<Team, "index" | "dotsCount">): Team {
        const team = { ...teamParams, dotsCount: 0, index: this.teams.size };
        this.teams.add(team);

        return team;
    }
}
