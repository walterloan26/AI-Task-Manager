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

// Global map to persist dragControls
const dragControlsMap = new Map<string, ReturnType<typeof useDragControls>>();

export default function ReorderableSubtaskItem({
  subtask,
  canReorder,
  onChange,
  onDelete,
  saving,
}: ReorderableSubtaskItemProps) {
  // ✅ Always call the hook
  const dragControls = useDragControls();

  // Store in the map if it doesn't exist
  if (!dragControlsMap.has(subtask._uiId)) {
    dragControlsMap.set(subtask._uiId, dragControls);
  }

  // Use the stored dragControls from the map
  const persistentDragControls = dragControlsMap.get(subtask._uiId)!;

  return (
    <Reorder.Item value={subtask} dragListener={false} dragControls={persistentDragControls}>
      <SubtaskCard
        subtask={subtask}
        onChange={onChange}
        onDelete={onDelete}
        saving={saving}
        showReorderHandle={canReorder}
        dragControls={persistentDragControls}
      />
    </Reorder.Item>
  );
}
