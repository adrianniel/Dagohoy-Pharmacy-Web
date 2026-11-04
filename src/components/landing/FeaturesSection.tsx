import { useRef, type PointerEvent } from 'react';
import medicineMockup from '../../assets/medicine mockup.png';
import scanner from '../../assets/scanner.png';
import scannerHolder from '../../assets/scanner holder.png';

export function FeaturesSection() {
  const scannerDrag = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const handleScannerPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    scannerDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
    event.currentTarget.style.transition = 'none';
  };

  const handleScannerPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const drag = scannerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.currentTarget.style.transform = `translate3d(${event.clientX - drag.x}px, ${event.clientY - drag.y}px, 0)`;
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
