import { useState } from 'react';
import { pharmacyFeatures } from './mockData';

export function FeaturesSection() {
  const [activeStep, setActiveStep] = useState(0);
  const activeFeature = pharmacyFeatures[activeStep];

  return (
    <section
      className="features-section section-wrap"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Core capabilities</p>
        <h2 id="features-title">Everything in its place. Nothing in your way.</h2>
        <p>Thoughtful tools for the moments that matter at the counter and beyond.</p>
      </div>
      <div className="features-tour">
        <ol className="features-tour__steps" aria-label="System workflow">
          {pharmacyFeatures.map((feature, index) => {
            const isComplete = index < activeStep;
            const isActive = index === activeStep;
            const stepState = isComplete ? 'completed' : isActive ? 'active' : 'pending';

            return (
              <li
                className={`features-tour__step features-tour__step--${stepState}`}
                key={feature.number}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="features-tour__circle" aria-hidden="true">
                  {isComplete ? (
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z" />
                    </svg>
                  ) : (
                    feature.number
                  )}
                </span>
                {index < pharmacyFeatures.length - 1 && (
                  <span className="features-tour__line" aria-hidden="true" />
                )}
                <div className="features-tour__content">
                  <h3>{feature.title}</h3>
                  <span className="features-tour__status">
                    {isComplete ? 'Completed' : isActive ? 'In progress' : 'Up next'}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {activeFeature && (
          <div className="features-tour__detail" aria-live="polite" aria-atomic="true">
            <p className="features-tour__detail-label">
              Step {activeStep + 1} of {pharmacyFeatures.length}
            </p>
            <p>{activeFeature.description}</p>
          </div>
        )}

        <div className="features-tour__controls">
          <button
            className="features-tour__button"
            type="button"
            onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
            disabled={activeStep === 0}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8" />
            </svg>
            Previous
          </button>
          <button
            className="features-tour__button features-tour__button--primary"
            type="button"
            onClick={() => setActiveStep((step) => Math.min(pharmacyFeatures.length - 1, step + 1))}
            disabled={activeStep === pharmacyFeatures.length - 1}
          >
            Next
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
