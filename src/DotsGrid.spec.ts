import { DotsGrid } from "./DotsGrid";
import { DotsController, type Dot } from "./Game/DotsController";
import { distanceBetween, type Point } from "./shapes";

function getDotsInRangeBruteForce(dots: Dot[], point: Point, range: number) {
    return dots.filter((dot) => {
        return distanceBetween(dot.position, point) <= range;
    });
}

function prepareGrid({
    width,
    height,
    stepDot,
    dotsGridSquareSize,
}: {
    width: number;
    height: number;
    stepDot: number;
    dotsGridSquareSize: number;
}) {
    const dots: Dot[] = [];

    const grid = new DotsGrid({
        dotsGridSquareSize,
        width,
        height,
    });

    const dotWidth = 8;
    const dotHeight = 8;

    let idCounter = 0;
    for (let x = dotWidth / 2; x < width - dotWidth / 2; x += stepDot) {
        for (let y = dotHeight / 2; y < height - dotHeight / 2; y += stepDot) {
            const position = { x, y };
            const dot = {
                position,
                id: 1000 + idCounter++,
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

    return { dots, grid, stepDot };
}

describe("DotsGrid", () => {
    test("grid dimensions", () => {
        const width = 10;
        const height = 13;
        const dotsGridSquadSize = 3;

        const grid = new DotsGrid({
            dotsGridSquareSize: dotsGridSquadSize,
            width,
            height,
        });

        expect(grid.dotsGridCols).toBe(4);
        expect(grid.dotsGridRows).toBe(5);
    });

    describe("getDotsInRange", () => {
        test("correctness", () => {
            const width = 23;
            const height = 24;
            const stepDot = 0.35;
            const dotsGridSquareSize = 3;

            const { dots, grid } = prepareGrid({
                width,
                height,
                stepDot,
                dotsGridSquareSize,
            });

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
                            dots,
                            { x: xRounded, y: yRounded },
                            range,
                        );

                        const idsByGrid = dotsInRangeByGrid
                            .sort((a, b) => a.id - b.id)
                            .map((dot) => dot.id);
                        const idsByBruteForce = dotsInRangeBruteForce
                            .sort((a, b) => a.id - b.id)
                            .map((dot) => dot.id);

                        expect(idsByGrid).toEqual(idsByBruteForce);
                    }
                }
            }
        });

        test.todo("performance worst case", () => {});

        test.todo("performance average case", () => {});

        test.todo("performance best case", () => {});
    });
});
