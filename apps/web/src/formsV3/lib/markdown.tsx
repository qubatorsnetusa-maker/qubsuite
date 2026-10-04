import React from 'react';

export interface MarkdownProps {
  children?: string | null;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ children, className }) => {
  if (!children) return null;
  const paragraphs = String(children).split('\n\n');
  return (
    <div className={className}>
      {paragraphs.map((para, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {para.split('\n').map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );
};

export default Markdown;
