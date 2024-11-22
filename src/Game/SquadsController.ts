import { SQUAD_NAMES } from "../assets/squadNames";
import { BETWEEN_SQUADS_GAP, SQUAD_MIN_DOTS } from "../consts";
import {
    arePointsEqual,
    distanceBetween,
    rotatePoint,
    rotateRect,
    type Point,
    type Rect,
} from "../shapes";
import type { Building } from "./BuildingsController";
import type { Dot } from "./DotsController";
import { SquadFrameUtils } from "./SquadFrameUtils";
import type { Team } from "./TeamController";

export type Squad = {
    key: string;
    index: number;
    frame: Rect;
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

    fillSlotsMutate(slots: Slot[], dots: Dot[]) {
        for (const [index, slot] of slots.entries()) {
            if (index >= dots.length) {
                return;
            }

            this.assignDotToSlot(dots[index], slot);
        }
    }

    createSquad(dots: Dot[], team: Team, center: Point) {
        if (dots.length < SQUAD_MIN_DOTS) {
            return { isSuccess: false, error: "no enough dots" } as const;
        }

        const frame = SquadFrameUtils.createSquadSquare(dots.length, center);

        const slots = this.createSlots(frame, dots.length);

        this.fillSlotsMutate(slots, dots);

        const squad: Squad = {
            key: this.createSquadKey(),
            index: this.squads.length,
            frame,
            slots,
            attackTargetBuildings: new Set(),
            attackTargetSquads: new Set(),
            attackTargetedBySquads: new Set(),
            allowAttack: true,
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

        return { isSuccess: true, squad } as const;
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

    createSlotPositions(rect: Rect, count: number) {
        const angle = Math.atan2(rect.p2.y - rect.p1.y, rect.p2.x - rect.p1.x);
        const rectOrth = rotateRect({ rect, anchor: rect.p1, angle: -angle });
        const lengthFront = rectOrth.p2.x - rectOrth.p1.x;
        const lengthSide = rectOrth.p4.y - rectOrth.p1.y;
        const columns = Math.ceil(
            Math.sqrt((count * lengthFront) / lengthSide),
        );
        const rows = Math.ceil(Math.sqrt((count * lengthSide) / lengthFront));

        const positions: Point[] = [];
        let countLeft = count;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                if (countLeft-- <= 0) {
                    break;
                }

                const pointOrth = {
                    x: rectOrth.p1.x + (lengthFront * c) / (columns - 1 || 1),
                    y: rectOrth.p1.y + (lengthSide * r) / (rows - 1 || 1),
                };
                positions.push(rotatePoint(pointOrth, rectOrth.p1, angle));
            }
        }

        return positions;
    }

    createSlots(rect: Rect, count: number) {
        const positions = this.createSlotPositions(rect, count);

        const angle = Math.atan2(rect.p3.y - rect.p2.y, rect.p3.x - rect.p2.x);

        return positions.map<Slot>((position) => ({
            position,
            dot: null,
            angle,
        }));
    }

    // chatgpt (c)
    updateSlotPositionsAndReassignDots(squad: Squad, newFrame: Rect) {
        const oldSlots = squad.slots;
        const newPositions = this.createSlotPositions(
            newFrame,
            oldSlots.length,
        );

        // Calculate the front direction angle from p1 to p2
        const frontAngle =
            Math.atan2(
                newFrame.p2.y - newFrame.p1.y,
                newFrame.p2.x - newFrame.p1.x,
            ) + Math.PI;

        // Update slot positions and angles based on the front direction of the frame
        oldSlots.forEach((slot, index) => {
            slot.position = newPositions[index];
            slot.angle = frontAngle; // Set the angle towards the front of the frame
        });

        // Reassign dots to maintain minimal position change
        oldSlots.forEach((slot) => {
            if (slot.dot) {
                let minDistance = Infinity;
                let closestSlot = slot;

                oldSlots.forEach((targetSlot) => {
                    const distance = distanceBetween(
                        slot.position,
                        targetSlot.position,
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestSlot = targetSlot;
                    }
                });

                if (closestSlot !== slot) {
                    this.assignDotToSlot(slot.dot, closestSlot);
                    slot.dot = null;
                }
            }
        });

        return squad;
    }

    moveSquadTo(squad: Squad, targetFrame: Rect) {
        this.updateSlotPositionsAndReassignDots(squad, targetFrame);

        squad.frame = targetFrame;
    }

    // chatgpt (c)
    /** @deprecated */
    moveSquadsTo(squads: Squad[], targetFrame: Rect) {
        const N = squads.length;
        if (N === 0) return [];

        const totalLength = distanceBetween(targetFrame.p1, targetFrame.p2);
        const sideLength = distanceBetween(targetFrame.p1, targetFrame.p4);
        const density = SquadFrameUtils.calcDotArea(); // Area per unit

        const frontDirection = {
            x: (targetFrame.p2.x - targetFrame.p1.x) / totalLength,
            y: (targetFrame.p2.y - targetFrame.p1.y) / totalLength,
        };

        const sideDirection = {
            x: targetFrame.p4.x - targetFrame.p1.x,
            y: targetFrame.p4.y - targetFrame.p1.y,
        };

        const squadRects = [];

        let currentOffset = 0;
        for (const squad of squads) {
            const squadUnits = squad.slots.length;

            const squadArea = squadUnits * density;
            const squadLength = squadArea / sideLength;

            const start = {
                x: targetFrame.p1.x + frontDirection.x * currentOffset,
                y: targetFrame.p1.y + frontDirection.y * currentOffset,
            };
            const end = {
                x: start.x + frontDirection.x * squadLength,
                y: start.y + frontDirection.y * squadLength,
            };

            const squadRect: Rect = {
                p1: start,
                p2: end,
                p3: {
                    x: end.x + sideDirection.x,
                    y: end.y + sideDirection.y,
                },
                p4: {
                    x: start.x + sideDirection.x,
                    y: start.y + sideDirection.y,
                },
            };

            this.updateSlotPositionsAndReassignDots(squad, squadRect);

            squadRects.push(squadRect);

            squad.frame = squadRect;

            currentOffset += squadLength + BETWEEN_SQUADS_GAP;
        }

        return squadRects;
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

        const removeAttackTargetBuildingIfDead = (squad: Squad) => {
            const buildingsToRemove: Building[] = [];
            for (const building of squad.attackTargetBuildings) {
                if (building.health <= 0) {
                    buildingsToRemove.push(building);
                }
            }

            for (const building of buildingsToRemove) {
                squad.attackTargetBuildings.delete(building);
            }
        };

        for (const squad of this.squads) {
            changePathToSquad(squad);

            this.fillEmptyFrontSlots(squad);
        }

        for (const squad of this.squads) {
            removeSquadIfEmpty(squad);
        }

        for (const squad of this.squads) {
            removeAttackTargetBuildingIfDead(squad);
        }

        return effects;
    }
}
