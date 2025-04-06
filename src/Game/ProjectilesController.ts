import {
    distanceBetween,
    getIntersectionAnyPolygon,
    getIntersectionAnyRect,
    type Point,
} from "../shapes";
import type { Building } from "./BuildingsController";
import type { Dot } from "./DotsController";

export type Projectile = {
    position: Point;
    angle: number;
    speed: number;
    damage: number;
    flyDistanceLeft: number;
    fromDot: Dot;
    radius: number;
};

export type ProjectilesControllerTickEffects = {
    dotsKilled: Dot[];
    dotsHitNotKilled: Dot[];
    buildingsKilled: Building[];
};

export class ProjectilesController {
    projectiles = new Set<Projectile>();

    constructor(
        readonly dots: Set<Dot>,
        readonly buildings: Set<Building>,
    ) {}

    removeProjectile(projectile: Projectile) {
        this.projectiles.delete(projectile);
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

        this.projectiles.add(projectile);
    }

    hitProjectileDot(projectile: Projectile, dot: Dot): { isKilled: boolean } {
        this.removeProjectile(projectile);
        dot.health -= projectile.damage;

        return { isKilled: dot.health <= 0 };
    }

    hitProjectileBuilding(
        projectile: Projectile,
        building: Building,
    ): {
        isKilled: boolean;
    } {
        this.removeProjectile(projectile);
        building.health -= projectile.damage;

        return { isKilled: building.health <= 0 };
    }

    tick(timeDelta: number) {
        const effects: ProjectilesControllerTickEffects = {
            dotsKilled: [],
            dotsHitNotKilled: [],
            buildingsKilled: [],
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

            let closestIntersection:
                | { building: Building; dot?: never; distance: number }
                | { building?: never; dot: Dot; distance: number }
                | null = null;
            for (const building of this.buildings) {
                const intersection = getIntersectionAnyPolygon(
                    line,
                    building.frame,
                );

                if (!intersection) {
                    continue;
                }

                const distance = distanceBetween(
                    projectile.position,
                    intersection,
                );
                if (
                    closestIntersection === null ||
                    distance > closestIntersection.distance
                ) {
                    closestIntersection = { building, distance };
                }
            }

            for (const dot of this.dots) {
                if (dot === projectile.fromDot) {
                    continue;
                }

                const intersection = getIntersectionAnyRect(line, dot.hitBox);

                if (!intersection) {
                    continue;
                }

                const distance = distanceBetween(
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

            if (closestIntersection !== null) {
                if (closestIntersection.dot) {
                    const { isKilled } = this.hitProjectileDot(
                        projectile,
                        closestIntersection.dot,
                    );

                    if (isKilled) {
                        effects.dotsKilled.push(closestIntersection.dot);
                    } else {
                        effects.dotsHitNotKilled.push(closestIntersection.dot);
                    }

                    return;
                }

                const { isKilled } = this.hitProjectileBuilding(
                    projectile,
                    closestIntersection.building,
                );

                if (isKilled) {
                    effects.buildingsKilled.push(closestIntersection.building);
                }

                return;
            }

            projectile.position.x += dx;
            projectile.position.y += dy;

            projectile.flyDistanceLeft -= timeDelta;

            if (projectile.flyDistanceLeft <= 0) {
                this.removeProjectile(projectile);
            }
        };

        for (const projectile of this.projectiles) {
            updateProjectile(projectile);
        }

        return effects;
    }
}
