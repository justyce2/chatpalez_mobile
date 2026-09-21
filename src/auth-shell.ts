export type LoginCredentials = {
  usernameEmail: string;
  password: string;
};

export type AuthShell = {
  showStartup: (title: string, message: string, canRetry?: boolean) => void;
  showLogin: (error?: string) => void;
  setBusy: (busy: boolean, message?: string) => void;
  setRetryAction: (action: () => void) => void;
};

export function createAuthShell(
  root: HTMLElement,
  onLogin: (credentials: LoginCredentials) => Promise<void>
): AuthShell {
  let retryAction: (() => void) | null = null;
  let busyOverlay: HTMLElement | null = null;

  function showStartup(title: string, message: string, canRetry = false): void {
    document.body.classList.add('auth-mode');
    root.replaceChildren();
    const card = document.createElement('section');
    card.className = 'state-card';
    card.append(brandMark(), heading(title), paragraph(message));

    if (canRetry && retryAction) {
      const retry = button('Try again', 'primary-button');
      retry.addEventListener('click', retryAction);
      card.append(retry);
    }

    root.append(card);
  }

  function showLogin(error?: string): void {
    document.body.classList.add('auth-mode');
    root.replaceChildren();

    const screen = document.createElement('section');
    screen.className = 'auth-screen';
    const header = document.createElement('div');
    header.className = 'auth-header';
    header.append(
      brandMark(),
      heading('Welcome to ChatPalez'),
      paragraph('Sign in to continue to ChatPalez.')
    );

    const form = document.createElement('form');
    form.className = 'auth-form';
    const identity = input('text', 'Email or username');
    identity.autocomplete = 'username';
    const password = input('password', 'Password');
    password.autocomplete = 'current-password';

    const errorBox = document.createElement('p');
    errorBox.className = 'form-error';
    errorBox.hidden = !error;
    errorBox.textContent = error ?? '';

    const submit = button('Sign in', 'primary-button');
    submit.type = 'submit';

    form.append(
      field('Email or username', identity),
      field('Password', password),
      errorBox,
      submit
    );

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      submit.disabled = true;
      submit.textContent = 'Signing in…';

      void onLogin({
        usernameEmail: identity.value,
        password: password.value
      }).catch((reason: unknown) => {
        errorBox.textContent = reason instanceof Error ? reason.message : 'Unable to sign in.';
        errorBox.hidden = false;
        submit.disabled = false;
        submit.textContent = 'Sign in';
      });
    });

    screen.append(header, form);
    root.append(screen);
  }

  function setBusy(busy: boolean, message = 'Please wait…'): void {
    if (!busy) {
      busyOverlay?.remove();
      busyOverlay = null;
      return;
    }
    if (busyOverlay) {
      const text = busyOverlay.querySelector('p');
      if (text) text.textContent = message;
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'busy-overlay';
    overlay.setAttribute('role', 'status');
    overlay.append(paragraph(message));
    document.body.append(overlay);
    busyOverlay = overlay;
  }

  return {
    showStartup,
    showLogin,
    setBusy,
    setRetryAction(action) {
      retryAction = action;
    }
  };
}

function brandMark(): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'brand-mark';
  image.src = '/brand/chatpalez-app-icon.png';
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  return image;
}

function heading(text: string): HTMLHeadingElement {
  const element = document.createElement('h1');
  element.textContent = text;
  return element;
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

function input(type: string, placeholder: string): HTMLInputElement {
  const control = document.createElement('input');
  control.type = type;
  control.placeholder = placeholder;
  control.required = true;
  return control;
}

function field(label: string, control: HTMLInputElement): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const text = document.createElement('span');
  text.textContent = label;
  wrapper.append(text, control);
  return wrapper;
}

function button(text: string, className: string): HTMLButtonElement {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = className;
  control.textContent = text;
  return control;
}
