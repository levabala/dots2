/* eslint-disable @typescript-eslint/no-require-imports */
const {
    test,
    describe,
    expect,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} = require("bun:test");

global.test = test;
global.describe = describe;
global.expect = expect;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
