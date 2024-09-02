export type Point = { x: number; y: number };
export type Rect = { p1: Point; p2: Point; p3: Point; p4: Point };

export function orthogonalRect(p1: Point, p3: Point): Rect {
    return {
        p1,
        p2: { x: p3.x, y: p1.y },
        p3,
        p4: { x: p1.x, y: p3.y },
    };
}

export function randomPointInRect({ p1, p2, p3 }: Rect): Point {
    // Calculate the width and height of the rectangle
    const width = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const height = Math.hypot(p3.x - p2.x, p3.y - p2.y);

    // Generate a random point in the rectangle's local coordinate system
    const randomX = Math.random() * width;
    const randomY = Math.random() * height;

    // Rotate the random point back to the rectangle's original orientation
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const randomPoint = rotatePoint({ x: randomX, y: randomY }, { x: 0, y: 0 }, angle);

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
    let points: Point[] = [rect.p1, rect.p2, rect.p3, rect.p4];

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
    const angle = Math.atan2(rect.p2.y - rect.p1.y,  rect.p2.x - rect.p1.x);

    return rotateRect({ rect, anchor: rect.p1, angle: -angle });
}

export function distanceBetween(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    return Math.sqrt(dx * dx + dy * dy);
}
