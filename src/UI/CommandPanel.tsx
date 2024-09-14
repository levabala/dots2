import { createRoot, type Root } from "react-dom/client";
import type { Squad, Team } from "../Game";

export type CommandPanelState = {
    team: Team | null;
    squads: Squad[];
};

export type CommandPanelCallbacks = {
    changeAllowAttack: (squads: Squad[], allowAttack: boolean) => void;
    changeAllowAttackOnce: (squads: Squad[], allowAttack: boolean) => void;
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
}> = ({ state: { team, squads }, callbacks }) => {
    let allowAttack: Presence = Presence.None;
    for (const squad of squads) {
        if (squad.allowAttack) {
            allowAttack = Presence.All;
        } else if (allowAttack === Presence.All) {
            allowAttack = Presence.Some;
            break;
        }
    }

    let allowShootOnce: Presence = Presence.None;
    for (const squad of squads) {
        if (squad.allowShootOnce) {
            allowShootOnce = Presence.All;
        } else if (allowShootOnce === Presence.All) {
            allowShootOnce = Presence.Some;
            break;
        }
    }

    return (
        <div
            style={{
                height: "100%",
                background: "#cececed6",
                border: "solid black 1px",
            }}
        >
            <h3>Command Panel</h3>
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
                                    acc + (slot.dot !== null ? 1 : 0),
                                0,
                            ),
                            attacking: squad.attackTargetSquad?.key,
                        };
                    }),
                    undefined,
                    2,
                )}
            </div>
            {squads.length > 0 && (
                <>
                    <button
                        onClick={() =>
                            callbacks.changeAllowAttack(
                                squads,
                                allowAttack === Presence.None ? true : false,
                            )
                        }
                    >
                        allowAttack: {allowAttack}
                    </button>
                    <button
                        onClick={() => {
                            callbacks.changeAllowAttackOnce(
                                squads,
                                allowShootOnce === Presence.None ? true : false,
                            );
                        }}
                    >
                        allowAttackOnce: {allowShootOnce}
                    </button>
                </>
            )}
        </div>
    );
};
