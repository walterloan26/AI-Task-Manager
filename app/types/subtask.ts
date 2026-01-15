export interface PersistedSubtask {
  title: string
  description: string
  estimateMinutes: number
}

export interface UiSubtask extends PersistedSubtask {
  _uiId: string
}
