import type { Point } from "./shapes";

export class Vector implements Point {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    add(v: Point) {
        return new Vector(this.x + v.x, this.y + v.y);
    }

    sub(v: Point) {
        return new Vector(this.x - v.x, this.y - v.y);
    }

    mul(v: Point) {
        return new Vector(this.x * v.x, this.y * v.y);
    }

    div(v: Point) {
        return new Vector(this.x / v.x, this.y / v.y);
    }

    dot(v: Point) {
        return this.x * v.x + this.y * v.y;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }

    normalize() {
        const length = this.length();

        return new Vector(this.x / length, this.y / length);
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    withLength(length: number) {
        const currentLength = this.length();

        if (currentLength === 0) {
            return new Vector(0, 0);
        }

        const scale = length / currentLength;

        return this.mul({ x: scale, y: scale });
    }

    static fromPoint(point: Point) {
        return new Vector(point.x, point.y);
    }

    static betweenPoints(p1: Point, p2: Point) {
        return new Vector(p2.x - p1.x, p2.y - p1.y);
    }

    toString() {
        return `(${this.x}, ${this.y})`;
    }
}
