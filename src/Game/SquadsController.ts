import { SQUAD_NAMES } from "../assets/squadNames";
import { arePointsEqual, distanceBetween, type Point } from "../utils";
import type { Dot } from "./DotsController";
import type { Team } from "./TeamController";

export type Squad = {
    key: string;
    index: number;
    slots: Slot[];
    attackTargetSquads: Set<Squad>;
    attackTargetedBySquads: Set<Squad>;
    allowAttack: boolean;
    allowShootOnce: boolean;
    dotsToShootOnce: Set<Dot>;
    team: Team;
    removed: boolean;
};

export type Slot = {
    position: Point;
    angle: number;
    dot: Dot | null;
};

export type SquadsControllerTickEffects = {
    squadsRemoved: Squad[];
};

export class SquadsController {
    squads: Squad[] = [];

    constructor(
        // TODO: remove this dependency
        readonly checkHasShootIntersectionWithOwnTeam: (
            dot: Dot,
            target: Dot,
        ) => boolean,
    ) {}

    fillEmptyFrontSlots(squad: Squad) {
        let headIndex = 0;
        let tailIndex = squad.slots.length - 1;
        while (headIndex < tailIndex) {
            const head = squad.slots[headIndex];
            if (head.dot) {
                headIndex++;
                continue;
            }

            const tail = squad.slots[tailIndex];
            if (tail.dot === null) {
                tailIndex--;
                continue;
            }

            head.dot = tail.dot;
            tail.dot = null;

            head.dot.slot = head;
        }
    }

    squadKeyIndex = 0;
    createSquadKey() {
        return SQUAD_NAMES[this.squadKeyIndex++] || "JustASquad";
    }

    createSquad(slots: Slot[], team: Team) {
        const squad: Squad = {
            key: this.createSquadKey(),
            index: this.squads.length,
            slots,
            attackTargetSquads: new Set(),
            attackTargetedBySquads: new Set(),
            allowAttack: false,
            allowShootOnce: false,
            dotsToShootOnce: new Set(),
            team,
            removed: false,
        };
        this.squads.push(squad);

        for (const slot of slots) {
            if (!slot.dot) {
                continue;
            }

            slot.dot.squad = squad;
            slot.dot.slot = slot;
        }

        return squad;
    }

    removeSquad(squad: Squad) {
        squad.removed = true;

        this.squads.splice(this.squads.indexOf(squad), 1);

        for (const slot of squad.slots) {
            if (!slot.dot) {
                continue;
            }

            const dot = slot.dot;

            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
            }

            for (const targeter of dot.attackTargetedByDots) {
                targeter.attackTargetDot = null;
            }

            dot.squad = null;
            dot.slot = null;
            dot.attackTargetDot = null;
        }

        for (const squadAttacker of squad.attackTargetedBySquads) {
            squadAttacker.attackTargetSquads.delete(squad);
        }
    }

    isInSquad(dot: Dot) {
        return this.squads.some((squad) =>
            squad.slots.some((slot) => slot.dot === dot),
        );
    }

    removeSquadIfEmpty(squad: Squad): { isRemoved: boolean } {
        const squadHasNoDots = squad.slots.every((slot) => slot.dot === null);

        if (squadHasNoDots) {
            this.removeSquad(squad);

            return { isRemoved: true };
        }

        return { isRemoved: false };
    }

    assignDotToSlot(dot: Dot, slot: Slot): void {
        if (dot.slot) {
            dot.slot.dot = null;
        }

        slot.dot = dot;
        dot.slot = slot;
    }

    tick(_timeDelta: number): SquadsControllerTickEffects {
        const effects: SquadsControllerTickEffects = {
            squadsRemoved: [],
        };

        const changePathToSquad = (squad: Squad) => {
            for (const slot of squad.slots) {
                if (!slot.dot) {
                    continue;
                }

                if (
                    slot.dot.path.length === 0 &&
                    arePointsEqual(slot.dot.position, slot.position)
                ) {
                    continue;
                }

                slot.dot.path = [slot.position];
            }
        };

        const assignDotAttackTargetsBySquad = (
            dot: Dot,
            squadTargets: Set<Squad>,
        ) => {
            if (
                dot.attackTargetDot?.squad &&
                squadTargets.has(dot.attackTargetDot?.squad)
            ) {
                const distance = distanceBetween(
                    dot.position,
                    dot.attackTargetDot.position,
                );

                if (
                    distance > dot.attackRange ||
                    this.checkHasShootIntersectionWithOwnTeam(
                        dot,
                        dot.attackTargetDot,
                    )
                ) {
                    dot.attackTargetDot?.attackTargetedByDots.delete(dot);
                    dot.attackTargetDot = null;
                } else {
                    return;
                }
            }

            const dotPotentionalTargets = [];
            for (const squad of squadTargets) {
                for (const slot of squad.slots) {
                    if (!slot.dot) {
                        continue;
                    }

                    const distance = distanceBetween(
                        dot.position,
                        slot.dot.position,
                    );
                    if (distance > dot.attackRange) {
                        continue;
                    }

                    const hasIntersection =
                        this.checkHasShootIntersectionWithOwnTeam(
                            dot,
                            slot.dot,
                        );

                    if (hasIntersection !== false) {
                        continue;
                    }

                    dotPotentionalTargets.push(slot.dot);
                }
            }

            if (!dotPotentionalTargets.length) {
                dot.attackTargetDot?.attackTargetedByDots.delete(dot);
                dot.attackTargetDot = null;
                return;
            }

            dotPotentionalTargets.sort(
                (d1, d2) =>
                    Math.hypot(
                        d1.position.x - dot.position.x,
                        d1.position.y - dot.position.y,
                    ) -
                    Math.hypot(
                        d2.position.x - dot.position.x,
                        d2.position.y - dot.position.y,
                    ),
            );

            const target = dotPotentionalTargets[0];

            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
            }

            window.assert(
                target.removed !== true,
                "attack target dot must not be removed",
                { dot, target },
            );

            dot.attackTargetDot = target;
            target.attackTargetedByDots.add(dot);
        };

        const removeSquadIfEmpty = (squad: Squad) => {
            const { isRemoved } = this.removeSquadIfEmpty(squad);

            if (isRemoved) {
                effects.squadsRemoved.push(squad);
            }
        };

        for (const squad of this.squads) {
            changePathToSquad(squad);

            if (squad.attackTargetSquads.size) {
                for (const slot of squad.slots) {
                    const dot = slot.dot;

                    if (!dot) {
                        continue;
                    }

                    if (dot.path.length > 0) {
                        continue;
                    }

                    if (dot.attackCooldownLeft === 0) {
                        assignDotAttackTargetsBySquad(
                            dot,
                            squad.attackTargetSquads,
                        );
                    }
                }
            }

            this.fillEmptyFrontSlots(squad);
        }

        for (const squad of this.squads) {
            removeSquadIfEmpty(squad);
        }

        return effects;
    }
}
