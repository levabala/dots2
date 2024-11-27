/* eslint-disable @typescript-eslint/no-require-imports */
if (typeof window === "undefined") {
    require("./setupGlobalNode");
} else {
    require("./setupGlobalWeb");
}

import { setupPanicAssert } from "./setupPanicAssert";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
setupPanicAssert({ "no game initialized": "for the panic" } as any);
