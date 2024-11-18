import { Game } from "./Game/Game";
import { UI } from "./UI/UI";
import { RendererCanvasSimple } from "./Renderer";
import { Logger } from "./Logger";
import { VisualDebugger } from "./VisualDebugger";
import { sceneOneTeam } from "./scenes/scenes2";
import { setupGlobal } from "./setupGlobal";

if (typeof global === 'undefined') {
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

const game = new Game(3000, 3000);

const isPauseRef = { current: false };

const ui = new UI(
    container,
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

setupGlobal(game);

function renderLoop() {
    renderer.render();
    requestAnimationFrame(renderLoop);
}

global.timeScale = 4;

let timeReal = Date.now();
function gameLoop() {
    const timeRealNew = Date.now();
    const deltaReal = timeRealNew - timeReal;

    if (!isPauseRef.current) {
        const timeScale = global.timeScale;
        game.tick(deltaReal * timeScale);
    }

    timeReal = timeRealNew;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
(global as any).game = game;
(global as any).ui = ui;
(global as any).renderer = renderer;
(global as any).logger = logger;
(global as any).visualDebugger = visualDebugger;
/* eslint-enable @typescript-eslint/no-explicit-any */

ui.init();

sceneOneTeam(game);

renderLoop();
gameLoop();
setInterval(gameLoop, 10);
