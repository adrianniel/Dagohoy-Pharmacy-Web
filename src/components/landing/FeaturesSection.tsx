import medicineMockup from '../../assets/medicine mockup.png';
import scannerHolder from '../../assets/scanner holder.png';

export function FeaturesSection() {
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
      <div className="features-scanner-holder">
        <img src={scannerHolder} alt="Wall-mounted barcode scanner holder" />
      </div>
    </section>
  );
}
