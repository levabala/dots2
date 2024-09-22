import { createRoot, type Root } from "react-dom/client";
import type { ResourcesState } from "../Game/ResourcesController";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import type { BuildingKind } from "../Game/BuildingsController";

export type CommandPanelState = {
    team: Team | null;
    squads: Squad[];
    resources: ResourcesState | null;
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
}> = ({ state: { team, squads, resources }, callbacks }) => {
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
                        flexGrow: 1,
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
                                          food: Math.ceil(resources.food),
                                          foodCapacity: resources.foodCapacity,
                                          housing: resources.housing,
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
                <div>
                    <button
                        onClick={() => callbacks.selectBuilding("barracks")}
                    >
                        Barracks
                    </button>
                    <button onClick={() => callbacks.selectBuilding("house")}>
                        House
                    </button>
                    <button onClick={() => callbacks.selectBuilding("farm")}>
                        Farm
                    </button>
                    <button onClick={() => callbacks.selectBuilding("granary")}>
                        Granary
                    </button>
                </div>
            </div>
        </div>
    );
};
