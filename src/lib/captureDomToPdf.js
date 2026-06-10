import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

/** A4 PDF 여백 (mm) */
const MARGIN_TOP_MM = 10;
const MARGIN_BOTTOM_MM = 10;
const MARGIN_SIDE_MM = 10;

function sliceImageToDataUrl(img, srcY, srcH) {
  const heightPx = Math.max(1, Math.round(srcH));
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 초기화하지 못했습니다.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, canvas.width, heightPx);
  return canvas.toDataURL('image/png');
}

/**
 * DOM 요소를 캡처해 여러 페이지 A4 PDF로 저장한다.
 * 페이지마다 이미지를 잘라 위·아래 10mm 여백을 비운다.
 * @param {HTMLElement} element
 * @param {string} filename
 */
export async function captureDomToPdf(element, filename) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const imgData = await toPng(element, { cacheBust: true, pixelRatio: 2 });

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgData;
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - 2 * MARGIN_SIDE_MM;
  const contentHPerPage = pageH - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
  const imgH = (img.height * contentW) / img.width;

  let offsetMm = 0;
  let pageIndex = 0;

  while (offsetMm < imgH - 0.01) {
    if (pageIndex > 0) pdf.addPage();

    const sliceHeightMm = Math.min(contentHPerPage, imgH - offsetMm);
    const srcY = (offsetMm / imgH) * img.height;
    const srcH = (sliceHeightMm / imgH) * img.height;
    const sliceData = sliceImageToDataUrl(img, srcY, srcH);

    pdf.addImage(
      sliceData,
      'PNG',
      MARGIN_SIDE_MM,
      MARGIN_TOP_MM,
      contentW,
      sliceHeightMm
    );

    offsetMm += contentHPerPage;
    pageIndex += 1;
  }

  pdf.save(filename);
}
