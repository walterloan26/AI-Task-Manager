
import { Reorder, useDragControls } from "framer-motion";
import SubtaskCard from "../components/subtaskCard";
import { UiSubtask } from "../types/subtask";

interface ReorderableSubtaskItemProps {
  subtask: UiSubtask;
  canReorder: boolean;
  onChange: (s: UiSubtask) => void;
  onDelete: () => void;
  saving?: boolean;
}

// Create a global map to persist dragControls per subtask _uiId
const dragControlsMap = new Map<string, ReturnType<typeof useDragControls>>();

export default function ReorderableSubtaskItem({
  subtask,
  canReorder,
  onChange,
  onDelete,
  saving,
}: ReorderableSubtaskItemProps) {
  // Only create a new drag control if it doesn't exist yet
  if (!dragControlsMap.has(subtask._uiId)) {
    dragControlsMap.set(subtask._uiId, useDragControls());
  }

  const dragControls = dragControlsMap.get(subtask._uiId)!;

  return (
    <Reorder.Item value={subtask} dragListener={false} dragControls={dragControls}>
      <SubtaskCard
        subtask={subtask}
        onChange={onChange}
        onDelete={onDelete}
        saving={saving}
        showReorderHandle={canReorder}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
}
