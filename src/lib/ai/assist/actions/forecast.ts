/** forecast, workspace, select: starting a TI forecast and showing it. */
import type { Depth, Outcome, Site } from '../tools';
import { fail, ok, str } from './shared';

export async function forecast(a: Record<string, unknown>, site: Site): Promise<Outcome> {
  const question = str(a.question, 500);
  if (question.length < 8) return fail('forecast', 'A forecast needs a question of a few words');
  const depth: Depth = a.depth === 'quick' || a.depth === 'deep' ? a.depth : 'standard';
  const started = await site.forecast(question, depth);
  if (!started.ok) return fail('forecast', started.error);
  return ok('forecast', `Started a ${depth} forecast (run ${started.id.slice(0, 8)})`, undefined, { kind: 'forecast', title: question, items: [], runId: started.id });
}

export function workspace(a: Record<string, unknown>, site: Site): Outcome {
  if (!site.workspace) return fail('workspace', 'The workspace is not available here');
  const view = a.view === 'globe' || a.view === 'graph' || a.view === 'timeline' || a.view === 'table' ? a.view : undefined;
  const open = a.open === false || a.open === 'false' ? false : a.open === true || a.open === 'true' || view ? true : undefined;
  if (open === undefined && !view) return fail('workspace', 'Say open (true or false) or a view');
  const out = site.workspace({ open, view });
  return out.ok ? ok('workspace', out.summary) : fail('workspace', out.error);
}

export function select(a: Record<string, unknown>, site: Site): Outcome {
  if (!site.select) return fail('select', 'There is nothing to select here');
  const name = str(a.name, 120);
  if (!name) return fail('select', 'Give the name of the object to open');
  const out = site.select(name);
  return out.ok ? ok('select', out.summary) : fail('select', out.error);
}
