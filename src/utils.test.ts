import { describe, expect, it } from "bun:test";
import {
    getFacingSidesOfConvexPolygon,
    groupPolygonsByOverlapping,
    type Point,
    type Polygon,
} from "./utils";

describe("groupPolygonsByOverlapping", () => {
    // chatgpt (c)
    it("should group overlapping polygons correctly", () => {
        // Define some overlapping polygons
        const polygon1: Polygon = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ];

        const polygon2: Polygon = [
            { x: 3, y: 3 },
            { x: 7, y: 3 },
            { x: 7, y: 7 },
            { x: 3, y: 7 },
        ];

        const polygon3: Polygon = [
            { x: 6, y: 6 },
            { x: 10, y: 6 },
            { x: 10, y: 10 },
            { x: 6, y: 10 },
        ];

        const polygon4: Polygon = [
            { x: 11, y: 11 },
            { x: 15, y: 11 },
            { x: 15, y: 15 },
            { x: 11, y: 15 },
        ];

        const polygons = [polygon1, polygon2, polygon3, polygon4];

        const grouped = groupPolygonsByOverlapping(polygons);

        // We expect polygon1, polygon2, and polygon3 to be in the same group since they overlap
        // Polygon4 does not overlap with any others, so it should be in its own group

        expect(grouped.length).toBe(2);

        // Find the group that contains polygon1
        const groupContainingPolygon1 = grouped.find((group) =>
            group.includes(polygon1),
        );
        expect(groupContainingPolygon1).toBeDefined();
        expect(groupContainingPolygon1?.length).toBe(3);
        expect(groupContainingPolygon1).toEqual(
            expect.arrayContaining([polygon1, polygon2, polygon3]),
        );

        // Find the group that contains polygon4
        const groupContainingPolygon4 = grouped.find((group) =>
            group.includes(polygon4),
        );
        expect(groupContainingPolygon4).toBeDefined();
        expect(groupContainingPolygon4?.length).toBe(1);
        expect(groupContainingPolygon4).toEqual([polygon4]);
    });

    // chatgpt (c)
    it("should not group non-overlapping polygons together", () => {
        const polygonA: Polygon = [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 },
        ];

        const polygonB: Polygon = [
            { x: 3, y: 3 },
            { x: 5, y: 3 },
            { x: 5, y: 5 },
            { x: 3, y: 5 },
        ];

        const polygons = [polygonA, polygonB];

        const grouped = groupPolygonsByOverlapping(polygons);

        expect(grouped.length).toBe(2);
        expect(grouped).toContainEqual([polygonA]);
        expect(grouped).toContainEqual([polygonB]);
    });

    // chatgpt (c)
    it("should handle an empty array of polygons", () => {
        const polygons: Polygon[] = [];

        const grouped = groupPolygonsByOverlapping(polygons);

        expect(grouped).toEqual([]);
    });

    // chatgpt (c)
    it("should handle a single polygon", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
        ];

        const grouped = groupPolygonsByOverlapping([polygon]);

        expect(grouped).toEqual([[polygon]]);
    });

    // chatgpt (c)
    it("should group polygons that touch at edges or vertices", () => {
        const polygon1: Polygon = [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 },
        ];

        const polygon2: Polygon = [
            { x: 2, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 2 },
            { x: 2, y: 2 },
        ];

        const polygons = [polygon1, polygon2];

        const grouped = groupPolygonsByOverlapping(polygons);

        expect(grouped.length).toBe(1);
        expect(grouped[0]).toEqual([polygon1, polygon2]);
    });

    // chatgpt (c)
    it("should correctly group multiple sets of overlapping polygons", () => {
        const polygonGroup1: Polygon[] = [
            [
                { x: 0, y: 0 },
                { x: 3, y: 0 },
                { x: 3, y: 3 },
                { x: 0, y: 3 },
            ],
            [
                { x: 2, y: 2 },
                { x: 5, y: 2 },
                { x: 5, y: 5 },
                { x: 2, y: 5 },
            ],
        ];

        const polygonGroup2: Polygon[] = [
            [
                { x: 6, y: 6 },
                { x: 9, y: 6 },
                { x: 9, y: 9 },
                { x: 6, y: 9 },
            ],
            [
                { x: 8, y: 8 },
                { x: 11, y: 8 },
                { x: 11, y: 11 },
                { x: 8, y: 11 },
            ],
        ];

        const polygonGroup3: Polygon[] = [
            [
                { x: 12, y: 12 },
                { x: 14, y: 12 },
                { x: 14, y: 14 },
                { x: 12, y: 14 },
            ],
        ];

        const polygons = [...polygonGroup1, ...polygonGroup2, ...polygonGroup3];

        const grouped = groupPolygonsByOverlapping(polygons);

        expect(grouped.length).toBe(3);

        const group1 = grouped.find((group) =>
            group.includes(polygonGroup1[0]),
        );
        expect(group1).toBeDefined();
        expect(group1).toEqual(expect.arrayContaining(polygonGroup1));

        const group2 = grouped.find((group) =>
            group.includes(polygonGroup2[0]),
        );
        expect(group2).toBeDefined();
        expect(group2).toEqual(expect.arrayContaining(polygonGroup2));

        const group3 = grouped.find((group) =>
            group.includes(polygonGroup3[0]),
        );
        expect(group3).toBeDefined();
        expect(group3).toEqual(expect.arrayContaining(polygonGroup3));
    });
});

describe("getFacingSidesOfConvexPolygon", () => {
    it("should identify facing sides for a square polygon", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ];

        const from: Point = { x: 2, y: -2 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([
            { x: 0, y: 0 },
            { x: 4, y: 0 },
        ]);
    });

    it("should return empty array when point is inside the polygon", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 2, y: 4 },
        ];

        const from: Point = { x: 2, y: 2 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([]);
    });

    it("should handle a convex polygon with more sides", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 3, y: 1 },
            { x: 4, y: 4 },
            { x: 1, y: 5 },
            { x: -1, y: 3 },
        ];

        const from: Point = { x: 2, y: -2 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([
            { x: 0, y: 0 },
            { x: 3, y: 1 },
        ]);
    });

    it("should return empty array when no sides are facing the point", () => {
        const polygon: Polygon = [
            { x: 1, y: 1 },
            { x: 5, y: 1 },
            { x: 5, y: 5 },
            { x: 1, y: 5 },
        ];

        const from: Point = { x: 3, y: 3 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([]);
    });

    it("should identify sides facing a point to the right of the polygon", () => {
        const polygon: Polygon = [
            { x: -4, y: 0 },
            { x: -4, y: 4 },
            { x: 0, y: 4 },
            { x: 0, y: 0 },
        ];

        const from: Point = { x: 2, y: 2 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([
            { x: 0, y: 4 },
            { x: 0, y: 0 },
        ]);
    });

    it("should handle polygon with sides perpendicular to the 'from' point", () => {
        const polygon: Polygon = [
            { x: -2, y: 0 },
            { x: 0, y: 2 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
        ];

        const from: Point = { x: 0, y: 0 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([]);
    });

    it("should handle a triangle", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 2.5, y: 5 },
        ];

        const from: Point = { x: 2.5, y: -2 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([
            { x: 0, y: 0 },
            { x: 5, y: 0 },
        ]);
    });

    it("should identify all sides facing a point far away", () => {
        const polygon: Polygon = [
            { x: -2, y: -2 },
            { x: 2, y: -2 },
            { x: 2, y: 2 },
            { x: -2, y: 2 },
        ];

        const from: Point = { x: 0, y: -10 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([
            { x: -2, y: -2 },
            { x: 2, y: -2 },
        ]);
    });

    it("should return empty array when polygon is degenerate (less than 3 points)", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ];

        const from: Point = { x: 2, y: 2 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([]);
    });

    it("should handle large convex polygons", () => {
        const polygon: Polygon = [];
        const numSides = 100;
        const radius = 10;

        for (let i = 0; i < numSides; i++) {
            const angle = (2 * Math.PI * i) / numSides;
            polygon.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle),
            });
        }

        const from: Point = { x: 0, y: -20 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints.length).toBeGreaterThan(0);
    });

    it("should handle sides when the 'from' point is exactly perpendicular to an edge", () => {
        const polygon: Polygon = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ];

        const from: Point = { x: 2, y: 0 };

        const facingPoints = getFacingSidesOfConvexPolygon(from, polygon);

        expect(facingPoints).toEqual([]);
    });
});
