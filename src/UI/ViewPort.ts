import { TransformationMatrix } from "../TransformationMatrix";
import type { Point, RectOrth } from "../utils";

export class ViewPort {
    viewAngleHorizontal: number;
    aspectRatio: number;
    viewElevation: number;

    offset: Point;

    rect: RectOrth;
    matrix: TransformationMatrix;

    constructor(
        readonly canvasWidth: number,
        readonly canvasHeight: number,
        viewAngleHorizontal: number,
        aspectRatio: number,
        viewElevation: number,
        offset: Point,
    ) {
        this.viewAngleHorizontal = viewAngleHorizontal;
        this.aspectRatio = aspectRatio;
        this.viewElevation = viewElevation;

        this.offset = offset;

        this.rect = this.calcRect();
        this.matrix = new TransformationMatrix();

        this.updateMatrix();
    }

    calcRect(): RectOrth {
        const viewWidth =
            (this.viewElevation / Math.tan(this.viewAngleHorizontal / 2)) * 2;
        const viewHeight = viewWidth / this.aspectRatio;

        return {
            left: this.offset.x - viewWidth / 2,
            right: this.offset.x + viewWidth / 2,
            top: this.offset.y - viewHeight / 2,
            bottom: this.offset.y + viewHeight / 2,
        };
    }

    updateMatrix() {
        const scaleX = this.canvasWidth / (this.rect.right - this.rect.left);
        const scaleY = this.canvasHeight / (this.rect.bottom - this.rect.top);

        this.matrix
            .reset()
            .scale(scaleX, scaleY)
            .translate(-this.rect.left, -this.rect.top);
    }

    updateRectAndMatrix() {
        this.rect = this.calcRect();
        this.updateMatrix();
    }

    translate(x: number, y: number) {
        this.offset.x += x;
        this.offset.y += y;
        this.updateRectAndMatrix();
    }

    addElevation(value: number) {
        this.viewElevation = Math.max(this.viewElevation + value, 100);
        this.updateRectAndMatrix();
    }
}
