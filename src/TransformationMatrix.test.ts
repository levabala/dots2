import { describe, it, expect } from "bun:test";
import { TransformationMatrix } from "./TransformationMatrix"; // Adjust the import based on your file structure

// chatgpt (c)
describe("TransformationMatrix", () => {
    // chatgpt (c)
    it("should return the original point after transform and reverse transform", () => {
        const matrix = new TransformationMatrix();

        const point = { x: 10, y: 20 };
        const transformed = matrix.transformPoint(point);
        const reverseTransformed = matrix.transformPointReverse(transformed);

        expect(reverseTransformed.x).toBeCloseTo(point.x);
        expect(reverseTransformed.y).toBeCloseTo(point.y);
    });

    // chatgpt (c)
    it("should return the original point after scaling and reverse scaling", () => {
        const matrix = new TransformationMatrix().scale(2, 3);

        const point = { x: 10, y: 20 };
        const transformed = matrix.transformPoint(point);
        const reverseTransformed = matrix.transformPointReverse(transformed);

        expect(reverseTransformed.x).toBeCloseTo(point.x);
        expect(reverseTransformed.y).toBeCloseTo(point.y);
    });

    // chatgpt (c)
    it("should return the original point after translation and reverse translation", () => {
        const matrix = new TransformationMatrix().translate(5, -5);

        const point = { x: 10, y: 20 };
        const transformed = matrix.transformPoint(point);
        const reverseTransformed = matrix.transformPointReverse(transformed);

        expect(reverseTransformed.x).toBeCloseTo(point.x);
        expect(reverseTransformed.y).toBeCloseTo(point.y);
    });

    // chatgpt (c)
    it("should return the original point after scaling, translating, and reverse transforming", () => {
        const matrix = new TransformationMatrix()
            .scale(1.5, 0.5)
            .translate(10, -10);

        const point = { x: 10, y: 20 };
        const transformed = matrix.transformPoint(point);
        const reverseTransformed = matrix.transformPointReverse(transformed);

        expect(reverseTransformed.x).toBeCloseTo(point.x);
        expect(reverseTransformed.y).toBeCloseTo(point.y);
    });
});
