import { WIDTH, HEIGHT } from "./consts";
import { Game } from "./game";
import { UI } from "./ui";
import { RendererCanvasSimple } from "./renderer";

const canvas = document.createElement("canvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.style.border = "solid gray 1px";

document.body.appendChild(canvas);

const game = new Game();
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

console.log(game, ui, renderer);

renderLoop();
