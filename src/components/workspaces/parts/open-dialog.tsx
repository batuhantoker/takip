'use client';

import { useEffect } from 'react';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { workspaceCount } from '@/components/workspaces/messages';
import { useWorkspace } from '@/components/workspaces/use-workspace';
import { showWorkspaceDialog } from '@/components/workspaces/workspace-dialog-state';
import WorkspaceRow from './workspace-row';

export default function OpenDialog({ onClose }: { onClose: () => void }) {
  const { list, max, current } = useWorkspace();

  useEffect(() => {
    void workspaceSession().refreshList();
  }, []);

  return (
    <DialogFrame title="Workspaces" onClose={onClose}>
      {list === null ? (
        <Hint>Loading…</Hint>
      ) : list.length === 0 ? (
        <Hint>No saved workspaces yet. Save this view to start one.</Hint>
      ) : (
        <div className="flex flex-col">
          {list.map(workspace => (
            <WorkspaceRow key={workspace.id} workspace={workspace} isCurrent={workspace.id === current?.id} onOpened={onClose} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {list !== null && max !== null && (
          <span className="flex-1 text-[11px] text-ink-3">{list.length} of {workspaceCount(max)}</span>
        )}
        <SmallButton onClick={() => showWorkspaceDialog({ kind: 'name', mode: 'new' })}>New workspace…</SmallButton>
      </div>
    </DialogFrame>
  );
}
