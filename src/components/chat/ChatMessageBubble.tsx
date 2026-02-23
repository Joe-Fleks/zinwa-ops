import { useMemo } from 'react';

interface Props {
  content: string;
}

function parseInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-semibold">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function ChatMessageBubble({ content }: Props) {
  const rendered = useMemo(() => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (listItems.length === 0) return;
      const items = listItems.map((item, i) => (
        <li key={i} className="ml-4">{parseInline(item)}</li>
      ));
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal space-y-0.5 my-1">
            {items}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc space-y-0.5 my-1">
            {items}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <p key={i} className="font-semibold text-sm mt-2 mb-0.5">
            {parseInline(trimmed.slice(4))}
          </p>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <p key={i} className="font-bold text-sm mt-2 mb-0.5">
            {parseInline(trimmed.slice(3))}
          </p>
        );
      } else if (trimmed.startsWith('# ')) {
        flushList();
        elements.push(
          <p key={i} className="font-bold mt-2 mb-0.5">
            {parseInline(trimmed.slice(2))}
          </p>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(trimmed.replace(/^\d+\.\s/, ''));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(trimmed.slice(2));
      } else if (trimmed === '') {
        flushList();
        if (i > 0 && i < lines.length - 1) {
          elements.push(<div key={i} className="h-1.5" />);
        }
      } else {
        flushList();
        elements.push(
          <p key={i} className="my-0.5">
            {parseInline(trimmed)}
          </p>
        );
      }
    }

    flushList();
    return elements;
  }, [content]);

  return <div className="space-y-0">{rendered}</div>;
}
