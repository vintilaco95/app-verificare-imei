const FaneBot = (() => {
  const container = document.getElementById('fane-bot');
  if (!container) {
    return null;
  }

  const toggleButton = document.getElementById('fane-bot-toggle');
  const windowEl = document.getElementById('fane-bot-window');
  const closeButton = document.getElementById('fane-bot-close');
  const messagesEl = document.getElementById('fane-bot-messages');
  const formEl = document.getElementById('fane-bot-form');
  const inputEl = document.getElementById('fane-bot-input');
  const sendButton = document.getElementById('fane-bot-send');
  const statusEl = document.getElementById('fane-bot-status');
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const WELCOME_MESSAGE = 'Salut, sunt FANE , spune-mi ce telefon cumpărăm azi.';
  let didResetSession = false;

  const state = {
    isOpen: false,
    isSending: false,
    history: [],
    context: (window.__FANE_BOT__ && window.__FANE_BOT__.currentVerification) || null,
    language: (window.__FANE_BOT__ && window.__FANE_BOT__.language) || document.documentElement.lang || 'ro',
    sessionOrders: []
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

  async function resetSession() {
    if (didResetSession) {
      return;
    }

    try {
      await fetch('/api/fane-bot/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        }
      });
      state.history = [];
      state.sessionOrders = [];
      didResetSession = true;
    } catch (error) {
      console.warn('FANE reset failed:', error);
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
        if (data.currentOrder) {
          state.context = data.currentOrder;
        }
        if (Array.isArray(data.sessionOrders)) {
          state.sessionOrders = data.sessionOrders;
        }
      }
    } catch (error) {
      console.warn('FANE history load failed:', error);
    } finally {
      renderHistory();
      setStatus('');
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
      orderId: state.context && state.context.orderId ? state.context.orderId : null,
      context: state.context || null,
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
      if (data.currentOrder) {
        state.context = data.currentOrder;
      }
      if (Array.isArray(data.sessionOrders)) {
        state.sessionOrders = data.sessionOrders;
      }
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
  formEl?.addEventListener('submit', handleSubmit);

  (async () => {
    await resetSession();
    renderHistory();
    await loadHistory();
  })();

  return {
    toggle: toggleWindow
  };
})();
