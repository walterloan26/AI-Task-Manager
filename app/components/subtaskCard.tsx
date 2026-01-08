"use client";

import { Subtask } from "../types/subtask";

interface Props {
    subtask: Subtask
    onChange: (updated: Subtask) => void
    onDelete: () => void
}

export default function SubtaskCard ({ subtask, onChange, onDelete} : Props) {
    return (
        <div className="border rounded p-4 space-y-3">
            <input 
                className="w-full border p-2 rounded"
                value={subtask.title}
                onChange={(e) => 
                    onChange({...subtask, title: e.target.value})
                }
            />
            <textarea
                className="w-full border p-2 rounded"
                value={subtask.description}
                onChange={(e) =>
                    onChange({ ...subtask, description: e.target.value})
                }
            />
            <div className="flex items-center justify-between">
                <input
                    type="number"
                    className="flex items-center justify-between"
                    value={subtask.estimateMinutes}
                    onChange={(e) =>
                        onChange({...subtask, estimateMinutes: Number(e.target.value)})
                    }
                />
                <button
                    className="text-red-600 text-sm"
                    onClick={onDelete} 
                >
                    Delete
                </button>
            </div> 
        </div>
    )
}