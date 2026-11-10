import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import medicineMockup from '../../assets/medicine mockup.png';
import conveyorTable from '../../assets/converyor table.png';
import scanner from '../../assets/scanner.png';
import scannerHolder from '../../assets/scanner holder.png';

const featureSlides = [
  {
    title: 'Barcode Scanning',
    titleLines: ['Barcode', 'Scanning'],
    description: 'Faster product lookup and checkout with less manual encoding.',
  },
  {
    title: 'Sales Counter',
    titleLines: ['Sales', 'Counter'],
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

const cashierSteps = [
  {
    title: 'Log In',
    titleLines: ['Step 1', 'Log In'],
    description: 'Access the pharmacy system securely using your assigned cashier account.',
  },
  {
    title: 'Start Shift',
    titleLines: ['Step 2', 'Start Shift'],
    description: 'Begin your duty and record the opening cash balance.',
  },
  {
    title: 'Scan Products',
    titleLines: ['Step 3', 'Scan Products'],
    description: 'Scan barcodes or search products to quickly add items to the cart.',
  },
  {
    title: 'Review Cart',
    titleLines: ['Step 4', 'Review Cart'],
    description: 'Check product quantities, prices, and totals before completing the sale.',
  },
  {
    title: 'Process Sale',
    titleLines: ['Step 5', 'Process Sale'],
    description:
      'Record customer payments or approved credit transactions accurately and efficiently.',
  },
  {
    title: 'Issue Receipt',
    titleLines: ['Step 6', 'Issue Receipt'],
    description: 'Generate a receipt and provide customers with their transaction details.',
  },
  {
    title: 'View Transactions',
    titleLines: ['Step 7', 'View Transactions'],
    description: 'Track completed sales and review transaction records during your shift.',
  },
  {
    title: 'End Shift',
    titleLines: ['Step 8', 'End Shift'],
    description: 'Count the closing cash balance and submit your daily shift summary.',
  },
];

const adminSteps = [
  {
    title: 'Log In',
    titleLines: ['Step 1', 'Log In'],
    description: 'Access the pharmacy system securely with full administrative privileges.',
  },
  {
    title: 'Monitor Dashboard',
    titleLines: ['Step 2', 'Monitor Dashboard'],
    description: 'View daily sales, active shifts, stock alerts, and pharmacy operations.',
  },
  {
    title: 'Manage Products',
    titleLines: ['Step 3', 'Manage Products'],
    description: 'Organize product details, barcodes, categories, units, and selling prices.',
  },
  {
    title: 'Manage Inventory',
    titleLines: ['Step 4', 'Manage Inventory'],
    description: 'Monitor stock levels, medicine batches, expiry dates, and inventory movements.',
  },
  {
    title: 'Receive Supplies',
    titleLines: ['Step 5', 'Receive Supplies'],
    description: 'Record incoming products, supplier information, quantities, and purchase costs.',
  },
  {
    title: 'Review Sales',
    titleLines: ['Step 6', 'Review Sales'],
    description: 'Track completed transactions, payment records, and cashier sales activity.',
  },
  {
    title: 'Manage Customer Credit',
    titleLines: ['Step 7', 'Manage Customer', 'Credit'],
    description: 'Monitor customer credit balances, outstanding debts, and repayment records.',
  },
  {
    title: 'Manage Staff',
    titleLines: ['Step 8', 'Manage Staff'],
    description: 'Create cashier accounts, monitor shifts, and control staff access permissions.',
  },
  {
    title: 'Review Reports',
    titleLines: ['Step 9', 'Review Reports'],
    description: 'Analyze sales performance, inventory trends, and overall pharmacy operations.',
  },
  {
    title: 'Manage Settings',
    titleLines: ['Step 10', 'Manage Settings'],
    description:
      'Configure pharmacy details, operating schedules, and essential system preferences.',
  },
];

export function FeaturesSection() {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [activeCashierStepIndex, setActiveCashierStepIndex] = useState(0);
  const [activeAdminStepIndex, setActiveAdminStepIndex] = useState(0);
  const [scanBounce, setScanBounce] = useState<{
    box: 'Features' | 'Cashier' | 'Admin' | null;
    sequence: number;
  }>({ box: null, sequence: 0 });
  const featureBarcodeTarget = useRef<HTMLDivElement>(null);
  const cashierBarcodeTarget = useRef<HTMLDivElement>(null);
  const adminBarcodeTarget = useRef<HTMLDivElement>(null);
  const featureDescriptionRef = useRef<HTMLParagraphElement>(null);
  const cashierDescriptionRef = useRef<HTMLParagraphElement>(null);
  const adminDescriptionRef = useRef<HTMLParagraphElement>(null);
  const scannerDrag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    overBarcode: 'features' | 'cashier' | 'admin' | null;
  } | null>(null);

  useLayoutEffect(() => {
    const descriptions = [
      featureDescriptionRef.current,
      cashierDescriptionRef.current,
      adminDescriptionRef.current,
    ].filter((description): description is HTMLParagraphElement => description !== null);

    const fitDescription = (description: HTMLParagraphElement) => {
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

    descriptions.forEach(fitDescription);
    const resizeObserver = new ResizeObserver(() => descriptions.forEach(fitDescription));
    descriptions.forEach((description) => {
      if (description.parentElement) resizeObserver.observe(description.parentElement);
    });
    return () => resizeObserver.disconnect();
  }, [activeAdminStepIndex, activeCashierStepIndex, activeFeatureIndex]);

  const handleScannerPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    scannerDrag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      overBarcode: null,
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
    const scannerHead = {
      left: scannerBounds.left + scannerBounds.width * 0.19,
      right: scannerBounds.left + scannerBounds.width * 0.63,
      top: scannerBounds.top + scannerBounds.height * 0.22,
      bottom: scannerBounds.top + scannerBounds.height * 0.46,
    };
    const scannedBox = [
      { name: 'features' as const, target: featureBarcodeTarget.current },
      { name: 'cashier' as const, target: cashierBarcodeTarget.current },
      { name: 'admin' as const, target: adminBarcodeTarget.current },
    ].find(({ target }) => {
      const bounds = target?.getBoundingClientRect();
      return Boolean(
        bounds &&
        scannerHead.right > bounds.left &&
        scannerHead.left < bounds.right &&
        scannerHead.bottom > bounds.top &&
        scannerHead.top < bounds.bottom,
      );
    })?.name;

    if (scannedBox && drag.overBarcode !== scannedBox) {
      const boxTitle =
        scannedBox === 'features' ? 'Features' : scannedBox === 'cashier' ? 'Cashier' : 'Admin';
      setScanBounce((current) => ({ box: boxTitle, sequence: current.sequence + 1 }));
      if (scannedBox === 'features') {
        setActiveFeatureIndex((index) => (index + 1) % featureSlides.length);
      } else if (scannedBox === 'cashier') {
        setActiveCashierStepIndex((index) => (index + 1) % cashierSteps.length);
      } else {
        setActiveAdminStepIndex((index) => (index + 1) % adminSteps.length);
      }
    }
    drag.overBarcode = scannedBox ?? null;
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
        {['Features', 'Cashier', 'Admin'].map((title) => {
          const isFeatureBox = title === 'Features';
          const isCashierBox = title === 'Cashier';
          const isAdminBox = title === 'Admin';
          const slide = isFeatureBox
            ? featureSlides[activeFeatureIndex]
            : isCashierBox
              ? cashierSteps[activeCashierStepIndex]
              : adminSteps[activeAdminStepIndex];

          return (
            <div className="features-medicine-row__item" key={title}>
              <h3
                key={scanBounce.box === title ? scanBounce.sequence : title}
                className={scanBounce.box === title ? 'is-scan-bouncing' : undefined}
              >
                {title}
              </h3>
              <div className="features-medicine-row__image">
                <span className="features-medicine-row__box-shadow" aria-hidden="true" />
                <span
                  key={scanBounce.box === title ? scanBounce.sequence : title}
                  className={
                    scanBounce.box === title
                      ? 'features-medicine-row__scan-glow is-scan-glowing'
                      : 'features-medicine-row__scan-glow'
                  }
                  aria-hidden="true"
                />
                <img src={medicineMockup} alt="" aria-hidden="true" />
                {slide && (
                  <>
                    <div className="features-medicine-row__feature-copy" aria-live="polite">
                      <h4
                        data-compact-title={slide.title === 'View Transactions'}
                        data-admin-title={isAdminBox}
                        data-admin-step-seven={
                          isAdminBox && slide.title === 'Manage Customer Credit'
                        }
                      >
                        {slide.titleLines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </h4>
                      <p
                        ref={
                          isFeatureBox
                            ? featureDescriptionRef
                            : isCashierBox
                              ? cashierDescriptionRef
                              : adminDescriptionRef
                        }
                      >
                        {slide.description}
                      </p>
                    </div>
                    <div
                      className="features-medicine-row__barcode-target"
                      ref={
                        isFeatureBox
                          ? featureBarcodeTarget
                          : isCashierBox
                            ? cashierBarcodeTarget
                            : adminBarcodeTarget
                      }
                      aria-hidden="true"
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
        <img
          className="features-medicine-row__conveyor"
          src={conveyorTable}
          alt=""
          aria-hidden="true"
        />
      </div>
      <div
        className="features-scanner-holder"
        role="img"
        aria-label="Barcode scanner resting in its wall-mounted holder"
      >
        <img src={scannerHolder} alt="" aria-hidden="true" />
        <div className="features-scanner-guide">
          <p>Drag the scanner over a barcode to scan it.</p>
          <svg viewBox="0 0 120 78" aria-hidden="true">
            <defs>
              <marker
                id="scanner-guide-arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            <path d="M112 6 C104 40, 72 56, 22 62" markerEnd="url(#scanner-guide-arrowhead)" />
          </svg>
        </div>
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
