export const ORDER_GAP = 1000

export function initialOrder(index: number): number {
  return (index + 1) * ORDER_GAP
}

export function between(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) {
    return ORDER_GAP
  }

  if (prev === undefined) {
    return next! / 2
  }

  if (next === undefined) {
    return prev + ORDER_GAP
  }

  return Math.floor((prev + next) / 2)
}
