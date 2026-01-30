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

export default function ReorderableSubtaskItem({
  subtask,
  canReorder,
  onChange,
  onDelete,
  saving,
}: ReorderableSubtaskItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={subtask}
      id={subtask._uiId} // Important for drag identification
      dragListener={false} // Disable drag on the whole item
      dragControls={dragControls}
      style={{ 
        listStyle: "none",
        position: "relative",
        zIndex: 1 // Ensures dragged item appears above others
      }}
      className="focus:outline-none"
      whileDrag={{
        zIndex: 100, // Even higher when actively dragging
        scale: 1.02, // Slight visual feedback
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)" // Shadow when dragging
      }}
    >
      <SubtaskCard
        subtask={subtask}
        onChange={onChange}
        onDelete={onDelete}
        saving={saving}
        showReorderHandle={canReorder}
        dragControls={canReorder ? dragControls : undefined}
      />
      
    </Reorder.Item>
  );
}