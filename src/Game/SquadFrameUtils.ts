import { DOT_TARGET_MOVE_SPACE } from "../consts";
import { orthogonalRect, type Point } from "../utils";

export class SquadFrameUtils {
    static calcDotsSquadArea(dotsCount: number) {
        return dotsCount * DOT_TARGET_MOVE_SPACE;
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
}
