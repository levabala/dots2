/* eslint-disable */
// @ts-nocheck

import { SQUAD_MIN_DOTS, DOT_ATTACK_RANGE } from "../consts";
import type { Game } from "../Game";
import { BUILDINGS_CONFIGS } from "../Game/buildingsConfigs";
import type { BuildingKind, Building, BuildingHQ } from "../Game/BuildingsController";
import { SquadFrameUtils } from "../Game/SquadFrameUtils";
import type { Squad } from "../Game/SquadsController";
import type { Team } from "../Game/TeamController";
import { distanceBetween, isPointInPolygon, rotateRect, type Point, type Polygon } from "../utils";
import { PlayerLegacy } from "./PlayerLegacy";

export class PlayerAI extends PlayerLegacy {
    private actionListeners: ((message: string) => void)[] = [];
    private intentionListeners: ((message: string) => void)[] = [];
    private actions: string[] = [];
    private intentions: string[] = [];
    private intervalId: number | null = null;
    private lastIntentionTime: number = 0;
    private lastIntention: string = '';
    private currentIntention: string = '';

    constructor(
        readonly game: Game,
        readonly team: Team,
    ) {
        super(game, team);
    }

    addEventListener(event: 'action' | 'intention', listener: (message: string) => void): void {
        if (event === 'action') {
            this.actionListeners.push(listener);
        } else if (event === 'intention') {
            this.intentionListeners.push(listener);
        }
    }

    removeEventListener(event: 'action' | 'intention', listener: (message: string) => void): void {
        if (event === 'action') {
            this.actionListeners = this.actionListeners.filter(l => l !== listener);
        } else if (event === 'intention') {
            this.intentionListeners = this.intentionListeners.filter(l => l !== listener);
        }
    }

    private emitEvent(event: 'action' | 'intention', message: string): void {
        if (event === 'action') {
            this.actions.push(message);
            this.actionListeners.forEach(listener => listener(message));
        } else if (event === 'intention') {
            this.intentions.push(message);
            this.intentionListeners.forEach(listener => listener(message));
        }
    }

    startAI(): void {
        this.intervalId = global.setInterval(() => {
            this.update();
        }, 200);
    }

    private update(): void {
        const resources = this.game.getTeamToResources().get(this.team);

        if (!resources) {
            this.emitEvent('action', 'No resources information available.');
            return;
        }

        const allBuildings = Array.from(this.game.getBuildings());
        const myBuildings = allBuildings.filter(building => building.team === this.team);

        const allSquads = this.game.getSquads();
        const mySquads = allSquads.filter(squad => squad.team === this.team);

        const enemyBuildings = allBuildings.filter(building => building.team !== this.team);
        const enemySquads = allSquads.filter(squad => squad.team !== this.team);

        const barracksCount = myBuildings.filter(building => building.kind === 'barracks').length;
        const farmCount = myBuildings.filter(building => building.kind === 'farm').length;
        const lumberMillCount = myBuildings.filter(building => building.kind === 'lumberMill').length;
        const houseCount = myBuildings.filter(building => building.kind === 'house').length;
        const granaryCount = myBuildings.filter(building => building.kind === 'granary').length;

        const now = Date.now();

        // Build initial buildings
        if (barracksCount === 0) {
            if (this.tryBuildBuilding('barracks')) {
                this.currentIntention = 'Building barracks';
                return;
            }
        }

        if (farmCount === 0) {
            if (this.tryBuildBuilding('farm')) {
                this.currentIntention = 'Building farm';
                return;
            }
        }

        if (lumberMillCount === 0) {
            if (this.tryBuildBuilding('lumberMill')) {
                this.currentIntention = 'Building lumber mill';
                return;
            }
        }

        if (houseCount === 0) {
            if (this.tryBuildBuilding('house')) {
                this.currentIntention = 'Building house';
                return;
            }
        }

        // Build additional buildings based on resources
        if (resources.food >= resources.foodCapacity * 0.8) {
            if (this.tryBuildBuilding('granary')) {
                this.currentIntention = 'Building granary to increase food capacity';
                return;
            }
        }

        if (resources.wood >= resources.woodCapacity * 0.8) {
            if (this.tryBuildBuilding('lumberMill')) {
                this.currentIntention = 'Building lumber mill to increase wood capacity';
                return;
            }
        }

        if (resources.housing <= 10) {
            if (this.tryBuildBuilding('house')) {
                this.currentIntention = 'Building house to increase housing';
                return;
            }
        }

        // Create squads with different sizes
        const allDots = Array.from(this.game.getDots());
        const myDots = allDots.filter(dot => dot.team === this.team);
        const myDotsWithoutSquad = myDots.filter(dot => !dot.squad);

        const minSquadSize = SQUAD_MIN_DOTS;
        const maxSquadSize = 30;

        if (myDotsWithoutSquad.length >= minSquadSize) {
            const squadSize = minSquadSize + Math.floor(Math.random() * (maxSquadSize - minSquadSize + 1));
            const availableDots = myDotsWithoutSquad.slice(0, squadSize);
            const center = this.getSquadFormationCenter();

            const result = this.game.createSquad(availableDots, this.team, center);

            if (result.isSuccess) {
                this.emitEvent('action', `Created squad ${result.squad.key} of size ${squadSize} at (${center.x.toFixed(2)}, ${center.y.toFixed(2)}).`);
                this.currentIntention = `Formed new squad ${result.squad.key} of size ${squadSize}`;
                return;
            } else {
                this.emitEvent('action', `Failed to create squad: ${result.error}.`);
            }
        }

        // Manage squads
        if (mySquads.length > 0) {
            for (const squad of mySquads) {
                // Check if squad is already attacking
                if (squad.attackTargetBuildings.size > 0 || squad.attackTargetSquads.size > 0) {
                    continue;
                }

                // Find nearest enemy squad
                if (enemySquads.length > 0) {
                    const nearestEnemySquad = this.findNearestSquad(squad, enemySquads);

                    const targetPosition = this.getPositionNearTarget(squad, this.getSquadCenter(nearestEnemySquad), DOT_ATTACK_RANGE - 10);

                    this.moveAndOrientSquadTowards(squad, targetPosition, nearestEnemySquad);

                    // Allow squad to attack
                    squad.allowAttack = true;

                    // Order squad to attack the enemy squad
                    this.game.orderAttackOnlySquad({ squadAttacker: squad, squadTarget: nearestEnemySquad });

                    this.emitEvent('action', `Squad ${squad.key} is attacking enemy squad ${nearestEnemySquad.key}.`);
                    this.currentIntention = `Attacking enemy squad ${nearestEnemySquad.key} with squad ${squad.key}`;
                    return;
                } else if (enemyBuildings.length > 0) {
                    // Attack enemy buildings
                    const nearestBuilding = this.findNearestBuilding(squad, enemyBuildings);

                    const targetPosition = this.getPositionNearTarget(squad, nearestBuilding.center, DOT_ATTACK_RANGE - 10);

                    this.moveAndOrientSquadTowards(squad, targetPosition, nearestBuilding);

                    // Allow squad to attack
                    squad.allowAttack = true;

                    // Order squad to attack the enemy building
                    this.game.orderAttackOnlyBuilding({ squadAttacker: squad, buildingTarget: nearestBuilding });

                    this.emitEvent('action', `Squad ${squad.key} is attacking enemy building at (${nearestBuilding.center.x.toFixed(2)}, ${nearestBuilding.center.y.toFixed(2)}).`);
                    this.currentIntention = `Attacking enemy building with squad ${squad.key}`;
                    return;
                } else {
                    // No enemies found
                    this.currentIntention = 'No enemies found, scouting...';
                }
            }
        }

        // Emit intention every 1 second if it has changed
        if (this.currentIntention !== this.lastIntention && now - this.lastIntentionTime >= 1000) {
            this.emitEvent('intention', this.currentIntention);
            this.lastIntention = this.currentIntention;
            this.lastIntentionTime = now;
        }
    }

    private tryBuildBuilding(kind: BuildingKind): boolean {
        const config = BUILDINGS_CONFIGS[kind];
        const resources = this.game.getTeamToResources().get(this.team);

        if (!resources) {
            this.emitEvent('action', 'No resources information available.');
            return false;
        }

        const cost = this.game.getBuildingCost(kind, this.team);

        if (resources.coins < cost.coins || resources.wood < cost.wood) {
            this.emitEvent('intention', `Not enough resources to build ${kind}.`);
            return false;
        }

        // Find a place to build the building
        const position = this.findBuildingPlacement(kind);

        if (!position) {
            this.emitEvent('intention', `Cannot find place to build ${kind}.`);
            return false;
        }

        const building: Building = {
            ...config,
            frame: config.frameRelative.map(p => ({ x: p.x + position.x, y: p.y + position.y })),
            center: position,
            team: this.team,
        } as Building;

        const success = this.game.tryBuild(building);

        if (success) {
            this.emitEvent('action', `Built ${kind} at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}).`);
            return true;
        } else {
            this.emitEvent('action', `Failed to build ${kind}.`);
            return false;
        }
    }

    private findBuildingPlacement(kind: BuildingKind): Point | null {
        const config = BUILDINGS_CONFIGS[kind];
        const myBuildings = Array.from(this.game.getBuildings()).filter(b => b.team === this.team);

        const myHQ = myBuildings.find(building => building.kind === 'hq') as BuildingHQ | undefined;

        if (!myHQ) {
            this.emitEvent('action', 'No HQ found.');
            return null;
        }

        // Try to find a position near the HQ
        const hqPosition = myHQ.center;

        const searchRadius = 200; // Search radius
        const maxAttempts = 36; // 360 degrees / 10 degrees

        for (let i = 0; i < maxAttempts; i++) {
            const angle = Math.random() * 360;
            const rad = angle * Math.PI / 180;
            const radius = searchRadius + Math.random() * 100;

            const x = hqPosition.x + radius * Math.cos(rad);
            const y = hqPosition.y + radius * Math.sin(rad);

            const position = { x, y };

            const frame = config.frameRelative.map(p => ({ x: p.x + position.x, y: p.y + position.y }));

            // Check for overlap with other buildings
            const overlaps = myBuildings.some(building => this.polygonsOverlap(frame, building.frame));

            if (!overlaps) {
                // Position is good
                return position;
            }
        }

        // Cannot find a position
        return null;
    }

    private polygonsOverlap(polygon1: Polygon, polygon2: Polygon): boolean {
        for (const point of polygon1) {
            if (isPointInPolygon(point, polygon2)) {
                return true;
            }
        }

        for (const point of polygon2) {
            if (isPointInPolygon(point, polygon1)) {
                return true;
            }
        }

        return false;
    }

    private getSquadFormationCenter(): Point {
        const myBuildings = Array.from(this.game.getBuildings()).filter(b => b.team === this.team);

        const myHQ = myBuildings.find(building => building.kind === 'hq') as BuildingHQ | undefined;

        if (myHQ) {
            return {
                x: myHQ.center.x + Math.random() * 100 - 50,
                y: myHQ.center.y + Math.random() * 100 - 50,
            };
        } else {
            // No HQ, return some default position
            return { x: Math.random() * this.game.width, y: Math.random() * this.game.height };
        }
    }

    private findNearestBuilding(squad: Squad, buildings: Building[]): Building {
        const squadCenter = this.getSquadCenter(squad);
        let minDistance = Infinity;
        let nearestBuilding: Building | null = null;

        for (const building of buildings) {
            const distance = distanceBetween(squadCenter, building.center);
            if (distance < minDistance) {
                minDistance = distance;
                nearestBuilding = building;
            }
        }

        return nearestBuilding!;
    }

    private findNearestSquad(squad: Squad, squads: Squad[]): Squad {
        const squadCenter = this.getSquadCenter(squad);
        let minDistance = Infinity;
        let nearestSquad: Squad | null = null;

        for (const enemySquad of squads) {
            const enemySquadCenter = this.getSquadCenter(enemySquad);
            const distance = distanceBetween(squadCenter, enemySquadCenter);
            if (distance < minDistance) {
                minDistance = distance;
                nearestSquad = enemySquad;
            }
        }

        return nearestSquad!;
    }

    private getSquadCenter(squad: Squad): Point {
        const positions = squad.slots.filter(slot => slot.dot).map(slot => slot.dot!.position);
        if (positions.length === 0) {
            return { x: 0, y: 0 };
        }
        const sumX = positions.reduce((sum, p) => sum + p.x, 0);
        const sumY = positions.reduce((sum, p) => sum + p.y, 0);
        return { x: sumX / positions.length, y: sumY / positions.length };
    }

    private moveAndOrientSquadTowards(squad: Squad, targetPosition: Point, enemyTarget: Squad | Building): void {
        const dotsCount = squad.slots.length;

        const squadCenter = this.getSquadCenter(squad);

        // Get enemy center
        const enemyCenter = enemyTarget instanceof Object && 'center' in enemyTarget
            ? enemyTarget.center
            : this.getSquadCenter(enemyTarget as Squad);

        // Calculate angle from squad to enemy
        const angleToEnemy = Math.atan2(enemyCenter.y - squadCenter.y, enemyCenter.x - squadCenter.x);

        // Create the squad frame at targetPosition, facing angleToEnemy
        const squadArea = SquadFrameUtils.calcDotsSquadArea(dotsCount);
        const squadWidth = Math.sqrt(squadArea);
        const squadHeight = squadWidth;

        // Create rectangle centered at targetPosition
        const halfWidth = squadWidth / 2;
        const halfHeight = squadHeight / 2;

        // Initial rectangle at origin
        let rect: Rect = {
            p1: { x: -halfWidth, y: -halfHeight },
            p2: { x: halfWidth, y: -halfHeight },
            p3: { x: halfWidth, y: halfHeight },
            p4: { x: -halfWidth, y: halfHeight },
        };

        // Rotate the rectangle so that p1 and p2 face towards the enemy
        rect = rotateRect({
            rect,
            anchor: { x: 0, y: 0 },
            angle: angleToEnemy,
        });

        // Translate the rectangle to targetPosition
        rect = {
            p1: { x: rect.p1.x + targetPosition.x, y: rect.p1.y + targetPosition.y },
            p2: { x: rect.p2.x + targetPosition.x, y: rect.p2.y + targetPosition.y },
            p3: { x: rect.p3.x + targetPosition.x, y: rect.p3.y + targetPosition.y },
            p4: { x: rect.p4.x + targetPosition.x, y: rect.p4.y + targetPosition.y },
        };

        // Move the squad
        this.game.moveSquadTo([squad], rect);

        this.emitEvent('action', `Moved and oriented squad ${squad.key} towards enemy at (${enemyCenter.x.toFixed(2)}, ${enemyCenter.y.toFixed(2)}).`);
    }

    private getPositionNearTarget(squad: Squad, targetPosition: Point, distance: number): Point {
        const squadCenter = this.getSquadCenter(squad);
        const angle = Math.atan2(targetPosition.y - squadCenter.y, targetPosition.x - squadCenter.x);
        return {
            x: targetPosition.x - distance * Math.cos(angle),
            y: targetPosition.y - distance * Math.sin(angle),
        };
    }
}
