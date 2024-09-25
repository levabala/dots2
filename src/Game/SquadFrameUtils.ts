import {
    DOT_HEIGHT,
    DOT_IN_SQUAD_RADIUS_AROUND,
    DOT_WIDTH,
} from "../consts";
import { orthogonalRect, type Point } from "../utils";

export class SquadFrameUtils {
    static calcDotsSquadArea(dotsCount: number) {
        return dotsCount * SquadFrameUtils.calcDotArea();
    }

    static createSquadSquare(dotsCount: number, center: Point) {
        const targetRectArea = SquadFrameUtils.calcDotsSquadArea(dotsCount);
        const sideLength = Math.ceil(Math.sqrt(targetRectArea));
        const targetRect = orthogonalRect(
            {
                x: center.x - sideLength / 2,
                y: center.y - sideLength / 2,
            },
            {
                x: center.x + sideLength / 2,
                y: center.y + sideLength / 2,
            },
        );

        return targetRect;
    }

    static calcDotArea() {
        return (
            (DOT_WIDTH + DOT_IN_SQUAD_RADIUS_AROUND) *
            (DOT_HEIGHT + DOT_IN_SQUAD_RADIUS_AROUND)
        );
    }

    static calcSquadSideLength(dotsCount: number, frontLength: number) {
        const totalAreaNeeded = dotsCount * SquadFrameUtils.calcDotArea();
        const sideLength = totalAreaNeeded / frontLength;

        return sideLength;
    }

    static calcSquadFrontLength(dotsCount: number, sideLength: number) {
        const totalAreaNeeded = dotsCount * SquadFrameUtils.calcDotArea();
        const frontLength = totalAreaNeeded / sideLength;

        return frontLength;
    }
}
