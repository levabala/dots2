/* eslint-disable no-var */
declare global {
    var assert: (condition: boolean, message: string, details?: object) => void;
    var panic: (message: string, details?: object) => never;
    var timeScale: number;
}
