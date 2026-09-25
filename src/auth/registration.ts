import type { AuthSession } from './session';
import type { RegistrationMetadata, RegistrationService } from '../api/registration';

export type RegistrationOptions = {
  root: HTMLElement;
  registration: RegistrationService;
  onSessionCreated: (session: AuthSession) => void;
  onComplete: (session: AuthSession) => void;
  onReturnToLogin: () => void;
  onOpenPublicPage?: (path: string) => void;
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
  if (gender && !enabled(metadata.system.genders_disabled)) { gender.required = true; form.append(field('Gender', gender)); }

  const invitation = enabled(metadata.system.invitation_enabled) ? input('text', 'Invitation code') : null;
  if (invitation) form.append(field('Invitation code', invitation));
  const phone = enabled(metadata.system.activation_enabled) && metadata.system.activation_type === 'sms'
    ? input('tel', 'Phone number') : null;
  if (phone) { phone.autocomplete = 'tel'; form.append(field('Phone number', phone)); }
  const birthdate = enabled(metadata.system.age_restriction) ? input('date', 'Date of birth') : null;
  if (birthdate) {
    birthdate.min = '1905-01-01';
    birthdate.max = `${Math.min(2017, new Date().getFullYear() - Number(metadata.system.minimum_age || 0))}-12-31`;
    form.append(field('Date of birth', birthdate));
  }
  const userGroup = enabled(metadata.system.select_user_group_enabled)
    ? selectFromRecords(metadata.userGroups, 'Select user group', ['user_group_id'], ['user_group_title', 'permissions_group_title']) : null;
  if (userGroup) { userGroup.required = true; form.append(field('User group', userGroup)); }
  const customFields = metadata.customFields.map((record) => {
    const id = firstValue(record, ['field_id']);
    const label = firstValue(record, ['label']);
    const type = firstValue(record, ['type']);
    if (!/^\d+$/.test(id) || !label) return null;
    let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (type === 'selectbox' || type === 'multipleselectbox') {
      control = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = 'none';
      placeholder.textContent = `Select ${label}`;
      if (type === 'multipleselectbox') { control.multiple = true; placeholder.remove(); }
      else control.append(placeholder);
      const choices = Array.isArray(record.options) ? record.options : [];
      choices.forEach((choice, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = String(choice);
        control.append(option);
      });
    } else if (type === 'textarea') {
      control = document.createElement('textarea');
    } else if (type === 'textbox') {
      control = input('text', label, false);
    } else return null;
    control.required = enabled(record.mandatory);
    if ((control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) && Number(record.length) > 0) {
      control.maxLength = Number(record.length);
    }
    form.append(field(label, control));
    return { key: `fld_${id}`, control };
  }).filter((entry): entry is { key: string; control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement } => entry !== null);

  form.append(field('Password', passwordField(password)), field('Confirm password', passwordField(confirm)));
  if (options.onOpenPublicPage) {
    form.append(consentLinks(options.onOpenPublicPage));
  }
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
      gender: gender?.value || undefined,
      invitationCode: invitation?.value,
      phone: phone?.value,
      birthdate: birthdate?.value,
      userGroup: userGroup?.value,
      customFields: Object.fromEntries(customFields.map(({ key, control }) => [key,
        control instanceof HTMLSelectElement && control.multiple
          ? Array.from(control.selectedOptions, (option) => option.value) : control.value]))
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

function field(label: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(text, control);
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

function consentLinks(openPublicPage: (path: string) => void): HTMLParagraphElement {
  const note = document.createElement('p');
  note.className = 'auth-consent-note';
  note.append(document.createTextNode('By creating your account, you agree to our '));
  const terms = document.createElement('button');
  terms.type = 'button';
  terms.className = 'auth-policy-link';
  terms.textContent = 'Terms';
  terms.addEventListener('click', () => openPublicPage('/static/terms'));
  const privacy = document.createElement('button');
  privacy.type = 'button';
  privacy.className = 'auth-policy-link';
  privacy.textContent = 'Privacy Policy';
  privacy.addEventListener('click', () => openPublicPage('/static/privacy'));
  note.append(terms, document.createTextNode(' and '), privacy, document.createTextNode('.'));
  return note;
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

function enabled(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}
