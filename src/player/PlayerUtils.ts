import type { Building } from "../Game/BuildingsController";
import type { Squad } from "../Game/SquadsController";
import {
    arePointsEqual,
    createPolygonOffset,
    distanceBetween,
    getIntersectionFirstRect,
    getRectCenter,
    isPointInRect,
    polygonToRect,
    rectToPolygon,
    type Point,
} from "../shapes";
import { Vector } from "../Vector";

export class PlayerUtils {
    static squadAllDotsInFrame(squad: Pick<Squad, "slots" | "frameTarget">) {
        return squad.slots.every(
            (slot) =>
                !slot.dot || isPointInRect(slot.dot.position, squad.frameTarget),
        );
    }

    static squadAllDotsInPosition(squad: Pick<Squad, "slots" | "frameTarget">) {
        return squad.slots.every(
            (slot) =>
                !slot.dot ||
                arePointsEqual(slot.dot.position, slot.dot.position),
        );
    }

    static getNewSquadFrameInFrontOf(
        squad: Squad,
        target: Point,
        distanceUntil: number,
    ) {
        const squadCenter = getRectCenter(squad.frameTarget);

        const squadEdge = getIntersectionFirstRect(
            {
                p1: squadCenter,
                p2: target,
            },
            squad.frameTarget,
        );

        if (!squadEdge) {
            global.panic("closestPointSquad must be valid", {
                closestPointSquad: squadEdge,
                squadCenter,
                target,
            });
        }

        const vectorCenterToEdge = Vector.betweenPoints(squadCenter, squadEdge);
        const distanceBetweenCenterAndTarget = distanceBetween(
            squadCenter,
            target,
        );

        const centerToEdgeDistanceAbs = Math.abs(vectorCenterToEdge.length());
        const length =
            distanceBetweenCenterAndTarget -
            distanceUntil -
            centerToEdgeDistanceAbs;
        const vectorCenterOldToNew = vectorCenterToEdge.withLength(length);

        const centerNew = vectorCenterOldToNew.add(squadCenter);

        // TODO: rotate

        return polygonToRect(
            createPolygonOffset(
                rectToPolygon(squad.frameTarget),
                Vector.betweenPoints(squadCenter, centerNew),
            ),
        );
    }

    static isBuilding(smth: Building | Squad): smth is Building {
        return "kind" in smth;
    }

    static isSquad(smth: Building | Squad): smth is Squad {
        return !PlayerUtils.isBuilding(smth);
    }
}
