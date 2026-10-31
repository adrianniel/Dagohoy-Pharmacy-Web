import { useState } from 'react';
import storefrontImage from '../../assets/dagohoy-pharmacy-storefront.jpg';
import ChartBarIcon from './hovericons/chart-bar-icon';
import StackIcon from './hovericons/stack-icon';
import UsersGroupIcon from './hovericons/users-group-icon';
import ScanBarcodeIcon from './hovericons/scan-barcode-icon';
import ShoppingCartIcon from './hovericons/shopping-cart-icon';
import CheckedIcon from './hovericons/checked-icon';

interface WorkflowStep {
  title: string;
  description: string;
}

interface Workflow {
  id: string;
  title: string;
  steps: WorkflowStep[];
}

const workflows: Workflow[] = [
  {
    id: 'administrator',
    title: 'Administrator Workflow',
    steps: [
      {
        title: 'Monitor Operations',
        description: 'View sales activity, active shifts, and the pharmacy’s current status.',
      },
      {
        title: 'Manage Inventory',
        description:
          'Maintain products, stock levels, batches, expiry dates, and received supplies.',
      },
      {
        title: 'Review Records',
        description: 'Check transactions, customer credit, stock movements, and business reports.',
      },
      {
        title: 'Manage Staff',
        description: 'Create cashier accounts, review shifts, and control access to the system.',
      },
    ],
  },
  {
    id: 'cashier',
    title: 'Cashier Workflow',
    steps: [
      {
        title: 'Start Shift',
        description: 'Log in and begin the active cashier shift for the day.',
      },
      {
        title: 'Scan & Add Products',
        description: 'Scan barcodes or search products to quickly build the customer’s cart.',
      },
      {
        title: 'Process Sale',
        description: 'Review items, choose the payment method, and complete the transaction.',
      },
      {
        title: 'End Shift',
        description: 'Review the shift summary, record the closing cash, and close the shift.',
      },
    ],
  },
];

function WorkflowStepper({ workflow }: { workflow: Workflow }) {
  const [activeStep, setActiveStep] = useState(0);
  const icons =
    workflow.id === 'administrator'
      ? [ChartBarIcon, StackIcon, CheckedIcon, UsersGroupIcon]
      : [CheckedIcon, ScanBarcodeIcon, ShoppingCartIcon, CheckedIcon];
  const HeaderIcon = workflow.id === 'administrator' ? ChartBarIcon : ShoppingCartIcon;

  return (
    <section className="features-workflow" aria-labelledby={`${workflow.id}-workflow-title`}>
      <header
        className="features-workflow__header"
        style={{
          backgroundImage: `linear-gradient(115deg, #123f2a 0%, #14532deB 72%, #14532d55 73%), url(${storefrontImage})`,
        }}
      >
        <span className="features-workflow__header-icon" aria-hidden="true">
          <HeaderIcon size={36} />
        </span>
        <div>
          <h3 className="features-workflow__title" id={`${workflow.id}-workflow-title`}>
            {workflow.title}
          </h3>
          <p>
            {workflow.id === 'administrator'
              ? 'Manage, monitor, and control the pharmacy’s operations.'
              : 'Process sales quickly and accurately from start to finish.'}
          </p>
        </div>
      </header>
      <div className="features-tour">
        <ol className="features-tour__steps" aria-label={`${workflow.title} steps`}>
          {workflow.steps.map((step, index) => {
            const isComplete = index < activeStep;
            const isActive = index === activeStep;
            const stepState = isComplete ? 'completed' : isActive ? 'active' : 'pending';
            const Icon = icons[index] ?? CheckedIcon;

            return (
              <li
                className={`features-tour__step features-tour__step--${stepState}`}
                key={step.title}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="features-tour__circle" aria-hidden="true">
                  {isComplete ? (
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                {index < workflow.steps.length - 1 && (
                  <span className="features-tour__line" aria-hidden="true" />
                )}
                <div className="features-tour__content">
                  <span className="features-tour__icon" aria-hidden="true">
                    <Icon size={30} />
                  </span>
                  <div className="features-tour__copy">
                    <h4>{step.title}</h4>
                    <p>{step.description}</p>
                  </div>
                  <span className="features-tour__status">
                    {isComplete ? 'Completed' : isActive ? 'In progress' : 'Up next'}
                  </span>
                  <span className="features-tour__chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="features-tour__controls">
          <div className="features-tour__progress" aria-live="polite" aria-atomic="true">
            <p>
              Step {activeStep + 1} of {workflow.steps.length}
            </p>
            <div aria-hidden="true">
              {workflow.steps.map((step, index) => (
                <span className={index <= activeStep ? 'is-filled' : ''} key={step.title} />
              ))}
            </div>
          </div>
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
            onClick={() => setActiveStep((step) => Math.min(workflow.steps.length - 1, step + 1))}
            disabled={activeStep === workflow.steps.length - 1}
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

export function FeaturesSection() {
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
      <div className="features-workflows">
        {workflows.map((workflow) => (
          <WorkflowStepper workflow={workflow} key={workflow.id} />
        ))}
      </div>
    </section>
  );
}
