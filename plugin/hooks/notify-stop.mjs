/** Hook entry for the `Stop` (end of turn) event. See notify.mjs. */
import { runHook } from "./notify.mjs";

await runHook("Stop");
