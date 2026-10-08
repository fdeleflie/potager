export interface PrintOptions {
  orientation?: 'landscape' | 'portrait';
  scale?: number;
  extraStyles?: string;
  hideHeader?: boolean;
}

export const printElement = (
  elementId: string, 
  title: string, 
  scaleOrOptions: number | PrintOptions = 100
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const options: PrintOptions = typeof scaleOrOptions === 'number'
    ? { scale: scaleOrOptions, orientation: 'landscape' }
    : { scale: 100, orientation: 'landscape', ...scaleOrOptions };

  const scale = options.scale || 100;
  const orientation = options.orientation || 'landscape';

  const scaleStyle = scale !== 100 ? `
    body { 
      transform: scale(${scale / 100}); 
      transform-origin: top left; 
      width: ${100 * (100 / scale)}%;
      height: ${100 * (100 / scale)}%;
    }
  ` : '';

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(el => el.outerHTML)
    .join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          @page {
            size: ${orientation};
            margin: 10mm;
          }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 16px; 
            color: #1c1917; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background-color: white !important;
          }
          ${scaleStyle}
          .print\\:hidden { 
            display: none !important; 
          }
          h1 { 
            font-size: 22px; 
            margin-bottom: 16px; 
            font-weight: 600;
            color: #1c1917;
          }
          /* Ensure inline background colors are respected */
          [style*="background-color"] {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page-break-after-always {
            break-after: page;
            page-break-after: always;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            border-color: #e7e5e4 !important;
          }
          ${options.extraStyles || ''}
        </style>
      </head>
      <body>
        ${options.hideHeader ? '' : `<h1 class="print:hidden">${title}</h1>`}
        ${element.innerHTML}
      </body>
    </html>
  `;

  // Try window.open first, but if blocked by sandbox or popups, fall back to hidden iframe
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank');
  } catch {
    printWindow = null;
  }

  if (printWindow) {
    try {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow?.print();
        printWindow?.close();
      }, 500);
      return;
    } catch {
      // If cross-origin or blocked after open, fall back to iframe
    }
  }

  // Fallback: Invisible iframe printing (ideal for iframes and strict popup blockers)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 500);
  } else {
    window.print();
  }
};

