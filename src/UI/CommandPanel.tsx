import { createRoot, type Root } from "react-dom/client";
import type { ResourcesState } from "../Game/ResourcesController";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import {
    BuildingsController,
    type BuildingCost,
    type BuildingKind,
} from "../Game/BuildingsController";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type CommandPanelLog = {
    timestamp: Date;
    content: string;
};

export type CommandPanelState = {
    team: Team | null;
    squads: Squad[];
    resources: ResourcesState | null;
    logs: CommandPanelLog[];
    buildingToCost: Record<BuildingKind, BuildingCost> | null;
};

export type CommandPanelCallbacks = {
    changeAllowAttack: (squads: Squad[], allowAttack: boolean) => void;
    changeAllowAttackOnce: (squads: Squad[], allowAttack: boolean) => void;
    selectBuilding: (building: BuildingKind) => void;
};

export class CommandPanelUI {
    root: Root;

    constructor(rootNode: HTMLDivElement) {
        this.root = createRoot(rootNode);
    }

    render(state: CommandPanelState, callbacks: CommandPanelCallbacks) {
        this.root.render(<CommandPanel state={state} callbacks={callbacks} />);
    }
}

enum Presence {
    All = "All",
    Some = "Some",
    None = "None",
}

const CommandPanel: React.FC<{
    state: CommandPanelState;
    callbacks: CommandPanelCallbacks;
}> = ({
    state: { team, squads, resources, logs, buildingToCost },
    callbacks,
}) => {
    const logsRef = useRef<HTMLDivElement>(null);
    const [timeScale, setTimeScale] = useState(global.timeScale);

    const isScrolledToBottom = useRef(true);
    useEffect(() => {
        if (!logsRef.current) {
            return;
        }

        logsRef.current.addEventListener("scroll", () => {
            if (!logsRef.current) {
                return;
            }

            isScrolledToBottom.current =
                logsRef.current.scrollTop + logsRef.current.clientHeight >=
                logsRef.current.scrollHeight - 10;
        });
    }, []);

    useLayoutEffect(() => {
        if (!logsRef.current) {
            return;
        }

        if (!isScrolledToBottom.current) {
            return;
        }

        logsRef.current.scrollTo({
            top: logsRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [logs.length]);

    let allowAttack: Presence;
    if (squads.every((squad) => !squad.allowAttack)) {
        allowAttack = Presence.None;
    } else if (squads.every((squad) => squad.allowAttack)) {
        allowAttack = Presence.All;
    } else {
        allowAttack = Presence.Some;
    }

    let allowShootOnce: Presence = Presence.None;
    if (squads.every((squad) => !squad.allowShootOnce)) {
        allowShootOnce = Presence.None;
    } else if (squads.every((squad) => squad.allowShootOnce)) {
        allowShootOnce = Presence.All;
    } else {
        allowShootOnce = Presence.Some;
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "#cececed6",
                border: "solid black 1px",
                padding: 4,
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                }}
            >
                <h3 style={{ margin: 0 }}>Command Panel</h3>
                <div
                    style={{
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                    }}
                >
                    <input
                        type="range"
                        value={timeScale}
                        min="0"
                        max="9.5"
                        step="0.5"
                        onChange={(e) => {
                            global.timeScale = parseFloat(e.target.value);
                            setTimeScale(global.timeScale);
                        }}
                    />
                    <label>Time scale: {timeScale.toFixed(1)}</label>
                    <button
                        onClick={() => {
                            global.timeScale = 1;
                            setTimeScale(global.timeScale);
                        }}
                    >
                        1
                    </button>
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 4,
                    flexGrow: 1,
                    minHeight: 0,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        width: "70%",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            overflow: "scroll",
                            border: "solid black 1px",
                            flexGrow: 1,
                        }}
                    >
                        <div>
                            {JSON.stringify(
                                resources
                                    ? {
                                          housing: resources.housing,
                                          woodCapacity: resources.woodCapacity,
                                          wood: Math.ceil(resources.wood),
                                          coins: Math.ceil(resources.coins),
                                          foodCapacity: resources.foodCapacity,
                                          food: Math.ceil(resources.food),
                                      }
                                    : null,
                                undefined,
                                2,
                            )}
                        </div>
                        <div>{JSON.stringify(team, undefined, 2)}</div>
                        <div>
                            {JSON.stringify(
                                squads.map((squad) => {
                                    return {
                                        name: squad.key,
                                        teamName: squad.team.name,
                                        slots: squad.slots.length,
                                        dots: squad.slots.reduce(
                                            (acc, slot) =>
                                                acc +
                                                (slot.dot !== null ? 1 : 0),
                                            0,
                                        ),
                                        attacking: Array.from(
                                            squad.attackTargetSquads,
                                        ).map((squad) => squad.key),
                                    };
                                }),
                                undefined,
                                2,
                            )}
                        </div>
                    </div>
                    {squads.length > 0 && (
                        <div>
                            <button
                                onClick={() =>
                                    callbacks.changeAllowAttack(
                                        squads,
                                        allowAttack === Presence.None
                                            ? true
                                            : false,
                                    )
                                }
                            >
                                allowAttack: {allowAttack}
                            </button>
                            <button
                                onClick={() => {
                                    callbacks.changeAllowAttackOnce(
                                        squads,
                                        allowShootOnce === Presence.None
                                            ? true
                                            : false,
                                    );
                                }}
                            >
                                allowAttackOnce: {allowShootOnce}
                            </button>
                        </div>
                    )}
                </div>
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                    <div>
                        <button
                            onClick={() =>
                                callbacks.selectBuilding("lumberMill")
                            }
                            data-tooltip={
                                buildingToCost &&
                                JSON.stringify(
                                    buildingToCost.lumberMill,
                                    undefined,
                                    2,
                                )
                            }
                            disabled={
                                resources === null ||
                                buildingToCost === null ||
                                !BuildingsController.canBuild(
                                    buildingToCost.lumberMill,
                                    resources,
                                )
                            }
                        >
                            Lumbermill
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("barracks")}
                            data-tooltip={
                                buildingToCost &&
                                JSON.stringify(
                                    buildingToCost.barracks,
                                    undefined,
                                    2,
                                )
                            }
                            disabled={
                                resources === null ||
                                buildingToCost === null ||
                                !BuildingsController.canBuild(
                                    buildingToCost.barracks,
                                    resources,
                                )
                            }
                        >
                            Barracks
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("house")}
                            data-tooltip={
                                buildingToCost &&
                                JSON.stringify(
                                    buildingToCost.house,
                                    undefined,
                                    2,
                                )
                            }
                            disabled={
                                resources === null ||
                                buildingToCost === null ||
                                !BuildingsController.canBuild(
                                    buildingToCost.house,
                                    resources,
                                )
                            }
                        >
                            House
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("farm")}
                            data-tooltip={
                                buildingToCost &&
                                JSON.stringify(
                                    buildingToCost.farm,
                                    undefined,
                                    2,
                                )
                            }
                            disabled={
                                resources === null ||
                                buildingToCost === null ||
                                !BuildingsController.canBuild(
                                    buildingToCost.farm,
                                    resources,
                                )
                            }
                        >
                            Farm
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("granary")}
                            data-tooltip={
                                buildingToCost &&
                                JSON.stringify(
                                    buildingToCost.granary,
                                    undefined,
                                    2,
                                )
                            }
                            disabled={
                                resources === null ||
                                buildingToCost === null ||
                                !BuildingsController.canBuild(
                                    buildingToCost.granary,
                                    resources,
                                )
                            }
                        >
                            Granary
                        </button>
                        <button
                            onClick={() =>
                                callbacks.selectBuilding("coinMiner")
                            }
                            data-tooltip={
                                buildingToCost &&
                                JSON.stringify(
                                    buildingToCost.coinMiner,
                                    undefined,
                                    2,
                                )
                            }
                            disabled={
                                resources === null ||
                                buildingToCost === null ||
                                !BuildingsController.canBuild(
                                    buildingToCost.coinMiner,
                                    resources,
                                )
                            }
                        >
                            Coin Miner
                        </button>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            border: "solid black 1px",
                            flexGrow: 1,
                            overflow: "hidden",
                        }}
                    >
                        Logs:
                        <div
                            ref={logsRef}
                            style={{
                                overflow: "scroll",
                                flexGrow: 1,
                            }}
                        >
                            {logs.map((log, i) => (
                                <div key={i}>
                                    <span>
                                        {log.timestamp.toLocaleString("en-US", {
                                            hour12: false,
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        })}
                                    </span>
                                    {" - "}
                                    <span>{log.content}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
