    const attachmentIcon = (type: string): string => `<span class="chat-attachment-option__icon chat-attachment-option__icon--${type}" aria-hidden="true"></span>`;
    // Keep photo availability as real runtime state: site features can arrive after the sheet is created.
    let photosAvailable = true;
    const addOption = (kind: 'image' | 'video' | 'file' | 'voice', label: string, enabled = true): void => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'chat-attachment-option';
      option.disabled = !enabled;
      option.innerHTML = `${attachmentIcon(kind)}<span>${label}</span>`;
      option.addEventListener('click', () => {
        if (kind === 'image' && !photosAvailable) return;
        attachmentSheet.hidden = true;
        if (kind === 'voice') {
          if (!this.handlers.onRecordVoiceNote) return;
          option.disabled = true;
          void this.handlers.onRecordVoiceNote(conversationId).then((file) => {
            if (file && version === this.viewVersion) showVoiceAttachment(file);
          }).catch((error: unknown) => {
            if (version === this.viewVersion && error instanceof Error && !/cancel|dismiss/i.test(error.message)) window.alert(error.message);
          }).finally(() => { option.disabled = false; });
          return;
        }
        if (this.handlers.onPickChatAttachment) {
          option.disabled = true;
          void this.handlers.onPickChatAttachment(kind).then((file) => {
            if (file && version === this.viewVersion) showAttachment(file);
          }).catch((error: unknown) => {
            if (version === this.viewVersion && error instanceof Error && !/cancel|dismiss/i.test(error.message)) window.alert(error.message);
          }).finally(() => { option.disabled = !enabled; });
        } else if (kind === 'image') {
          photo.click();
        }
      });
      attachmentSheetOptions.append(option);
    };
    addOption('image', 'Image', photosAvailable);
    addOption('video', 'Video', true);
    addOption('file', 'File', true);
    addOption('voice', 'Voice note', true);
    attachmentSheetPanel.append(attachmentSheetHeader, attachmentSheetOptions);
    attachmentSheet.append(attachmentSheetPanel);
    document.body.append(attachmentSheet);

    let selectedPhoto: File | null = null;
    let selectedVideo: File | null = null;
    let selectedFile: File | null = null;
    let selectedVoice: File | null = null;
    let previewUrl: string | null = null;
    let videoMaxBytes = 0;
    let fileMaxBytes = 0;
    const clearAttachment = (): void => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      selectedPhoto = null;
      selectedVideo = null;
      selectedFile = null;
      selectedVoice = null;
      photo.value = '';
      attachment.hidden = true;
      attachmentImage.hidden = false;
      attachmentImage.removeAttribute('src');
      text.placeholder = 'Write a message…';
      send.setAttribute('aria-label', 'Send message');
    };
    const showVoiceAttachment = (file: File): void => {
      clearAttachment();
      selectedVoice = file;
      previewUrl = URL.createObjectURL(file);
      attachmentImage.hidden = true;
      attachmentImage.removeAttribute('src');
      attachmentName.textContent = file.name || 'Voice note';
      attachmentHint.textContent = 'Voice note recorded. Send when ready.';
      attachment.hidden = false;
      text.placeholder = 'Add a caption (optional)…';
      send.setAttribute('aria-label', 'Send voice note');
    };
    const showAttachment = (file: File): void => {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file';
      if (kind === 'image' && !photosAvailable) return;
      if (kind === 'image' && file.size > 8 * 1024 * 1024) { window.alert('This photo is too large. Choose a smaller image.'); return; }
      if (kind === 'video' && videoMaxBytes > 0 && file.size > videoMaxBytes) { window.alert('This video is larger than the site limit. Choose a smaller video.'); return; }
      if (kind === 'file' && fileMaxBytes > 0 && file.size > fileMaxBytes) { window.alert('This file is larger than the site limit. Choose a smaller file.'); return; }
      clearAttachment();
      if (kind === 'image') selectedPhoto = file;
      else if (kind === 'video') selectedVideo = file;
      else selectedFile = file;
      previewUrl = URL.createObjectURL(file);
      attachmentImage.src = previewUrl;
      attachmentName.textContent = file.name;
      attachmentHint.textContent = kind === 'video' ? 'Video selected. Send when ready.' : kind === 'file' ? 'File selected. Send when ready.' : 'Add a caption below, or send the photo on its own.';
      attachment.hidden = false;
      text.placeholder = 'Add a caption (optional)…';
      send.setAttribute('aria-label', 'Send message and photo');
    };
    this.attachmentCleanup = (): void => {
      clearAttachment();
      attachmentSheet.remove();
    };
    removeAttachment.addEventListener('click', clearAttachment);
    photo.addEventListener('change', () => { const file = photo.files?.[0]; if (file) showAttachment(file); });
    attach.addEventListener('click', () => {
      attachmentSheet.hidden = false;
    });
    const text = document.createElement('textarea');
    text.rows = 2;
    text.placeholder = 'Write a message…';
    text.setAttribute('aria-label', 'Message or photo caption');
    const savedDraft = this.drafts.get(String(conversationId));
    if (savedDraft) text.value = savedDraft.text;
    const send = primaryButton('');
    send.type = 'submit';
    send.classList.add('message-send-button');
    send.setAttribute('aria-label', 'Send message');
    send.innerHTML = '<span class="message-send-button__icon" aria-hidden="true"></span>';
    composer.append(attach, text, photo, send);
    this.content.append(realtimeStatus, deliveryStatus, attachment, composer);
    if (savedDraft?.photo) showAttachment(savedDraft.photo);
    if (this.handlers.onLoadChatFeatures) {
      void this.handlers.onLoadChatFeatures().then((features) => {
        if (version !== this.viewVersion) return;
        videoMaxBytes = Number(features.videoMaxBytes || 0);
        fileMaxBytes = Number(features.fileMaxBytes || 0);
        const options = Array.from(attachmentSheetOptions.querySelectorAll<HTMLButtonElement>('.chat-attachment-option'));
        const labels = options.map((option) => option.textContent?.trim().toLowerCase());
        const setOption = (label: string, enabled: boolean) => { const index = labels.indexOf(label); if (index >= 0 && options[index]) options[index].disabled = !enabled; };
        setOption('image', features.photos); setOption('video', features.videos); setOption('file', features.files); setOption('voice note', features.voiceNotes);
        photosAvailable = Boolean(features.photos);
        if (!photosAvailable && selectedPhoto) clearAttachment();
        setOption('image', photosAvailable);
        attach.disabled = !(photosAvailable || features.videos || features.files || features.voiceNotes);
        attach.title = attach.disabled ? 'Attachments are disabled by site settings.' : '';
      }).catch(() => undefined);
    }

    let typingTimer: number | undefined;
    let typingActive = false;
    const setTyping = (typing: boolean): void => {
      if (typingActive === typing) return;
      typingActive = typing;
      if (this.handlers.onTyping) void this.handlers.onTyping(conversationId, typing).catch(() => undefined);
    };
    text.addEventListener('input', () => {
      setTyping(true);
      if (typingTimer) window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => setTyping(false), 1200);
    });
    text.addEventListener('blur', () => setTyping(false));