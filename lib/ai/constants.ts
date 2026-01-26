export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const
export type Priority = (typeof PRIORITIES)[number]

export const COMPLEXITIES = ["LOW", "MEDIUM", "HIGH"] as const
export type Complexity = (typeof COMPLEXITIES)[number]
