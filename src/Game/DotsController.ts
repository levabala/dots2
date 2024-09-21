import { randomInteger } from "remeda";
import {
    DEFAULT_PROJECTILE,
    DOT_HEIGHT,
    DOT_SPEED,
    DOT_WIDTH,
    DOTS_GRID_SIZE,
} from "../consts";
import { DotsGrid } from "../DotsGrid";
import type { Dot, Projectile, Slot, Team } from "./Game";
import {
    distanceBetween,
    getIntersectionAny,
    type Point,
    type Rect,
    rotatePoint,
} from "../utils";

export type ProjectileToShoot = {
    fromDot: Dot;
    toPoint: Point;
    params: Pick<Projectile, "speed" | "damage" | "flyDistanceLeft" | "radius">;
};

export type DotsControllerTickEffects = {
    projectilesToShoot: ProjectileToShoot[];
    dotsRemoved: Dot[];
};

export class DotsController {
    dotsGrid: DotsGrid;
    dots = new Set<Dot>();

    constructor(
        readonly width: number,
        readonly height: number,
    ) {
        this.dotsGrid = new DotsGrid(DOTS_GRID_SIZE, width, height);
    }

    initDot(
        dotPartial: Omit<
            Dot,
            | "path"
            | "attackTargetDot"
            | "attackCooldownLeft"
            | "attackTargetedByDots"
            | "aimingTimeLeft"
            | "aimingTarget"
            | "hitBox"
            | "squad"
            | "slot"
            | "gridSquareIndexes"
            | "removed"
        >,
    ): Dot {
        return {
            ...dotPartial,
            path: [],
            attackTargetDot: null,
            attackCooldownLeft: 0,
            attackTargetedByDots: new Set(),
            aimingTimeLeft: dotPartial.aimingDuration,
            aimingTarget: null,
            hitBox: this.calculateHitBox(
                dotPartial.position,
                0,
                DOT_WIDTH,
                DOT_HEIGHT,
            ),
            removed: false,

            squad: null,
            slot: null,
            gridSquareIndexes: [],
        };
    }

    addDot(dot: Dot) {
        this.dots.add(dot);
        this.dotsGrid.addDot(dot);
    }

    removeDot(dot: Dot) {
        dot.removed = true;

        this.dots.delete(dot);
        this.dotsGrid.removeDot(dot);

        if (dot.slot) {
            dot.slot.dot = null;
        }

        for (const targeter of dot.attackTargetedByDots) {
            targeter.attackTargetDot = null;
        }
    }

    generateDotRandom(): Omit<Dot, "team"> {
        const position = {
            x: randomInteger(1000, 2000),
            y: randomInteger(1000, 2000),
        };
        return {
            path: [],
            position,
            width: DOT_WIDTH,
            height: DOT_HEIGHT,
            speed: DOT_SPEED,
            attackTargetDot: null,
            attackRange: 200,
            attackCooldown: 3000,
            attackCooldownLeft: 0,
            attackTargetedByDots: new Set(),
            aimingDuration: 1000,
            aimingTimeLeft: 1000,
            aimingTarget: null,
            health: 2,
            angle: 0,
            hitBox: this.calculateHitBox(position, 0, DOT_WIDTH, DOT_HEIGHT),
            removed: false,

            squad: null,
            slot: null,
            gridSquareIndexes: [],
        };
    }

    addDotRandom(team: Team) {
        this.addDot({ ...this.generateDotRandom(), team });
    }

    syncDotAndSlotAngle(dot: Dot, slot: Slot) {
        dot.angle = slot.angle;
        dot.hitBox = this.calculateHitBox(
            dot.position,
            dot.angle,
            dot.width,
            dot.height,
        );
    }

    moveDot(dot: Dot, to: Point) {
        dot.position.x = to.x;
        dot.position.y = to.y;

        dot.hitBox = this.calculateHitBox(
            dot.position,
            dot.angle,
            dot.width,
            dot.height,
        );

        this.dotsGrid.updateDot(dot);

        dot.aimingTimeLeft = dot.aimingDuration;
        if (dot.attackCooldownLeft > 0) {
            dot.attackCooldownLeft = dot.attackCooldown;
        }
    }

    // chatgpt (c)
    calculateHitBox(
        position: Point,
        angle: number,
        width: number,
        height: number,
    ): Rect {
        const initialHitBox: Rect = {
            p1: {
                x: position.x - width / 2,
                y: position.y - height / 2,
            },
            p2: {
                x: position.x + width / 2,
                y: position.y - height / 2,
            },
            p3: {
                x: position.x + width / 2,
                y: position.y + height / 2,
            },
            p4: {
                x: position.x - width / 2,
                y: position.y + height / 2,
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

    checkHasShootIntersectionWithOwnTeam(dot: Dot, target: Dot): boolean {
        const line = {
            p1: dot.position,
            p2: target.position,
        };

        for (const dotAnother of this.dotsGrid.iterateDotsAlongLine(line)) {
            if (dotAnother.team !== dot.team || dot === dotAnother) {
                continue;
            }

            const intersection = getIntersectionAny(line, dotAnother.hitBox);
            if (intersection) {
                return true;
            }
        }

        return false;
    }

    tick(timeDelta: number): DotsControllerTickEffects {
        const effects: DotsControllerTickEffects = {
            projectilesToShoot: [],
            dotsRemoved: [],
        };

        const moveByPath = (dot: Dot) => {
            const maxMoveDistance = timeDelta * DOT_SPEED;

            const target = dot.path[0];
            const dxRaw = target.x - dot.position.x;
            const dyRaw = target.y - dot.position.y;

            if (dxRaw === 0 && dyRaw === 0) {
                return;
            }

            const angle = Math.atan2(dyRaw, dxRaw);
            const distanceToTarget = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);
            const distanceMove = Math.min(distanceToTarget, maxMoveDistance);

            if (distanceMove === 0) {
                return;
            }

            const dx = distanceMove * Math.cos(angle);
            const dy = distanceMove * Math.sin(angle);

            this.moveDot(dot, {
                x: dot.position.x + dx,
                y: dot.position.y + dy,
            });

            if (distanceToTarget <= distanceMove) {
                dot.path.splice(0, 1);
            }
        };

        const proceedCooldown = (dot: Dot) => {
            dot.attackCooldownLeft = Math.max(
                dot.attackCooldownLeft - timeDelta,
                0,
            );
        };

        const abortAiming = (dot: Dot) => {
            dot.aimingTarget = dot.attackTargetDot;
            dot.aimingTimeLeft = dot.aimingDuration;
        };

        const proceedAiming = (dot: Dot) => {
            if (!dot.attackTargetDot || dot.attackCooldownLeft > 0) {
                abortAiming(dot);
                return;
            }

            const distance = distanceBetween(
                dot.position,
                dot.attackTargetDot.position,
            );
            if (distance > dot.attackRange) {
                abortAiming(dot);
                return;
            }

            if (dot.aimingTarget !== dot.attackTargetDot) {
                abortAiming(dot);
            }

            dot.aimingTimeLeft = Math.max(dot.aimingTimeLeft - timeDelta, 0);
        };

        const tryShoot = (dot: Dot) => {
            if (
                dot.squad &&
                dot.squad.allowAttack === false &&
                !(
                    dot.squad.allowShootOnce &&
                    dot.squad.dotsToShootOnce.has(dot)
                )
            ) {
                return;
            }

            if (
                !dot.attackTargetDot ||
                dot.attackCooldownLeft > 0 ||
                dot.aimingTimeLeft > 0
            ) {
                return;
            }

            const distance = distanceBetween(
                dot.position,
                dot.attackTargetDot.position,
            );
            if (distance > dot.attackRange) {
                return;
            }

            const hasIntersection = this.checkHasShootIntersectionWithOwnTeam(
                dot,
                dot.attackTargetDot,
            );

            if (hasIntersection) {
                return;
            }

            effects.projectilesToShoot.push({
                fromDot: dot,
                toPoint: dot.attackTargetDot.position,
                params: DEFAULT_PROJECTILE,
            });

            dot.attackCooldownLeft = dot.attackCooldown;

            if (dot.squad && dot.squad.allowShootOnce) {
                dot.squad.dotsToShootOnce.delete(dot);

                const noAttackTargetForTheRest = Array.from(
                    dot.squad.dotsToShootOnce,
                ).every((dot) => {
                    return dot.attackTargetDot === null;
                });

                if (noAttackTargetForTheRest) {
                    dot.squad.allowShootOnce = false;
                }
            }
        };

        const removeIfDead = (dot: Dot) => {
            if (dot.health <= 0) {
                this.removeDot(dot);
                effects.dotsRemoved.push(dot);
            }
        };

        for (const dot of this.dots) {
            if (dot.path.length > 0) {
                continue;
            }

            proceedAiming(dot);
            proceedCooldown(dot);
        }

        for (const dot of this.dots) {
            if (dot.path.length > 0) {
                continue;
            }

            tryShoot(dot);
        }

        for (const dot of this.dots) {
            if (dot.path.length) {
                moveByPath(dot);
            }
        }

        for (const dot of this.dots) {
            removeIfDead(dot);
        }

        return effects;
    }
}
