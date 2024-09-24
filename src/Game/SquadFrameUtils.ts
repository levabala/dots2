import { DOT_IN_SQUAD_SPACE_AROUND } from "../consts";
import { orthogonalRect, type Point } from "../utils";

export class SquadFrameUtils {
    static calcDotsSquadArea(dotsCount: number) {
        return dotsCount * DOT_IN_SQUAD_SPACE_AROUND;
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
