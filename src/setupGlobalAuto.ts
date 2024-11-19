/* eslint-disable @typescript-eslint/no-require-imports */
if (typeof window === "undefined") {
    require("./setupGlobalNode");
} else {
    require("./setupGlobalWeb");
}
