/* eslint-disable */

import { DOT_COST_COINS, DOT_COST_FOOD, DOT_WIDTH, DOT_HEIGHT, DOT_SPEED, SQUAD_MIN_DOTS, DOT_AIMING_DURATION, DOT_ATTACK_COOLDOWN, DOT_ATTACK_RANGE, DOT_HEALTH_MAX } from "../consts";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { Building, BuildingKind, BuildingHQ, BuildingBarracks } from "../Game/BuildingsController";
import type { Dot, DotTemplate } from "../Game/DotsController";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import { makeRectOrthogonal, orthogonalRect, type Point, type Rect, type RectOrth } from "../shapes";
import { PlayerLegacy } from "./PlayerLegacy";

export class PlayerAI extends PlayerLegacy {
    private logs: string[] = [];
    private eventListeners: Map<string, Function[]> = new Map();
    private intervalId: number | null = null;
    private lastIntentionTime: number = 0;
    private lastIntention: string = '';

    private myBuildings: Set<Building> = new Set();
    private mySquads: Squad[] = [];
    private myDots: Dot[] = [];
    private enemyBuildings: Set<Building> = new Set();
    private enemySquads: Squad[] = [];
    private enemyTeams: Set<Team> = new Set();

    private squadMoveTimers: Map<string, number> = new Map();
    private squadPositions: Map<string, Rect> = new Map();

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        super(game, team);
    }

    startAI() {
        this.intervalId = global.setInterval(() => {
            this.update();
        }, 200) as unknown as number;
    }

    private update() {
        this.refreshGameState();

        this.buildNeededBuildings();
        this.createSquads();
        this.manageSquads();
    }

    private refreshGameState() {
        const allBuildings = this.game.getBuildings();
        this.myBuildings = new Set([...allBuildings].filter(b => b.team === this.team));
        this.enemyBuildings = new Set([...allBuildings].filter(b => b.team !== this.team));

        const allSquads = this.game.getSquads();
        this.mySquads = allSquads.filter(s => s.team === this.team && !s.removed);
        this.enemySquads = allSquads.filter(s => s.team !== this.team && !s.removed);

        this.enemyTeams = new Set([...this.enemyBuildings].map(b => b.team));

        const allDots = this.game.getDots();
        this.myDots = [...allDots].filter(dot => dot.team === this.team && !dot.removed);
    }

    private buildNeededBuildings() {
        const resources = this.game.getTeamToResources().get(this.team)!;

        const buildingCounts = {
            farm: 0,
            house: 0,
            lumberMill: 0,
            barracks: 0,
            granary: 0,
            hq: 0,
            coinMiner: 0,
        };

        for (const building of this.myBuildings) {
            if (building.kind === 'farm') buildingCounts.farm++;
            else if (building.kind === 'house') buildingCounts.house++;
            else if (building.kind === 'lumberMill') buildingCounts.lumberMill++;
            else if (building.kind === 'barracks') buildingCounts.barracks++;
        }

        const targetBuildingCounts = {
            farm: 3,
            house: 2,
            lumberMill: 1,
            barracks: 1,
            granary: 0,
            hq: 0,
            coinMiner: 0,
        };

        const buildingsOrder: BuildingKind[] = ['farm', 'house', 'lumberMill', 'barracks'];

        for (const buildingKind of buildingsOrder) {
            if (buildingCounts[buildingKind] < targetBuildingCounts[buildingKind]) {
                const buildingConfig = BUILDINGS_CONFIGS[buildingKind];
                const cost = this.game.getBuildingCost(buildingConfig.kind, this.team);

                if (resources.coins >= cost.coins && resources.wood >= cost.wood) {
                    const baseBuilding = this.findBuildingToBuildAround();
                    if (baseBuilding) {
                        const success = this.tryBuildBuilding(buildingKind, baseBuilding);
                        if (success) {
                            this.logIntention(`Built ${buildingKind}`);
                            buildingCounts[buildingKind]++;
                        } else {
                            this.logIntention(`Failed to build ${buildingKind}`);
                        }
                    }
                } else {
                    this.logAction(`Not enough resources to build ${buildingKind}`);
                }
            }
        }
    }

    private findBuildingToBuildAround(): Building | null {
        const possibleBuildings = [...this.myBuildings].filter(b => b.kind === 'hq' || b.kind === 'barracks' || b.kind === 'farm' || b.kind === 'house');
        if (possibleBuildings.length > 0) {
            return possibleBuildings[Math.floor(Math.random() * possibleBuildings.length)];
        }
        return null;
    }

    private tryBuildBuilding(buildingKind: BuildingKind, aroundBuilding: Building): boolean {
        const buildingConfig = BUILDINGS_CONFIGS[buildingKind];

        const maxAttempts = 10;
        const radius = 200;

        for (let i = 0; i < maxAttempts; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = 100 + Math.random() * radius;
            const x = aroundBuilding.center.x + distance * Math.cos(angle);
            const y = aroundBuilding.center.y + distance * Math.sin(angle);

            const position = { x, y };

            const success = this.game.tryBuild(buildingConfig.kind, position, this.team);

            if (success) {
                this.logAction(`Built ${buildingKind} at (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`);
                return true;
            }
        }

        this.logAction(`Failed to build ${buildingKind} after ${maxAttempts} attempts`);
        return false;
    }

    private createSquads() {
        const freeDots = this.myDots.filter(dot => !this.game.isInSquad(dot) && !dot.removed);

        while (freeDots.length >= SQUAD_MIN_DOTS) {
            const dotsForSquad = freeDots.splice(0, SQUAD_MIN_DOTS);
            const center = this.getDotsCenter(dotsForSquad);
            const createResult = this.game.createSquad(dotsForSquad, this.team, center);

            if (createResult.isSuccess) {
                const squad = createResult.squad;
                this.mySquads.push(squad);
                this.logAction(`Created squad ${squad.key} with ${dotsForSquad.length} dots`);
            } else {
                this.logAction(`Failed to create squad: ${createResult.error}`);
                break;
            }
        }
    }

    private manageSquads() {
        for (const squad of this.mySquads) {
            if (squad.removed) continue;

            squad.attackTargetBuildings.forEach(building => {
                if (building.health <= 0) {
                    squad.attackTargetBuildings.delete(building);
                }
            });

            squad.attackTargetSquads.forEach(enemySquad => {
                if (enemySquad.removed) {
                    squad.attackTargetSquads.delete(enemySquad);
                }
            });

            const squadCenter = this.getSquadCenter(squad);

            let nearestEnemySquad: { position: Point; squad: Squad } | null = null;
            let minDistance = Infinity;

            for (const enemySquad of this.enemySquads) {
                if (enemySquad.removed) continue;
                const enemySquadCenter = this.getSquadCenter(enemySquad);
                const distance = this.distanceBetween(squadCenter, enemySquadCenter);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemySquad = {
                        position: enemySquadCenter,
                        squad: enemySquad,
                    };
                }
            }

            if (nearestEnemySquad) {
                const canAttack = this.canMySquadAttackEnemySquad(squad, nearestEnemySquad.squad);

                if (canAttack) {
                    this.game.orderAttackOnlySquad({ squadAttacker: squad, squadTarget: nearestEnemySquad.squad });
                    squad.allowAttack = true;
                    this.logAction(`Squad ${squad.key} attacking enemy squad ${nearestEnemySquad.squad.key}`);
                    this.logIntention(`Squad ${squad.key} attacking enemy squad`);
                } else {
                    const shouldMove = this.shouldMoveSquad(squad);
                    if (shouldMove) {
                        const attackPosition = this.getAttackPosition(squadCenter, nearestEnemySquad.position);
                        const targetFrame = this.createWideSquadFormation(squad.slots.length, attackPosition);

                        if (this.isPositionSafe(targetFrame, squad)) {
                            this.game.moveSquadsTo([squad], targetFrame);
                            this.updateSquadMoveTimer(squad);
                            this.squadPositions.set(squad.key, targetFrame);
                            this.logIntention(`Squad ${squad.key} moving to attack position`);
                        } else {
                            // Try to find an alternative position
                            const alternativePosition = this.findAlternativePosition(attackPosition, squad);
                            if (alternativePosition) {
                                const alternativeFrame = this.createWideSquadFormation(squad.slots.length, alternativePosition);
                                this.game.moveSquadsTo([squad], alternativeFrame);
                                this.updateSquadMoveTimer(squad);
                                this.squadPositions.set(squad.key, alternativeFrame);
                                this.logIntention(`Squad ${squad.key} moving to alternative attack position`);
                            }
                        }
                    }
                }
            } else {
                let nearestEnemyBuilding: { position: Point; building: Building } | null = null;
                minDistance = Infinity;

                for (const enemyBuilding of this.enemyBuildings) {
                    const distance = this.distanceBetween(squadCenter, enemyBuilding.center);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestEnemyBuilding = {
                            position: enemyBuilding.center,
                            building: enemyBuilding,
                        };
                    }
                }

                if (nearestEnemyBuilding) {
                    const safeToAttack = this.isSafeToAttackBuilding(nearestEnemyBuilding.building, squadCenter);

                    if (safeToAttack) {
                        const shouldMove = this.shouldMoveSquad(squad);
                        if (shouldMove) {
                            const attackPosition = this.getAttackPosition(squadCenter, nearestEnemyBuilding.position);
                            const targetFrame = this.createWideSquadFormation(squad.slots.length, attackPosition);

                            if (this.isPositionSafe(targetFrame, squad)) {
                                this.game.moveSquadsTo([squad], targetFrame);
                                this.updateSquadMoveTimer(squad);
                                this.squadPositions.set(squad.key, targetFrame);
                                this.logIntention(`Squad ${squad.key} moving to attack building`);
                            } else {
                                const alternativePosition = this.findAlternativePosition(attackPosition, squad);
                                if (alternativePosition) {
                                    const alternativeFrame = this.createWideSquadFormation(squad.slots.length, alternativePosition);
                                    this.game.moveSquadsTo([squad], alternativeFrame);
                                    this.updateSquadMoveTimer(squad);
                                    this.squadPositions.set(squad.key, alternativeFrame);
                                    this.logIntention(`Squad ${squad.key} moving to alternative attack position`);
                                }
                            }
                        }
                        this.game.orderAttackOnlyBuilding({ squadAttacker: squad, buildingTarget: nearestEnemyBuilding.building });
                        squad.allowAttack = true;
                        this.logAction(`Squad ${squad.key} attacking building at (${nearestEnemyBuilding.position.x.toFixed(2)}, ${nearestEnemyBuilding.position.y.toFixed(2)})`);
                    } else {
                        this.logIntention(`Squad ${squad.key} holding position`);
                    }
                } else {
                    this.logIntention(`Squad ${squad.key} holding position`);
                }
            }
        }
    }

    private canMySquadAttackEnemySquad(mySquad: Squad, enemySquad: Squad): boolean {
        const mySquadCenter = this.getSquadCenter(mySquad);
        const enemySquadCenter = this.getSquadCenter(enemySquad);
        const distance = this.distanceBetween(mySquadCenter, enemySquadCenter);

        return distance <= DOT_ATTACK_RANGE;
    }

    private getAttackPosition(squadPosition: Point, enemyPosition: Point): Point {
        const distanceToEnemy = this.distanceBetween(squadPosition, enemyPosition);
        const desiredDistance = DOT_ATTACK_RANGE - 20;
        const ratio = desiredDistance / distanceToEnemy;

        const x = squadPosition.x + (enemyPosition.x - squadPosition.x) * ratio;
        const y = squadPosition.y + (enemyPosition.y - squadPosition.y) * ratio;

        return { x, y };
    }

    private isSafeToAttackBuilding(building: Building, squadPosition: Point): boolean {
        for (const enemySquad of this.enemySquads) {
            const enemySquadCenter = this.getSquadCenter(enemySquad);
            const distance = this.distanceBetween(building.center, enemySquadCenter);
            if (distance < DOT_ATTACK_RANGE + 50) {
                return false;
            }
        }
        return true;
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

    private createWideSquadFormation(dotsCount: number, center: Point): Rect {
        const rowCount = 2; // Only 2 rows for maximum shooting efficiency
        const dotsPerRow = Math.ceil(dotsCount / rowCount);
        const squadWidth = dotsPerRow * (DOT_WIDTH + 5);
        const squadHeight = rowCount * (DOT_HEIGHT + 10);

        const p1 = { x: center.x - squadWidth / 2, y: center.y - squadHeight / 2 };
        const p3 = { x: center.x + squadWidth / 2, y: center.y + squadHeight / 2 };

        return orthogonalRect(p1, p3);
    }

    private isPositionSafe(targetFrame: Rect, currentSquad: Squad): boolean {
        for (const squad of this.mySquads) {
            if (squad.removed || squad.key === currentSquad.key) continue;
            const squadFrame = this.squadPositions.get(squad.key) || this.getSquadFrame(squad);
            if (this.areRectsOverlapping(targetFrame, squadFrame)) {
                return false;
            }
        }
        return true;
    }

    private getSquadFrame(squad: Squad): Rect {
        const positions = squad.slots
            .filter(slot => slot.dot !== null)
            .map(slot => slot.dot!.position);

        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const minY = Math.min(...positions.map(p => p.y));
        const maxY = Math.max(...positions.map(p => p.y));

        const p1 = { x: minX, y: minY };
        const p3 = { x: maxX, y: maxY };

        return orthogonalRect(p1, p3);
    }

    private areRectsOverlapping(rect1: Rect, rect2: Rect): boolean {
        const rect1Orth = this.rectToOrth(rect1);
        const rect2Orth = this.rectToOrth(rect2);

        return !(
            rect1Orth.left > rect2Orth.right ||
            rect1Orth.right < rect2Orth.left ||
            rect1Orth.top > rect2Orth.bottom ||
            rect1Orth.bottom < rect2Orth.top
        );
    }

    private rectToOrth(rect: Rect): RectOrth {
        const xs = [rect.p1.x, rect.p2.x, rect.p3.x, rect.p4.x];
        const ys = [rect.p1.y, rect.p2.y, rect.p3.y, rect.p4.y];
        return {
            left: Math.min(...xs),
            right: Math.max(...xs),
            top: Math.min(...ys),
            bottom: Math.max(...ys),
        };
    }

    private shouldMoveSquad(squad: Squad): boolean {
        const currentTime = Date.now();
        const lastMoveTime = this.squadMoveTimers.get(squad.key) || 0;
        return currentTime - lastMoveTime > 5000; // Move every 5 seconds
    }

    private updateSquadMoveTimer(squad: Squad) {
        this.squadMoveTimers.set(squad.key, Date.now());
    }

    private findAlternativePosition(targetPosition: Point, squad: Squad): Point | null {
        const radius = 50;
        for (let angle = 0; angle < 360; angle += 45) {
            const rad = (angle * Math.PI) / 180;
            const x = targetPosition.x + radius * Math.cos(rad);
            const y = targetPosition.y + radius * Math.sin(rad);
            const alternativePosition = { x, y };
            const targetFrame = this.createWideSquadFormation(squad.slots.length, alternativePosition);
            if (this.isPositionSafe(targetFrame, squad)) {
                return alternativePosition;
            }
        }
        return null;
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
