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

  function isValidIMEI(imei) {
    if (!/^\d{15}$/.test(imei)) {
      return false;
    }
    let sum = 0;
    for (let i = 0; i < imei.length; i += 1) {
      let digit = parseInt(imei[i], 10);
      if (Number.isNaN(digit)) return false;
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) {
          digit = Math.floor(digit / 10) + (digit % 10);
        }
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

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
    if (!text) return null;
    const sanitized = sanitizeText(text);
    const digitsOnly = sanitized.replace(/[^0-9]/g, '');
    for (let i = 0; i + 15 <= digitsOnly.length; i += 1) {
      const candidate = digitsOnly.slice(i, i + 15);
      if (isValidIMEI(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  function extractSegments(data) {
    const segments = [];

    if (Array.isArray(data.lines)) {
      data.lines.forEach((line) => {
        if (line && typeof line.text === 'string') {
          const raw = line.text;
          const sanitized = sanitizeText(raw);

          if (/^\s*IMEI[\s:]*\d{6,}\s*$/i.test(raw)) {
            const digits = raw.replace(/[^0-9]/g, '');
            segments.push(digits);
            return;
          }

          if (/^\d{8,}$/.test(sanitized)) {
            segments.push(sanitized);
            return;
          }

          if (Array.isArray(line.words)) {
            const numericWords = line.words
              .filter((word) => word && typeof word.text === 'string')
              .map((word) => sanitizeText(word.text))
              .filter((w) => /^\d{4,}$/.test(w));

            if (numericWords.length >= 2) {
              segments.push(numericWords.join(''));
            } else if (numericWords.length === 1) {
              segments.push(numericWords[0]);
            }
          }
        }
      });
    }

    if (typeof data.text === 'string') {
      const sanitized = sanitizeText(data.text);
      if (/^\d{8,}$/.test(sanitized)) {
        segments.push(sanitized);
      }
    }

    return segments;
  }

  function extractIMEICandidates(segment) {
    const digitsOnly = segment.replace(/[^0-9]/g, '');
    const matches = [];
    for (let i = 0; i + 15 <= digitsOnly.length; i += 1) {
      matches.push(digitsOnly.slice(i, i + 15));
    }
    return matches;
  }

  function collectCandidatesFromData(data) {
    if (!data) return [];
    const segments = extractSegments(data);
    const unique = new Set();
    for (let i = 0; i < segments.length; i += 1) {
      const group = extractIMEICandidates(segments[i]);
      for (let j = 0; j < group.length; j += 1) {
        if (group[j] && group[j].length === 15) {
          unique.add(group[j]);
        }
      }
    }
    return Array.from(unique);
  }

  function resolveIMEIResult(candidates) {
    if (!Array.isArray(candidates)) {
      return { imei: null, nearCandidate: null };
    }
    const unique = Array.from(new Set(candidates));
    const valid = unique.find((value) => isValidIMEI(value));
    const near = unique.find((value) => /^\d{15}$/.test(value));
    return {
      imei: valid || null,
      nearCandidate: valid ? null : near || null
    };
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

  async function detectBarcode(canvas) {
    if (!('BarcodeDetector' in window)) {
      return null;
    }
    try {
      const detector = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
      });
      const bitmap = await createImageBitmap(canvas);
      const barcodes = await detector.detect(bitmap);
      if (barcodes && barcodes.length > 0) {
        for (const barcode of barcodes) {
          if (barcode && typeof barcode.rawValue === 'string') {
            const imei = extractIMEIFromText(barcode.rawValue);
            if (imei) {
              return imei;
            }
          }
        }
      }
    } catch (error) {
      console.warn('[IMEI OCR] Barcode detection error:', error);
    }
    return null;
  }

  async function runTesseractOnSources(sources, onProgress) {
    if (!window.Tesseract || typeof window.Tesseract.recognize !== 'function') {
      throw new Error('Tesseract.js not available');
    }

    let nearCandidate = null;

    for (let i = 0; i < sources.length; i += 1) {
      const src = sources[i];
      try {
        const { data } = await window.Tesseract.recognize(src, 'eng', {
          logger: (m) => {
            if (
              onProgress &&
              m &&
              typeof m.progress === 'number' &&
              m.status === 'recognizing text'
            ) {
              onProgress(m.progress);
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

        const candidates = collectCandidatesFromData(data);
        const { imei, nearCandidate: near } = resolveIMEIResult(candidates);

        if (imei) {
          return { imei };
        }
        if (!nearCandidate && near) {
          nearCandidate = near;
        }
      } catch (error) {
        console.error('[IMEI OCR] Tesseract error:', error);
      }
    }

    return { imei: null, nearCandidate };
  }

  async function scanCanvasForIMEI(canvas, options = {}) {
    const { onProgress, quick = false } = options;

    const barcodeResult = await detectBarcode(canvas);
    if (barcodeResult && isValidIMEI(barcodeResult)) {
      return { imei: barcodeResult, method: 'barcode' };
    }

    const sources = [];
    const original = canvas.toDataURL('image/png');

    if (!quick) {
      try {
        const processed = await preprocessImage(original);
        if (processed) {
          sources.push(processed);
        }
      } catch (error) {
        console.warn('[IMEI OCR] Preprocess error:', error);
      }
    }

    sources.push(original);

    const result = await runTesseractOnSources(sources, onProgress);
    return result;
  }

  async function processCanvas(canvas, texts, targetInput, feedbackEl) {
    setFeedback(feedbackEl, texts.loading);
    try {
      const result = await scanCanvasForIMEI(canvas, {
        onProgress: (progress) => {
          if (typeof progress === 'number') {
            setFeedback(
              feedbackEl,
              `${texts.scanning} ${Math.round(progress * 100)}%`
            );
          } else {
            setFeedback(feedbackEl, texts.scanning);
          }
        }
      });

      if (result.imei) {
        targetInput.value = result.imei;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        const successMessage = texts.success.replace('{imei}', result.imei);
        setFeedback(feedbackEl, successMessage, 'success');
        return;
      }

      if (result.nearCandidate) {
        setFeedback(
          feedbackEl,
          `${texts.error} (${result.nearCandidate})`,
          'error'
        );
      } else {
        setFeedback(feedbackEl, texts.error, 'error');
      }
    } catch (error) {
      console.error('[IMEI OCR] process error:', error);
      setFeedback(feedbackEl, texts.error, 'error');
    }
  }

  async function createCanvasFromImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const maxDim = 2000;
          const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas);
        } catch (err) {
          reject(err);
        }
      };
      image.onerror = reject;
      image.crossOrigin = 'Anonymous';
      image.src = src;
    });
  }

  function captureFrameCanvas(video) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) {
      return null;
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

    return canvas;
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
        <div class="imei-ocr-preview">
          <span class="imei-ocr-preview-label">${texts.previewLabel || 'Previzualizare'}</span>
          <span class="imei-ocr-preview-value">—</span>
        </div>
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
      gallery: button.dataset.textGallery || 'Upload',
      previewLabel: button.dataset.textPreview || 'Live preview',
      instructions: button.dataset.textInstructions || ''
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
        const previewValueEl = overlay.querySelector('.imei-ocr-preview-value');
        const closeBtn = overlay.querySelector('.imei-ocr-close');
        const captureBtn = overlay.querySelector('.imei-ocr-capture');
        const fallbackBtn = overlay.querySelector('.imei-ocr-fallback-btn');

        video.srcObject = stream;

        let liveScanActive = true;
        let liveScanBusy = false;
        let liveScanTimer = null;
        let lastValidIMEI = null;
        let lastNearCandidate = null;

        const updatePreview = (value, type) => {
          if (!previewValueEl) return;
          previewValueEl.classList.remove('success', 'near');
          if (!value) {
            previewValueEl.textContent = '—';
            return;
          }
          previewValueEl.textContent = value;
          if (type) {
            previewValueEl.classList.add(type);
          }
        };

        const cleanup = () => {
          stopStream(stream);
          liveScanActive = false;
          if (liveScanTimer) {
            clearTimeout(liveScanTimer);
            liveScanTimer = null;
          }
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

        const scheduleLiveScan = (delay = 1500) => {
          if (!liveScanActive) return;
          if (liveScanTimer) {
            clearTimeout(liveScanTimer);
          }
          liveScanTimer = setTimeout(async () => {
            if (!liveScanActive || liveScanBusy) {
              scheduleLiveScan();
              return;
            }

            const frameCanvas = captureFrameCanvas(video);
            if (!frameCanvas) {
              scheduleLiveScan();
              return;
            }

            liveScanBusy = true;
            try {
              const result = await scanCanvasForIMEI(frameCanvas, { quick: true });
              if (!liveScanActive) return;

              if (result.imei) {
                lastValidIMEI = result.imei;
                lastNearCandidate = null;
                updatePreview(result.imei, 'success');
              } else if (result.nearCandidate) {
                lastNearCandidate = result.nearCandidate;
                if (!lastValidIMEI) {
                  updatePreview(`${result.nearCandidate} ✳`, 'near');
                }
              } else {
                if (!lastValidIMEI) {
                  updatePreview('—');
                }
              }
            } catch (error) {
              console.error('[IMEI OCR] live scan error:', error);
            } finally {
              liveScanBusy = false;
              scheduleLiveScan();
            }
          }, delay);
        };

        video.addEventListener('loadedmetadata', () => {
          statusEl.textContent = texts.instructions || '';
          updatePreview('—');
          scheduleLiveScan(500);
        });

        captureBtn.addEventListener('click', async () => {
          try {
            if (lastValidIMEI) {
              cleanup();
              targetInput.value = lastValidIMEI;
              targetInput.dispatchEvent(new Event('input', { bubbles: true }));
              const successMessage = texts.success.replace('{imei}', lastValidIMEI);
              setFeedback(feedbackEl, successMessage, 'success');
              return;
            }

            if (lastNearCandidate && isValidIMEI(lastNearCandidate)) {
              cleanup();
              targetInput.value = lastNearCandidate;
              targetInput.dispatchEvent(new Event('input', { bubbles: true }));
              const successMessage = texts.success.replace('{imei}', lastNearCandidate);
              setFeedback(feedbackEl, successMessage, 'success');
              return;
            }

            const frameCanvas = captureFrameCanvas(video);
            if (!frameCanvas) {
              statusEl.textContent = texts.loading;
              return;
            }

            cleanup();
            await processCanvas(frameCanvas, texts, targetInput, feedbackEl);
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
      reader.onload = async (e) => {
        try {
          const canvas = await createCanvasFromImage(e.target.result);
          await processCanvas(canvas, texts, targetInput, feedbackEl);
        } catch (error) {
          console.error('[IMEI OCR] gallery error:', error);
          setFeedback(feedbackEl, texts.error, 'error');
        }
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

