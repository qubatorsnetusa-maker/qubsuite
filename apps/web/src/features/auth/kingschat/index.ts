import type { KingsChatEnvironment } from "@qub/shared";
import { loginWindow, type KingsChatTokens } from "./login-window";

export { KingsChatPopupError, type KingsChatTokens } from "./login-window";

/** Asks the person to approve Qub in KingsChat. Qub only needs their profile. */
export function kingslogin(
  options: { clientId: string; scopes: string[] },
  environment: KingsChatEnvironment,
): Promise<KingsChatTokens> {
  if (!options.clientId)
    return Promise.reject(new Error("KingsChat client id is missing."));
  if (!options.scopes.every((s) => typeof s === "string"))
    return Promise.reject(new Error("KingsChat scopes must be strings."));
  return loginWindow(options, environment);
}
