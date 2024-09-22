import type { Dot } from "./Game/DotsController";
import {
    Direction,
    distanceBetween,
    getIntersectedSquareOrth,
    roundAngle,
    roundSinCos,
    type Line,
    type Point,
} from "./utils";

export class DotsGrid {
    dotsGridCols: number;
    dotsGridRows: number;
    dotsGrid: Set<Dot>[];

    constructor(
        readonly dotsGridSquadSize: number,
        width: number,
        height: number,
    ) {
        this.dotsGridCols = Math.ceil(width / this.dotsGridSquadSize);
        this.dotsGridRows = Math.ceil(height / this.dotsGridSquadSize);

        this.dotsGrid = Array(this.dotsGridCols * this.dotsGridRows)
            .fill(null)
            .map(() => new Set());
    }

    calcIndexFromXY(x: number, y: number) {
        return y * this.dotsGridCols + x;
    }

    private calcIndexXY(point: Point) {
        const x = Math.min(
            Math.max(Math.floor(point.x / this.dotsGridSquadSize), 0),
            this.dotsGridCols - 1,
        );
        const y = Math.min(
            Math.max(Math.floor(point.y / this.dotsGridSquadSize), 0),
            this.dotsGridRows - 1,
        );

        return { x, y, index: this.calcIndexFromXY(x, y) };
    }

    private calcIndex(point: Point): number {
        return this.calcIndexXY(point).index;
    }

    private calcIndexesDot(dot: Dot): number[] {
        return Array.from(
            new Set([
                this.calcIndex(dot.hitBox.p1),
                this.calcIndex(dot.hitBox.p2),
                this.calcIndex(dot.hitBox.p3),
                this.calcIndex(dot.hitBox.p4),
            ]),
        );
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
            top: this.dotsGridSquadSize * gridY,
            bottom: this.dotsGridSquadSize * (gridY + 1),
            left: this.dotsGridSquadSize * gridX,
            right: this.dotsGridSquadSize * (gridX + 1),
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
                    square.top = this.dotsGridSquadSize * gridY;
                    square.bottom = this.dotsGridSquadSize * (gridY + 1);
                    break;
                case Direction.bottom:
                    gridY += 1;
                    square.top = this.dotsGridSquadSize * gridY;
                    square.bottom = this.dotsGridSquadSize * (gridY + 1);
                    break;
                case Direction.left:
                    gridX -= 1;
                    square.left = this.dotsGridSquadSize * gridX;
                    square.right = this.dotsGridSquadSize * (gridX + 1);
                    break;
                case Direction.right:
                    gridX += 1;
                    square.left = this.dotsGridSquadSize * gridX;
                    square.right = this.dotsGridSquadSize * (gridX + 1);
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

    getDotsGridIndicesInRange(
        point: Point,
        range: number,
    ): {
        definitelyInRange: number[];
        maybeInRange: number[];
    } {
        const gridRadiusForSure = Math.ceil(range / this.dotsGridSquadSize);

        const center = this.calcIndexXY(point);
        const fromX = center.x - gridRadiusForSure;
        const fromY = center.y - gridRadiusForSure;
        const toX = center.x + gridRadiusForSure;
        const toY = center.y + gridRadiusForSure;

        const dotsGridSquadDiagonalHalf = Math.sqrt(
            this.dotsGridSquadSize ** 2 * 2,
        );

        const maybeInRange: number[] = [];
        const definitelyInRange: number[] = [];

        for (let x = fromX; x <= toX; x++) {
            for (let y = fromY; y <= toY; y++) {
                const index = this.calcIndexFromXY(x, y);

                const squadCenter = {
                    x: this.dotsGridSquadSize * x + this.dotsGridSquadSize / 2,
                    y: this.dotsGridSquadSize * y + this.dotsGridSquadSize / 2,
                };

                const distance = distanceBetween(point, squadCenter);

                const isMaybeInRange =
                    distance >= range - dotsGridSquadDiagonalHalf;

                if (isMaybeInRange) {
                    maybeInRange.push(index);
                } else {
                    definitelyInRange.push(index);
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
        const dots = [];

        const { definitelyInRange, maybeInRange } =
            this.getDotsGridIndicesInRange(point, range);

        for (const index of definitelyInRange) {
            for (const dot of this.dotsGrid[index]) {
                if (predicate && !predicate(dot)) {
                    continue;
                }

                dots.push(dot);
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

                dots.push(dot);
            }
        }

        return dots;
    }
}
