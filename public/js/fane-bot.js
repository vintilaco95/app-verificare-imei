const FaneBot = (() => {
  const container = document.getElementById('fane-bot');
  if (!container) {
    return null;
  }

  const toggleButton = document.getElementById('fane-bot-toggle');
  const windowEl = document.getElementById('fane-bot-window');
  const closeButton = document.getElementById('fane-bot-close');
  const resetButton = document.getElementById('fane-bot-reset');
  const messagesEl = document.getElementById('fane-bot-messages');
  const formEl = document.getElementById('fane-bot-form');
  const inputEl = document.getElementById('fane-bot-input');
  const sendButton = document.getElementById('fane-bot-send');
  const statusEl = document.getElementById('fane-bot-status');
  const suggestionsEl = document.getElementById('fane-bot-suggestions');
  const suggestionsToggle = document.getElementById('fane-bot-suggest-toggle');
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const WELCOME_MESSAGE = 'Salut, sunt FANE , spune-mi ce telefon cumpărăm azi.';
  let isResetting = false;

  const RECOMMENDED_QUESTIONS = {
    ro: (phoneName) => [
      phoneName ? `Este sigur să cumpăr ${phoneName}?` : 'Este sigur să cumpăr telefonul verificat?',
      phoneName ? `Ce mi-ai recomanda înainte să iau ${phoneName}?` : 'Ce îmi recomanzi înainte să îl cumpăr?',
      phoneName ? `Care ar fi un preț corect pentru ${phoneName}?` : 'Care ar fi un preț corect pentru telefonul ăsta?'
    ],
    en: (phoneName) => [
      phoneName ? `Is it safe to buy the ${phoneName}?` : 'Is it safe to buy this phone?',
      phoneName ? `What would you recommend before I pick up the ${phoneName}?` : 'What would you recommend before I buy it?',
      phoneName ? `What would be a fair price for the ${phoneName}?` : 'What would be a fair price for this phone?'
    ]
  };

  const state = {
    isOpen: false,
    isSending: false,
    history: [],
    verification: (window.__FANE_BOT__ && (window.__FANE_BOT__.latestVerification || window.__FANE_BOT__.currentVerification)) || null,
    language: (window.__FANE_BOT__ && window.__FANE_BOT__.language) || document.documentElement.lang || 'ro'
  };

  function renderHistory(history = state.history) {
    messagesEl.innerHTML = '';
    const list = Array.isArray(history) ? history : [];
    if (!list.length) {
      appendMessage('assistant', WELCOME_MESSAGE, false);
      return;
    }
    list.forEach((entry) => {
      appendMessage(entry.role === 'assistant' ? 'assistant' : 'user', entry.content, false);
    });
    scrollMessagesToBottom();
  }

  function handleSuggestionClick(text) {
    if (!text || state.isSending) {
      return;
    }
    sendMessage(text);
  }

  function renderSuggestions(list) {
    if (!suggestionsEl) return;
    suggestionsEl.innerHTML = '';
    const wasOpen = suggestionsToggle && suggestionsToggle.getAttribute('aria-expanded') === 'true';
    hideSuggestions();
    const visibleList = (list || []).slice(0, 3);
    if (!visibleList.length) {
      hideSuggestions();
      disableSuggestionsToggle();
      return;
    }

    visibleList.forEach((text) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fane-bot-suggestion';
      button.textContent = text;
      button.addEventListener('click', () => handleSuggestionClick(text));
      suggestionsEl.appendChild(button);
    });
    enableSuggestionsToggle();
    if (wasOpen) {
      showSuggestions();
    }
  }

  function getPhoneName() {
    const verification = state.verification;
    if (!verification) {
      return '';
    }
    const brand = verification.brand || verification.make || '';
    const model = verification.modelDesc || verification.model || verification.deviceName || '';
    const parts = [brand, model].map((value) => (value || '').trim()).filter(Boolean);
    if (!parts.length) {
      return '';
    }
    const combined = parts.join(' ');
    return combined.length > 60 ? `${combined.slice(0, 57)}…` : combined;
  }

  function getRecommendedQuestions() {
    if (!state.verification) {
      return [];
    }
    const langKey = state.language === 'en' ? 'en' : 'ro';
    const builder = RECOMMENDED_QUESTIONS[langKey] || RECOMMENDED_QUESTIONS.ro;
    return builder(getPhoneName()).slice(0, 3);
  }

  function updateSuggestions() {
    renderSuggestions(getRecommendedQuestions());
  }
  function showSuggestions() {
    if (!suggestionsEl) return;
    suggestionsEl.classList.add('is-visible');
    suggestionsEl.hidden = false;
    if (suggestionsToggle) {
      suggestionsToggle.setAttribute('aria-expanded', 'true');
      suggestionsToggle.classList.add('is-active');
    }
  }

  function hideSuggestions() {
    if (!suggestionsEl) return;
    suggestionsEl.classList.remove('is-visible');
    suggestionsEl.hidden = true;
    if (suggestionsToggle) {
      suggestionsToggle.setAttribute('aria-expanded', 'false');
      suggestionsToggle.classList.remove('is-active');
    }
  }

  function toggleSuggestions() {
    if (!suggestionsEl) return;
    if (suggestionsEl.classList.contains('is-visible')) {
      hideSuggestions();
    } else {
      showSuggestions();
    }
  }

  function enableSuggestionsToggle() {
    if (!suggestionsToggle) return;
    suggestionsToggle.disabled = false;
    suggestionsToggle.classList.remove('is-disabled');
  }

  function disableSuggestionsToggle() {
    if (!suggestionsToggle) return;
    suggestionsToggle.disabled = true;
    suggestionsToggle.classList.add('is-disabled');
    suggestionsToggle.setAttribute('aria-expanded', 'false');
  }


  async function resetSession() {
    if (isResetting) {
      return;
    }

    isResetting = true;
    hideSuggestions();
    disableSuggestionsToggle();
    setStatus(state.language === 'en' ? 'Resetting chat…' : 'Resetez chatul…');

    if (resetButton) {
      resetButton.disabled = true;
      resetButton.classList.add('is-loading');
    }

    try {
      const response = await fetch('/api/fane-bot/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        }
      });

      if (!response.ok) {
        throw new Error('Reset failed');
      }

      state.history = [];
      state.verification = null;
      renderHistory();
      updateSuggestions();
      await loadHistory();
    } catch (error) {
      console.warn('FANE reset failed:', error);
      setStatus(state.language === 'en'
        ? 'Could not reset the chat. Try again.'
        : 'Nu am putut reseta chatul. Încearcă din nou.');
    } finally {
      if (resetButton) {
        resetButton.disabled = false;
        resetButton.classList.remove('is-loading');
      }
      isResetting = false;
      setTimeout(() => setStatus(''), 1200);
    }
  }

  async function loadHistory() {
    try {
      setStatus('FANE își amintește conversația...');
      const response = await fetch('/api/fane-bot/history', {
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data) {
        if (Array.isArray(data.history)) {
          state.history = data.history;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'latestVerification')) {
          state.verification = data.latestVerification;
        }
      }
    } catch (error) {
      console.warn('FANE history load failed:', error);
    } finally {
      renderHistory();
      setStatus('');
      updateSuggestions();
    }
  }

  function toggleWindow(forceState) {
    const newState = typeof forceState === 'boolean' ? forceState : !state.isOpen;
    state.isOpen = newState;
    if (newState) {
      windowEl.hidden = false;
      toggleButton.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        inputEl?.focus();
        scrollMessagesToBottom();
      }, 120);
    } else {
      windowEl.hidden = true;
      toggleButton.setAttribute('aria-expanded', 'false');
    }
  }

  function createMessageElement(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = `fane-message fane-message-${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'fane-message-bubble';

    const lines = String(text || '').split(/\n/g);
    lines.forEach((line, index) => {
      const span = document.createElement('span');
      span.textContent = line;
      bubble.appendChild(span);
      if (index < lines.length - 1) {
        bubble.appendChild(document.createElement('br'));
      }
    });

    wrapper.appendChild(bubble);
    return wrapper;
  }

  function appendMessage(role, text, shouldPush = true) {
    const el = createMessageElement(role, text);
    messagesEl.appendChild(el);
    if (shouldPush) {
      state.history.push({ role, content: text, createdAt: new Date().toISOString() });
    }
    scrollMessagesToBottom();
  }

  function scrollMessagesToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setStatus(message) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = '';
    } else {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
  }

  function setSending(isSending) {
    state.isSending = isSending;
    if (sendButton) {
      sendButton.disabled = isSending;
      sendButton.classList.toggle('is-loading', isSending);
    }
    if (inputEl) {
      inputEl.disabled = isSending;
    }
  }

  async function sendMessage(text) {
    if (!text || state.isSending) return;

    const payload = {
      message: text,
      language: state.language
    };

    setSending(true);
    appendMessage('user', text);

    const typingEl = createMessageElement('assistant', '...');
    typingEl.classList.add('fane-message-typing');
    messagesEl.appendChild(typingEl);
    scrollMessagesToBottom();

    try {
      const response = await fetch('/api/fane-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      typingEl.remove();

      if (!response.ok || !data.success) {
        const errorMsg = data && data.error ? data.error : 'FANE nu a putut răspunde acum.';
        appendMessage('assistant', errorMsg);
        state.history.push({ role: 'assistant', content: errorMsg, createdAt: new Date().toISOString() });
        return;
      }

      const replyText = data.reply || 'Totul e în regulă.';
      appendMessage('assistant', replyText);

      if (Array.isArray(data.history)) {
        state.history = data.history;
        renderHistory(state.history);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'latestVerification')) {
        state.verification = data.latestVerification;
      }
      updateSuggestions();
    } catch (error) {
      typingEl.remove();
      const fallback = 'S-a întrerupt conexiunea. Mai încearcă o dată.';
      appendMessage('assistant', fallback);
    } finally {
      setSending(false);
      setStatus('');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const value = inputEl.value.trim();
    if (!value) {
      inputEl.focus();
      return;
    }
    inputEl.value = '';
    sendMessage(value);
  }

  toggleButton?.addEventListener('click', () => toggleWindow());
  closeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    toggleWindow(false);
  });
  resetButton?.addEventListener('click', async (event) => {
    event.preventDefault();
    if (state.isSending || isResetting) {
      return;
    }
    const confirmText = resetButton.getAttribute('data-confirm') || '';
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    await resetSession();
  });
  suggestionsToggle?.addEventListener('click', () => toggleSuggestions());
  formEl?.addEventListener('submit', handleSubmit);
  inputEl?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const value = inputEl.value.trim();
      if (!value || state.isSending) {
        return;
      }
      inputEl.value = '';
      sendMessage(value);
    }
  });

  (async () => {
    renderHistory();
    updateSuggestions();
    await loadHistory();
  })();

  return {
    toggle: toggleWindow
  };
})();
