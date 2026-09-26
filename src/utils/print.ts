/**
 * Utility to reliably print any DOM element without blank pages,
 * overflow clipping, or modal/shell interference.
 */
export function printElement(
  target: HTMLElement | string,
  title: string = 'Bandhan Vatika Document'
) {
  let element: HTMLElement | null = null;
  if (typeof target === 'string') {
    element = document.getElementById(target);
  } else {
    element = target;
  }

  if (!element) {
    console.warn(`Print target element "${target}" not found, falling back to window.print()`);
    window.print();
    return;
  }

  // Create a hidden iframe for isolated printing
  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;top:-10000px;left:-10000px;width:1000px;height:1400px;border:none;opacity:0;pointer-events:none;'
  );
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  // Collect all stylesheets and style tags from the current document
  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  const stylesHtml = styleTags.map((el) => el.outerHTML).join('\n');

  // Clone target element HTML
  const contentHtml = element.outerHTML;

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${stylesHtml}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html, body {
            background-color: #ffffff !important;
            color: #1c1917 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          .font-brand {
            font-family: 'Cinzel', serif !important;
          }
          /* Ensure print target is visible and fills A4 properly */
          .print-receipt-container,
          .official-bill-wrapper,
          #bandhan-print-receipt,
          #printable-invoice,
          #quotation-print-voucher {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; max-width: 210mm; margin: 0 auto; padding: 0;">
          ${contentHtml}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // Give styles and fonts 250ms to render inside the iframe before opening print dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Iframe print error, falling back to window.print():', e);
      window.print();
    } finally {
      // Clean up iframe after printing
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 250);
}
