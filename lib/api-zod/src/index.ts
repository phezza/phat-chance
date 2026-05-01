// The generated `api.ts` (Zod runtime schemas) and `generated/types/*` (TS types)
// can collide on names produced by orval. The Zod side is what callers use for
// validation, so it wins; types are still importable from their files directly.
export * from "./generated/api";
export type { HealthStatus } from "./generated/types/healthStatus";
export type { TrackPosition } from "./generated/types/trackPosition";
export type { TrackPositionUpdate } from "./generated/types/trackPositionUpdate";
