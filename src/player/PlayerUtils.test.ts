import "../setupGlobalAuto";
import type { Dot } from "../Game/DotsController";
import { PlayerUtils } from "./PlayerUtils";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";

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

    test("getNewSquadFrameInFrontOf", () => {
        const squad = {
            frame: {
                p1: { x: 0, y: -1 },
                p2: { x: 1, y: -1 },
                p3: { x: 1, y: 1 },
                p4: { x: 0, y: 1 },
            },
        } as Squad;

        expect(
            PlayerUtils.getNewSquadFrameInFrontOf(squad, { x: 3, y: 0 }, 1),
        ).toEqual({
            p1: { x: 1, y: -1 },
            p2: { x: 2, y: -1 },
            p3: { x: 2, y: 1 },
            p4: { x: 1, y: 1 },
        });
        expect(
            PlayerUtils.getNewSquadFrameInFrontOf(squad, { x: 4, y: 0 }, 1),
        ).toEqual({
            p1: { x: 2, y: -1 },
            p2: { x: 3, y: -1 },
            p3: { x: 3, y: 1 },
            p4: { x: 2, y: 1 },
        });
        expect(
            PlayerUtils.getNewSquadFrameInFrontOf(squad, { x: -2, y: 0 }, 1),
        ).toEqual({
            p1: { x: -1, y: -1 },
            p2: { x: 0, y: -1 },
            p3: { x: 0, y: 1 },
            p4: { x: -1, y: 1 },
        });
    });
});
