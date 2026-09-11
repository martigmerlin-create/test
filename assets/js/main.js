/* Pavillon de Jade — comportements progressifs.
   Rien ici n'est requis pour lire le contenu : sans JS, le site reste
   entièrement lisible (nav visible, horaires en texte, formulaire natif). */
(function () {
  'use strict';

  /* ---------------------------------------------------------- horaires
     0 = dimanche ... 6 = samedi, comme Date.prototype.getDay().
     Chaque service est [debut, fin] en heures décimales. */
  var HOURS = {
    0: [[11.5, 14]],
    1: [],
    2: [[11.5, 14], [18.5, 21.5]],
    3: [[11.5, 14], [18.5, 21.5]],
    4: [[11.5, 14], [18.5, 21.5]],
    5: [[11.5, 14], [18.5, 22]],
    6: [[11.5, 14], [18.5, 22]]
  };
  var DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function fmtHour(h) {
    var hh = Math.floor(h);
    var mm = Math.round((h - hh) * 60);
    return hh + 'h' + String(mm).padStart(2, '0');
  }

  function computeStatus(now) {
    var day = now.getDay();
    var t = now.getHours() + now.getMinutes() / 60;
    var slots = HOURS[day];

    for (var i = 0; i < slots.length; i++) {
      if (t >= slots[i][0] && t < slots[i][1]) {
        return { open: true, label: 'Ouvert — service jusqu’à ' + fmtHour(slots[i][1]) };
      }
    }
    for (var j = 0; j < slots.length; j++) {
      if (t < slots[j][0]) {
        return { open: false, label: 'Fermé — ouvre à ' + fmtHour(slots[j][0]) };
      }
    }
    for (var k = 1; k <= 7; k++) {
      var nd = (day + k) % 7;
      if (HOURS[nd].length) {
        var when = k === 1 ? 'demain' : DAY_NAMES[nd];
        return { open: false, label: 'Fermé — réouvre ' + when + ' à ' + fmtHour(HOURS[nd][0][0]) };
      }
    }
    return { open: false, label: 'Fermé' };
  }

  function initOpenBadges() {
    var badges = document.querySelectorAll('[data-open-badge]');
    if (!badges.length) return;
    var status = computeStatus(new Date());
    badges.forEach(function (b) {
      b.hidden = false;
      b.dataset.state = status.open ? 'open' : 'closed';
      var text = b.querySelector('.label');
      if (text) text.textContent = status.label;
    });
  }

  function highlightToday() {
    var today = new Date().getDay();
    document.querySelectorAll('[data-day]').forEach(function (row) {
      if (parseInt(row.getAttribute('data-day'), 10) === today) {
        row.classList.add('is-today');
      }
    });
  }

  /* ---------------------------------------------------------- navigation */
  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.nav-links');
    if (!toggle || !links) return;
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------------------------------------------------------- reveal on scroll
     Tout est visible par défaut (voir CSS .reveal). On ne masque que ce qui
     est déjà hors écran au chargement, jamais le premier écran. Les éléments
     qui partagent un même parent (une grille de cartes, par ex.) reçoivent
     un index --reveal-i pour apparaître en cascade plutôt que tous à la fois. */
  function initReveal() {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = document.querySelectorAll('.reveal');
    if (!items.length || reduced || !('IntersectionObserver' in window)) return;

    var counts = new Map();
    items.forEach(function (el) {
      var parent = el.parentElement;
      var i = counts.get(parent) || 0;
      el.style.setProperty('--reveal-i', i);
      counts.set(parent, i + 1);

      var rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.92) el.classList.add('pre');
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('pre');
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------- fond animé
     Trois halos dérivent doucement pendant le défilement, et l'en-tête
     bascule en variante claire lorsqu'une section sombre passe dessous —
     comme sur les pages produit d'Apple, en restant très discret. */
  function initScrollScene() {
    var scene = document.querySelector('.bg-scene');
    var header = document.querySelector('.site-header');
    if (!scene && !header) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var blobs = scene ? scene.querySelectorAll('span') : [];
    var darkSections = document.querySelectorAll('[data-theme="dark"]');
    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var progress = max > 0 ? window.scrollY / max : 0;

      if (!reduced) {
        blobs.forEach(function (b, i) {
          var drift = (progress - 0.5) * (36 + i * 16);
          b.style.transform = 'translateY(' + drift.toFixed(1) + 'px)';
        });
      }

      if (header && darkSections.length) {
        var headerBottom = header.getBoundingClientRect().bottom;
        var onDark = false;
        darkSections.forEach(function (s) {
          var r = s.getBoundingClientRect();
          if (headerBottom > r.top && headerBottom < r.bottom) onDark = true;
        });
        header.classList.toggle('on-dark', onDark);
        document.body.dataset.scene = onDark ? 'dark' : 'light';
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  /* ---------------------------------------------------------- parallaxe héro
     Léger déplacement de la photo héro pendant le défilement — subtil,
     jamais au point de gêner la lecture, et désactivé si l'utilisateur
     préfère moins de mouvement. */
  function initHeroParallax() {
    var img = document.querySelector('.hero-art img');
    if (!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var wrap = img.closest('.hero-art');
    var ticking = false;

    function update() {
      ticking = false;
      var rect = wrap.getBoundingClientRect();
      var offset = rect.top * 0.06;
      img.style.transform = 'translateY(' + offset.toFixed(1) + 'px) scale(1.08)';
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  function initInkDividers() {
    var dividers = document.querySelectorAll('.ink-divider');
    if (!dividers.length || !('IntersectionObserver' in window)) {
      dividers.forEach(function (d) { d.classList.add('drawn'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('drawn');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    dividers.forEach(function (d) { io.observe(d); });
  }

  /* ---------------------------------------------------------- réservation
     Le formulaire fonctionne sans JS (action mailto natif + attributs
     required/min/max du HTML). Le JS ajoute une validation plus fine et
     un message de confirmation avant l'ouverture du client mail. */
  function initReservationForm() {
    var form = document.getElementById('reservation-form');
    if (!form) return;

    var dateInput = form.querySelector('#date');
    if (dateInput) {
      var today = new Date();
      var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      dateInput.setAttribute('min', iso);
    }

    var statusEl = form.querySelector('.form-status');

    function setError(field, message) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.add('invalid');
      var err = wrap.querySelector('.error');
      if (err) err.textContent = message;
    }
    function clearError(field) {
      var wrap = field.closest('.field');
      if (wrap) wrap.classList.remove('invalid');
    }

    form.addEventListener('submit', function (e) {
      var valid = true;
      var fields = form.querySelectorAll('input[required], select[required], textarea[required]');
      fields.forEach(clearError);

      fields.forEach(function (field) {
        if (!field.value.trim()) {
          setError(field, 'Ce champ est requis.');
          valid = false;
        }
      });

      var dateField = form.querySelector('#date');
      var guestsField = form.querySelector('#guests');

      if (dateField && dateField.value) {
        var picked = new Date(dateField.value + 'T00:00:00');
        var day = picked.getDay();
        if (!HOURS[day].length) {
          setError(dateField, 'Le restaurant est fermé le ' + DAY_NAMES[day] + '. Merci de choisir un autre jour.');
          valid = false;
        }
      }

      if (guestsField && guestsField.value && (guestsField.value < 1 || guestsField.value > 20)) {
        setError(guestsField, 'Pour un groupe de plus de 20 personnes, merci de nous appeler directement.');
        valid = false;
      }

      if (!valid) {
        e.preventDefault();
        if (statusEl) {
          statusEl.textContent = 'Merci de corriger les champs signalés ci-dessus.';
          statusEl.className = 'form-status show err';
        }
        var firstInvalid = form.querySelector('.invalid input, .invalid select');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (statusEl) {
        statusEl.textContent = 'Votre client de messagerie va s’ouvrir avec votre demande pré-remplie — il ne reste qu’à l’envoyer.';
        statusEl.className = 'form-status show ok';
      }
      /* La soumission continue normalement vers l'action mailto: du formulaire. */
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initOpenBadges();
    highlightToday();
    initNav();
    initReveal();
    initInkDividers();
    initReservationForm();
    initScrollScene();
    initHeroParallax();
  });
})();
