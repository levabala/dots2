import { randomInteger } from "remeda";
import {
    DEFAULT_PROJECTILE,
    DOT_AIMING_DURATION,
    DOT_ATTACK_COOLDOWN,
    DOT_ATTACK_RANGE,
    DOT_HEALTH_MAX,
    DOT_HEIGHT,
    DOT_MORALE_BASELINE,
    DOT_MORALE_DROP_BY_NEARBY_ENEMY_COUNT,
    DOT_MORALE_DROP_BY_NEARBY_ENEMY_RADIUS,
    DOT_MORALE_FLEE_LEVEL,
    DOT_MORALE_GAIN_BY_NEARBY_ALLIE_COUNT,
    DOT_MORALE_GAIN_BY_NEARBY_ALLIE_RADIUS,
    DOT_MORALE_MAX,
    DOT_MORALE_DROP_PER_SECOND_MAX,
    DOT_MORALE_GAIN_PER_SECOND_MAX,
    DOT_SPEED,
    DOT_WIDTH,
    DOTS_GRID_SIZE,
    DOT_MORALE_MIN,
    DOT_MORALE_GAIN_BY_NEARBY_ALLIE_COUNT_MAX,
    DOT_MORALE_DROP_BY_NEARBY_ENEMY_COUNT_MAX,
    DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_RADIUS,
    DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_COUNT_MAX,
    DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_COUNT,
    DOT_SCAN_INTERVAL,
} from "../consts";
import { DotsGrid } from "../DotsGrid";
import {
    distanceBetween,
    getIntersectionAnyRect,
    type Point,
    type Rect,
    rotatePoint,
} from "../shapes";
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
    healthMax: number;
    angle: number;
};

export type Dot = DotTemplate & {
    id: number;
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
    scanInterval: number;
    scanIn: number;
    path: Point[];
    allowAttack: boolean;
    morale: number;
    isFleeing: boolean;
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
    dotsGridDead: DotsGrid;
    dots = new Set<Dot>();
    dotsDead = new Set<Dot>();
    dotsIdCounter = 0;

    constructor(
        readonly width: number,
        readonly height: number,
    ) {
        this.dotsGrid = new DotsGrid({
            dotsGridSquareSize: DOTS_GRID_SIZE,
            width,
            height,
        });
        this.dotsGridDead = new DotsGrid({
            dotsGridSquareSize: DOTS_GRID_SIZE,
            width,
            height,
        });
    }

    initDot(
        dotPartial: Omit<
            Dot,
            | "id"
            | "path"
            | "attackTargetDot"
            | "attackCooldownLeft"
            | "attackTargetedByDots"
            | "aimingTimeLeft"
            | "aimingTarget"
            | "scanInterval"
            | "scanIn"
            | "hitBox"
            | "squad"
            | "slot"
            | "gridSquareIndexes"
            | "removed"
            | "allowAttack"
            | "aimingTargetDot"
            | "attackTargetBuilding"
            | "isFleeing"
            | "morale"
        >,
    ): Dot {
        return {
            ...dotPartial,
            id: this.dotsIdCounter++,
            path: [],
            attackTargetDot: null,
            attackCooldownLeft: 0,
            attackTargetedByDots: new Set(),
            attackTargetBuilding: null,
            aimingTimeLeft: dotPartial.aimingDuration,
            aimingTargetDot: null,
            scanInterval: DOT_SCAN_INTERVAL,
            scanIn: DOT_SCAN_INTERVAL,
            hitBox: DotsController.calculateHitBox(
                dotPartial.position,
                0,
                DOT_WIDTH,
                DOT_HEIGHT,
            ),
            removed: false,
            allowAttack: true,
            isFleeing: false,
            morale: DOT_MORALE_BASELINE,

            squad: null,
            slot: null,
            gridSquareIndexes: [],
        };
    }

    addDot(dotRaw: Omit<Dot, "hitBox">) {
        const dot: Dot = {
            ...dotRaw,
            hitBox: DotsController.calculateHitBox(
                dotRaw.position,
                dotRaw.angle,
                DOT_WIDTH,
                DOT_HEIGHT,
            ),
        };

        this.dots.add(dot);
        this.dotsGrid.addDot(dot);

        dot.team.dotsCount++;

        return dot;
    }

    killDot(dot: Dot) {
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

        this.dotsDead.add(dot);
        this.dotsGridDead.addDot(dot);
    }

    generateDotRandom(): Omit<Dot, "team"> {
        // TODO: move an argument
        const position = {
            x: randomInteger(1200, 1500),
            y: randomInteger(1200, 1500),
        };
        return {
            id: this.dotsIdCounter++,
            path: [],
            position,
            width: DOT_WIDTH,
            height: DOT_HEIGHT,
            speed: DOT_SPEED,
            attackTargetDot: null,
            attackRange: DOT_ATTACK_RANGE,
            attackCooldown: DOT_ATTACK_COOLDOWN,
            attackCooldownLeft: 0,
            attackTargetedByDots: new Set(),
            attackTargetBuilding: null,
            aimingDuration: DOT_AIMING_DURATION,
            aimingTimeLeft: DOT_AIMING_DURATION,
            aimingTargetDot: null,
            health: DOT_HEALTH_MAX,
            healthMax: DOT_HEALTH_MAX,
            morale: DOT_MORALE_MAX,
            scanInterval: DOT_SCAN_INTERVAL,
            scanIn: DOT_SCAN_INTERVAL,
            angle: 0,
            hitBox: DotsController.calculateHitBox(
                position,
                0,
                DOT_WIDTH,
                DOT_HEIGHT,
            ),
            removed: false,
            allowAttack: true,
            isFleeing: false,

            squad: null,
            slot: null,
            gridSquareIndexes: [],
        };
    }

    addDotRandom(team: Team) {
        return this.addDot({ ...this.generateDotRandom(), team });
    }

    syncDotAndSlotAngle(dot: Dot, slot: Slot) {
        dot.angle = slot.angle;
        dot.hitBox = DotsController.calculateHitBox(
            dot.position,
            dot.angle,
            dot.width,
            dot.height,
        );
    }

    moveDot(dot: Dot, to: Point) {
        dot.position.x = Math.max(
            Math.min(to.x, this.width - dot.width * 2),
            dot.width * 2,
        );
        dot.position.y = Math.max(
            Math.min(to.y, this.height - dot.height * 2),
            dot.height * 2,
        );

        dot.hitBox = DotsController.calculateHitBox(
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
    static calculateHitBox(
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

        return DotsController.calculateRotatedHitBox(
            position,
            initialHitBox,
            angle,
        );
    }

    // chatgpt (c)
    static calculateRotatedHitBox(
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

    dotMoveTo(dot: Dot, destination: Point) {
        dot.path = [destination];
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

    orderAttackDot({ attacker, target }: { attacker: Dot; target: Dot }) {
        attacker.attackTargetDot = target;
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

        const clearTargetIfDead = (dot: Dot) => {
            if (dot.attackTargetDot === null) {
                return;
            }

            if (dot.attackTargetDot.health <= 0) {
                dot.attackTargetDot = null;
            }
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
                global.panic("attack target position must be valid", {
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
            if (dot.squad) {
                if (
                    dot.squad.allowAttack === false &&
                    !(
                        dot.squad.allowShootOnce &&
                        dot.squad.dotsToShootOnce.has(dot)
                    )
                ) {
                    return;
                }
            } else {
                if (dot.allowAttack === false) {
                    return;
                }
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
                global.panic("attack target position must be valid", {
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
                    global.panic("distance must be less than attack range", {
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

                global.assert(
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

        const checkIfDead = (dot: Dot) => {
            if (dot.health <= 0) {
                this.killDot(dot);
                effects.dotsRemoved.push(dot);
            }
        };

        const changeMorale = (dot: Dot) => {
            const alliesNearby = this.dotsGrid.getDotsInRange(
                dot.position,
                DOT_MORALE_GAIN_BY_NEARBY_ALLIE_RADIUS,
                (d) => d.team === dot.team && d.squad !== null && d !== dot,
            );

            const enemiesNearby = this.dotsGrid.getDotsInRange(
                dot.position,
                DOT_MORALE_DROP_BY_NEARBY_ENEMY_RADIUS,
                (d) => d.team !== dot.team && d.squad !== null,
            );

            const deadAlliesNearby = this.dotsGridDead.getDotsInRange(
                dot.position,
                DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_RADIUS,
                (d) => d.team === dot.team,
            );

            const moraleTargetChangeNearbyAllies = Math.min(
                alliesNearby.length * DOT_MORALE_GAIN_BY_NEARBY_ALLIE_COUNT,
                DOT_MORALE_GAIN_BY_NEARBY_ALLIE_COUNT_MAX,
            );
            const moraleTargetChangeNearbyEnemies =
                -1 *
                Math.min(
                    enemiesNearby.length *
                        DOT_MORALE_DROP_BY_NEARBY_ENEMY_COUNT,
                    DOT_MORALE_DROP_BY_NEARBY_ENEMY_COUNT_MAX,
                );
            const moraleTargetChangeNearbyDeadAllies =
                -1 *
                Math.min(
                    deadAlliesNearby.length *
                        DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_COUNT,
                    DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_COUNT_MAX,
                );

            const moraleTarget =
                DOT_MORALE_BASELINE +
                moraleTargetChangeNearbyAllies +
                moraleTargetChangeNearbyEnemies +
                moraleTargetChangeNearbyDeadAllies;

            const moraleDiff = moraleTarget - dot.morale;
            const moraleDiffAbs = Math.abs(moraleDiff);
            const changeCapPerSecond =
                Math.sign(moraleDiff) === -1
                    ? DOT_MORALE_DROP_PER_SECOND_MAX
                    : DOT_MORALE_GAIN_PER_SECOND_MAX;
            const changeCap = changeCapPerSecond * timeDelta;
            const moraleChangeAbs = Math.min(moraleDiffAbs, changeCap);
            const moraleChange = Math.sign(moraleDiff) * moraleChangeAbs;

            dot.morale = Math.min(
                DOT_MORALE_MAX,
                Math.max(DOT_MORALE_MIN, dot.morale + moraleChange),
            );
        };

        const updateIsFleeing = (dot: Dot) => {
            const isFleeing = dot.morale <= DOT_MORALE_FLEE_LEVEL;

            dot.isFleeing = isFleeing;
        };

        for (const dot of this.dots) {
            if ("TEMPORARY_DISABLED".length === 0) {
                changeMorale(dot);
            }

            updateIsFleeing(dot);
        }

        for (const dot of this.dots) {
            if (dot.path.length > 0) {
                continue;
            }

            clearTargetIfDead(dot);
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

            dot.scanIn -= timeDelta;

            if (dot.scanIn > 0) {
                continue;
            }

            dot.scanIn = dot.scanInterval;

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
            checkIfDead(dot);
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
