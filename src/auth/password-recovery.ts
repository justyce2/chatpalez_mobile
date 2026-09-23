import type { AuthService } from '../api/auth';

export type PasswordRecoveryOptions = {
  root: HTMLElement;
  auth: AuthService;
  onReturnToLogin: () => void;
};

export function installPasswordRecovery(options: PasswordRecoveryOptions): void {
  const form = options.root.querySelector<HTMLFormElement>('.auth-form');
  if (!form || form.querySelector('[data-password-recovery]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'auth-link-button';
  button.dataset.passwordRecovery = 'true';
  button.textContent = 'Forgot password?';
  button.addEventListener('click', () => renderRequestStep(options));
  form.append(button);
}

function renderRequestStep(options: PasswordRecoveryOptions): void {
  const card = recoveryCard('Reset your password', 'Enter the email address connected to your ChatPalez account.');
  const form = document.createElement('form');
  form.className = 'auth-form';
  const email = fieldInput('email', 'Email address');
  email.autocomplete = 'email';
  const error = errorBox();
  const submit = primaryButton('Send reset code');
  form.append(field('Email address', email), error, submit, backButton(options.onReturnToLogin));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    setSubmitting(submit, true, 'Sending…');
    void options.auth.requestPasswordReset(email.value)
      .then(() => renderCodeStep(options, email.value.trim()))
      .catch((reason: unknown) => showError(error, reason, 'Unable to send reset code.'))
      .finally(() => setSubmitting(submit, false, 'Send reset code'));
  });
  card.append(form);
  options.root.replaceChildren(card);
}

function renderCodeStep(options: PasswordRecoveryOptions, emailAddress: string): void {
  const card = recoveryCard('Enter reset code', `We sent a password reset code to ${emailAddress}.`);
  const form = document.createElement('form');
  form.className = 'auth-form';
  const code = fieldInput('text', 'Reset code');
  code.autocomplete = 'one-time-code';
  const error = errorBox();
  const submit = primaryButton('Continue');
  form.append(field('Reset code', code), error, submit, backButton(() => renderRequestStep(options)));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    setSubmitting(submit, true, 'Checking…');
    void options.auth.confirmPasswordResetCode(emailAddress, code.value)
      .then(() => renderNewPasswordStep(options, emailAddress, code.value.trim()))
      .catch((reason: unknown) => showError(error, reason, 'The reset code could not be confirmed.'))
      .finally(() => setSubmitting(submit, false, 'Continue'));
  });
  card.append(form);
  options.root.replaceChildren(card);
}

function renderNewPasswordStep(options: PasswordRecoveryOptions, emailAddress: string, resetKey: string): void {
  const card = recoveryCard('Choose a new password', 'Use a strong password you do not reuse on other services.');
  const form = document.createElement('form');
  form.className = 'auth-form';
  const password = fieldInput('password', 'New password');
  password.autocomplete = 'new-password';
  const confirm = fieldInput('password', 'Confirm new password');
  confirm.autocomplete = 'new-password';
  const error = errorBox();
  const submit = primaryButton('Change password');
  form.append(field('New password', passwordField(password)), field('Confirm new password', passwordField(confirm)), error, submit, backButton(options.onReturnToLogin));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    if (password.value !== confirm.value) {
      error.textContent = 'Passwords do not match.';
      error.hidden = false;
      return;
    }
    setSubmitting(submit, true, 'Changing…');
    void options.auth.resetPassword(emailAddress, resetKey, password.value, confirm.value)
      .then(() => {
        options.onReturnToLogin();
        const status = document.createElement('p');
        status.className = 'auth-success';
        status.textContent = 'Password changed. You can sign in with your new password.';
        options.root.querySelector('.auth-form')?.prepend(status);
      })
      .catch((reason: unknown) => showError(error, reason, 'Unable to change password.'))
      .finally(() => setSubmitting(submit, false, 'Change password'));
  });
  card.append(form);
  options.root.replaceChildren(card);
}

function recoveryCard(title: string, message: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'auth-screen';
  const mark = document.createElement('img');
  mark.className = 'brand-mark';
  mark.src = '/brand/chatpalez-app-icon.png';
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h1');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = message;
  const header = document.createElement('div');
  header.className = 'auth-header';
  header.append(mark, heading, text);
  card.append(header);
  return card;
}

function fieldInput(type: string, placeholder: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.placeholder = placeholder;
  input.required = true;
  return input;
}

function field(label: string, input: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(text, input);
  return wrapper;
}

function passwordField(inputControl: HTMLInputElement): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'password-field';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'password-toggle';
  toggle.setAttribute('aria-label', 'Show password');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = '👁';
  toggle.addEventListener('click', () => {
    const showing = inputControl.type === 'text';
    inputControl.type = showing ? 'password' : 'text';
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    toggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
    inputControl.focus({ preventScroll: true });
  });
  wrap.append(inputControl, toggle);
  return wrap;
}

function errorBox(): HTMLParagraphElement {
  const error = document.createElement('p');
  error.className = 'form-error';
  error.hidden = true;
  return error;
}

function primaryButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'primary-button';
  button.textContent = text;
  return button;
}

function backButton(onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'auth-link-button';
  button.textContent = 'Back to sign in';
  button.addEventListener('click', onClick);
  return button;
}

function setSubmitting(button: HTMLButtonElement, busy: boolean, label: string): void {
  button.disabled = busy;
  button.textContent = label;
}

function showError(element: HTMLParagraphElement, reason: unknown, fallback: string): void {
  element.textContent = reason instanceof Error ? reason.message : fallback;
  element.hidden = false;
}
