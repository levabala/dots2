import type { Dot } from "./Game/DotsController";
import {
    Direction,
    distanceBetween,
    getIntersectedSquareOrth,
    isRectInCircle,
    roundAngle,
    roundSinCos,
    type Line,
    type Point,
} from "./shapes";

export class DotsGrid {
    readonly dotsGridSquareSize: number;
    readonly dotsGridCols: number;
    readonly dotsGridRows: number;
    readonly dotsGrid: Set<Dot>[];

    constructor({
        dotsGridSquareSize,
        width,
        height,
    }: {
        dotsGridSquareSize: number;
        width: number;
        height: number;
    }) {
        this.dotsGridSquareSize = dotsGridSquareSize;
        this.dotsGridCols = Math.ceil(width / this.dotsGridSquareSize);
        this.dotsGridRows = Math.ceil(height / this.dotsGridSquareSize);

        this.dotsGrid = Array(this.dotsGridCols * this.dotsGridRows)
            .fill(null)
            .map(() => new Set());
    }

    calcIndexFromXY(x: number, y: number) {
        return y * this.dotsGridCols + x;
    }

    calcXYFromIndex(index: number) {
        return {
            x: index % this.dotsGridCols,
            y: Math.floor(index / this.dotsGridCols),
        };
    }

    private calcIndexXY(point: Point) {
        const x = Math.min(
            Math.max(Math.floor(point.x / this.dotsGridSquareSize), 0),
            this.dotsGridCols - 1,
        );
        const y = Math.min(
            Math.max(Math.floor(point.y / this.dotsGridSquareSize), 0),
            this.dotsGridRows - 1,
        );

        return { x, y, index: this.calcIndexFromXY(x, y) };
    }

    private calcIndexesDot(dot: Dot): number[] {
        return [this.calcIndexXY(dot.position).index];
    }

    addDot(dot: Dot) {
        const indexes = this.calcIndexesDot(dot);
        for (const index of indexes) {
            this.dotsGrid[index].add(dot);
        }

        dot.gridSquareIndexes = indexes;
    }

    removeDot(dot: Dot) {
        for (const index of dot.gridSquareIndexes) {
            this.dotsGrid[index].delete(dot);
        }
    }

    updateDot(dot: Dot) {
        const indexesNew = this.calcIndexesDot(dot);

        const toDelete = [];
        for (const indexOld of dot.gridSquareIndexes) {
            if (!indexesNew.includes(indexOld)) {
                toDelete.push(indexOld);
            }
        }

        if (
            toDelete.length === 0 &&
            indexesNew.length === dot.gridSquareIndexes.length
        ) {
            return;
        }

        const toAdd = [];
        for (const indexNew of indexesNew) {
            if (!dot.gridSquareIndexes.includes(indexNew)) {
                toAdd.push(indexNew);
            }
        }

        for (const index of toDelete) {
            this.dotsGrid[index].delete(dot);
        }

        for (const index of toAdd) {
            this.dotsGrid[index].add(dot);
        }

        dot.gridSquareIndexes = indexesNew;
    }

    *iterateDotsAlongLine(line: Line) {
        const dx = line.p2.x - line.p1.x;
        const dy = line.p2.y - line.p1.y;
        const angle = roundAngle(Math.atan2(dy, dx));
        const cosAngle = roundSinCos(Math.cos(angle));
        const sinAngle = roundSinCos(Math.sin(angle));

        let pointer = line.p1;
        let { index, x: gridX, y: gridY } = this.calcIndexXY(pointer);
        const square = {
            top: this.dotsGridSquareSize * gridY,
            bottom: this.dotsGridSquareSize * (gridY + 1),
            left: this.dotsGridSquareSize * gridX,
            right: this.dotsGridSquareSize * (gridX + 1),
        };

        while (true) {
            yield* this.dotsGrid[index];

            const { side, intersection } = getIntersectedSquareOrth(
                pointer,
                angle,
                cosAngle,
                sinAngle,
                square,
            );

            switch (side) {
                case Direction.top:
                    gridY -= 1;
                    square.top = this.dotsGridSquareSize * gridY;
                    square.bottom = this.dotsGridSquareSize * (gridY + 1);
                    break;
                case Direction.bottom:
                    gridY += 1;
                    square.top = this.dotsGridSquareSize * gridY;
                    square.bottom = this.dotsGridSquareSize * (gridY + 1);
                    break;
                case Direction.left:
                    gridX -= 1;
                    square.left = this.dotsGridSquareSize * gridX;
                    square.right = this.dotsGridSquareSize * (gridX + 1);
                    break;
                case Direction.right:
                    gridX += 1;
                    square.left = this.dotsGridSquareSize * gridX;
                    square.right = this.dotsGridSquareSize * (gridX + 1);
                    break;
            }

            if (
                gridX < 0 ||
                gridX >= this.dotsGridCols ||
                gridY < 0 ||
                gridY >= this.dotsGridRows
            ) {
                return;
            }

            index = this.calcIndexFromXY(gridX, gridY);
            pointer = intersection;

            const dxNew = line.p2.x - pointer.x;
            const dyNew = line.p2.y - pointer.y;

            if (
                Math.sign(dxNew) !== Math.sign(dx) ||
                Math.sign(dyNew) !== Math.sign(dy)
            ) {
                return;
            }
        }
    }

    getSquareAsRect(index: number) {
        const { x, y } = this.calcXYFromIndex(index);

        return {
            p1: {
                x: x * this.dotsGridSquareSize,
                y: y * this.dotsGridSquareSize,
            },
            p2: {
                x: (x + 1) * this.dotsGridSquareSize,
                y: y * this.dotsGridSquareSize,
            },
            p3: {
                x: (x + 1) * this.dotsGridSquareSize,
                y: (y + 1) * this.dotsGridSquareSize,
            },
            p4: {
                x: x * this.dotsGridSquareSize,
                y: (y + 1) * this.dotsGridSquareSize,
            },
        };
    }

    getDotsGridIndicesInRange(
        point: Point,
        range: number,
    ): {
        definitelyInRange: number[];
        maybeInRange: number[];
    } {
        const gridRadiusForSure = Math.ceil(range / this.dotsGridSquareSize);

        const center = this.calcIndexXY(point);
        const fromX = Math.min(
            Math.max(center.x - gridRadiusForSure, 0),
            this.dotsGridCols - 1,
        );
        const fromY = Math.min(
            Math.max(center.y - gridRadiusForSure, 0),
            this.dotsGridRows - 1,
        );
        const toX = Math.min(
            Math.max(center.x + gridRadiusForSure, 0),
            this.dotsGridCols - 1,
        );
        const toY = Math.min(
            Math.max(center.y + gridRadiusForSure, 0),
            this.dotsGridRows - 1,
        );
        const maybeInRange: number[] = [];
        const definitelyInRange: number[] = [];

        for (let x = fromX; x <= toX; x++) {
            for (let y = fromY; y <= toY; y++) {
                const index = this.calcIndexFromXY(x, y);

                const isDefinitelyInRange = isRectInCircle(
                    this.getSquareAsRect(index),
                    point,
                    range,
                );

                if (isDefinitelyInRange) {
                    definitelyInRange.push(index);
                } else {
                    maybeInRange.push(index);
                }
            }
        }

        return { definitelyInRange, maybeInRange };
    }

    getDotsInRange(
        point: Point,
        range: number,
        predicate?: (dot: Dot) => boolean,
    ): Dot[] {
        const dots = new Set<Dot>();

        const { definitelyInRange, maybeInRange } =
            this.getDotsGridIndicesInRange(point, range);

        for (const index of definitelyInRange) {
            for (const dot of this.dotsGrid[index]) {
                if (predicate && !predicate(dot)) {
                    continue;
                }

                dots.add(dot);
            }
        }

        for (const index of maybeInRange) {
            for (const dot of this.dotsGrid[index]) {
                if (predicate && !predicate(dot)) {
                    continue;
                }

                if (distanceBetween(point, dot.position) > range) {
                    continue;
                }

                dots.add(dot);
            }
        }

        return Array.from(dots);
    }
}
