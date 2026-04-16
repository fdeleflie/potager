export const printElement = (elementId: string, title: string, scale: number = 100, onBlocked?: () => void) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    if (onBlocked) {
      onBlocked();
    } else {
      alert("Veuillez autoriser les pop-ups pour imprimer.");
    }
    return;
  }

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
            size: landscape;
            margin: 10mm;
          }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            padding: 20px; 
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
            font-size: 24px; 
            margin-bottom: 20px; 
            font-weight: 500;
          }
          /* Ensure inline background colors are respected */
          [style*="background-color"] {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        </style>
      </head>
      <body>
        <h1 class="print:hidden">${title}</h1>
        ${element.innerHTML}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  
  // Wait a bit for styles and images to load
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};
