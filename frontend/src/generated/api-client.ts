/**
 * Typed API client generated for HoYoMusic frontend.
 *
 * Built from openapi/openapi.json via openapi-typescript (types in ./api-types.ts)
 * and openapi-fetch. This file is for future use and does NOT modify any existing
 * services/types. Adjust `baseUrl` to match your runtime API origin.
 */

import createClient from "openapi-fetch";
import type { paths } from "./api-types";

/** Shared, typed fetch client. */
export const apiClient = createClient<paths>({
  baseUrl: "/api",
});

export type ApiClient = typeof apiClient;
