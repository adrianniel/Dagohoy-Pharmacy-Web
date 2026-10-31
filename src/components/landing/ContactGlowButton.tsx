import styled, { keyframes } from 'styled-components';

const letterGlow = keyframes`
  50% {
    color: #fffff0;
    text-shadow: 0 0 5px rgb(255 255 240 / 72%);
  }
`;

const sparkleFlicker = keyframes`
  50% {
    opacity: 0.35;
  }
`;

const StyledWrapper = styled.div`
  display: inline-block;

  .btn-wrapper {
    position: relative;
    display: inline-block;
    isolation: isolate;
  }

  .btn {
    --border-radius: 24px;
    --padding: 4px;
    --transition: 0.4s;
    --highlight-color: #cce8b7;

    position: relative;
    display: inline-flex;
    width: fit-content;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    padding: 0.55rem 1rem;
    border: 1px solid rgb(255 255 240 / 28%);
    border-radius: var(--border-radius);
    background: #355e3b;
    box-shadow:
      inset 0 1px 1px rgb(255 255 255 / 20%),
      inset 0 2px 2px rgb(255 255 255 / 15%),
      inset 0 4px 4px rgb(255 255 255 / 10%),
      inset 0 8px 8px rgb(255 255 255 / 5%),
      0 -1px 1px rgb(0 0 0 / 2%),
      0 -2px 2px rgb(0 0 0 / 3%),
      0 -4px 4px rgb(0 0 0 / 5%),
      0 -8px 8px rgb(0 0 0 / 6%),
      0 -16px 16px rgb(0 0 0 / 8%);
    color: #fffff0;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.84rem;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none;
    transition:
      box-shadow var(--transition),
      border-color var(--transition),
      background-color var(--transition);
    user-select: none;
    white-space: nowrap;
  }

  .btn::before {
    position: absolute;
    z-index: -1;
    top: calc(0px - var(--padding));
    left: calc(0px - var(--padding));
    width: calc(100% + var(--padding) * 2);
    height: calc(100% + var(--padding) * 2);
    border-radius: calc(var(--border-radius) + var(--padding));
    background-image: linear-gradient(0deg, #0004, #000a);
    box-shadow:
      0 -8px 8px -6px transparent inset,
      0 -16px 16px -8px transparent inset,
      1px 1px 1px rgb(255 255 255 / 13%),
      2px 2px 2px rgb(255 255 255 / 7%),
      -1px -1px 1px rgb(0 0 0 / 13%),
      -2px -2px 2px rgb(0 0 0 / 7%);
    content: '';
    pointer-events: none;
    transition:
      box-shadow var(--transition),
      filter var(--transition);
  }

  .btn::after {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: linear-gradient(
      0deg,
      #fffff0,
      var(--highlight-color),
      rgb(204 232 183 / 50%),
      8%,
      transparent
    );
    content: '';
    opacity: 0;
    pointer-events: none;
    transition:
      opacity var(--transition),
      filter var(--transition);
  }

  .btn:focus-visible {
    outline: 2px solid var(--highlight-color);
    outline-offset: 4px;
  }

  .btn-letter {
    display: inline-block;
    color: #fffff0;
    animation: ${letterGlow} 2s ease-in-out infinite;
    transition:
      color var(--transition),
      text-shadow var(--transition);
  }

  .btn-svg {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    fill: #edf4df;
    animation: ${sparkleFlicker} 2s linear infinite;
    animation-delay: 0.5s;
    filter: drop-shadow(0 0 2px rgb(255 255 240 / 60%));
    transition:
      fill var(--transition),
      filter var(--transition),
      opacity var(--transition);
  }

  .btn:hover {
    border-color: rgb(204 232 183 / 65%);
    background: #26482c;
  }

  .btn:hover::before,
  .btn:focus-visible::before {
    box-shadow:
      0 -8px 8px -6px rgb(255 255 240 / 55%) inset,
      0 -16px 16px -8px rgb(204 232 183 / 25%) inset,
      1px 1px 1px rgb(255 255 255 / 20%),
      2px 2px 2px rgb(255 255 255 / 7%),
      -1px -1px 1px rgb(0 0 0 / 13%),
      -2px -2px 2px rgb(0 0 0 / 7%);
  }

  .btn:hover::after,
  .btn:focus-visible::after {
    opacity: 0.65;
    mask-image: linear-gradient(0deg, #fff, transparent);
  }

  .btn:hover .btn-svg,
  .btn:focus-visible .btn-svg {
    fill: #fffff0;
    filter: drop-shadow(0 0 4px var(--highlight-color));
    animation: none;
  }

  .btn:active {
    transform: translateY(1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .btn-letter,
    .btn-svg {
      animation: none;
    }

    .btn,
    .btn-letter,
    .btn-svg {
      transition: none;
    }
  }
`;

const label = 'Get Your Own System';

export function ContactGlowButton() {
  return (
    <StyledWrapper>
      <div className="btn-wrapper">
        <a className="btn" href="#contact" aria-label={label}>
          <svg
            className="btn-svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
          <span className="txt-wrapper" aria-hidden="true">
            {Array.from(label).map((character, index) => (
              <span
                className="btn-letter"
                key={`${character}-${index}`}
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                {character === ' ' ? '\u00a0' : character}
              </span>
            ))}
          </span>
        </a>
      </div>
    </StyledWrapper>
  );
}
