import type { Game } from "../Game";
import { RendererCanvasSimple } from "../Renderer";
import { UI } from "../UI";

export function playTest(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
    generator: Generator<Game, Game>,
) {
    const game = generator.next().value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).game = game;

    const isPauseRef = { current: true };

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

    function renderLoop() {
        renderer.render();
        requestAnimationFrame(renderLoop);
    }

    ui.init();
    renderLoop();

    for (const _ of generator);

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

    gameLoop();
    setInterval(gameLoop, 10);
}
