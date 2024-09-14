import { Game } from "./game";
import { UI } from "./ui";
import { RendererCanvasSimple } from "./renderer";
import { Logger } from "./logger";
import { VisualDebugger } from "./visualDebugger";

const width = Math.floor(window.document.body.offsetWidth - 8);
const height = Math.floor(window.document.body.offsetHeight - 8);

const container = document.createElement("div");
container.style.position = 'relative';

const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
canvas.style.border = "solid gray 1px";

document.body.appendChild(container);
container.appendChild(canvas);

const game = new Game(width, height);

const isPauseRef = { current: false };

const ui = new UI(
    canvas,
    game,
    isPauseRef,
    () => {
        isPauseRef.current = true;
    },
    () => {
        isPauseRef.current = false;
    },
);

const renderer = new RendererCanvasSimple(game, ui, canvas);

const logger = new Logger(game);
const visualDebugger = new VisualDebugger(game, container);

function panic(message: string, details?: object): never {
    console.trace("Failed:", message, details);
    console.log(game);
    console.log(ui);
    console.log(renderer);

    throw new Error("Assertion failed");
}

function assert(condition: boolean, message: string, details?: object) {
    if (condition) {
        return;
    }

    panic(message, details);
}
window.assert = assert;
window.panic = panic;

function renderLoop() {
    renderer.render();
    requestAnimationFrame(renderLoop);
}

let time = Date.now();
function gameLoop() {
    const timeNew = Date.now();
    const delta = timeNew - time;

    if (!isPauseRef.current) {
        game.tick(delta);
    }

    time = timeNew;
    setTimeout(() => gameLoop(), 10);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
(window as any).game = game;
(window as any).ui = ui;
(window as any).renderer = renderer;
(window as any).logger = logger;
(window as any).visualDebugger = visualDebugger;
/* eslint-enable @typescript-eslint/no-explicit-any */

game.init();
ui.init();

renderLoop();
gameLoop();
