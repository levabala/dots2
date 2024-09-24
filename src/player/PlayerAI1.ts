/* eslint-disable */

import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind, BuildingHQ, BuildingBarracks } from "../Game/BuildingsController";
import type { Dot, DotTemplate } from "../Game/DotsController";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import type { Point } from "../utils";
import { Player } from "./Player";

export class PlayerAI extends Player {
    private logs: string[] = [];
    private eventListeners: Map<string, Function[]> = new Map();
    private intervalId: number | null = null;
    private lastIntentionTime: number = 0;
    private lastIntention: string = '';

    private myBuildings: Building[] = [];
    private mySquads: Squad[] = [];
    private myDots: Dot[] = [];
    private enemyBuildings: Building[] = [];
    private enemySquads: Squad[] = [];

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        super(game, team);
    }

    startAI() {
        this.intervalId = window.setInterval(() => {
            this.update();
        }, 200);
    }

    update() {
        const resources = this.game.getTeamToResources().get(this.team);

        this.myBuildings = [...this.game.getBuildings()].filter(b => b.team === this.team);
        this.mySquads = this.game.getSquads().filter(s => s.team === this.team);
        this.myDots = [...this.game.getDots()].filter(dot => dot.team === this.team);
        this.enemyBuildings = [...this.game.getBuildings()].filter(b => b.team !== this.team);
        this.enemySquads = this.game.getSquads().filter(s => s.team !== this.team);

        const farmCount = this.myBuildings.filter(b => b.kind === 'farm').length;
        const houseCount = this.myBuildings.filter(b => b.kind === 'house').length;
        const lumberMillCount = this.myBuildings.filter(b => b.kind === 'lumberMill').length;
        const barracksCount = this.myBuildings.filter(b => b.kind === 'barracks').length;

        const targetFarmCount = 2;
        const targetHouseCount = 2;
        const targetLumberMillCount = 1;
        const targetBarracksCount = 1;

        let buildingToBuild: BuildingKind | null = null;

        if (farmCount < targetFarmCount) {
            buildingToBuild = 'farm';
        } else if (houseCount < targetHouseCount) {
            buildingToBuild = 'house';
        } else if (lumberMillCount < targetLumberMillCount) {
            buildingToBuild = 'lumberMill';
        } else if (barracksCount < targetBarracksCount) {
            buildingToBuild = 'barracks';
        }

        if (buildingToBuild) {
            const buildingConfig = BUILDINGS_CONFIGS[buildingToBuild];
            const cost = buildingConfig.cost;

            if (resources.coins >= cost.coins && resources.wood >= cost.wood) {
                const myHQ = this.myBuildings.find(b => b.kind === 'hq') as BuildingHQ;
                if (myHQ) {
                    const success = this.tryBuildBuilding(buildingToBuild, myHQ.center);
                    if (success) {
                        this.logIntention(`Built ${buildingToBuild}`);
                    } else {
                        this.logIntention(`Failed to build ${buildingToBuild}`);
                    }
                }
            } else {
                this.logAction(`Not enough resources to build ${buildingToBuild}`);
            }
        }

        // Produce units
        this.produceUnits();

        // Create squads from free dots
        this.createSquadsFromFreeDots();

        // Manage squads
        this.manageSquads();
    }

    private tryBuildBuilding(buildingKind: BuildingKind, center: Point): boolean {
        const buildingConfig = BUILDINGS_CONFIGS[buildingKind];

        const maxAttempts = 10;
        const radius = 200;

        for (let i = 0; i < maxAttempts; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * radius;
            const x = center.x + distance * Math.cos(angle);
            const y = center.y + distance * Math.sin(angle);

            const position = { x, y };

            const building: Building = {
                ...buildingConfig,
                team: this.team,
                center: position,
                frame: buildingConfig.frameRelative.map(p => ({
                    x: p.x + position.x,
                    y: p.y + position.y,
                })),
            } as Building;

            const success = this.game.tryBuild(building);

            if (success) {
                this.logAction(`Built ${buildingKind} at (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`);
                return true;
            } else {
                // Build failed
                // Try next position
            }
        }

        // Failed to build
        this.logAction(`Failed to build ${buildingKind} after ${maxAttempts} attempts`);
        return false;
    }

    private produceUnits() {
        const resources = this.game.getTeamToResources().get(this.team);
        const unitCost = {
            coins: 10,
            food: 5,
        };

        const barracks = this.myBuildings.filter(b => b.kind === 'barracks') as BuildingBarracks[];

        if (barracks.length > 0) {
            const dotTemplate: DotTemplate = {
                width: 10,
                height: 10,
                speed: 1,
                attackRange: 100,
                attackCooldown: 1000,
                aimingDuration: 500,
                hitBox: {
                    p1: { x: -5, y: -5 },
                    p2: { x: 5, y: -5 },
                    p3: { x: 5, y: 5 },
                    p4: { x: -5, y: 5 },
                },
                health: 10,
                angle: 0,
            };

            for (const barrack of barracks) {
                if (!barrack.isSpawning && barrack.spawnQueue.length === 0) {
                    if (resources.coins >= unitCost.coins && resources.food >= unitCost.food) {
                        barrack.spawnQueue.push(dotTemplate);
                        // Assume resources will be deducted by the game when unit is spawned
                        this.logAction(`Enqueued unit production in barrack at (${barrack.center.x.toFixed(2)}, ${barrack.center.y.toFixed(2)})`);
                    } else {
                        this.logAction(`Not enough resources to produce unit`);
                    }
                }
            }
        }
    }

    private createSquadsFromFreeDots() {
        const freeDots = this.myDots.filter(dot => !this.game.isInSquad(dot));

        const squadSize = 5;

        for (let i = 0; i < freeDots.length; i += squadSize) {
            const dotsForSquad = freeDots.slice(i, i + squadSize);
            if (dotsForSquad.length > 0) {
                const center = this.getDotsCenter(dotsForSquad);
                const squad = this.game.createSquad(dotsForSquad, this.team, center);
                this.logAction(`Created squad ${squad.key} with ${dotsForSquad.length} dots`);
            }
        }
    }

    private manageSquads() {
        for (const squad of this.mySquads) {
            if (squad.attackTargetBuildings.size > 0 || squad.attackTargetSquads.size > 0) {
                continue;
            }

            const squadCenter = this.getSquadCenter(squad);

            let nearestEnemy: { position: Point; type: 'building' | 'squad'; target: any } | null = null;
            let minDistance = Infinity;

            for (const enemyBuilding of this.enemyBuildings) {
                const distance = this.distanceBetween(squadCenter, enemyBuilding.center);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = {
                        position: enemyBuilding.center,
                        type: 'building',
                        target: enemyBuilding,
                    };
                }
            }

            for (const enemySquad of this.enemySquads) {
                const enemySquadCenter = this.getSquadCenter(enemySquad);
                const distance = this.distanceBetween(squadCenter, enemySquadCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = {
                        position: enemySquadCenter,
                        type: 'squad',
                        target: enemySquad,
                    };
                }
            }

            if (nearestEnemy) {
                const targetFrame = SquadFrameUtils.createSquadSquare(squad.slots.length, nearestEnemy.position);

                this.game.moveSquadTo([squad], targetFrame);

                if (nearestEnemy.type === 'building') {
                    this.game.attackBuilding({ squadAttacker: squad, buildingTarget: nearestEnemy.target });
                    this.logAction(`Squad ${squad.key} attacking building at (${nearestEnemy.position.x.toFixed(2)}, ${nearestEnemy.position.y.toFixed(2)})`);
                } else if (nearestEnemy.type === 'squad') {
                    this.game.attackSquad({ squadAttacker: squad, squadTarget: nearestEnemy.target });
                    this.logAction(`Squad ${squad.key} attacking enemy squad ${nearestEnemy.target.key}`);
                }

                squad.allowAttack = true;
                this.logIntention(`Squad ${squad.key} moving to attack`);
            } else {
                // No enemies found
                // Move squad to random location
                const randomX = Math.random() * this.game.width;
                const randomY = Math.random() * this.game.height;
                const randomPoint = { x: randomX, y: randomY };
                const targetFrame = SquadFrameUtils.createSquadSquare(squad.slots.length, randomPoint);

                this.game.moveSquadTo([squad], targetFrame);
                squad.allowAttack = true;
                this.logIntention(`Squad ${squad.key} exploring`);
            }
        }
    }

    private getSquadCenter(squad: Squad): Point {
        const positions = squad.slots
            .filter(slot => slot.dot !== null)
            .map(slot => slot.dot!.position);
        return this.getDotsCenter(positions);
    }

    private getDotsCenter(dots: Dot[] | Point[]): Point {
        let x = 0;
        let y = 0;
        for (const dot of dots) {
            if ('position' in dot) {
                x += dot.position.x;
                y += dot.position.y;
            } else {
                x += dot.x;
                y += dot.y;
            }
        }
        return { x: x / dots.length, y: y / dots.length };
    }

    private distanceBetween(p1: Point, p2: Point): number {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    addEventListener(name: string, listener: Function) {
        if (!this.eventListeners.has(name)) {
            this.eventListeners.set(name, []);
        }
        this.eventListeners.get(name)!.push(listener);
    }

    removeEventListener(name: string, listener: Function) {
        if (this.eventListeners.has(name)) {
            const listeners = this.eventListeners.get(name)!;
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emitEvent(name: string, payload: any) {
        if (this.eventListeners.has(name)) {
            for (const listener of this.eventListeners.get(name)!) {
                listener(payload);
            }
        }
    }

    private logAction(action: string) {
        this.logs.push(action);
        this.emitEvent('action', action);
    }

    private logIntention(intention: string) {
        const currentTime = Date.now();
        if (currentTime - this.lastIntentionTime > 1000 || this.lastIntention !== intention) {
            this.lastIntentionTime = currentTime;
            this.lastIntention = intention;
            this.emitEvent('intention', intention);
        }
    }
}
