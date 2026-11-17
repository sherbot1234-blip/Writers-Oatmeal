import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Mark, mergeAttributes } from '@tiptap/core';
import { countWords } from '../defaults';

/** Highlights a passage that has a comment attached. */
const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment'),
        renderHTML: (a) => ({ 'data-comment': a.id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-comment]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'cmt' }), 0];
  },
});

/** Removes every highlight belonging to one comment. */
export function removeCommentMark(editor: Editor, id: string) {
  const type = editor.schema.marks.comment;
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    if (node.marks.some((m) => m.type === type && m.attrs.id === id)) {
      tr.removeMark(pos, pos + node.nodeSize, type.create({ id }));
    }
  });
  editor.view.dispatch(tr);
}

export function scrollToComment(root: HTMLElement | null, id: string) {
  const el = root?.querySelector(`[data-comment="${CSS.escape(id)}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.classList.add('flash');
  setTimeout(() => el?.classList.remove('flash'), 1200);
}

export function RichEditor({
  html,
  onChange,
  onReady,
  onCommentClick,
  placeholder = 'Start writing…',
}: {
  html: string;
  onChange: (html: string, words: number) => void;
  onReady?: (e: Editor) => void;
  onCommentClick?: (id: string) => void;
  placeholder?: string;
}) {
  const timer = useRef<number>();
  const pending = useRef<(() => void) | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      CommentMark,
    ],
    content: html || '',
    onUpdate: ({ editor: e }) => {
      // save shortly after typing stops, not on every keystroke
      pending.current = () => onChangeRef.current(e.getHTML(), countWords(e.state.doc.textContent));
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        pending.current?.();
        pending.current = null;
      }, 500);
    },
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  // write any unsaved typing when leaving the page
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pending.current?.();
    },
    [],
  );

  // if the chapter changed elsewhere (another device) and you're not typing in it, show the new text
  useEffect(() => {
    if (!editor || editor.isFocused || pending.current) return;
    if (html !== editor.getHTML()) editor.commands.setContent(html || '', false);
  }, [html, editor]);

  return (
    <div
      className="rich"
      onClick={(e) => {
        const c = (e.target as HTMLElement).closest('[data-comment]');
        if (c) onCommentClick?.(c.getAttribute('data-comment')!);
      }}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="rich-body" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, title: string, active: boolean, run: () => void, cls = '') => (
    <button
      type="button"
      className={'tb' + (active ? ' on' : '') + (cls ? ' ' + cls : '')}
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );
  const c = () => editor.chain().focus();
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {btn('B', 'Bold', editor.isActive('bold'), () => c().toggleBold().run(), 'b')}
      {btn('I', 'Italic', editor.isActive('italic'), () => c().toggleItalic().run(), 'i')}
      {btn('U', 'Underline', editor.isActive('underline'), () => c().toggleUnderline().run(), 'u')}
      {btn('S', 'Strikethrough', editor.isActive('strike'), () => c().toggleStrike().run(), 's')}
      <span className="tb-sep" />
      {btn('H', 'Heading', editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
      {btn('h', 'Small heading', editor.isActive('heading', { level: 3 }), () => c().toggleHeading({ level: 3 }).run())}
      {btn('❝', 'Quote / letter', editor.isActive('blockquote'), () => c().toggleBlockquote().run())}
      {btn('•', 'Bullet list', editor.isActive('bulletList'), () => c().toggleBulletList().run())}
      {btn('1.', 'Numbered list', editor.isActive('orderedList'), () => c().toggleOrderedList().run())}
      {btn('⁂', 'Scene break', false, () => c().setHorizontalRule().run())}
      <span className="tb-sep" />
      {btn('⇤', 'Align left', editor.isActive({ textAlign: 'left' }), () => c().setTextAlign('left').run())}
      {btn('⇔', 'Centre', editor.isActive({ textAlign: 'center' }), () => c().setTextAlign('center').run())}
      <span className="tb-sep" />
      {btn('↶', 'Undo', false, () => c().undo().run())}
      {btn('↷', 'Redo', false, () => c().redo().run())}
    </div>
  );
}
