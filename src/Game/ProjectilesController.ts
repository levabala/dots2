import { distanceBetween, getIntersectionAny, type Point } from "../utils";
import type { Dot, Projectile } from "./Game";

export type ProjectilesControllerTickEffects = {
    dotsKilled: Dot[];
};

export class ProjectilesController {
    projectiles: Projectile[] = [];

    constructor(readonly dots: Set<Dot>) {}

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

    hitProjectile(projectile: Projectile, dot: Dot): { isKilled: boolean } {
        this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
        dot.health -= projectile.damage;

        return { isKilled: dot.health <= 0 };
    }

    tick(timeDelta: number): ProjectilesControllerTickEffects {
        const effects: ProjectilesControllerTickEffects = {
            dotsKilled: [],
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

            if (closestIntersection) {
                const { isKilled } = this.hitProjectile(
                    projectile,
                    closestIntersection.dot,
                );

                if (isKilled) {
                    effects.dotsKilled.push(closestIntersection.dot);
                }

                return;
            }

            projectile.position.x += dx;
            projectile.position.y += dy;
        };

        for (const projectile of this.projectiles) {
            updateProjectile(projectile);
        }

        return effects;
    }
}