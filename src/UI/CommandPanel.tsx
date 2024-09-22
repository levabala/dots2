import { createRoot, type Root } from "react-dom/client";
import type { ResourcesState } from "../Game/ResourcesController";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import type { BuildingKind } from "../Game/BuildingsController";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";

export type CommandPanelLog = {
    timestamp: Date;
    content: string;
};

export type CommandPanelState = {
    team: Team | null;
    squads: Squad[];
    resources: ResourcesState | null;
    logs: CommandPanelLog[];
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
}> = ({ state: { team, squads, resources, logs }, callbacks }) => {
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
            <h3 style={{ margin: 0, marginBottom: 4 }}>Command Panel</h3>
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    overflow: "hidden",
                    gap: 4,
                    flexGrow: 1,
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
                                          coins: resources.coins,
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
                            title={JSON.stringify(
                                BUILDINGS_CONFIGS.lumberMill.cost,
                                undefined,
                                2,
                            )}
                        >
                            Lumbermill
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("barracks")}
                            title={JSON.stringify(
                                BUILDINGS_CONFIGS.barracks.cost,
                                undefined,
                                2,
                            )}
                        >
                            Barracks
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("house")}
                            title={JSON.stringify(
                                BUILDINGS_CONFIGS.house.cost,
                                undefined,
                                2,
                            )}
                        >
                            House
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("farm")}
                            title={JSON.stringify(
                                BUILDINGS_CONFIGS.farm.cost,
                                undefined,
                                2,
                            )}
                        >
                            Farm
                        </button>
                        <button
                            onClick={() => callbacks.selectBuilding("granary")}
                            title={JSON.stringify(
                                BUILDINGS_CONFIGS.granary.cost,
                                undefined,
                                2,
                            )}
                        >
                            Granary
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
                            style={{
                                overflow: "scroll",
                                flexGrow: 1,
                            }}
                        >
                            {logs.map((log) => (
                                <div>
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
