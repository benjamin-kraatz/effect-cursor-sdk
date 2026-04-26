import type { Agent } from "@cursor/february";
import { Context } from "effect";

export class CursorSDKService extends Context.Service<
  CursorSDKService,
  { readonly agent: Agent }
>()("effect-cursor-sdk/index/CursorSDKService") {}

/**
 * Public entry for effect-cursor-sdk.
 * Replace with real SDK surface as it grows.
 */
export const packageName = "effect-cursor-sdk";
