export type CroppedProfilePicture = {
  file: File;
  previewUrl: string;
};

export async function cropProfilePicture(file: File): Promise<CroppedProfilePicture | null> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for your profile picture.');
  if (file.size <= 0) throw new Error('The selected photo is empty.');
  if (file.size > 8 * 1024 * 1024) throw new Error('This photo is too large. Choose a smaller image.');

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    return await openCropper(image, file.name);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected photo could not be opened.'));
    image.src = sourceUrl;
  });
}

function openCropper(image: HTMLImageElement, originalName: string): Promise<CroppedProfilePicture | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'profile-picture-cropper';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Crop profile picture');

    const panel = document.createElement('section');
    panel.className = 'profile-picture-cropper__panel';

    const heading = document.createElement('div');
    heading.className = 'profile-picture-cropper__heading';
    heading.append(
      textElement('strong', 'Crop profile picture'),
      textElement('span', 'Drag to position and use the slider to zoom.')
    );

    const viewport = document.createElement('div');
    viewport.className = 'profile-picture-cropper__viewport';

    const canvas = document.createElement('canvas');
    canvas.className = 'profile-picture-cropper__canvas';
    canvas.width = 640;
    canvas.height = 640;
    viewport.append(canvas);

    const zoomLabel = textElement('label', 'Zoom');
    zoomLabel.className = 'profile-picture-cropper__zoom-label';
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.01';
    zoom.value = '1';
    zoom.className = 'profile-picture-cropper__zoom';
    zoomLabel.append(zoom);

    const actions = document.createElement('div');
    actions.className = 'profile-picture-cropper__actions';
    const cancel = button('Cancel', 'secondary-button');
    const apply = button('Use photo', 'primary-button');
    actions.append(cancel, apply);

    panel.append(heading, viewport, zoomLabel, actions);
    overlay.append(panel);
    document.body.append(overlay);

    const context = canvas.getContext('2d');
    if (!context) {
      overlay.remove();
      resolve(null);
      return;
    }

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const baseScale = Math.max(640 / imageWidth, 640 / imageHeight);
    let scale = baseScale;
    let offsetX = (640 - imageWidth * scale) / 2;
    let offsetY = (640 - imageHeight * scale) / 2;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let settled = false;

    const draw = (): void => {
      context.clearRect(0, 0, 640, 640);
      context.fillStyle = '#000';
      context.fillRect(0, 0, 640, 640);
      context.drawImage(image, offsetX, offsetY, imageWidth * scale, imageHeight * scale);
    };

    const finish = (result: CroppedProfilePicture | null): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const onZoom = (): void => {
      const previousScale = scale;
      scale = baseScale * Number(zoom.value);
      const centerX = 320;
      const centerY = 320;
      offsetX = centerX - (centerX - offsetX) * (scale / previousScale);
      offsetY = centerY - (centerY - offsetY) * (scale / previousScale);
      draw();
    };

    const onPointerDown = (event: PointerEvent): void => {
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      offsetX += event.clientX - lastX;
      offsetY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      draw();
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') finish(null);
    };

    zoom.addEventListener('input', onZoom);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('keydown', onKeyDown);

    cancel.addEventListener('click', () => finish(null));
    apply.addEventListener('click', () => {
      apply.disabled = true;
      try {
        const output = document.createElement('canvas');
        output.width = 512;
        output.height = 512;
        const outputContext = output.getContext('2d');
        if (!outputContext) throw new Error('The profile picture crop could not be prepared.');

        const ratio = 512 / 640;
        outputContext.fillStyle = '#fff';
        outputContext.fillRect(0, 0, 512, 512);
        outputContext.drawImage(
          image,
          offsetX * ratio,
          offsetY * ratio,
          imageWidth * scale * ratio,
          imageHeight * scale * ratio
        );

        output.toBlob((blob) => {
          if (!blob) {
            apply.disabled = false;
            return;
          }
          const baseName = originalName.replace(/\\.[^.]*$/, '').trim() || 'profile-picture';
          const fileName = `${baseName}-profile.jpg`;
          const croppedFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
          const previewUrl = URL.createObjectURL(croppedFile);
          finish({ file: croppedFile, previewUrl });
        }, 'image/jpeg', 0.9);
      } catch {
        apply.disabled = false;
      }
    });

    draw();
  });
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function button(text: string, className: string): HTMLButtonElement {
  const node = textElement('button', text);
  node.type = 'button';
  node.className = className;
  return node;
}
