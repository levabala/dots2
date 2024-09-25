import { Game } from "./Game/Game";
import { UI } from "./UI/UI";
import { RendererCanvasSimple } from "./Renderer";
import { Logger } from "./Logger";
import { VisualDebugger } from "./VisualDebugger";
import {
    sceneOneTeam,
    sceneTwoSquads,
    sceneTwoTeamsSomeBuildings,
} from "./scenes";
import { PlayerAI as PlayerAI1 } from "./player/PlayerAIGPT1";
import { PlayerAI as PlayerAI2 } from "./player/PlayerAIGPT2";

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

let timeReal = Date.now();
function gameLoop() {
    const timeRealNew = Date.now();
    const deltaReal = timeRealNew - timeReal;

    if (!isPauseRef.current) {
        const timeScale =
            typeof window.timeScale === "number" &&
            Number.isFinite(window.timeScale)
                ? window.timeScale
                : 1;
        game.tick(deltaReal * timeScale);
    }

    timeReal = timeRealNew;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
(window as any).game = game;
(window as any).ui = ui;
(window as any).renderer = renderer;
(window as any).logger = logger;
(window as any).visualDebugger = visualDebugger;
/* eslint-enable @typescript-eslint/no-explicit-any */

ui.init();

const { team1, team2 } = sceneTwoTeamsSomeBuildings(game);
sceneTwoSquads(game, ui);

const player1 = new PlayerAI1(game, team1);

player1.addEventListener("action", (message: string) =>
    console.log("action", message),
);
player1.addEventListener("intention", (message: string) =>
    console.log("intention", message),
);
player1.startAI();

const player2 = new PlayerAI2(game, team2);

player2.addEventListener("action", (message: string) =>
    console.log("action", message),
);
player2.addEventListener("intention", (message: string) =>
    console.log("intention", message),
);
player2.startAI();

const team3 = sceneOneTeam(game);

const player3 = new PlayerAI2(game, team3);

player3.addEventListener("action", (message: string) =>
    console.log("action", message),
);
player3.addEventListener("intention", (message: string) =>
    console.log("intention", message),
);
player3.startAI();

renderLoop();
gameLoop();
setInterval(gameLoop, 10);
