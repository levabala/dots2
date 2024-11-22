export type Team = {
    index: number;
    name: string;
    dotsCount: number;
};

export class TeamController {
    teams = new Set<Team>();
    teamCounter = 0;

    createTeam(teamParams: Omit<Team, "index" | "dotsCount">): Team {
        const team = { ...teamParams, dotsCount: 0, index: this.teamCounter++ };
        this.teams.add(team);

        return team;
    }
}
