import type { Game, Dot } from "./Game";

export type DotWithNode = Dot & { node: HTMLDivElement };

const MAX_UPDATES_PER_TICK = 100;
const TICK_INTERVAL = 200;

export class VisualDebugger {
    dotsToUpdate = new Set<Dot>();

    constructor(
        readonly game: Game,
        readonly anchorElement: HTMLDivElement,
    ) {
        const container = document.createElement("div");
        container.style.position = "absolute";
        container.style.left = "0";
        container.style.top = "0";
        container.style.right = "0";
        container.style.bottom = "0";
        container.style.overflow = "hidden";
        container.style.pointerEvents = "none";

        anchorElement.appendChild(container);

        game.addEventListener("dot-added", ({ dot }) => {
            const node = document.createElement("div");

            node.style.position = "absolute";
            node.style.width = `${dot.width}px`;
            node.style.height = `${dot.height}px`;

            (dot as DotWithNode).node = node;

            this.updateDotNode(dot as DotWithNode);

            container.appendChild(node);
        });

        game.addEventListener("dot-moved", ({ dot }) => {
            this.dotsToUpdate.add(dot);
        });

        setInterval(() => {
            let counter = 0;
            for (const dot of this.dotsToUpdate) {
                this.updateDotNode(dot as DotWithNode);
                this.dotsToUpdate.delete(dot);

                counter++;
                if (counter >= MAX_UPDATES_PER_TICK) {
                    return;
                }
            }
        }, TICK_INTERVAL);
    }

    private updateDotNode(dot: DotWithNode) {
        const node = (dot as DotWithNode).node;

        node.style.width = `${dot.width}px`;
        node.style.height = `${dot.height}px`;
        node.style.left = `${dot.position.x - dot.width / 2}px`;
        node.style.top = `${dot.position.y - dot.height / 2}px`;
        node.style.transform = `rotate(${dot.angle}rad)`;
    }
}
