import { User } from "@prisma/client";

const DAILY_AI_LIMIT = 20;

export function canUseAI(user: User): {
  allowed: boolean;
  remaining: number;
  reset: boolean;
} {
  const now = new Date();

  const lastReset = user.aiLastResetAt ?? new Date(0);
  const isNewDay =
    now.toDateString() !== lastReset.toDateString();

  const usedToday = isNewDay ? 0 : user.aiCallsToday;

  if (usedToday >= DAILY_AI_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      reset: isNewDay,
    };
  }

  return {
    allowed: true,
    remaining: DAILY_AI_LIMIT - usedToday,
    reset: isNewDay,
  };
}
