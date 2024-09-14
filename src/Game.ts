import { DEFAULT_PROJECTILE, DOT_HEIGHT, DOT_SPEED, DOT_WIDTH } from "./consts";
import { DotsGrid } from "./DotsGrid";
import {
    arePointsEqual,
    distanceBetween as getDistanceBetween,
    getIntersectionAny,
    rotatePoint,
    type Point,
    type Rect,
} from "./utils";
import { randomInteger, times } from "remeda";

export type Team = {
    index: number;
    name: string;

    // TODO: implement
    // dots: Set<Dot>;
    // squads: Set<Squad>;
};

export type Dot = {
    position: Point;
    width: number;
    height: number;
    speed: number;
    path: Point[];
    attackTargetedByDots: Set<Dot>;
    attackTargetDot: Dot | null;
    attackRange: number;
    attackCooldown: number;
    attackCooldownLeft: number;
    aimingDuration: number;
    aimingTimeLeft: number;
    aimingTarget: Dot | null;
    hitBox: Rect;
    health: number;
    angle: number;

    team: Team;
    squad: Squad | null;
    slot: Slot | null;
    gridSquareIndexes: number[];
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

    team: Team;
};

export type GameEvent =
    | { name: "squad-removed"; payload: { squad: Squad } }
    | { name: "dot-added"; payload: { dot: Dot } }
    | { name: "dot-moved"; payload: { dot: Dot } }
    | {
          name: "dot-action-verbose";
          payload: { dot: Dot; name: string; details?: object };
      };

export type GameEventFromName<Name extends GameEvent["name"]> = Extract<
    GameEvent,
    { name: Name }
>;

export type GameEventListener<Name extends GameEvent["name"]> = (
    payload: GameEventFromName<Name>["payload"],
) => void;

export class Game {
    dotsGrid: DotsGrid;

    teams = new Set<Team>();
    dots = new Set<Dot>();
    squads: Squad[] = [];
    projectiles: Projectile[] = [];

    eventListeners: {
        [key in GameEvent["name"]]: Set<GameEventListener<key>>;
    } = {
        "squad-removed": new Set(),
        "dot-added": new Set(),
        "dot-moved": new Set(),
        "dot-action-verbose": new Set(),
    };

    constructor(
        readonly width: number,
        readonly height: number,
    ) {
        this.dotsGrid = new DotsGrid(
            Math.max(DOT_WIDTH, DOT_HEIGHT) * 5,
            width,
            height,
        );
    }

    init() {
        const team1 = this.createTeam({ name: "red" });
        const team2 = this.createTeam({ name: "blue" });

        times(500, () => this.addDotRandom(team1));
        times(500, () => this.addDotRandom(team2));
    }

    addEventListener<Name extends GameEvent["name"]>(
        name: Name,
        listener: GameEventListener<Name>,
    ) {
        this.eventListeners[name].add(listener);
    }

    removeEventListener<Name extends GameEvent["name"]>(
        name: Name,
        listener: GameEventListener<Name>,
    ) {
        this.eventListeners[name].delete(listener);
    }

    private emitEvent<Name extends GameEvent["name"]>(
        name: Name,
        payload: GameEventFromName<Name>["payload"],
    ) {
        for (const listener of this.eventListeners[name]) {
            listener(payload as GameEventFromName<Name>["payload"]);
        }
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

    cancelAttackSquad(squadAttacker: Squad) {
        squadAttacker.attackTargetSquad = null;
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
        this.dotsGrid.removeDot(dot);

        if (dot.slot) {
            dot.slot.dot = null;
        }

        for (const targeter of dot.attackTargetedByDots) {
            targeter.attackTargetDot = null;
        }

        if (dot.squad) {
            this.removeSquadIfEmpty(dot.squad);
        }
    }

    removeSquadIfEmpty(squad: Squad) {
        const squadHasNoDots = squad.slots.every((slot) => slot.dot === null);

        if (squadHasNoDots) {
            this.removeSquad(squad);
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
        dot.hitBox = this.calculateHitBox(
            dot.position,
            dot.angle,
            dot.width,
            dot.height,
        );
    }

    // chatgpt (c)
    private calculateHitBox(
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

    createSquad(slots: Slot[], team: Team) {
        const squad: Squad = {
            index: this.squads.length,
            slots,
            attackTargetDot: null,
            attackTargetSquad: null,
            team,
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
            dot.slot = null;
            dot.attackTargetDot = null;
        }

        this.emitEvent("squad-removed", { squad });
    }

    createTeam(teamParams: Omit<Team, "index">): Team {
        const team = { ...teamParams, index: this.teams.size };
        this.teams.add(team);

        return team;
    }

    isInSquad(dot: Dot) {
        return this.squads.some((squad) =>
            squad.slots.some((slot) => slot.dot === dot),
        );
    }

    addDot(dot: Dot) {
        this.dots.add(dot);
        this.dotsGrid.addDot(dot);

        this.emitEvent("dot-added", { dot });
    }

    addDotRandom(team: Team) {
        const position = {
            x: randomInteger(0, this.width),
            y: randomInteger(0, this.height),
        };
        this.addDot({
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

            team,
            squad: null,
            slot: null,
            gridSquareIndexes: [],
        });
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

    private checkHasShootIntersectionWithOwnSquad(dot: Dot, target: Dot): boolean {
        if (!dot.squad) {
            return false;
        }

        const line = {
            p1: dot.position,
            p2: target.position,
        };

        for (const dotAnother of this.dotsGrid.iterateDotsAlongLine(line)) {
            if (dotAnother.squad !== dot.squad || dot === dotAnother) {
                continue;
            }

            const intersection = getIntersectionAny(line, dotAnother.hitBox);
            if (intersection) {
                return true;
            }
        }

        return false;
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

        this.emitEvent("dot-moved", { dot });
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
            squadTarget: Squad,
        ) => {
            if (dot.attackTargetDot?.squad === squadTarget) {
                const distance = getDistanceBetween(
                    dot.position,
                    dot.attackTargetDot.position,
                );

                if (
                    distance > dot.attackRange ||
                    this.checkHasShootIntersectionWithOwnSquad(
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
                    this.checkHasShootIntersectionWithOwnSquad(dot, slot.dot);

                if (hasIntersection !== false) {
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

        const abortAiming = (dot: Dot) => {
            dot.aimingTarget = dot.attackTargetDot;
            dot.aimingTimeLeft = dot.aimingDuration;
        };

        const proceedAiming = (dot: Dot) => {
            if (!dot.attackTargetDot || dot.attackCooldownLeft > 0) {
                abortAiming(dot);
                return;
            }

            const distance = getDistanceBetween(
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
                !dot.attackTargetDot ||
                dot.attackCooldownLeft > 0 ||
                dot.aimingTimeLeft > 0
            ) {
                return;
            }

            const distance = getDistanceBetween(
                dot.position,
                dot.attackTargetDot.position,
            );
            if (distance > dot.attackRange) {
                return;
            }

            const hasIntersection = this.checkHasShootIntersectionWithOwnSquad(
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

        for (const dot of this.dots) {
            if (dot.path.length > 0) {
                continue;
            }

            proceedAiming(dot);
            proceedCooldown(dot);
        }

        for (const squad of this.squads) {
            changePathToSquad(squad);

            if (squad.attackTargetSquad) {
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
                            squad.attackTargetSquad,
                        );
                    }
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

        for (const dot of this.dots) {
            if (dot.path.length > 0) {
                continue;
            }

            tryShoot(dot);
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