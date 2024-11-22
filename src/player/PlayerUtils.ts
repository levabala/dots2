import type { Squad } from "../Game/SquadsController";
import { arePointsEqual, isPointInRect } from "../shapes";

export class PlayerUtils {
    static squadAllDotsInFrame(squad: Pick<Squad, "slots" | "frame">) {
        return squad.slots.every(
            (slot) =>
                !slot.dot || isPointInRect(slot.dot.position, squad.frame),
        );
    }

    static squadAllDotsInPosition(squad: Pick<Squad, "slots" | "frame">) {
        return squad.slots.every(
            (slot) =>
                !slot.dot ||
                arePointsEqual(slot.dot.position, slot.dot.position),
        );
    }
}
