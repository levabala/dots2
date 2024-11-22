import type { Point, Rect } from "./shapes";

export class RendererUtils {
    static drawPolygon(ctx: CanvasRenderingContext2D, points: Point[]) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (const point of points) {
            ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
    }

    static drawRect(ctx: CanvasRenderingContext2D, rect: Rect) {
        RendererUtils.drawPolygon(ctx, [rect.p1, rect.p2, rect.p3, rect.p4]);
    }

    // chatgpt (c)
    static drawArrowHead(
        ctx: CanvasRenderingContext2D,
        p1: Point,
        p2: Point,
        headLength: number,
    ) {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.beginPath();

        // Draw the line
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
            p2.x - headLength * Math.cos(angle - Math.PI / 6),
            p2.y - headLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
            p2.x - headLength * Math.cos(angle + Math.PI / 6),
            p2.y - headLength * Math.sin(angle + Math.PI / 6),
        );
    }
}
