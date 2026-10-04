/** Prints `html` from a hidden frame, so only that document — never the app around it — reaches the printer. */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.title = 'Print';
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      frame.remove();
      resolve();
    };
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        frame.remove();
        return reject(new Error('Printing is not available in this browser.'));
      }
      win.addEventListener('afterprint', () => setTimeout(cleanup, 0));
      win.focus();
      win.print();
      // Browsers whose print() blocks until the dialog closes have printed by now; others fire afterprint.
      setTimeout(cleanup, 60_000);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
