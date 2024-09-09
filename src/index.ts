import { Game } from "./game";
import { UI } from "./ui";
import { RendererCanvasSimple } from "./renderer";

const width = Math.floor(window.innerWidth * 0.98);
const height = Math.floor(window.innerHeight * 0.98);

const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
canvas.style.border = "solid gray 1px";

document.body.appendChild(canvas);

const game = new Game(width, height);
game.init();

const ui = new UI(canvas, game);
ui.init();

const renderer = new RendererCanvasSimple(game, ui, canvas);

function assert(condition: boolean, message: string, details?: object) {
    if (condition) {
        return;
    }

    console.trace("Failed:", message, details);
    console.log(game);
    console.log(ui);
    console.log(renderer);
    throw new Error("Assertion failed");
}
window.assert = assert;

let time = Date.now();
function renderLoop() {
    const timeNew = Date.now();
    const delta = timeNew - time;

    game.tick(delta);
    renderer.render();

    time = timeNew;
    requestAnimationFrame(renderLoop);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
(window as any).game = game;
(window as any).ui = ui;
(window as any).renderer = renderer;
/* eslint-enable @typescript-eslint/no-explicit-any */

renderLoop();
