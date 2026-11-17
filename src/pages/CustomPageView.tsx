import { Link, useParams } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Field } from '../components/ui';
import { SectionList } from '../components/Sections';
import { palette } from './Library';

/** A page you built yourself out of sections: Magic system, Case board, Levels… */
export default function CustomPageView() {
  const { story, upd, base } = useStoryCtx();
  const { pageId } = useParams();
  const i = story.customPages.findIndex((p) => p.id === pageId);
  const page = story.customPages[i];
  if (!page)
    return (
      <div className="page">
        <p>This page doesn't exist any more.</p>
        <Link className="btn" to={base}>← Back to the story</Link>
      </div>
    );
  return (
    <div className="page">
      <div className="page-head custom-head">
        <input className="emoji-input big" value={page.icon} onChange={(e) => upd((s) => void (s.customPages[i].icon = e.target.value))} aria-label="Page icon" />
        <h1 style={{ flex: 1 }}>
          <Field value={page.title} placeholder="Page title" onChange={(v) => upd((s) => void (s.customPages[i].title = v))} />
        </h1>
        <Link className="btn small ghost" to={`${base}/settings#pages`}>Page settings</Link>
      </div>
      <SectionList accent={palette(story.theme).accent} sections={page.sections} edit={(fn) => upd((s) => fn(s.customPages[i].sections))} />
    </div>
  );
}
