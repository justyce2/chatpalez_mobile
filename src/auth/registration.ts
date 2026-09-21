import type { AuthSession } from './session';
import type { RegistrationMetadata, RegistrationService } from '../api/registration';

export type RegistrationOptions = {
  root: HTMLElement;
  registration: RegistrationService;
  onSessionCreated: (session: AuthSession) => void;
  onComplete: (session: AuthSession) => void;
  onReturnToLogin: () => void;
};

export function installRegistration(options: RegistrationOptions): void {
  const form = options.root.querySelector<HTMLFormElement>('.auth-form');
  if (!form || form.querySelector('[data-registration]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'auth-link-button';
  button.dataset.registration = 'true';
  button.textContent = 'Create an account';
  button.addEventListener('click', () => void renderSignUp(options));
  form.append(button);
}

export function needsRegistrationCompletion(session: AuthSession): boolean {
  return isFalseLike(session.user.user_activated) || isFalseLike(session.user.user_started);
}

export async function resumeRegistration(options: RegistrationOptions, session: AuthSession): Promise<void> {
  const card = authCard('Finish setting up ChatPalez', 'Loading your remaining account setup steps…');
  options.root.replaceChildren(card);
  try {
    const metadata = await options.registration.getMetadata();
    continueAfterRegistration(options, metadata, session);
  } catch (reason) {
    const error = errorBox();
    showError(error, reason, 'Unable to resume account setup.');
    card.append(error, linkButton('Back to sign in', options.onReturnToLogin));
  }
}

async function renderSignUp(options: RegistrationOptions): Promise<void> {
  const card = authCard('Create your ChatPalez account', 'Join ChatPalez from the mobile app.');
  card.classList.add('auth-screen-signup');
  const loading = message('Loading registration options…');
  loading.dataset.registrationLoading = 'true';
  card.append(loading);
  options.root.replaceChildren(card);

  try {
    const metadata = await options.registration.getMetadata();
    loading.remove();
    renderSignUpForm(options, metadata, card);
  } catch (reason) {
    loading.className = 'form-error';
    loading.textContent = reason instanceof Error ? reason.message : 'Unable to load registration options.';
    const back = linkButton('Back to sign in', options.onReturnToLogin);
    card.append(back);
  }
}

function renderSignUpForm(options: RegistrationOptions, metadata: RegistrationMetadata, card: HTMLElement): void {
  const form = document.createElement('form');
  form.className = 'auth-form';

  const firstName = input('text', 'First name');
  const lastName = input('text', 'Last name');
  const username = input('text', 'Username');
  const email = input('email', 'Email address');
  const password = input('password', 'Password');
  const confirm = input('password', 'Confirm password');
  firstName.autocomplete = 'given-name';
  lastName.autocomplete = 'family-name';
  username.autocomplete = 'username';
  email.autocomplete = 'email';
  password.autocomplete = 'new-password';
  confirm.autocomplete = 'new-password';

  form.append(
    field('First name', firstName),
    field('Last name', lastName),
    field('Username', username),
    field('Email address', email)
  );

  const gender = metadata.genders.length > 0 ? selectFromRecords(metadata.genders, 'Select gender', ['gender_id', 'id'], ['gender_name', 'name']) : null;
  if (gender) form.append(field('Gender', gender));

  form.append(field('Password', password), field('Confirm password', confirm));
  const error = errorBox();
  const submit = primaryButton('Create account');
  form.append(error, submit, linkButton('Back to sign in', options.onReturnToLogin));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    if (password.value !== confirm.value) {
      showError(error, new Error('Passwords do not match.'), 'Passwords do not match.');
      return;
    }
    setSubmitting(submit, true, 'Creating account…');
    void options.registration.signUp({
      firstName: firstName.value,
      lastName: lastName.value,
      username: username.value,
      email: email.value,
      password: password.value,
      confirm: confirm.value,
      gender: gender?.value || undefined
    }).then((session) => {
      options.onSessionCreated(session);
      continueAfterRegistration(options, metadata, session);
    }).catch((reason: unknown) => {
      showError(error, reason, 'Unable to create your account.');
      setSubmitting(submit, false, 'Create account');
    });
  });

  card.append(form);
}

function continueAfterRegistration(options: RegistrationOptions, metadata: RegistrationMetadata, session: AuthSession): void {
  if (isFalseLike(session.user.user_activated)) {
    renderActivation(options, metadata, session);
    return;
  }
  if (isFalseLike(session.user.user_started)) {
    renderGettingStarted(options, metadata, session);
    return;
  }
  options.onComplete(session);
}

function renderActivation(options: RegistrationOptions, metadata: RegistrationMetadata, session: AuthSession): void {
  const card = authCard('Activate your account', 'Enter the verification code sent by ChatPalez.');
  card.classList.add('auth-screen-compact');
  const form = document.createElement('form');
  form.className = 'auth-form';
  const code = input('text', 'Verification code');
  code.autocomplete = 'one-time-code';
  const error = errorBox();
  const status = message('');
  status.hidden = true;
  const submit = primaryButton('Verify account');
  const resend = linkButton('Resend verification code', () => {
    status.hidden = true;
    resend.disabled = true;
    void options.registration.resendActivation()
      .then(() => {
        status.textContent = 'A new verification code has been sent.';
        status.className = 'auth-success';
        status.hidden = false;
      })
      .catch((reason: unknown) => showError(error, reason, 'Unable to resend the verification code.'))
      .finally(() => { resend.disabled = false; });
  });
  form.append(field('Verification code', code), error, status, submit, resend);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    setSubmitting(submit, true, 'Verifying…');
    void options.registration.activate(code.value)
      .then(() => {
        session.user.user_activated = '1';
        options.onSessionCreated(session);
        if (isFalseLike(session.user.user_started)) renderGettingStarted(options, metadata, session);
        else options.onComplete(session);
      })
      .catch((reason: unknown) => showError(error, reason, 'Unable to activate your account.'))
      .finally(() => setSubmitting(submit, false, 'Verify account'));
  });
  card.append(form);
  options.root.replaceChildren(card);
}

function renderGettingStarted(options: RegistrationOptions, metadata: RegistrationMetadata, session: AuthSession): void {
  const card = authCard('Complete your profile', 'Add a few details to finish setting up ChatPalez.');
  card.classList.add('auth-screen-onboarding');
  const form = document.createElement('form');
  form.className = 'auth-form';
  const country = selectFromRecords(metadata.countries, 'Select country', ['country_id', 'id'], ['country_name', 'name']);
  country.required = true;
  const city = input('text', 'Current city', false);
  const hometown = input('text', 'Hometown', false);
  const workTitle = input('text', 'Job title', false);
  const workPlace = input('text', 'Workplace', false);
  const educationMajor = input('text', 'Field of study', false);
  const educationSchool = input('text', 'School', false);
  const educationClass = input('text', 'Class / graduation year', false);
  const error = errorBox();
  const submit = primaryButton('Finish setup');

  form.append(
    field('Country', country),
    field('Current city', city),
    field('Hometown', hometown),
    field('Job title', workTitle),
    field('Workplace', workPlace),
    field('Field of study', educationMajor),
    field('School', educationSchool),
    field('Class / graduation year', educationClass),
    error,
    submit
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    setSubmitting(submit, true, 'Finishing…');
    void options.registration.updateGettingStarted({
      country: country.value,
      city: city.value,
      hometown: hometown.value,
      workTitle: workTitle.value,
      workPlace: workPlace.value,
      educationMajor: educationMajor.value,
      educationSchool: educationSchool.value,
      educationClass: educationClass.value
    }).then(() => options.registration.finishGettingStarted())
      .then(() => {
        session.user.user_started = '1';
        options.onSessionCreated(session);
        options.onComplete(session);
      })
      .catch((reason: unknown) => showError(error, reason, 'Unable to finish account setup.'))
      .finally(() => setSubmitting(submit, false, 'Finish setup'));
  });
  card.append(form);
  options.root.replaceChildren(card);
}

function authCard(title: string, text: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'auth-screen';
  const header = document.createElement('div');
  header.className = 'auth-header';
  const mark = document.createElement('img');
  mark.className = 'brand-mark';
  mark.src = '/brand/chatpalez-app-icon.png';
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h1');
  heading.textContent = title;
  header.append(mark, heading, message(text));
  card.append(header);
  return card;
}

function input(type: string, placeholder: string, required = true): HTMLInputElement {
  const control = document.createElement('input');
  control.type = type;
  control.placeholder = placeholder;
  control.required = required;
  return control;
}

function selectFromRecords(records: Array<Record<string, unknown>>, placeholder: string, valueKeys: string[], labelKeys: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  const initial = document.createElement('option');
  initial.value = '';
  initial.textContent = placeholder;
  initial.disabled = true;
  initial.selected = true;
  select.append(initial);

  for (const record of records) {
    const value = firstValue(record, valueKeys);
    const label = firstValue(record, labelKeys);
    if (!value || !label) continue;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  return select;
}

function firstValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return '';
}

function field(label: string, control: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(text, control);
  return wrapper;
}

function primaryButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'primary-button';
  button.textContent = text;
  return button;
}

function linkButton(text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'auth-link-button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function errorBox(): HTMLParagraphElement {
  const error = document.createElement('p');
  error.className = 'form-error';
  error.hidden = true;
  return error;
}

function message(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

function setSubmitting(button: HTMLButtonElement, busy: boolean, label: string): void {
  button.disabled = busy;
  button.textContent = label;
}

function showError(element: HTMLParagraphElement, reason: unknown, fallback: string): void {
  element.textContent = reason instanceof Error ? reason.message : fallback;
  element.hidden = false;
}

function isFalseLike(value: unknown): boolean {
  return value === false || value === 0 || value === '0';
}
