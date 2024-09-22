import { SQUAD_NAMES } from "../assets/squadNames";
import { arePointsEqual, type Point } from "../utils";
import type { Building } from "./BuildingsController";
import type { Dot } from "./DotsController";
import type { Team } from "./TeamController";

export type Squad = {
    key: string;
    index: number;
    slots: Slot[];
    attackTargetBuildings: Set<Building>;
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

    constructor() {}

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
            if (tail.dot === null || tail.dot.attackCooldownLeft > 0) {
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
            attackTargetBuildings: new Set(),
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
            dot.allowAttack = true;
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
        dot.allowAttack = false;
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
        const removeSquadIfEmpty = (squad: Squad) => {
            const { isRemoved } = this.removeSquadIfEmpty(squad);

            if (isRemoved) {
                effects.squadsRemoved.push(squad);
            }
        };

        for (const squad of this.squads) {
            changePathToSquad(squad);

            this.fillEmptyFrontSlots(squad);
        }

        for (const squad of this.squads) {
            removeSquadIfEmpty(squad);
        }

        return effects;
    }
}
