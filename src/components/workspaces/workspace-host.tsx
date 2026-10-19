'use client';

import { useEffect, useLayoutEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { authClient } from '@/components/site/account/auth-client';
import { restoreDevice } from '@/lib/platform/workspaces/device';
import { workspaceParts } from '@/lib/platform/workspaces/parts';
import { workspaceSession } from '@/lib/platform/workspaces/session';
import { registerStoredParts } from '@/lib/platform/workspaces/stored-parts';
import { useT } from '@/components/ui/use-t';
import ConflictDialog from '@/components/workspaces/parts/conflict-dialog';
import DialogFrame, { Hint } from '@/components/workspaces/parts/dialog-frame';
import ImportOffer from '@/components/workspaces/parts/import-offer';
import NameDialog from '@/components/workspaces/parts/name-dialog';
import OpenDialog from '@/components/workspaces/parts/open-dialog';
import ShareDialog from '@/components/workspaces/parts/share-dialog';
import { useSharedLink } from './use-shared-link';
import { useWorkspace } from './use-workspace';
import { showWorkspaceDialog, useWorkspaceDialog } from './workspace-dialog-state';

// Catches parts that changed without telling: the localStorage-backed ones.
const POLL_MS = 10_000;

/** Mount once per page, beside <AccountDialog />: runs autosave and the share-link landing, and shows the dialogs. */
export default function WorkspaceHost() {
  const t = useT();
  const { data, isPending } = authClient.useSession();
  const userId = data?.user.id ?? null;
  const { offerImport, conflict, current, shared } = useWorkspace();
  const dialog = useWorkspaceDialog();
  const link = useSharedLink();

  // A layout effect runs before every other component's effects, so none reads keys a closed shared view left behind.
  useLayoutEffect(() => {
    restoreDevice(window.localStorage);
    return registerStoredParts(workspaceParts, window.localStorage);
  }, []);

  useEffect(() => {
    if (isPending) return;
    const session = workspaceSession();
    if (userId) void session.signIn(userId);
    else session.signOut();
  }, [userId, isPending]);

  useEffect(() => {
    const session = workspaceSession();
    const changed = () => session.changed();
    const flush = () => void session.flush();
    const closing = () => void session.flush({ pageClosing: true });
    const hidden = () => {
      if (document.visibilityState === 'hidden') closing();
    };
    const unsubscribe = workspaceParts.subscribe(changed);
    const poll = setInterval(changed, POLL_MS);
    window.addEventListener('online', flush);
    window.addEventListener('pagehide', closing);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      unsubscribe();
      clearInterval(poll);
      window.removeEventListener('online', flush);
      window.removeEventListener('pagehide', closing);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  const close = () => showWorkspaceDialog(null);

  return (
    <AnimatePresence>
      {dialog?.kind === 'name' && <NameDialog key="name" mode={dialog.mode} onClose={close} />}
      {dialog?.kind === 'share' && <ShareDialog key="share" onClose={close} />}
      {dialog?.kind === 'open' && <OpenDialog key="open" onClose={close} />}
      {!dialog && link.failed && (
        <DialogFrame key="link" title={t('Link unavailable')} onClose={link.dismiss}>
          <Hint>{t('This share link no longer works: its owner stopped sharing, made a new link, or deleted the workspace.')}</Hint>
        </DialogFrame>
      )}
      {!dialog && !link.failed && conflict && current && <ConflictDialog key="conflict" name={current.name} />}
      {!dialog && !link.failed && !conflict && offerImport && !shared && <ImportOffer key="import" />}
    </AnimatePresence>
  );
}
