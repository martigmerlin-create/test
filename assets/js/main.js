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

  /* ---------------------------------------------------------- navigation
     Le menu est un <details>/<summary> : il s'ouvre et se ferme nativement
     au clic, sans JavaScript. Le JS ajoute seulement des fermetures
     supplémentaires (clic extérieur, Échap, clic sur un lien) pour un
     comportement plus proche d'un menu d'application. */
  function initNav() {
    var menu = document.querySelector('.nav-menu');
    if (!menu) return;

    function close() { menu.removeAttribute('open'); }

    document.addEventListener('click', function (e) {
      if (menu.hasAttribute('open') && !menu.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    menu.querySelectorAll('.nav-dropdown a').forEach(function (a) {
      a.addEventListener('click', close);
    });
  }

  /* ---------------------------------------------------------- reveal on scroll
     Tout est visible par défaut (voir CSS .reveal). On ne masque que ce qui
     est déjà hors écran au chargement, jamais le premier écran. */
  function initReveal() {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = document.querySelectorAll('.reveal');
    if (!items.length || reduced || !('IntersectionObserver' in window)) return;

    items.forEach(function (el) {
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
  });
})();
