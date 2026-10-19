'use client';

import { useEffect } from 'react';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { SmallButton } from '@/components/site/account/settings/settings-parts';
import DialogFrame, { Hint } from './dialog-frame';
import { useWorkspace } from '@/components/workspaces/use-workspace';
import { showWorkspaceDialog } from '@/components/workspaces/workspace-dialog-state';
import WorkspaceRow from './workspace-row';
import { useT } from '@/components/ui/use-t';

export default function OpenDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { list, max, current } = useWorkspace();

  useEffect(() => {
    void workspaceSession().refreshList();
  }, []);

  return (
    <DialogFrame title={t('Workspaces')} onClose={onClose}>
      {list === null ? (
        <Hint>{t('Loading…')}</Hint>
      ) : list.length === 0 ? (
        <Hint>{t('No saved workspaces yet. Save this view to start one.')}</Hint>
      ) : (
        <div className="flex flex-col">
          {list.map(workspace => (
            <WorkspaceRow key={workspace.id} workspace={workspace} isCurrent={workspace.id === current?.id} onOpened={onClose} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {list !== null && max !== null && (
          <span className="flex-1 text-[11px] text-ink-3">{t('{count} of {n, plural, one {# workspace} other {# workspaces}}', { count: list.length, n: max })}</span>
        )}
        <SmallButton onClick={() => showWorkspaceDialog({ kind: 'name', mode: 'new' })}>{t('New workspace…')}</SmallButton>
      </div>
    </DialogFrame>
  );
}
