import { DEFAULT_PROJECTILE, DOT_HEIGHT, DOT_SPEED, DOT_WIDTH } from "./consts";
import {
    distanceBetween as getDistanceBetween,
    getIntersectionAny,
    rotatePoint,
    type Point,
    type Rect,
} from "./utils";
import { randomInteger, times } from "remeda";

export type Dot = {
    position: Point;
    speed: number;
    path: Point[];
    attackTargetedByDots: Set<Dot>;
    attackTargetDot: Dot | null;
    attackRange: number;
    attackCooldown: number;
    attackCooldownLeft: number;
    squad: Squad | null;
    slot: Slot | null;
    hitBox: Rect;
    health: number;
    angle: number;
};

export type Projectile = {
    position: Point;
    angle: number;
    speed: number;
    damage: number;
    flyDistanceLeft: number;
    fromDot: Dot;
    radius: number;
};

export type Slot = {
    position: Point;
    angle: number;
    dot: Dot | null;
};

export type Squad = {
    index: number;
    slots: Slot[];
    attackTargetDot: Dot | null;
    attackTargetSquad: Squad | null;
};

export class Game {
    dots = new Set<Dot>();
    dotsSelected = new Set<Dot>();
    squads: Squad[] = [];
    projectiles: Projectile[] = [];

    constructor(
        readonly width: number,
        readonly height: number,
    ) {}

    init() {
        times(1000, () => this.addDotRandom());
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

    shootProjectile(
        fromDot: Dot,
        toPoint: Point,
        params: Pick<
            Projectile,
            "speed" | "damage" | "flyDistanceLeft" | "radius"
        >,
    ) {
        const projectile: Projectile = {
            ...params,
            position: { ...fromDot.position },
            angle: Math.atan2(
                toPoint.y - fromDot.position.y,
                toPoint.x - fromDot.position.x,
            ),
            fromDot,
        };

        this.projectiles.push(projectile);
    }

    hitProjectile(projectile: Projectile, dot: Dot) {
        this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
        dot.health -= projectile.damage;

        if (dot.health <= 0) {
            this.removeDot(dot);
        }
    }

    removeDot(dot: Dot) {
        this.dots.delete(dot);
        if (dot.slot) {
            dot.slot.dot = null;
        }
        for (const targeter of dot.attackTargetedByDots) {
            targeter.attackTargetDot = null;
        }
    }

    assignDotToSlot(dot: Dot, slot: Slot): void {
        if (dot.slot) {
            dot.slot.dot = null;
        }

        slot.dot = dot;
        dot.slot = slot;
    }

    syncDotAndSlotAngle(dot: Dot, slot: Slot) {
        dot.angle = slot.angle;
        dot.hitBox = this.calculateHitBox(dot.position, dot.angle);
    }

    // chatgpt (c)
    private calculateHitBox(position: Point, angle: number): Rect {
        const initialHitBox: Rect = {
            p1: {
                x: position.x - DOT_WIDTH / 2,
                y: position.y - DOT_HEIGHT / 2,
            },
            p2: {
                x: position.x + DOT_WIDTH / 2,
                y: position.y - DOT_HEIGHT / 2,
            },
            p3: {
                x: position.x + DOT_WIDTH / 2,
                y: position.y + DOT_HEIGHT / 2,
            },
            p4: {
                x: position.x - DOT_WIDTH / 2,
                y: position.y + DOT_HEIGHT / 2,
            },
        };

        return this.calculateRotatedHitBox(position, initialHitBox, angle);
    }

    // chatgpt (c)
    private calculateRotatedHitBox(
        position: Point,
        hitBox: Rect,
        angle: number,
    ): Rect {
        return {
            p1: rotatePoint(hitBox.p1, position, angle),
            p2: rotatePoint(hitBox.p2, position, angle),
            p3: rotatePoint(hitBox.p3, position, angle),
            p4: rotatePoint(hitBox.p4, position, angle),
        };
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
            if (!slot.dot) {
                continue;
            }

            slot.dot.squad = squad;
            slot.dot.slot = slot;
        }

        return squad;
    }

    removeSquad(squad: Squad) {
        this.squads.splice(this.squads.indexOf(squad), 1);

        for (const slot of squad.slots) {
            if (!slot.dot) {
                continue;
            }

            const dot = slot.dot;

            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
            }

            dot.squad = null;
            dot.attackTargetDot = null;
        }
    }

    isInSquad(dot: Dot) {
        return this.squads.some((squad) =>
            squad.slots.some((slot) => slot.dot === dot),
        );
    }

    addDotRandom() {
        const position = {
            x: randomInteger(0, this.width),
            y: randomInteger(0, this.height),
        };
        this.dots.add({
            path: [],
            position,
            speed: DOT_SPEED,
            attackTargetDot: null,
            attackRange: 200,
            attackCooldown: 1000,
            attackCooldownLeft: 0,
            attackTargetedByDots: new Set(),
            squad: null,
            slot: null,
            health: 2,
            angle: 0,
            hitBox: this.calculateHitBox(position, 0),
        });
    }

    dotSelect(dot: Dot) {
        this.dotsSelected.add(dot);
    }

    dotSelectAllWithoutSquad() {
        this.dotsSelected = new Set(this.dots);

        for (const squad of this.squads) {
            for (const slot of squad.slots) {
                if (slot.dot) {
                    this.dotsSelected.delete(slot.dot);
                }
            }
        }
    }

    dotUnselect(dot: Dot) {
        this.dotsSelected.delete(dot);
    }

    dotsAllUnselect() {
        this.dotsSelected.clear();
    }

    isDotSelected(dot: Dot) {
        return this.dotsSelected.has(dot);
    }

    dotMoveTo(dot: Dot, destination: Point) {
        dot.path = [destination];
    }

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

    private checkHaShootIntersectionWithOwnSquad(
        dot: Dot,
        target: Dot,
    ): boolean {
        if (!dot.squad) {
            return false;
        }

        const line = {
            p1: dot.position,
            p2: target.position,
        };
        for (const slot of dot.squad.slots) {
            if (slot === dot.slot || !slot.dot) {
                continue;
            }

            const intersection = getIntersectionAny(line, slot.dot.hitBox);
            if (intersection) {
                return true;
            }
        }

        return false;
    }

    tick(timeDelta: number) {
        const moveByPath = (dot: Dot) => {
            const maxMoveDistance = timeDelta * DOT_SPEED;

            const target = dot.path[0];
            const dxRaw = target.x - dot.position.x;
            const dyRaw = target.y - dot.position.y;

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

            dot.position.x += dx;
            dot.position.y += dy;

            dot.hitBox.p1.x += dx;
            dot.hitBox.p2.x += dx;
            dot.hitBox.p3.x += dx;
            dot.hitBox.p4.x += dx;
            dot.hitBox.p1.y += dy;
            dot.hitBox.p2.y += dy;
            dot.hitBox.p3.y += dy;
            dot.hitBox.p4.y += dy;

            if (length < maxMoveDistance) {
                dot.path.splice(0, 1);
            }
        };

        const changePathToSquad = (squad: Squad) => {
            for (const slot of squad.slots) {
                if (!slot.dot) {
                    continue;
                }

                slot.dot.path = [slot.position];
            }
        };

        const assignDotAttackTargetsBySquad = (
            dot: Dot,
            squadTarget: Squad,
        ) => {
            if (dot.attackTargetDot?.squad === squadTarget) {
                const distance = getDistanceBetween(
                    dot.position,
                    dot.attackTargetDot.position,
                );

                if (
                    distance > dot.attackRange ||
                    this.checkHaShootIntersectionWithOwnSquad(
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
            for (const slot of squadTarget.slots) {
                if (!slot.dot) {
                    continue;
                }

                const distance = getDistanceBetween(
                    dot.position,
                    slot.dot.position,
                );
                if (distance > dot.attackRange) {
                    continue;
                }

                const hasIntersection =
                    this.checkHaShootIntersectionWithOwnSquad(dot, slot.dot);

                if (hasIntersection) {
                    continue;
                }

                dotPotentionalTargets.push(slot.dot);
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

            dotPotentionalTargets.sort(
                (d1, d2) =>
                    d1.attackTargetedByDots.size - d2.attackTargetedByDots.size,
            );

            const target = dotPotentionalTargets[0];

            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
            }

            dot.attackTargetDot = target;
            target.attackTargetedByDots.add(dot);
        };

        const proceedCooldown = (dot: Dot) => {
            dot.attackCooldownLeft = Math.max(
                dot.attackCooldownLeft - timeDelta,
                0,
            );
        };

        const tryShoot = (dot: Dot) => {
            if (!dot.attackTargetDot || dot.attackCooldownLeft > 0) {
                return;
            }

            const distance = getDistanceBetween(
                dot.position,
                dot.attackTargetDot.position,
            );
            if (distance > dot.attackRange) {
                return;
            }

            const hasIntersection = this.checkHaShootIntersectionWithOwnSquad(
                dot,
                dot.attackTargetDot,
            );

            if (hasIntersection) {
                return;
            }

            this.shootProjectile(
                dot,
                dot.attackTargetDot.position,
                DEFAULT_PROJECTILE,
            );
            dot.attackCooldownLeft = dot.attackCooldown;
        };

        const updateProjectile = (projectile: Projectile) => {
            const traveledDistance = projectile.speed * timeDelta;

            const dx = Math.cos(projectile.angle) * traveledDistance;
            const dy = Math.sin(projectile.angle) * traveledDistance;

            const line = {
                p1: projectile.position,
                p2: {
                    x: projectile.position.x + dx,
                    y: projectile.position.y + dy,
                },
            };

            let closestIntersection: { dot: Dot; distance: number } | null =
                null;
            for (const dot of this.dots) {
                if (dot === projectile.fromDot) {
                    continue;
                }

                const intersection = getIntersectionAny(line, dot.hitBox);

                if (!intersection) {
                    continue;
                }

                const distance = getDistanceBetween(
                    projectile.position,
                    intersection,
                );
                if (
                    closestIntersection === null ||
                    distance > closestIntersection.distance
                ) {
                    closestIntersection = { dot, distance };
                }
            }

            if (closestIntersection) {
                this.hitProjectile(projectile, closestIntersection.dot);
                return;
            }

            projectile.position.x += dx;
            projectile.position.y += dy;
        };

        for (const squad of this.squads) {
            changePathToSquad(squad);

            if (squad.attackTargetSquad) {
                for (const slot of squad.slots) {
                    if (!slot.dot) {
                        continue;
                    }

                    const dot = slot.dot;

                    assignDotAttackTargetsBySquad(dot, squad.attackTargetSquad);
                    proceedCooldown(dot);
                    tryShoot(dot);
                }
            }

            this.fillEmptyFrontSlots(squad);

            for (const slot of squad.slots) {
                if (!slot.dot) {
                    continue;
                }

                this.syncDotAndSlotAngle(slot.dot, slot);
            }
        }

        for (const projectile of this.projectiles) {
            updateProjectile(projectile);
        }

        for (const dot of this.dots) {
            if (dot.path.length) {
                moveByPath(dot);
            }
        }
    }
}
