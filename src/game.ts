import { DOT_SPEED } from "./consts";
import type { Point } from "./utils";
import { randomInteger, times } from "remeda";

export type Dot = Point & {
    index: number;
    speed: number;
    path: Point[];
    attackTargetedByDots: Set<Dot>;
    attackTargetDot: Dot | null;
    attackTargetSquad: Squad | null;
    attackRange: number;
    attackCooldown: number;
    squad: Squad | null;
};

export type Slot = {
    position: Point;
    dotIndex: number | null;
};

export type Squad = {
    index: number;
    slots: Slot[];
    attackTargetDot: Dot | null;
    attackTargetSquad: Squad | null;
};

export class Game {
    dots: Dot[] = [];
    dotsSelectedIndexes = new Set<number>();
    squads: Squad[] = [];

    constructor(
        readonly width: number,
        readonly height: number,
    ) {}

    init() {
        times(5000, () => this.addDotRandom());
    }

    attackSquad({
        squadAttacker,
        squadTarget,
    }: {
        squadAttacker: Squad;
        squadTarget: Squad;
    }) {
        squadAttacker.attackTargetSquad = squadTarget;
    }

    createSquad(slots: Slot[]) {
        const squad: Squad = {
            index: this.squads.length,
            slots,
            attackTargetDot: null,
            attackTargetSquad: null,
        };
        this.squads.push(squad);

        for (const slot of slots) {
            if (slot.dotIndex === null) {
                continue;
            }

            this.dots[slot.dotIndex].squad = squad;
        }

        return squad;
    }

    removeSquad(squad: Squad) {
        this.squads.splice(this.squads.indexOf(squad), 1);

        for (const slot of squad.slots) {
            if (slot.dotIndex === null) {
                continue;
            }

            const dot = this.dots[slot.dotIndex];

            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
            }

            dot.squad = null;
            dot.attackTargetSquad = null;
            dot.attackTargetDot = null;
        }
    }

    isInSquad(dotIndex: number) {
        return this.squads.some((squad) =>
            squad.slots.some((slot) => slot.dotIndex === dotIndex),
        );
    }

    addDotRandom() {
        this.dots.push({
            index: this.dots.length,
            x: randomInteger(0, this.width),
            y: randomInteger(0, this.height),
            path: [],
            speed: DOT_SPEED,
            attackTargetDot: null,
            attackTargetSquad: null,
            attackRange: 200,
            attackCooldown: 1000,
            attackTargetedByDots: new Set(),
            squad: null,
        });
    }

    dotSelect(dotIndex: number) {
        this.dotsSelectedIndexes.add(dotIndex);
    }

    dotSelectAllWithoutSquad() {
        this.dotsSelectedIndexes = new Set(times(this.dots.length, (i) => i));

        for (const squad of this.squads) {
            for (const slot of squad.slots) {
                if (slot.dotIndex !== null) {
                    this.dotsSelectedIndexes.delete(slot.dotIndex);
                }
            }
        }
    }

    dotUnselect(dotIndex: number) {
        this.dotsSelectedIndexes.delete(dotIndex);
    }

    dotsAllUnselect() {
        this.dotsSelectedIndexes.clear();
    }

    isDotSelected(dotIndex: number) {
        return this.dotsSelectedIndexes.has(dotIndex);
    }

    dotMoveTo(dotIndex: number, destination: Point) {
        this.dots[dotIndex].path = [destination];
    }

    tick(timeDelta: number) {
        const moveByPath = (dot: Dot) => {
            const maxMoveDistance = timeDelta * DOT_SPEED;

            const target = dot.path[0];
            const dxRaw = target.x - dot.x;
            const dyRaw = target.y - dot.y;

            if (dxRaw === 0 && dyRaw === 0) {
                return;
            }

            const angle = Math.atan2(dyRaw, dxRaw);
            const lengthRaw = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
            const length = Math.min(lengthRaw, maxMoveDistance);

            if (length === 0) {
                return;
            }

            const dx = length * Math.cos(angle);
            const dy = length * Math.sin(angle);

            dot.x += dx;
            dot.y += dy;

            if (length < maxMoveDistance) {
                dot.path.splice(0, 1);
            }
        };

        const changePathToSquad = (squad: Squad) => {
            for (const slot of squad.slots) {
                if (slot.dotIndex === null) {
                    continue;
                }

                const dot = this.dots[slot.dotIndex];
                dot.path = [slot.position];
            }
        };

        const assignDotAttackTargetsBySquad = (
            dot: Dot,
            squadTarget: Squad,
        ) => {
            if (dot.attackTargetSquad === squadTarget) {
                return;
            }

            const dotPotentionalTargets = [];
            for (const slot of squadTarget.slots) {
                if (slot.dotIndex === null) {
                    continue;
                }

                dotPotentionalTargets.push(this.dots[slot.dotIndex]);
            }

            if (!dotPotentionalTargets.length) {
                return;
            }

            dotPotentionalTargets
                .sort(
                    (d1, d2) =>
                        Math.hypot(d1.x - dot.x, d1.y - dot.y) -
                        Math.hypot(d2.x - dot.x, d2.y - dot.y),
                )
                .sort(
                    (d1, d2) =>
                        d1.attackTargetedByDots.size -
                        d2.attackTargetedByDots.size,
                );

            const target = dotPotentionalTargets[0];

            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
            }

            dot.attackTargetDot = target;
            dot.attackTargetSquad = target.squad;
            target.attackTargetedByDots.add(dot);
        };

        for (const squad of this.squads) {
            changePathToSquad(squad);

            if (squad.attackTargetSquad) {
                for (const slot of squad.slots) {
                    if (slot.dotIndex === null) {
                        continue;
                    }

                    const dot = this.dots[slot.dotIndex];

                    assignDotAttackTargetsBySquad(dot, squad.attackTargetSquad);
                }
            }
        }

        for (const dot of this.dots) {
            if (dot.path.length) {
                moveByPath(dot);
            }
        }
    }
}
