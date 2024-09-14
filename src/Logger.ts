import type { Game } from "./Game";

export type Log = {
    timestamp: Date;
    name: string;
    details: object;
};

export class Logger {
    logArray: Log[] = [];
    watchTargets: object[] = [];

    constructor(readonly game: Game) {
        this.game.addEventListener("dot-action-verbose", ({ dot, name, details }) => {
            if (!this.watchTargets.includes(dot)) {
                return;
            }

            this.log({ name, details: { dot, ...details } });
        });
    }

    log(data: Omit<Log, "timestamp">) {
        this.logArray.push({
            timestamp: new Date(),
            ...data,
        });
    }

    addWatchTarget(target: object) {
        this.watchTargets.push(target);
    }

    removeWatchTarget(target: object) {
        this.watchTargets.splice(this.watchTargets.indexOf(target), 1);
    }
}
