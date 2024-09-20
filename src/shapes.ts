import type { Point, Polygon } from "./utils";

export function createPolygonOffset(points: Point[], offset: Point): Polygon {
    return points.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
    }));
}

export function getPolygonCenter(points: Point[]): Point {
    let sumX = 0;
    let sumY = 0;
    for (const point of points) {
        sumX += point.x;
        sumY += point.y;
    }

    return {
        x: sumX / points.length,
        y: sumY / points.length,
    };
}
