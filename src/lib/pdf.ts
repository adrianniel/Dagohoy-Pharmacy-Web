/*
 * Saves a report on screen as a PDF file, straight to Downloads. No print dialog.
 * The two libraries are loaded only when a PDF is made, so they are not in the main bundle.
 *
 * shortcut: the page is captured as a picture and cut into A4 pages, so a long table can be
 * split through a row and the text is not selectable. If the owner needs searchable PDFs,
 * build the PDF from the data with jsPDF text/tables instead.
 */
export async function downloadPdf(
  element: HTMLElement,
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  const margin = 10;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const height = pdf.internal.pageSize.getHeight() - margin * 2;
  const pxPerMm = canvas.width / width;
  const sliceHeight = Math.floor(height * pxPerMm);

  for (let top = 0, page = 0; top < canvas.height; top += sliceHeight, page += 1) {
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.min(sliceHeight, canvas.height - top);
    slice
      .getContext('2d')!
      .drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (page) pdf.addPage();
    pdf.addImage(
      slice.toDataURL('image/jpeg', 0.92),
      'JPEG',
      margin,
      margin,
      width,
      slice.height / pxPerMm,
    );
  }
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}
