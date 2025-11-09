// IMEI Input formatting - now handled by imei-validator.js
// This code is kept for backward compatibility but main validation is in imei-validator.js
document.addEventListener('DOMContentLoaded', function() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a, button').forEach(item => {
      item.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
  
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
