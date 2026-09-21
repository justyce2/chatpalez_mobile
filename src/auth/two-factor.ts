import type { AuthService, TwoFactorChallenge } from '../api/auth';
import type { AuthSession } from './session';

export type TwoFactorOptions = {
  root: HTMLElement;
  auth: AuthService;
  challenge: TwoFactorChallenge;
  onSuccess: (session: AuthSession) => void;
  onCancel: () => void;
};

export function renderTwoFactorChallenge(options: TwoFactorOptions): void {
  const screen = document.createElement('section');
  screen.className = 'auth-screen auth-screen-compact';

  const header = document.createElement('div');
  header.className = 'auth-header';
  const mark = document.createElement('img');
  mark.className = 'brand-mark';
  mark.src = '/brand/chatpalez-app-icon.png';
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  const title = document.createElement('h1');
  title.textContent = 'Two-factor authentication';
  const description = document.createElement('p');
  description.textContent = `Enter the code from ${options.challenge.method}.`;
  header.append(mark, title, description);

  const form = document.createElement('form');
  form.className = 'auth-form';
  const label = document.createElement('label');
  label.className = 'field';
  const labelText = document.createElement('span');
  labelText.textContent = 'Authentication code';
  const code = document.createElement('input');
  code.type = 'text';
  code.inputMode = 'numeric';
  code.autocomplete = 'one-time-code';
  code.placeholder = 'Enter code';
  code.required = true;
  label.append(labelText, code);

  const error = document.createElement('p');
  error.className = 'form-error';
  error.hidden = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary-button';
  submit.textContent = 'Verify';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'auth-link-button';
  cancel.textContent = 'Back to sign in';
  cancel.addEventListener('click', options.onCancel);

  form.append(label, error, submit, cancel);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Verifying…';
    void options.auth.completeTwoFactor(options.challenge.userId, code.value)
      .then(options.onSuccess)
      .catch((reason: unknown) => {
        error.textContent = reason instanceof Error ? reason.message : 'Unable to verify the code.';
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Verify';
      });
  });

  screen.append(header, form);
  options.root.replaceChildren(screen);
  code.focus();
}
