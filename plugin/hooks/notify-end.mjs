/** Hook entry for the `SessionEnd` (end of session) event. See notify.mjs. */
import { runHook } from "./notify.mjs";

await runHook("SessionEnd");
