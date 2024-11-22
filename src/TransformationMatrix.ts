import type { Point } from "./shapes";

const DEFAULT_VALUE = [1, 0, 0, 1, 0, 0] as [
    number,
    number,
    number,
    number,
    number,
    number,
];

export class TransformationMatrix {
    value: [number, number, number, number, number, number];

    constructor() {
        this.value = DEFAULT_VALUE.slice() as typeof DEFAULT_VALUE;
    }

    reset() {
        this.value = DEFAULT_VALUE.slice() as typeof DEFAULT_VALUE;
        return this;
    }

    // chatgpt (c)
    scale(sx: number, sy: number): this {
        this.value[0] *= sx;
        this.value[3] *= sy;
        return this;
    }

    // chatgpt (c)
    translate(tx: number, ty: number): this {
        this.value[4] += this.value[0] * tx + this.value[2] * ty;
        this.value[5] += this.value[1] * tx + this.value[3] * ty;
        return this;
    }

    // chatgpt (c)
    transformPoint(point: Point): Point {
        const { x, y } = point;
        return {
            x: x * this.value[0] + y * this.value[2] + this.value[4],
            y: x * this.value[1] + y * this.value[3] + this.value[5],
        };
    }

    // chatgpt (c)
    transformPointReverse(point: Point): Point {
        const { x, y } = point;
        const det =
            this.value[0] * this.value[3] - this.value[1] * this.value[2];
        return {
            x:
                (this.value[3] * (x - this.value[4]) -
                    this.value[2] * (y - this.value[5])) /
                det,
            y:
                (this.value[0] * (y - this.value[5]) -
                    this.value[1] * (x - this.value[4])) /
                det,
        };
    }

    // chatgpt (c)
    transformVector(vector: Point): Point {
        const { x, y } = vector;
        return {
            x: x * this.value[0] + y * this.value[2],
            y: x * this.value[1] + y * this.value[3],
        };
    }

    // chatgpt (c)
    transformVectorReverse(vector: Point): Point {
        const { x, y } = vector;
        const det =
            this.value[0] * this.value[3] - this.value[1] * this.value[2];
        return {
            x: (this.value[3] * x - this.value[2] * y) / det,
            y: (this.value[0] * y - this.value[1] * x) / det,
        };
    }
}
