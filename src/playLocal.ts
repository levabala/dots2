import { Game } from "./Game";
import { setupGlobal } from "./setupGlobal";
import { Logger } from "./Logger";
import { RendererCanvasSimple } from "./Renderer";
import { sceneOneTeam } from "./scenes/scenes2";
import { UI } from "./UI";
import { VisualDebugger } from "./VisualDebugger";

export function playLocal(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
) {
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
}
