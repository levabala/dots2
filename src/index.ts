import { Game } from "./Game/Game";
import { UI } from "./UI/UI";
import { RendererCanvasSimple } from "./Renderer";
import { Logger } from "./Logger";
import { VisualDebugger } from "./VisualDebugger";
import { sceneTwoSquads, sceneTwoTeamsSomeBuildings } from "./scenes";
import { PlayerAI } from "./player/PlayerAI1";

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

function panic(message: string, details?: object): never {
    if (!details) {
        console.trace("Failed:", message);
    } else {
        console.trace("Failed:", message, details);
    }
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
}

/* eslint-disable @typescript-eslint/no-explicit-any */
(window as any).game = game;
(window as any).ui = ui;
(window as any).renderer = renderer;
(window as any).logger = logger;
(window as any).visualDebugger = visualDebugger;
/* eslint-enable @typescript-eslint/no-explicit-any */

ui.init();

const { team2 } = sceneTwoTeamsSomeBuildings(game);
sceneTwoSquads(game, ui);

const player = new PlayerAI(game, team2);

player.addEventListener((message: string) => console.log(message));
player.startAI();

renderLoop();
gameLoop();
setInterval(gameLoop, 10);
