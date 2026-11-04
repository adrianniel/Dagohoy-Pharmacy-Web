import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import medicineMockup from '../../assets/medicine mockup.png';
import scanner from '../../assets/scanner.png';
import scannerHolder from '../../assets/scanner holder.png';

const featureSlides = [
  {
    title: 'Barcode Scanning',
    titleLines: ['Barcode', 'Scanning'],
    description: 'Faster product lookup and checkout with less manual encoding.',
  },
  {
    title: 'Point of Sale (POS)',
    titleLines: ['Point of', 'Sale (POS)'],
    description: 'Process sales quickly through a simple and efficient checkout system.',
  },
  {
    title: 'Inventory Monitoring',
    titleLines: ['Inventory', 'Monitoring'],
    description: 'Track available stock and identify products that are running low.',
  },
  {
    title: 'Batch & Expiry Tracking',
    titleLines: ['Batch & Expiry', 'Tracking'],
    description: 'Monitor medicine batches and expiration dates to improve stock management.',
  },
  {
    title: 'Customer Credit Management',
    titleLines: ['Customer Credit', 'Management'],
    description: 'Keep track of customer credit (utang), outstanding balances, and repayments.',
  },
  {
    title: 'Supply Receiving',
    titleLines: ['Supply', 'Receiving'],
    description: 'Record incoming products, supplier details, quantities, and purchase costs.',
  },
  {
    title: 'Cashier Shift Management',
    titleLines: ['Cashier Shift', 'Management'],
    description: 'Monitor staff duty, shift transactions, opening cash, and closing balances.',
  },
  {
    title: 'Sales Analytics & Reports',
    titleLines: ['Sales Analytics', '& Reports'],
    description: 'View sales performance, inventory activity, and business insights in one place.',
  },
];

export function FeaturesSection() {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const activeFeature = featureSlides[activeFeatureIndex];
  const barcodeTarget = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const scannerDrag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    overBarcode: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const description = descriptionRef.current;
    const copyContainer = description?.parentElement;
    if (!description || !copyContainer) return;

    const fitDescription = () => {
      description.style.fontSize = '';
      const baseSize = Number.parseFloat(getComputedStyle(description).fontSize);
      const minSize = Math.max(4, baseSize * 0.6);
      let size = baseSize;
      description.style.fontSize = `${size}px`;

      while (description.scrollHeight > description.clientHeight + 1 && size > minSize) {
        size = Math.max(minSize, size - 0.25);
        description.style.fontSize = `${size}px`;
      }
    };

    fitDescription();
    const resizeObserver = new ResizeObserver(fitDescription);
    resizeObserver.observe(copyContainer);
    return () => resizeObserver.disconnect();
  }, [activeFeatureIndex]);

  const handleScannerPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    scannerDrag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      overBarcode: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
    event.currentTarget.style.transition = 'none';
  };

  const handleScannerPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const drag = scannerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.currentTarget.style.transform = `translate3d(${event.clientX - drag.x}px, ${event.clientY - drag.y}px, 0)`;

    const scannerBounds = event.currentTarget.getBoundingClientRect();
    const barcodeBounds = barcodeTarget.current?.getBoundingClientRect();
    const scannerHead = {
      left: scannerBounds.left + scannerBounds.width * 0.19,
      right: scannerBounds.left + scannerBounds.width * 0.63,
      top: scannerBounds.top + scannerBounds.height * 0.22,
      bottom: scannerBounds.top + scannerBounds.height * 0.46,
    };
    const isOverBarcode = Boolean(
      barcodeBounds &&
      scannerHead.right > barcodeBounds.left &&
      scannerHead.left < barcodeBounds.right &&
      scannerHead.bottom > barcodeBounds.top &&
      scannerHead.top < barcodeBounds.bottom,
    );

    if (isOverBarcode && !drag.overBarcode) {
      setActiveFeatureIndex((index) => (index + 1) % featureSlides.length);
    }
    drag.overBarcode = isOverBarcode;
  };

  const handleScannerPointerRelease = (event: PointerEvent<HTMLImageElement>) => {
    if (scannerDrag.current?.pointerId !== event.pointerId) return;

    scannerDrag.current = null;
    event.currentTarget.dataset.dragging = 'false';
    event.currentTarget.style.transition = '';
    event.currentTarget.style.transform = '';
  };

  return (
    <section
      className="features-section section-wrap"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <h2 id="features-title">Built around how the pharmacy actually works.</h2>
        <p>
          From managing the business to handling daily sales, each role gets the tools they need.
        </p>
      </div>
      <div className="features-medicine-row">
        {['Features', 'Cashier', 'Admin'].map((title) => (
          <div className="features-medicine-row__item" key={title}>
            <h3>{title}</h3>
            <div className="features-medicine-row__image">
              <img src={medicineMockup} alt="" aria-hidden="true" />
              {title === 'Features' && (
                <>
                  <div className="features-medicine-row__feature-copy" aria-live="polite">
                    <h4>
                      {activeFeature.titleLines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </h4>
                    <p ref={descriptionRef}>{activeFeature.description}</p>
                  </div>
                  <div
                    className="features-medicine-row__barcode-target"
                    ref={barcodeTarget}
                    aria-hidden="true"
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div
        className="features-scanner-holder"
        role="img"
        aria-label="Barcode scanner resting in its wall-mounted holder"
      >
        <img src={scannerHolder} alt="" aria-hidden="true" />
        <img
          className="features-scanner-holder__scanner"
          src={scanner}
          alt=""
          aria-hidden="true"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={handleScannerPointerDown}
          onPointerMove={handleScannerPointerMove}
          onPointerUp={handleScannerPointerRelease}
          onPointerCancel={handleScannerPointerRelease}
        />
      </div>
    </section>
  );
}
