// IMEI Input formatting - now handled by imei-validator.js
// This code is kept for backward compatibility but main validation is in imei-validator.js
document.addEventListener('DOMContentLoaded', function() {
  const navToggle = document.getElementById('site-nav-toggle');
  const navMenu = document.getElementById('site-nav');
  const navBackdrop = document.getElementById('nav-backdrop');

  if (navToggle && navMenu) {
    const body = document.body;

    const openNav = () => {
      navMenu.classList.add('is-open');
      navMenu.setAttribute('aria-hidden', 'false');
      navToggle.classList.add('is-active');
      navToggle.setAttribute('aria-expanded', 'true');
      body.classList.add('site-nav-open');
      if (navBackdrop) {
        navBackdrop.removeAttribute('hidden');
        requestAnimationFrame(() => navBackdrop.classList.add('is-visible'));
      }
    };

    const closeNav = (isResize = false) => {
      navMenu.classList.remove('is-open');
      navToggle.classList.remove('is-active');
      navToggle.setAttribute('aria-expanded', 'false');
      body.classList.remove('site-nav-open');
      if (window.innerWidth < 900 || !isResize) {
        navMenu.setAttribute('aria-hidden', 'true');
      } else {
        navMenu.setAttribute('aria-hidden', 'false');
      }
      if (navBackdrop) {
        navBackdrop.classList.remove('is-visible');
        const hideBackdrop = () => {
          navBackdrop.setAttribute('hidden', '');
          navBackdrop.removeEventListener('transitionend', hideBackdrop);
        };
        navBackdrop.addEventListener('transitionend', hideBackdrop);
        if (!navBackdrop.classList.contains('is-visible')) {
          navBackdrop.setAttribute('hidden', '');
          navBackdrop.removeEventListener('transitionend', hideBackdrop);
        }
      }
    };

    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('is-open');
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    if (navBackdrop) {
      navBackdrop.addEventListener('click', () => closeNav());
    }

    navMenu.querySelectorAll('a, button').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 900) {
          closeNav();
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navMenu.classList.contains('is-open')) {
        closeNav();
      }
    });

    const handleResize = () => {
      if (window.innerWidth >= 900) {
        navMenu.classList.remove('is-open');
        navMenu.setAttribute('aria-hidden', 'false');
        navToggle.classList.remove('is-active');
        navToggle.setAttribute('aria-expanded', 'false');
        body.classList.remove('site-nav-open');
        if (navBackdrop) {
          navBackdrop.classList.remove('is-visible');
          navBackdrop.setAttribute('hidden', '');
        }
      } else if (!navMenu.classList.contains('is-open')) {
        navMenu.setAttribute('aria-hidden', 'true');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
  }

  const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const token = (meta && meta.getAttribute('content')) || window.csrfToken || '';
    if (token) {
      window.csrfToken = token;
    }
    return token;
  };

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('#verify-provenance-btn');
    if (!button || button.disabled) {
      return;
    }

    const orderId = button.getAttribute('data-order-id');
    if (!orderId) {
      return;
    }

    const confirmText = button.getAttribute('data-confirm') || '';
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }

    const csrfToken = getCsrfToken();
    const processingText = button.getAttribute('data-processing') || 'Procesăm...';
    const errorText = button.getAttribute('data-error') || 'Nu am putut obține raportul de proveniență.';

    const originalHtml = button.dataset.originalHtml || button.innerHTML;
    const originalDisabled = button.disabled;
    button.dataset.originalHtml = originalHtml;
    button.disabled = true;
    button.innerHTML = processingText;

    try {
      const response = await fetch(`/verify/enhance/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'csrf-token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({ _csrf: csrfToken })
      });

      const data = await response.json();
      if (!data || !data.success) {
        throw new Error((data && data.error) || errorText);
      }

      window.location.reload();
    } catch (error) {
      alert(error.message || errorText);
      button.disabled = originalDisabled;
      const fallbackHtml = button.dataset.originalHtml || button.getAttribute('data-label') || originalHtml;
      button.innerHTML = fallbackHtml;
    }
  });
  
  // IMEI validation is now handled by imei-validator.js
  
  // Form validation
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      const inputs = form.querySelectorAll('input[required]');
      let isValid = true;
      
      inputs.forEach(input => {
        if (!input.value.trim()) {
          isValid = false;
          input.style.borderColor = '#ef4444';
        } else {
          input.style.borderColor = '';
        }
      });
      
      if (!isValid) {
        e.preventDefault();
      }
    });
  });
  
  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  // Auto-hide flash messages
  const flashMessages = document.querySelectorAll('.flash');
  flashMessages.forEach(flash => {
    setTimeout(() => {
      flash.style.opacity = '0';
      flash.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        flash.remove();
      }, 300);
    }, 5000);
  });
  
  // Add transition styles to flash messages
  flashMessages.forEach(flash => {
    flash.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  });

  // Cookie banner
  const cookieBanner = document.getElementById('cookie-banner');
  if (cookieBanner) {
    const acceptBtn = document.getElementById('cookie-accept');
    const settingsBtn = document.getElementById('cookie-settings');
    let storedConsent = null;

    try {
      storedConsent = window.localStorage.getItem('cookieConsent');
    } catch (error) {
      console.warn('[CookieBanner] Nu s-a putut accesa localStorage:', error);
    }

    const hideBanner = () => {
      cookieBanner.classList.remove('show');
      cookieBanner.setAttribute('aria-hidden', 'true');
    };

    const showBanner = () => {
      cookieBanner.classList.add('show');
      cookieBanner.setAttribute('aria-hidden', 'false');
    };

    if (!storedConsent) {
      showBanner();
    } else {
      cookieBanner.setAttribute('aria-hidden', 'true');
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        const consentDetails = {
          necessary: true,
          preferences: true,
          analytics: true,
          acceptedAt: new Date().toISOString()
        };
        try {
          window.localStorage.setItem('cookieConsent', JSON.stringify(consentDetails));
        } catch (error) {
          console.warn('[CookieBanner] Salvarea consimțământului a eșuat:', error);
        }
        hideBanner();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        window.location.href = '/legal/cookies';
      });
    }
  }

  // FAQ accordion
  document.querySelectorAll('.faq-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      const targetId = button.getAttribute('aria-controls');
      const target = document.getElementById(targetId);

      button.setAttribute('aria-expanded', String(!expanded));
      if (target) {
        target.hidden = expanded;
      }

      const icon = button.querySelector('.faq-icon');
      if (icon) {
        icon.textContent = expanded ? '+' : '−';
      }
    });
  });

  // Media sliders
  document.querySelectorAll('[data-slider]').forEach(slider => {
    let main = slider.querySelector('[data-slider-main]');
    const thumbs = slider.querySelectorAll('[data-slider-target]');
    if (!main || !thumbs.length) return;

    const renderSlide = (index) => {
      const data = thumbs[index].dataset;
      const figure = document.createElement('figure');
      figure.className = 'media-slider-main';
      figure.setAttribute('data-slider-main', '');
      figure.innerHTML = `
        <img src="${data.src || ''}" alt="${data.alt || ''}" loading="lazy">
        ${(data.caption || data.description) ? `
          <figcaption>
            ${data.caption ? `<h3>${data.caption}</h3>` : ''}
            ${data.description ? `<p>${data.description}</p>` : ''}
          </figcaption>` : ''}
      `;

      if (main) {
        main.replaceWith(figure);
      }
      main = figure;
      thumbs.forEach(btn => btn.classList.remove('is-active'));
      thumbs[index].classList.add('is-active');
      thumbs[index].setAttribute('aria-current', 'true');
    };

    thumbs.forEach((thumb, index) => {
      thumb.addEventListener('click', () => renderSlide(index));
      if (index === 0) {
        renderSlide(index);
      }
    });
  });

  // Icon tabs
  document.querySelectorAll('[data-icon-tabs]').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('[data-tab-target]');
    const panels = tabContainer.querySelectorAll('[data-tab-panel]');
    if (!tabs.length || !panels.length) return;

    const activateTab = (index) => {
      tabs.forEach((tab, i) => {
        const isActive = i === index;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      panels.forEach((panel, i) => {
        const isActive = i === index;
        panel.classList.toggle('is-active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(index));
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          const nextIndex = (index + direction + tabs.length) % tabs.length;
          tabs[nextIndex].focus();
          activateTab(nextIndex);
        }
      });
    });
  });
});

// Subtle 3D card effects - only on hover (excluding verify-card)
document.querySelectorAll('.feature-card, .stat-card, .auth-card').forEach(card => {
  // Add transition for smooth effect
  card.style.transition = 'transform 0.2s ease-out';
  
  card.addEventListener('mouseenter', function() {
    // Enable subtle 3D effect on hover
    this.addEventListener('mousemove', handleCardMove);
  });
  
  card.addEventListener('mouseleave', function() {
    // Remove event listener and reset transform
    this.removeEventListener('mousemove', handleCardMove);
    this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
  });
  
  function handleCardMove(e) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Very subtle rotation - reduced from /10 to /30 for minimal movement
    const rotateX = (y - centerY) / 30;
    const rotateY = (centerX - x) / 30;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1, 1, 1)`;
  }
});
