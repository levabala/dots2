import type { Squad } from "../Game/SquadsController";
import { isPointInRect } from "../shapes";

export class PlayerUtils {
    static squadAllDotsInFrame(squad: Squad) {
        return squad.slots.every(
            (slot) =>
                !slot.dot || isPointInRect(slot.dot.position, squad.frame),
        );
    }
}
