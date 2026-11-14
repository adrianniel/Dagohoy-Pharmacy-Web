import { useEffect, type RefObject } from 'react';

/**
 * On a phone every table in the workspace is shown as cards (mobile.css), so each cell needs
 * the name of its column: this copies the header text into `data-label` on every cell, and
 * keeps doing it as pages and rows change.
 */
export function useTableLabels(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const label = () => {
      frame = 0;
      element.querySelectorAll<HTMLTableElement>('table.cashier-table').forEach((table) => {
        const headers = [...table.querySelectorAll('thead th')].map(
          (th) => th.textContent?.trim() ?? '',
        );
        if (!headers.length) return;
        table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
          [...row.cells].forEach((cell, index) => {
            const text = headers[index];
            if (text && cell.dataset.label !== text && !cell.hasAttribute('data-label-fixed')) {
              cell.dataset.label = text;
            }
          });
        });
      });
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(label);
    });
    label();
    observer.observe(element, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [root]);
}
