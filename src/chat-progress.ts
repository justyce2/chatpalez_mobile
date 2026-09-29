export type ChatProgressState = {
  percent: number;
  loaded: number;
  total: number | null;
};

export type ChatProgressController = {
  element: HTMLDivElement;
  setProgress: (percent: number, loaded?: number, total?: number | null) => void;
  complete: () => void;
  fail: () => void;
  remove: () => void;
};

export function createChatCircularProgress(): ChatProgressController {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-circular-progress';
  wrapper.setAttribute('role', 'progressbar');
  wrapper.setAttribute('aria-valuemin', '0');
  wrapper.setAttribute('aria-valuemax', '100');
  wrapper.setAttribute('aria-valuenow', '0');
  wrapper.setAttribute('aria-label', 'Uploading attachment');
  const icon = document.createElement('span');
  icon.className = 'chat-circular-progress__icon';
  icon.setAttribute('aria-hidden', 'true');
  wrapper.append(icon);

  const setProgress = (percent: number, loaded = 0, total: number | null = null): void => {
    const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    wrapper.style.setProperty('--chat-progress', `${safe}%`);
    wrapper.setAttribute('aria-valuenow', String(Math.round(safe)));
    if (total && total > 0) {
      wrapper.setAttribute('aria-label', `Uploading attachment: ${Math.round(safe)} percent`);
    }
    void loaded;
  };

  return {
    element: wrapper,
    setProgress,
    complete: () => {
      wrapper.style.setProperty('--chat-progress', '100%');
      wrapper.classList.add('is-complete');
      wrapper.setAttribute('aria-valuenow', '100');
      wrapper.setAttribute('aria-label', 'Upload complete');
    },
    fail: () => {
      wrapper.classList.add('is-error');
      wrapper.setAttribute('aria-label', 'Attachment upload failed');
    },
    remove: () => wrapper.remove()
  };
}
