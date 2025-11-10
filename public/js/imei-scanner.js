(() => {
  const OVERLAY_ID = 'imei-ocr-overlay';

  function stopStream(stream) {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }

  const CHAR_MAP = {
    O: '0',
    o: '0',
    Q: '0',
    D: '0',
    I: '1',
    l: '1',
    '|': '1',
    '!': '1',
    Z: '2',
    z: '2',
    S: '5',
    s: '5',
    B: '8',
    G: '6',
    g: '9'
  };

  function sanitizeText(raw) {
    if (!raw) return '';
    let result = '';
    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      if (/[0-9]/.test(char)) {
        result += char;
      } else if (CHAR_MAP[char] !== undefined) {
        result += CHAR_MAP[char];
      } else {
        result += ' ';
      }
    }
    return result.replace(/\s+/g, ' ');
  }

  function extractIMEIFromText(text) {
    const sanitized = sanitizeText(text);
    const digitsOnly = sanitized.replace(/[^0-9]/g, '');
    const match = digitsOnly.match(/(\d{15})/);
    return match ? match[1] : null;
  }

  function extractIMEI(data) {
    if (!data) return null;

    const candidates = [];

    if (data.text) {
      candidates.push(data.text);
    }

    if (Array.isArray(data.lines)) {
      data.lines.forEach((line) => {
        if (line && typeof line.text === 'string') {
          candidates.push(line.text);
        }
      });
    }

    if (Array.isArray(data.words)) {
      const wordsOnlyDigits = data.words
        .filter((word) => word && typeof word.text === 'string')
        .map((word) => word.text);

      if (wordsOnlyDigits.length) {
        candidates.push(wordsOnlyDigits.join(' '));
      }
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const imei = extractIMEIFromText(candidates[i]);
      if (imei) {
        return imei;
      }
    }

    return null;
  }

  function setFeedback(el, message, type = 'info') {
    if (!el) return;
    el.classList.remove('success', 'error');
    if (!message) {
      el.textContent = '';
      return;
    }
    el.textContent = message;
    if (type !== 'info') {
      el.classList.add(type);
    }
  }

  function preprocessImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const maxDim = 1800;
          const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          ctx.filter = 'contrast(180%) brightness(115%)';
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      image.onerror = reject;
      image.crossOrigin = 'Anonymous';
      image.src = src;
    });
  }

  async function recognizeImage(source, texts, targetInput, feedbackEl) {
    if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') {
      setFeedback(feedbackEl, 'Tesseract.js failed to load.', 'error');
      return;
    }

    setFeedback(feedbackEl, texts.loading);
    let processed = null;

    try {
      processed = await preprocessImage(source);
    } catch (error) {
      console.warn('[IMEI OCR] Preprocess error:', error);
    }

    const candidates = [];

    if (processed) {
      candidates.push(processed);
    }

    candidates.push(source);

    for (let i = 0; i < candidates.length; i += 1) {
      try {
        setFeedback(feedbackEl, texts.scanning);
        const { data } = await window.Tesseract.recognize(candidates[i], 'eng', {
          logger: (m) => {
            if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
              setFeedback(feedbackEl, `${texts.scanning} ${Math.round(m.progress * 100)}%`);
            }
          },
          tessedit_char_whitelist: '0123456789',
          classify_bln_numeric_mode: '1',
          tessedit_pageseg_mode: window.Tesseract && window.Tesseract.PSM
            ? window.Tesseract.PSM.SINGLE_LINE
            : 6,
          user_defined_dpi: '300',
          preserve_interword_spaces: '0',
          tessedit_ocr_engine_mode: '1'
        });

        const imei = extractIMEI(data);
        if (imei) {
          targetInput.value = imei;
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          const successMessage = texts.success.replace('{imei}', imei);
          setFeedback(feedbackEl, successMessage, 'success');
          return;
        }
      } catch (error) {
        console.error('[IMEI OCR] Error:', error);
      }
    }

    setFeedback(feedbackEl, texts.error, 'error');
  }

  function createOverlay(texts) {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="imei-ocr-modal">
        <div class="imei-ocr-video-wrapper">
          <video playsinline autoplay muted></video>
          <div class="imei-ocr-frame"></div>
        </div>
        <div class="imei-ocr-controls">
          <button type="button" class="btn btn-secondary imei-ocr-close">${texts.close || 'Close'}</button>
          <button type="button" class="btn btn-primary imei-ocr-capture">${texts.capture || 'Capture'}</button>
        </div>
        <div class="imei-ocr-status">${texts.loading}</div>
        <div class="imei-ocr-fallback">
          <button type="button" class="btn btn-outline imei-ocr-fallback-btn">${texts.gallery || 'Upload'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function initButton(button) {
    const targetSelector = button.dataset.target;
    const targetInput = document.querySelector(targetSelector);
    const fileInput = button.parentElement.querySelector('.imei-ocr-file');
    const feedbackEl = button.parentElement.querySelector('.imei-ocr-feedback');

    if (!targetInput || !fileInput) return;

    const texts = {
      loading: button.dataset.textLoading || 'Processing...',
      scanning: button.dataset.textScanning || 'Processing...',
      error: button.dataset.textError || 'IMEI not detected.',
      success: button.dataset.textSuccess || 'Detected IMEI: {imei}',
      permission: button.dataset.textPermission || 'Camera access denied.',
      unsupported: button.dataset.textUnsupported || 'Camera not supported on this device.',
      capture: button.dataset.textCapture || 'Capture',
      close: button.dataset.textClose || 'Close',
      gallery: button.dataset.textGallery || 'Upload'
    };

    async function openCamera() {
      setFeedback(feedbackEl, '');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setFeedback(feedbackEl, texts.unsupported, 'error');
        fileInput.click();
        return;
      }

      let stream = null;
      let overlay = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }
          },
          audio: false
        });

        overlay = createOverlay(texts);
        const video = overlay.querySelector('video');
        const statusEl = overlay.querySelector('.imei-ocr-status');
        const closeBtn = overlay.querySelector('.imei-ocr-close');
        const captureBtn = overlay.querySelector('.imei-ocr-capture');
        const fallbackBtn = overlay.querySelector('.imei-ocr-fallback-btn');

        video.srcObject = stream;

        const cleanup = () => {
          stopStream(stream);
          if (overlay) {
            overlay.remove();
          }
        };

        closeBtn.addEventListener('click', () => {
          cleanup();
        });

        fallbackBtn.addEventListener('click', () => {
          cleanup();
          fileInput.click();
        });

        captureBtn.addEventListener('click', async () => {
          try {
            if (video.readyState < 2) {
              statusEl.textContent = texts.loading;
              return;
            }

            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            if (!videoWidth || !videoHeight) {
              statusEl.textContent = texts.loading;
              return;
            }

            const cropWidth = Math.floor(videoWidth * 0.8);
            const cropHeight = Math.floor(videoHeight * 0.25);
            const cropX = Math.floor((videoWidth - cropWidth) / 2);
            const cropY = Math.floor((videoHeight - cropHeight) / 2);

            const canvas = document.createElement('canvas');
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(
              video,
              cropX,
              cropY,
              cropWidth,
              cropHeight,
              0,
              0,
              cropWidth,
              cropHeight
            );

            const dataUrl = canvas.toDataURL('image/png');
            cleanup();

            await recognizeImage(dataUrl, texts, targetInput, feedbackEl);
          } catch (error) {
            console.error('[IMEI OCR] capture error:', error);
            cleanup();
            setFeedback(feedbackEl, texts.error, 'error');
          }
        });

        statusEl.textContent = '';
      } catch (error) {
        console.error('[IMEI OCR] Camera error:', error);
        stopStream(stream);
        setFeedback(feedbackEl, texts.permission, 'error');
        fileInput.click();
      }
    }

    button.addEventListener('click', () => {
      openCamera();
    });

    fileInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        recognizeImage(e.target.result, texts, targetInput, feedbackEl);
      };
      reader.onerror = () => {
        setFeedback(feedbackEl, texts.error, 'error');
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.imei-ocr-button').forEach(initButton);
  });
})();

