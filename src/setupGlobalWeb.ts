// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const objectWithAnyKeyCallableRecursive: any = new Proxy(
    function () {},
    {
        get: () => {
            return objectWithAnyKeyCallableRecursive;
        },
        apply: () => {
            return objectWithAnyKeyCallableRecursive;
        },
    },
);

window.test = objectWithAnyKeyCallableRecursive;
window.describe = objectWithAnyKeyCallableRecursive;
window.expect = objectWithAnyKeyCallableRecursive;
window.beforeEach = objectWithAnyKeyCallableRecursive;
window.afterEach = objectWithAnyKeyCallableRecursive;
window.beforeAll = objectWithAnyKeyCallableRecursive;
window.afterAll = objectWithAnyKeyCallableRecursive;
