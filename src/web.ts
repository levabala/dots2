import { playLocal } from "./playLocal";
import { playTest } from "./tests/playTest";
import { testMoveSquad } from "./tests/units.spec.ts";

if (typeof global === "undefined") {
    window.global = window;
}

const container = document.createElement("div");
container.style.position = "relative";
container.style.height = "100%";

document.body.appendChild(container);

const width = Math.floor(container.clientWidth) - 1;
const height = Math.floor(container.clientHeight);

const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
canvas.style.border = "solid gray 1px";

container.appendChild(canvas);

playTest(container, canvas, testMoveSquad());
// playLocal(container, canvas);
