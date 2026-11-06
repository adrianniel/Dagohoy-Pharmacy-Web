import { type InputHTMLAttributes, type Ref, useId, useState } from 'react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  ref?: Ref<HTMLInputElement>;
};

/** Password field with a Show / Hide button so people can check what they typed. */
export function PasswordInput({ id, ref, ...props }: PasswordInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        {...props}
        id={inputId}
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        spellCheck={false}
      />
      <button
        className="password-toggle"
        type="button"
        aria-controls={inputId}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
