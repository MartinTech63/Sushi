
/* select-ui.js — pills Ajouter / Ajouté */
(function () {
  function enhance(cb) {
    if (cb.dataset.enhanced === '1') return;

    // Crée le bouton pill
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'select-btn';
    const item = cb.closest('.menu-item');

    function setItemSelectedClass() {
      if (!item) return;
      // is-selected si AU MOINS une checkbox de l'item est cochée
      const anyChecked = item.querySelector('input[type="checkbox"]:checked');
      item.classList.toggle('is-selected', !!anyChecked);
    }

    function render() {
      const checked = cb.checked;
      btn.classList.toggle('select-btn--checked', checked);
      btn.setAttribute('aria-pressed', checked ? 'true' : 'false');
      btn.textContent = checked ? 'Ajouté' : 'Ajouter';
      setItemSelectedClass();
    }

    // Insertion : après la checkbox, dans .menu-item-actions si présent
    const actions = cb.closest('.menu-item-actions');
    const label = cb.closest('label');
    if (label) {
      label.insertAdjacentElement('afterend', btn);
    } else if (actions) {
      cb.insertAdjacentElement('afterend', btn);
    } else {
      cb.insertAdjacentElement('afterend', btn);
    }

    // Cache visuellement la checkbox (accessibilité OK)
    cb.classList.add('visually-hidden');
    cb.dataset.enhanced = '1';

    // Clic sur bouton -> toggle checkbox + déclenche 'change' (tes listeners gèrent quantité etc.)
    btn.addEventListener('click', () => {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      render();
    });

    // Si la checkbox change autrement (ex: quantité modifiée), on met à jour
    cb.addEventListener('change', render);

    // Rendu initial
    render();
  }

  function init(root) {
    root = root || document;
    root.querySelectorAll('.menu-item input[type="checkbox"]').forEach(enhance);
  }

  document.addEventListener('sushi:menu-ready', function () {
    init(document.getElementById('menuRoot') || document);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.querySelector('.menu-item')) init();
    });
  } else if (document.querySelector('.menu-item')) {
    init();
  }

  // Si de nouveaux items arrivent dynamiquement
  new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('.menu-item')) init(node);
        else node.querySelectorAll?.('.menu-item').forEach(init);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();


//reset ui

(function () {
  'use strict';

  function triggerUISync() {
    // Rafraîchit uniquement l’UI (pills / sync checkbox) sans écraser les quantités.
    document.querySelectorAll('.menu-item input[type="number"]').forEach(n => {
      n.dispatchEvent(new Event('input', { bubbles: true }));
      n.dispatchEvent(new Event('change', { bubbles: true }));
    });

    document.querySelectorAll('.menu-item input[type="checkbox"]').forEach(cb => {
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function wrapReset() {
    const orig = window.resetOrder;
    if (typeof orig !== 'function') return false;

    if (orig.__wrapped_by_ui_patch) return true;

    window.resetOrder = function wrappedResetOrder() {
      const res = orig.apply(this, arguments);
      // Assure-toi que l'UI est sync juste après
      requestAnimationFrame(triggerUISync);
      return res;
    };
    window.resetOrder.__wrapped_by_ui_patch = true;
    return true;
  }

  // Tente immédiatement, puis au DOM ready si resetOrder n'est pas encore défini
  if (!wrapReset()) {
    document.addEventListener('DOMContentLoaded', wrapReset, { once: true });
  }

  // Au cas où le reset se ferait autrement (form reset, etc.), expose manuellement :
  window.__forceSelectionUISync = triggerUISync;
})();