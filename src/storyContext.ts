import { useOutletContext } from 'react-router-dom';
import type { Story } from './types';
import type { StoryUpdater } from './store';

export interface StoryCtx {
  /** The story or universe being viewed (for a story: includes shared universe characters). */
  story: Story;
  upd: StoryUpdater;
  /** The universe this story belongs to, if any. */
  universe?: Story;
  /** URL prefix for this story's pages, e.g. /story/abc or /universe/xyz */
  base: string;
}

export const useStoryCtx = () => useOutletContext<StoryCtx>();

export const pathFor = (s: Pick<Story, 'id' | 'kind'>) => (s.kind === 'universe' ? '/universe/' : '/story/') + s.id;
