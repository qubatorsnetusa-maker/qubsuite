let measurer: HTMLDivElement | null = null;

/** Height (px) that `text` needs when wrapped in a column of `width` px, using the grid's cell typography. */
export function measureWrappedHeight(text: string, width: number, fontSize = 13, bold = false): number {
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.setAttribute('aria-hidden', 'true');
    Object.assign(measurer.style, {
      position: 'absolute',
      visibility: 'hidden',
      left: '-10000px',
      top: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      lineHeight: '16px',
      padding: '2px 3px',
      boxSizing: 'border-box',
    });
    document.body.appendChild(measurer);
  }
  measurer.style.width = `${width}px`;
  measurer.style.fontSize = `${fontSize}px`;
  measurer.style.fontWeight = bold ? '600' : '400';
  measurer.textContent = text || ' ';
  return Math.ceil(measurer.getBoundingClientRect().height) + 1;
}
