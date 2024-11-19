/* eslint-disable no-var */
declare global {
    var assert: (condition: boolean, message: string, details?: object) => void;
    var panic: (message: string, details?: object) => never;
    var timeScale: number;
}

import type {
    test as Test,
    describe as Describe,
    expect as Expect,
    beforeEach as BeforeEach,
    afterEach as AfterEach,
    beforeAll as BeforeAll,
    afterAll as AfterAll,
} from "bun:test";

declare global {
    var test: typeof Test;
    var describe: typeof Describe;
    var expect: typeof Expect;
    var beforeEach: typeof BeforeEach;
    var afterEach: typeof AfterEach;
    var beforeAll: typeof BeforeAll;
    var afterAll: typeof AfterAll;
}
