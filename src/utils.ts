export type RectOrth = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
export type Point = { x: number; y: number };
export type Line = { p1: Point; p2: Point };
export type Rect = { p1: Point; p2: Point; p3: Point; p4: Point };
export type Polygon = Point[];

export function orthogonalRect(p1: Point, p3: Point): Rect {
    return {
        p1,
        p2: { x: p3.x, y: p1.y },
        p3,
        p4: { x: p1.x, y: p3.y },
    };
}

// chatgpt (c)
export function randomPointInRect({ p1, p2, p3 }: Rect): Point {
    // Calculate the width and height of the rectangle
    const width = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const height = Math.hypot(p3.x - p2.x, p3.y - p2.y);

    // Generate a random point in the rectangle's local coordinate system
    const randomX = Math.random() * width;
    const randomY = Math.random() * height;

    // Rotate the random point back to the rectangle's original orientation
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const randomPoint = rotatePoint(
        { x: randomX, y: randomY },
        { x: 0, y: 0 },
        angle,
    );

    // Translate the random point to the rectangle's global position
    const finalPoint = {
        x: randomPoint.x + p1.x,
        y: randomPoint.y + p1.y,
    };

    return finalPoint;
}

// chatgpt (c)
export function sortRectPoints(rect: Rect): Rect {
    // Extract points into an array
    const points: Point[] = [rect.p1, rect.p2, rect.p3, rect.p4];

    // Sort points primarily by the y-coordinate, then by the x-coordinate
    points.sort((a, b) => {
        if (a.y !== b.y) {
            return a.y - b.y; // Sort by y-coordinate
        } else {
            return a.x - b.x; // Sort by x-coordinate if y is the same
        }
    });

    // Identify the two top points (top-left and top-right)
    let [topLeft, topRight] = points.slice(0, 2);
    // Identify the two bottom points (bottom-left and bottom-right)
    let [bottomLeft, bottomRight] = points.slice(2, 4);

    // Ensure top-right has a greater x-coordinate than top-left
    if (topRight.x < topLeft.x) {
        [topLeft, topRight] = [topRight, topLeft];
    }

    // Ensure bottom-right has a greater x-coordinate than bottom-left
    if (bottomRight.x < bottomLeft.x) {
        [bottomLeft, bottomRight] = [bottomRight, bottomLeft];
    }

    // Return a new Rect with the points sorted in the desired order
    return { p1: topLeft, p2: topRight, p3: bottomRight, p4: bottomLeft };
}

// chatgpt (c)
export function isPointInRect(point: Point, { p1, p2, p3, p4 }: Rect): boolean {
    function crossProduct(p1: Point, p2: Point, p: Point): number {
        return (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x);
    }

    const d1 = crossProduct(p1, p2, point);
    const d2 = crossProduct(p2, p3, point);
    const d3 = crossProduct(p3, p4, point);
    const d4 = crossProduct(p4, p1, point);

    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0 || d4 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0 || d4 > 0;

    return !(hasNeg && hasPos);
}

// chatgpt (c)
export function rotatePoint(
    { x: px, y: py }: Point,
    { x: cx, y: cy }: Point,
    rad: number,
) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const nx = cos * (px - cx) - sin * (py - cy) + cx;
    const ny = sin * (px - cx) + cos * (py - cy) + cy;

    return { x: nx, y: ny };
}

// chatgpt (c)
export function rotateRect({
    rect,
    anchor,
    angle,
}: {
    rect: Rect;
    anchor: Point;
    angle: number;
}) {
    const p1 = rotatePoint(rect.p1, anchor, angle);
    const p2 = rotatePoint(rect.p2, anchor, angle);
    const p3 = rotatePoint(rect.p3, anchor, angle);
    const p4 = rotatePoint(rect.p4, anchor, angle);

    return { p1, p2, p3, p4 };
}

export function makeRectOrthogonal(rect: Rect) {
    const angle = Math.atan2(rect.p2.y - rect.p1.y, rect.p2.x - rect.p1.x);

    return rotateRect({ rect, anchor: rect.p1, angle });
}

export function getRectCenter(rect: Rect): Point {
    return {
        x: (rect.p1.x + rect.p2.x + rect.p3.x + rect.p4.x) / 4,
        y: (rect.p1.y + rect.p2.y + rect.p3.y + rect.p4.y) / 4,
    };
}

// chatgpt (c)
export function getIntersectionFirst(
    line: { p1: Point; p2: Point },
    rect: Rect,
): Point | null {
    function getIntersection(
        p1: Point,
        p2: Point,
        p3: Point,
        p4: Point,
    ): Point | null {
        const denom =
            (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (denom === 0) return null; // Lines are parallel

        const ua =
            ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
            denom;
        const ub =
            ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
            denom;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            const x = p1.x + ua * (p2.x - p1.x);
            const y = p1.y + ua * (p2.y - p1.y);
            return { x, y };
        }

        return null; // No intersection
    }

    const sides = [
        { p1: rect.p1, p2: rect.p2 },
        { p1: rect.p2, p2: rect.p3 },
        { p1: rect.p3, p2: rect.p4 },
        { p1: rect.p4, p2: rect.p1 },
    ];

    let closestIntersection: Point | null = null;
    let minDistSquared = Infinity;

    for (const side of sides) {
        const intersection = getIntersection(
            line.p1,
            line.p2,
            side.p1,
            side.p2,
        );
        if (intersection) {
            const distSquared = distanceBetween(line.p1, intersection);
            if (distSquared < minDistSquared) {
                minDistSquared = distSquared;
                closestIntersection = intersection;
            }
        }
    }

    return closestIntersection;
}

export function getIntersectionAny(
    line: { p1: Point; p2: Point },
    rect: Rect,
): Point | null {
    function getIntersection(
        p1: Point,
        p2: Point,
        p3: Point,
        p4: Point,
    ): Point | null {
        const denom =
            (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (denom === 0) return null; // Lines are parallel

        const ua =
            ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
            denom;
        const ub =
            ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
            denom;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            const x = p1.x + ua * (p2.x - p1.x);
            const y = p1.y + ua * (p2.y - p1.y);
            return { x, y };
        }

        return null; // No intersection
    }

    const sides = [
        { p1: rect.p1, p2: rect.p2 },
        { p1: rect.p2, p2: rect.p3 },
        { p1: rect.p3, p2: rect.p4 },
        { p1: rect.p4, p2: rect.p1 },
    ];

    for (const side of sides) {
        const intersection = getIntersection(
            line.p1,
            line.p2,
            side.p1,
            side.p2,
        );
        if (intersection) {
            return intersection;
        }
    }

    return null;
}

export function roundSinCos(sincos: number) {
    const epsilon = Number.EPSILON;
    if (Math.abs(sincos) < epsilon) {
        return 0;
    } else if (Math.abs(sincos - 1) < epsilon) {
        return 1;
    } else if (Math.abs(sincos + 1) < epsilon) {
        return -1;
    }

    return sincos;
}

export function roundAngle(angleRaw: number) {
    const epsilon = Number.EPSILON;

    if (Math.abs(angleRaw) < epsilon) {
        return 0;
    } else if (Math.abs(angleRaw - Math.PI * 2) < epsilon) {
        return Math.PI * 2;
    } else if (Math.abs(angleRaw - Math.PI / 2) < epsilon) {
        return Math.PI / 2;
    } else if (Math.abs(angleRaw - Math.PI) < epsilon) {
        return Math.PI;
    } else if (Math.abs(angleRaw - (3 * Math.PI) / 2) < epsilon) {
        return (3 * Math.PI) / 2;
    }

    return angleRaw;
}

export enum Direction {
    top = 0,
    right = 1,
    bottom = 2,
    left = 3,
}

// chatgpt (c)
export function getIntersectedSquareOrth(
    point: Point,
    angleRaw: number,
    cosAngle: number,
    sinAngle: number,
    square: RectOrth,
): {
    side: Direction.top | Direction.right | Direction.bottom | Direction.left;
    intersection: Point;
} {
    let side1, side2, t1, t2, x1, x2, y1, y2;

    const angle = angleRaw < 0 ? angleRaw + Math.PI * 2 : angleRaw;

    // Determine which two sides to check based on the clockwise-oriented angle
    if (angle >= 0 && angle < Math.PI / 2) {
        // 0° to 90° (clockwise): Check right and bottom sides
        side1 = Direction.right;
        side2 = Direction.bottom;
        t1 = cosAngle !== 0 ? (square.right - point.x) / cosAngle : Infinity;
        t2 = sinAngle !== 0 ? (square.bottom - point.y) / sinAngle : Infinity;
        x1 = square.right;
        y1 = point.y + t1 * sinAngle;
        x2 = point.x + t2 * cosAngle;
        y2 = square.bottom;
    } else if (angle >= Math.PI / 2 && angle < Math.PI) {
        // 90° to 180° (clockwise): Check bottom and left sides
        side1 = Direction.bottom;
        side2 = Direction.left;
        t1 = sinAngle !== 0 ? (square.bottom - point.y) / sinAngle : Infinity;
        t2 = cosAngle !== 0 ? (square.left - point.x) / cosAngle : Infinity;
        x1 = point.x + t1 * cosAngle;
        y1 = square.bottom;
        x2 = square.left;
        y2 = point.y + t2 * sinAngle;
    } else if (angle >= Math.PI && angle < (3 * Math.PI) / 2) {
        // 180° to 270° (clockwise): Check left and top sides
        side1 = Direction.left;
        side2 = Direction.top;
        t1 = cosAngle !== 0 ? (square.left - point.x) / cosAngle : Infinity;
        t2 = sinAngle !== 0 ? (square.top - point.y) / sinAngle : Infinity;
        x1 = square.left;
        y1 = point.y + t1 * sinAngle;
        x2 = point.x + t2 * cosAngle;
        y2 = square.top;
    } else {
        // 270° to 360° (clockwise): Check top and right sides
        side1 = Direction.top;
        side2 = Direction.right;
        t1 = sinAngle !== 0 ? (square.top - point.y) / sinAngle : Infinity;
        t2 = cosAngle !== 0 ? (square.right - point.x) / cosAngle : Infinity;
        x1 = point.x + t1 * cosAngle;
        y1 = square.top;
        x2 = square.right;
        y2 = point.y + t2 * sinAngle;
    }

    // Determine which intersection is closer and return the corresponding side and intersection point
    if (t1 < t2 && y1 >= square.top && y1 <= square.bottom) {
        return { side: side1, intersection: { x: x1, y: y1 } };
    } else {
        return { side: side2, intersection: { x: x2, y: y2 } };
    }
}

export function distanceBetween(p1: Point, p2: Point): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function arePointsEqual(p1: Point, p2: Point) {
    return (
        Math.abs(p2.x - p1.x) < Number.EPSILON &&
        Math.abs(p2.y - p1.y) < Number.EPSILON
    );
}

const MAX_RANDOM_POINT_ATTEMPTS = 1000;

// chatgpt (c)
export function randomPointInPolygon(polygon: Polygon): Point {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    // Find bounding box of the polygon
    for (const point of polygon) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }

    let attempts = 0;

    // Loop until a point is found inside the polygon
    while (true) {
        const randomPoint = {
            x: minX + Math.random() * (maxX - minX),
            y: minY + Math.random() * (maxY - minY),
        };

        if (isPointInPolygon(randomPoint, polygon)) {
            return randomPoint;
        }

        if (attempts++ >= MAX_RANDOM_POINT_ATTEMPTS) {
            window.panic("Failed to find a random point in the polygon");
        }
    }
}

// chatgpt (c)
function isPointInPolygon(point: Point, polygon: Polygon): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = yi > point.y !== yj > point.y &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}
