/**
 * Robust print utility for Bandhan Vatika documents (Booking Slip, Red Bill, Receipts).
 * Ensures styles are preserved, base URL is correct, images are constrained,
 * and no overflowing onto extra blank pages occurs.
 */

let cachedStylesheetCss = '';

export async function printElement(
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

  // 1. Gather all CSS rules
  let inlineCss = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        inlineCss += rules.map((r) => r.cssText).join('\n') + '\n';
      } catch {
        // Cross-origin or restricted stylesheet access
      }
    }
  } catch {
    // Ignore error
  }

  // 2. If inlineCss is empty or minimal, fetch the linked stylesheets
  if (!inlineCss || inlineCss.length < 500) {
    if (cachedStylesheetCss) {
      inlineCss = cachedStylesheetCss;
    } else {
      try {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        const fetches = links.map(async (link) => {
          if (link.href && link.href.startsWith(window.location.origin)) {
            try {
              const res = await fetch(link.href);
              if (res.ok) return await res.text();
            } catch {}
          }
          return '';
        });
        const results = await Promise.all(fetches);
        cachedStylesheetCss = results.join('\n');
        inlineCss = cachedStylesheetCss;
      } catch {}
    }
  }

  // Collect link and style tags for fallback
  const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  const linksHtml = styleTags.map((el) => el.outerHTML).join('\n');

  // Create isolated iframe
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

  const contentHtml = element.outerHTML;

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <base href="${window.location.origin}/" />
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        ${linksHtml}
        ${inlineCss ? `<style id="inlined-all-styles">${inlineCss}</style>` : ''}
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

          /* ABSOLUTE GUARANTEE: Logo can never explode in print */
          img {
            max-width: 100%;
          }
          img[src*="brand-logo"], .brand-logo-img {
            width: 56px !important;
            height: 56px !important;
            max-width: 56px !important;
            max-height: 56px !important;
            min-width: 56px !important;
            min-height: 56px !important;
            object-fit: contain !important;
            display: inline-block !important;
          }

          /* Ensure single page fit and proper container layout */
          .print-receipt-container,
          .official-bill-wrapper,
          .booking-slip-wrapper,
          #bandhan-print-receipt,
          #bandhan-booking-slip,
          #bandhan-new-booking-slip,
          #bandhan-new-booking-bill,
          #bandhan-new-food-bill,
          #bandhan-new-banquet-bill,
          #bandhan-booking-slip-preview,
          #bandhan-booking-bill-preview,
          #bandhan-food-bill-preview,
          #bandhan-banquet-bill-preview,
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
            break-inside: avoid !important;
          }

          .page-break-between {
            page-break-after: always !important;
            break-after: page !important;
            display: block !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
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

  // Safely trigger print after fonts & images are ready
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

  const fontPromise = (iframeDoc as any).fonts?.ready || Promise.resolve();
  const images = Array.from(iframeDoc.images || []);
  const imgPromises = images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });

  const timer = setTimeout(() => {
    executePrint();
  }, 1000);

  Promise.all([fontPromise, ...imgPromises]).then(() => {
    clearTimeout(timer);
    setTimeout(executePrint, 150);
  });
}
