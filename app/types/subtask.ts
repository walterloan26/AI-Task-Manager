export type Priority = "Low" | "Medium" | "High"

export interface PersistedSubtask {
  title: string
  description: string
  estimateMinutes: number
  completed: boolean
  priority: Priority;
  orderIndex: number;
}

export interface UiSubtask {
  _uiId: string; // unique for frontend
  id?: string;
  title: string;
  description: string;
  estimateMinutes: number;
  completed: boolean; // must exist!
  priority: Priority;
  orderIndex: number;
}

