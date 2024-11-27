import type { Game } from "./Game";

export function setupPanicAssert(game: Game) {
    if (typeof global === "undefined") {
        window.global = window;
    }

    function panic(message: string, details?: object): never {
        if (!details) {
            console.trace("Failed:", message);
        } else {
            console.trace("Failed:", message, details);
        }
        console.log(game);

        throw new Error("Assertion failed");
    }

    function assert(condition: boolean, message: string, details?: object) {
        if (condition) {
            return;
        }

        panic(message, details);
    }
    global.assert = assert;
    global.panic = panic;
}
