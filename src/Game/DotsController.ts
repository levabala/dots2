import { randomInteger } from "remeda";
import {
    DEFAULT_PROJECTILE,
    DOT_HEIGHT,
    DOT_SPEED,
    DOT_WIDTH,
    DOTS_GRID_SIZE,
} from "../consts";
import { DotsGrid } from "../DotsGrid";
import {
    distanceBetween,
    getIntersectionAnyRect,
    type Point,
    type Rect,
    rotatePoint,
} from "../utils";
import type { Slot, Squad } from "./SquadsController";
import type { Projectile } from "./ProjectilesController";
import type { Team } from "./TeamController";
import type { Building } from "./BuildingsController";

export type DotTemplate = {
    width: number;
    height: number;
    speed: number;
    attackRange: number;
    attackCooldown: number;
    aimingDuration: number;
    hitBox: Rect;
    health: number;
    angle: number;
};

export type Dot = DotTemplate & {
    position: Point;
    team: Team;
    removed: boolean;
    squad: Squad | null;
    slot: Slot | null;
    gridSquareIndexes: number[];
    attackCooldownLeft: number;
    aimingTimeLeft: number;
    aimingTargetDot: Dot | null;
    attackTargetedByDots: Set<Dot>;
    attackTargetDot: Dot | null;
    attackTargetBuilding: Building | null;
    path: Point[];
    allowAttack: boolean;
};

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
            | "allowAttack"
            | "aimingTargetDot"
            | "attackTargetBuilding"
        >,
    ): Dot {
        return {
            ...dotPartial,
            path: [],
            attackTargetDot: null,
            attackCooldownLeft: 0,
            attackTargetedByDots: new Set(),
            attackTargetBuilding: null,
            aimingTimeLeft: dotPartial.aimingDuration,
            aimingTargetDot: null,
            hitBox: this.calculateHitBox(
                dotPartial.position,
                0,
                DOT_WIDTH,
                DOT_HEIGHT,
            ),
            removed: false,
            allowAttack: true,

            squad: null,
            slot: null,
            gridSquareIndexes: [],
        };
    }

    addDot(dot: Dot) {
        this.dots.add(dot);
        this.dotsGrid.addDot(dot);

        dot.team.dotsCount++;
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

        dot.team.dotsCount--;
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
            attackTargetBuilding: null,
            aimingDuration: 1000,
            aimingTimeLeft: 1000,
            aimingTargetDot: null,
            health: 2,
            angle: 0,
            hitBox: this.calculateHitBox(position, 0, DOT_WIDTH, DOT_HEIGHT),
            removed: false,
            allowAttack: true,

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

    checkHasShootIntersectionWithOwnTeam(dot: Dot, target: Point): boolean {
        const line = {
            p1: dot.position,
            p2: target,
        };

        for (const dotAnother of this.dotsGrid.iterateDotsAlongLine(line)) {
            if (dotAnother.team !== dot.team || dot === dotAnother) {
                continue;
            }

            const intersection = getIntersectionAnyRect(
                line,
                dotAnother.hitBox,
            );
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
            dot.aimingTargetDot = dot.attackTargetDot;
            dot.aimingTimeLeft = dot.aimingDuration;
        };

        const proceedAiming = (dot: Dot) => {
            if (
                (!dot.attackTargetDot && !dot.attackTargetBuilding) ||
                dot.attackCooldownLeft > 0
            ) {
                abortAiming(dot);
                return;
            }

            const attackTargetPosition =
                dot.attackTargetBuilding?.center ||
                dot.attackTargetDot?.position;

            if (!attackTargetPosition) {
                window.panic("attack target position must be valid", {
                    dot,
                    attackTargetPosition,
                });
            }

            const distance = distanceBetween(
                dot.position,
                attackTargetPosition,
            );
            if (distance > dot.attackRange) {
                abortAiming(dot);
                return;
            }

            if (dot.aimingTargetDot !== dot.attackTargetDot) {
                abortAiming(dot);
            }

            dot.aimingTimeLeft = Math.max(dot.aimingTimeLeft - timeDelta, 0);
        };

        const clearAttackTargetDot = (dot: Dot) => {
            if (dot.attackTargetDot) {
                dot.attackTargetDot.attackTargetedByDots.delete(dot);
                dot.attackTargetDot = null;
            }
        };

        const clearAttackTargetBuilding = (dot: Dot) => {
            if (dot.attackTargetBuilding) {
                dot.attackTargetBuilding = null;
            }
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
                (!dot.attackTargetDot && !dot.attackTargetBuilding) ||
                dot.attackCooldownLeft > 0 ||
                dot.aimingTimeLeft > 0
            ) {
                return;
            }

            const attackTargetPosition =
                dot.attackTargetBuilding?.center ||
                dot.attackTargetDot?.position;

            if (!attackTargetPosition) {
                window.panic("attack target position must be valid", {
                    dot,
                    attackTargetPosition,
                });
            }

            const distance = distanceBetween(
                dot.position,
                attackTargetPosition,
            );
            if (distance > dot.attackRange) {
                return;
            }

            const hasIntersection = this.checkHasShootIntersectionWithOwnTeam(
                dot,
                attackTargetPosition,
            );

            if (hasIntersection) {
                return;
            }

            effects.projectilesToShoot.push({
                fromDot: dot,
                toPoint: attackTargetPosition,
                params: DEFAULT_PROJECTILE,
            });

            dot.attackCooldownLeft = dot.attackCooldown;
            dot.aimingTimeLeft = dot.aimingDuration;

            if (dot.squad && dot.squad.allowShootOnce) {
                dot.squad.dotsToShootOnce.delete(dot);
                dot.allowAttack = false;
                clearAttackTargetDot(dot);

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

        type DotWithDistance = Dot & { _targeting_distance: number };

        const getDotPotentionalTargets = (dot: Dot): DotWithDistance[] => {
            if (dot.squad && dot.squad.attackTargetSquads.size) {
                const dotPotentionalTargets = [];

                for (const squadTarget of dot.squad.attackTargetSquads) {
                    for (const slotTarget of squadTarget.slots) {
                        if (!slotTarget.dot) {
                            continue;
                        }

                        const dotTarget = slotTarget.dot as DotWithDistance;

                        dotTarget._targeting_distance = distanceBetween(
                            dot.position,
                            dotTarget.position,
                        );

                        if (dotTarget._targeting_distance > dot.attackRange) {
                            continue;
                        }

                        dotPotentionalTargets.push(dotTarget);
                    }
                }

                return dotPotentionalTargets;
            }

            const dotsInRange = this.dotsGrid.getDotsInRange(
                dot.position,
                dot.attackRange,
                (d) => d.team !== dot.team,
            );

            for (const dotInRange of dotsInRange) {
                const distance = distanceBetween(
                    dot.position,
                    dotInRange.position,
                );

                if (distance > dot.attackRange) {
                    window.panic("distance must be less than attack range", {
                        dot,
                        dotInRange,
                    });
                }

                (dotInRange as DotWithDistance)._targeting_distance = distance;
            }

            return dotsInRange as DotWithDistance[];
        };

        const assignDotAttackTarget = (dot: Dot) => {
            const allowAttackSquad =
                dot.squad !== null && dot.squad.allowAttack;

            if (!dot.allowAttack && !allowAttackSquad) {
                clearAttackTargetDot(dot);
                return;
            }

            if (dot.squad && dot.squad.attackTargetBuildings.size) {
                const buildingTarget = Array.from(
                    dot.squad.attackTargetBuildings,
                ).find((building) => {
                    return (
                        building.health > 0 &&
                        distanceBetween(dot.position, building.center) <=
                            dot.attackRange &&
                        !this.checkHasShootIntersectionWithOwnTeam(
                            dot,
                            building.center,
                        )
                    );
                });

                if (!buildingTarget) {
                    clearAttackTargetBuilding(dot);
                    return;
                }

                clearAttackTargetDot(dot);
                dot.attackTargetBuilding = buildingTarget;
                return;
            }

            const dotPotentionalTargets = getDotPotentionalTargets(dot);

            dotPotentionalTargets.sort(
                (d1, d2) => d1._targeting_distance - d2._targeting_distance,
            );

            for (const dotTarget of dotPotentionalTargets) {
                const hasIntersection =
                    this.checkHasShootIntersectionWithOwnTeam(
                        dot,
                        dotTarget.position,
                    );

                if (hasIntersection) {
                    continue;
                }

                clearAttackTargetDot(dot);

                window.assert(
                    dotTarget.removed !== true,
                    "attack target dot must not be removed",
                    { dot, target: dotTarget },
                );

                dot.attackTargetDot = dotTarget;
                dotTarget.attackTargetedByDots.add(dot);

                return;
            }

            clearAttackTargetDot(dot);
        };

        const isBadTargetDot = (dot: Dot, dotTarget: Dot): boolean => {
            if (!dot.attackTargetDot) {
                return false;
            }

            if (
                dot.squad !== null &&
                dot.squad.attackTargetSquads.size > 0 &&
                (dotTarget.squad === null ||
                    !dot.squad.attackTargetSquads.has(dotTarget.squad))
            ) {
                return true;
            }

            if (
                distanceBetween(dot.position, dot.attackTargetDot.position) >
                dot.attackRange
            ) {
                return true;
            }

            if (
                this.checkHasShootIntersectionWithOwnTeam(
                    dot,
                    dot.attackTargetDot.position,
                )
            ) {
                return true;
            }

            return false;
        };

        const isBadTargetBuilding = (
            dot: Dot,
            buildingTarget: Building,
        ): boolean => {
            if (!dot.attackTargetBuilding) {
                return false;
            }

            if (buildingTarget.health <= 0) {
                return true;
            }

            if (
                dot.squad === null ||
                !dot.squad.attackTargetBuildings.has(buildingTarget)
            ) {
                return true;
            }

            if (
                distanceBetween(dot.position, dot.attackTargetBuilding.center) >
                dot.attackRange
            ) {
                return true;
            }

            if (
                this.checkHasShootIntersectionWithOwnTeam(
                    dot,
                    dot.attackTargetBuilding.center,
                )
            ) {
                return true;
            }

            return false;
        };

        const assignDotAttackTargetButTryNotToReassign = (dot: Dot) => {
            if (dot.attackTargetBuilding) {
                if (isBadTargetBuilding(dot, dot.attackTargetBuilding)) {
                    clearAttackTargetBuilding(dot);
                }

                return;
            }

            if (dot.attackTargetDot) {
                const gotBadTarget = isBadTargetDot(dot, dot.attackTargetDot);

                if (gotBadTarget) {
                    clearAttackTargetDot(dot);
                }

                return;
            }

            assignDotAttackTarget(dot);
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

            if (dot.attackCooldownLeft > 0) {
                continue;
            }

            assignDotAttackTargetButTryNotToReassign(dot);
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

        for (const dot of this.dots) {
            if (!dot.slot) {
                continue;
            }

            this.syncDotAndSlotAngle(dot, dot.slot);
        }

        return effects;
    }
}
