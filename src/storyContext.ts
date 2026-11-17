import { useOutletContext } from 'react-router-dom';
import type { Story } from './types';
import type { StoryUpdater } from './store';

export interface StoryCtx {
  story: Story;
  upd: StoryUpdater;
}

export const useStoryCtx = () => useOutletContext<StoryCtx>();
