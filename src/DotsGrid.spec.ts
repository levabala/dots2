import { DotsGrid } from "./DotsGrid";
import { DotsController, type Dot } from "./Game/DotsController";
import { distanceBetween, type Point } from "./shapes";

describe("DotsGrid", () => {
    test("grid dimensions", () => {
        const width = 10;
        const height = 13;
        const dotsGridSquadSize = 3;

        const grid = new DotsGrid({
            dotsGridSquadSize,
            width,
            height,
        });

        expect(grid.dotsGridCols).toBe(4);
        expect(grid.dotsGridRows).toBe(5);
    });

    test("getDotsInRange", () => {
        const dots: Dot[] = [];

        function getDotsInRangeBruteForce(point: Point, range: number) {
            return dots.filter((dot) => {
                return distanceBetween(point, dot.position) <= range;
            });
        }

        const width = 43;
        const height = 44;
        const grid = new DotsGrid({
            dotsGridSquadSize: 3,
            width,
            height,
        });

        const stepDot = 0.35;

        let idCounter = 0;
        for (let x = 0; x < width; x += stepDot) {
            for (let y = 0; y < height; y += stepDot) {
                const position = { x, y };
                const dotWidth = 8;
                const dotHeight = 8;
                const dot = {
                    position,
                    id: idCounter++,
                    width: dotWidth,
                    height: dotHeight,
                    hitBox: DotsController.calculateHitBox(
                        position,
                        x + y,
                        dotWidth,
                        dotHeight,
                    ),
                } as Dot;

                dots.push(dot);
                grid.addDot(dot);
            }
        }

        const stepCheck = stepDot * 1.5;
        const rangesToCheck = [0, 1, 5.5, 20, 50];

        for (const range of rangesToCheck) {
            for (let x = 0; x < width; x += stepCheck) {
                for (let y = 0; y < height; y += stepCheck) {
                    const xRounded = Math.floor(x * 1000) / 1000;
                    const yRounded = Math.floor(y * 1000) / 1000;

                    const dotsInRangeByGrid = grid.getDotsInRange(
                        { x: xRounded, y: yRounded },
                        range,
                    );
                    const dotsInRangeBruteForce = getDotsInRangeBruteForce(
                        { x: xRounded, y: yRounded },
                        range,
                    );

                    console.log({
                        range,
                        xRounded,
                        yRounded,
                        dotsInRangeByGrid: dotsInRangeByGrid.map(
                            (dot) => dot.id,
                        ),
                        dotsInRangeBruteForce: dotsInRangeBruteForce.map(
                            (dot) => dot.id,
                        ),
                    });
                    const dot1 = dots.find((dot) => dot.id === 2413)!;

                    const idsByGrid = dotsInRangeByGrid
                        .sort((a, b) => a.id - b.id)
                        .map((dot) => dot.id);
                    const idsByBruteForce = dotsInRangeBruteForce
                        .sort((a, b) => a.id - b.id)
                        .map((dot) => dot.id);

                    console.log(
                        dot1.position,
                        dot1.hitBox,
                        dot1.gridSquareIndexes,
                        grid.getDotsGridIndicesInRange(
                            dot1.position,
                            range,
                        ),
                        distanceBetween(dot1.position, {
                            x: xRounded,
                            y: yRounded,
                        }),
                        idsByGrid,
                        idsByBruteForce,
                    );

                    expect(idsByGrid).toEqual(idsByBruteForce);
                }
            }
        }
    });
});
