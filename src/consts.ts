export const DEFAULT_PROJECTILE = {
    radius: 4,
    speed: 3000 / 1000,
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
export const DOT_ATTACK_COOLDOWN = 5000;
export const DOT_AIMING_DURATION = 500;
export const DOT_HEALTH_MAX = 2;
export const DOT_MORALE_INITIAL = 20;
export const DOT_MORALE_BASELINE = 30;
export const DOT_MORALE_BASELINE_IN_SQUAD = 100;
export const DOT_MORALE_BASELINE_GAIN_PER_SECOND = 0.5;
export const DOT_MORALE_BASELINE_DROP_PER_SECOND = 0.5;
export const DOT_MORALE_BASELINE_GAIN_IN_SQUAD_PER_SECOND = 1;
export const DOT_MORALE_BASELINE_DROP_IN_SQUAD_PER_SECOND = 0.3;
export const DOT_MORALE_FLEE_LEVEL = 10;
export const DOT_MORALE_HIT_DROP_SELF = 5;
export const DOT_MORALE_HIT_DROP_NEARBY = 1;
export const DOT_MORALE_HIT_DROP_RADIUS = 20;
export const DOT_MORALE_KILL_DROP_NEARBY = 4;
export const DOT_MORALE_KILL_DROP_RADIUS = 50;
export const DOT_MORALE_SHOOT_GAIN_SELF = 4;
export const DOT_MORALE_SHOOT_GAIN_NEARBY = 2;
export const DOT_MORALE_SHOOT_GAIN_RADIUS = 40;
export const DOT_MORALE_MIN = 0;
export const DOT_MORALE_MAX = 200;
export const DOT_SCAN_INTERVAL = 100;
export const SQUAD_UPDATE_FRAME_INTERVAL = 100;
