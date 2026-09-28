/**
 * Utility to reliably print any DOM element without blank pages,
 * overflow clipping, modal/shell interference, or missing styles.
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
    'position:fixed;top:-10000px;left:-10000px;width:1050px;height:1480px;border:none;opacity:0;pointer-events:none;'
  );
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  // 1. Extract all loaded CSS rules from document.styleSheets for instant synchronous styling
  let inlineCss = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        inlineCss += rules.map((r) => r.cssText).join('\n') + '\n';
      } catch {
        // Cross-origin stylesheet security restriction (e.g. external Google Fonts)
      }
    }
  } catch {
    // Ignore error
  }

  // 2. Also collect all link[rel="stylesheet"] and style tags from parent
  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  const linksHtml = styleTags.map((el) => el.outerHTML).join('\n');

  // 3. Clone target element HTML
  const contentHtml = element.outerHTML;

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${linksHtml}
        ${inlineCss ? `<style id="inlined-tailwind-styles">${inlineCss}</style>` : ''}
        <style>
          @page {
            size: A4 portrait;
            margin: 5mm 8mm;
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
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          .font-brand {
            font-family: 'Cinzel', serif !important;
          }
          /* Ensure print target fills A4 properly and avoids accidental page splits */
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
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
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

  // 4. Safely execute print after styles, fonts, and images are ready
  let printed = false;
  const executePrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Iframe print error, falling back to window.print():', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  };

  // Wait for fonts & images
  const fontPromise = (iframeDoc as any).fonts?.ready || Promise.resolve();
  const images = Array.from(iframeDoc.images || []);
  const imgPromises = images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });

  // Collect links in iframe
  const links = Array.from(iframeDoc.querySelectorAll('link[rel="stylesheet"]'));
  const linkPromises = links.map((link) => {
    return new Promise((resolve) => {
      link.addEventListener('load', resolve);
      link.addEventListener('error', resolve);
    });
  });

  // Safety fallback timeout: max 800ms
  const timer = setTimeout(() => {
    executePrint();
  }, 800);

  Promise.all([fontPromise, ...imgPromises, ...linkPromises]).then(() => {
    clearTimeout(timer);
    setTimeout(executePrint, 120);
  });
}
