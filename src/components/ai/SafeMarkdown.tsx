import React from 'react';

function sanitizeLinkUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex =
    /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`|\[[^\]\n]+?\]\([^)\s]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-bold text-[#103B2D] dark:text-[#EDF5F0]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-[#F3EFE4] dark:bg-[#1A2D24] px-1.5 py-0.5 text-[12px] font-mono text-[#103B2D] dark:text-[#D8B66D]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const safeHref = sanitizeLinkUrl(linkMatch[2]);
        if (safeHref) {
          const isExternal = safeHref.startsWith('http');
          nodes.push(
            <a
              key={key}
              href={safeHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="font-semibold text-[#103B2D] dark:text-[#5ED1A1] underline decoration-[#B99A56]/70 underline-offset-2 hover:text-[#B99A56]"
            >
              {linkMatch[1]}
            </a>
          );
        } else {
          nodes.push(linkMatch[1]);
        }
      } else {
        nodes.push(token);
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?[\s:-]+\|[\s|:-]*$/.test(trimmed);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export function SafeMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre
          key={`code-${blockKey++}`}
          dir="ltr"
          className="my-1.5 overflow-x-auto rounded-xl border border-[#E5DFD2] dark:border-[#25382F] bg-[#F6F3EB] dark:bg-[#0D1612] p-2.5 text-[12px] font-mono text-[#16261E] dark:text-[#DDE8E2]"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(
        <hr
          key={`hr-${blockKey++}`}
          className="my-2 border-0 border-t border-[#E5DFD2] dark:border-[#25382F]"
        />
      );
      i += 1;
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const cls =
        level === 1
          ? 'text-[14.5px] font-extrabold text-[#103B2D] dark:text-[#EDF5F0] mt-1.5 mb-1'
          : level === 2
          ? 'text-[13.5px] font-extrabold text-[#103B2D] dark:text-[#EDF5F0] mt-1.5 mb-0.5'
          : 'text-[13px] font-bold text-[#103B2D] dark:text-[#D8B66D] mt-1 mb-0.5';
      blocks.push(
        <p key={`h-${blockKey++}`} className={cls}>
          {renderInline(headingText, `h-${blockKey}`)}
        </p>
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${blockKey++}`}
          className="my-1.5 border-s-2 border-[#B99A56] ps-2.5 text-[12.5px] text-[#5F6C65] dark:text-[#A5B7AD]"
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx}>{renderInline(ql, `q-${blockKey}-${idx}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Markdown table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(rawLine);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div
          key={`tbl-${blockKey++}`}
          className="my-2 overflow-x-auto rounded-xl border border-[#E5DFD2] dark:border-[#25382F]"
        >
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-[#F5F1E6] dark:bg-[#192821]">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-2.5 py-1.5 text-start font-bold text-[#103B2D] dark:text-[#EDF5F0] border-b border-[#E5DFD2] dark:border-[#25382F]"
                  >
                    {renderInline(h, `th-${blockKey}-${hIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b last:border-b-0 border-[#E5DFD2]/70 dark:border-[#25382F]/70"
                >
                  {headers.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-2.5 py-1.5 text-[#16261E] dark:text-[#DDE8E2]"
                    >
                      {renderInline(row[cIdx] || '', `td-${blockKey}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul
          key={`ul-${blockKey++}`}
          className="my-1 space-y-1 ps-4 list-disc marker:text-[#B99A56]"
        >
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, `ul-${blockKey}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${blockKey++}`}
          className="my-1 space-y-1 ps-5 list-decimal marker:font-bold marker:text-[#B99A56]"
        >
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, `ol-${blockKey}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (coalesce consecutive plain lines)
    const paraLines: string[] = [rawLine];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+|>\s+|```|-{3,}|\*{3,})/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${blockKey++}`} className="leading-relaxed whitespace-pre-wrap">
        {renderInline(paraLines.join('\n'), `p-${blockKey}`)}
      </p>
    );
  }

  return <div className="space-y-1.5 text-[13.5px] break-words [overflow-wrap:anywhere]">{blocks}</div>;
}
