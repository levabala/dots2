import type { Dot } from "../Game/DotsController";
import { PlayerUtils } from "./PlayerUtils";

describe("PlayerUtils", () => {
    test("squadAllDotsInFrame", () => {
        expect(
            PlayerUtils.squadAllDotsInFrame({
                slots: [
                    {
                        position: { x: 0, y: 0 },
                        angle: 0,
                        dot: {
                            position: { x: 0, y: 0 },
                        } as Dot,
                    },
                    {
                        position: { x: 1, y: 0 },
                        angle: 0,
                        dot: {
                            position: { x: 2, y: 0 },
                        } as Dot,
                    },
                    {
                        position: { x: 2, y: 0 },
                        angle: 0,
                        dot: {
                            position: { x: 3, y: 0 },
                        } as Dot,
                    },
                    {
                        position: { x: 3, y: 0 },
                        angle: 0,
                        dot: null,
                    },
                ],
                frame: {
                    p1: { x: 0, y: 0 },
                    p2: { x: 4, y: 0 },
                    p3: { x: 4, y: 4 },
                    p4: { x: 0, y: 4 },
                },
            }),
        ).toBeTrue();

        expect(
            PlayerUtils.squadAllDotsInFrame({
                slots: [
                    {
                        position: { x: 0, y: 0 },
                        angle: 0,
                        dot: {
                            position: { x: 0, y: 0 },
                        } as Dot,
                    },
                    {
                        position: { x: 1, y: 0 },
                        angle: 0,
                        dot: {
                            position: { x: 2, y: 0 },
                        } as Dot,
                    },
                    {
                        position: { x: 2, y: 0 },
                        angle: 0,
                        dot: {
                            position: { x: 3, y: 0 },
                        } as Dot,
                    },
                    {
                        position: { x: 4, y: 1 },
                        angle: 0,
                        dot: {
                            position: { x: -3, y: 0 },
                        } as Dot,
                    },
                ],
                frame: {
                    p1: { x: 0, y: 0 },
                    p2: { x: 4, y: 0 },
                    p3: { x: 4, y: 4 },
                    p4: { x: 0, y: 4 },
                },
            }),
        ).toBeFalse();
    });
});
