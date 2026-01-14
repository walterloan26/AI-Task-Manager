export interface PersistedSubtask {
  title: string
  description: string
  estimateMinutes: number
  completed: boolean
}

export interface UiSubtask {
  _uiId: string; // unique for frontend
  title: string;
  description: string;
  estimateMinutes: number;
  completed: boolean; // must exist!
}

