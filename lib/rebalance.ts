import { ORDER_GAP } from "./order"

export function rebalance(subtasks: { id: string }[]) {
  return subtasks.map((s, index) => ({
    id: s.id,
    orderIndex: (index + 1) * ORDER_GAP
  }))
}
