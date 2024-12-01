export const DEFAULT_PROJECTILE = {
    radius: 4,
    speed: 1500 / 1000,
    damage: 1,
    flyDistanceLeft: 500,
};
export const BETWEEN_SQUADS_GAP = 30;
export const SQUAD_MIN_DOTS = 10;

export const DOT_WIDTH = 8;
export const DOT_HEIGHT = 6;
export const DOT_SPEED = 70 / 1000;
export const DOT_IN_SQUAD_RADIUS_AROUND = 8;
export const DOTS_GRID_SIZE = Math.max(DOT_WIDTH, DOT_HEIGHT) * 5;
export const DOT_COST_FOOD = 10;
export const DOT_COST_COINS = 1;
export const DOT_ATTACK_RANGE = 200;
export const DOT_ATTACK_COOLDOWN = 2000;
export const DOT_AIMING_DURATION = 500;
export const DOT_HEALTH_MAX = 2;
export const DOT_MORALE_BASELINE = 50;
export const DOT_MORALE_GAIN_BY_NEARBY_ALLIE_COUNT = 5;
export const DOT_MORALE_GAIN_BY_NEARBY_ALLIE_RADIUS = DOT_ATTACK_RANGE;
export const DOT_MORALE_DROP_BY_NEARBY_ENEMY_COUNT = 1;
export const DOT_MORALE_DROP_BY_NEARBY_ENEMY_RADIUS = DOT_ATTACK_RANGE * 1.5;
export const DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_RADIUS = 30;
export const DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_COUNT = 5;
export const DOT_MORALE_FLEE_LEVEL = 10;
export const DOT_MORALE_DROP_PER_SECOND_MAX = 20;
export const DOT_MORALE_GAIN_PER_SECOND_MAX = 5;
export const DOT_MORALE_MIN = 0;
export const DOT_MORALE_MAX = 200;
export const DOT_MORALE_GAIN_BY_NEARBY_ALLIE_COUNT_MAX = 150;
export const DOT_MORALE_DROP_BY_NEARBY_ENEMY_COUNT_MAX = 100;
export const DOT_MORALE_DROP_BY_NEARBY_DEAD_ALLIE_COUNT_MAX = 50;
export const DOT_SCAN_INTERVAL = 100;
