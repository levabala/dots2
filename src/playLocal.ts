import { Game } from "./Game";
import { setupPanicAssert } from "./setupPanicAssert";
import { Logger } from "./Logger";
import { RendererCanvasSimple } from "./Renderer";
import { UI } from "./UI";
import { VisualDebugger } from "./VisualDebugger";
import { sceneTwoTeamsSomeBuildings } from "./scenes";

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

    setupPanicAssert(game);

    function renderLoop() {
        renderer.render();
        requestAnimationFrame(renderLoop);
    }

    global.timeScale = 4;

    const MAX_TICK_TIME = 60;
    const MIN_TICK_TIME = 16;

    let timeReal = Date.now();
    function gameLoop() {
        const timeRealNew = Date.now();
        const deltaReal = timeRealNew - timeReal;

        if (!isPauseRef.current) {
            const timeScale = global.timeScale;
            const tickTime = Math.min(deltaReal * timeScale, MAX_TICK_TIME);

            if (tickTime < MIN_TICK_TIME) {
                return;
            }

            game.tick(tickTime);
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

    // sceneOneTeam(game);
    // sceneFourAIs(game, ui);
    sceneTwoTeamsSomeBuildings(game);

    renderLoop();
    gameLoop();
    setInterval(gameLoop);
}
