'use client';

import { ToolList } from './tool-list';

/** The expanded view's left column: the same tool list, padded like a panel body, with its own scroller. */
export function ToolRail(props: {
  filter: string;
  setFilter: (v: string) => void;
  activeTool: string | null;
  onPick: (id: string) => void;
  onSelfTrack: () => void;
  selfTracking: boolean;
}) {
  return (
    <div className="styled-scrollbar h-full overflow-y-auto p-4">
      <ToolList {...props} />
    </div>
  );
}
