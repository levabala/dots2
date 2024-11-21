import { RendererCanvasSimple } from "../Renderer";
import { UI } from "../UI";
import type { GameTestGenerator } from "./testUtils";

export async function playTest(
    container: HTMLDivElement,
    canvas: HTMLCanvasElement,
    generator: GameTestGenerator,
) {
    console.log('--- test start');
    const { game } = generator.next().value;

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

    const waitOnTick =
        Number(
            new URLSearchParams(window.location.search).get("waitontick"),
        ) === 1;

    let skipUntilMark = false;
    for (const { mark } of generator) {
        if (mark === undefined && skipUntilMark) {
            continue;
        }

        if (mark !== undefined) {
            console.log(`mark: ${mark}`);
        }

        if (waitOnTick) {
            skipUntilMark = await new Promise<boolean>((res) =>
                window.addEventListener("keydown", (e) => {
                    if (e.code === "Space") {
                        res(false);
                    } else if (e.code === "KeyN") {
                        res(true);
                    }
                }),
            );
        }
    }

    console.log('--- test end');

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
