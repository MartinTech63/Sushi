
// SCRIPTS/select-ui.js — v2 (inclut les glaces avec data-target)
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

    // Insertion : 
    // - Cas glaces (avec data-target) -> bouton après le <label> pour garder l'ordre "texte / bouton / quantité"
    // - Cas général -> après la checkbox (avant le number)
    const label = cb.closest('label');
    if (label) {
      label.insertAdjacentElement('afterend', btn);
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

  function init(root = document) {
    root.querySelectorAll('.menu-item input[type="checkbox"]').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
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
  }).observe(document.body, { childList: true, subtree: true });
})();
