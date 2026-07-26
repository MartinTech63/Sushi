/**
 * Render the menu from /content/menu.json into #menuRoot.
 * Dispatches `sushi:menu-ready` when done so order/select-ui can bind.
 */
(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function itemLabel(item) {
    var label = item.code ? item.code + ' | ' + item.name : item.name;
    if (item.note) {
      label += ' <span class="menu-item-note">' + escapeHtml(item.note) + '</span>';
    }
    return label;
  }

  function renderStandardItem(item) {
    return (
      '<article class="menu-item" data-item-id="' + escapeHtml(item.id) + '">' +
      '<div class="menu-item-main">' +
      '<img src="/assets/' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" loading="lazy" width="72" height="72" />' +
      '<span class="menu-item-name">' + itemLabel(item) + '</span>' +
      '</div>' +
      '<div class="menu-item-actions">' +
      '<input type="checkbox" name="' + escapeHtml(item.id) + '" />' +
      '<input type="number" name="quantity_' + escapeHtml(item.id) + '" min="0" max="' + (item.max || 10) + '" value="0" inputmode="numeric" />' +
      '</div>' +
      '</article>'
    );
  }

  function renderFlavorItem(item) {
    var flavors = (item.flavors || [])
      .map(function (f) {
        var fid = item.id + '_' + f.id;
        var qid = 'quantity_' + fid;
        return (
          '<div class="menu-item-flavor">' +
          '<span class="menu-item-flavor-label">' + escapeHtml(f.label) + '</span>' +
          '<div class="menu-item-actions">' +
          '<input type="checkbox" name="' + escapeHtml(fid) + '" data-target="' + escapeHtml(qid) + '" />' +
          '<input type="number" id="' + escapeHtml(qid) + '" name="' + escapeHtml(qid) + '" min="0" max="' + (item.max || 10) + '" value="0" inputmode="numeric" />' +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<article class="menu-item menu-item--flavors" data-item-id="' + escapeHtml(item.id) + '">' +
      '<div class="menu-item-main">' +
      '<img src="/assets/' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" loading="lazy" width="72" height="72" />' +
      '<span class="menu-item-name">' + escapeHtml(item.name) + '</span>' +
      '</div>' +
      '<div class="menu-item-flavors">' + flavors + '</div>' +
      '</article>'
    );
  }

  function renderCategory(cat) {
    var items = (cat.items || [])
      .map(function (item) {
        return item.flavors ? renderFlavorItem(item) : renderStandardItem(item);
      })
      .join('');
    return (
      '<section id="' + escapeHtml(cat.id) + '" class="menu-section">' +
      '<h2>' + escapeHtml(cat.title) + '</h2>' +
      items +
      '</section>'
    );
  }

  async function boot() {
    var root = document.getElementById('menuRoot');
    if (!root) return;

    try {
      var res = await fetch('/content/menu.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('menu_load_failed');
      var data = await res.json();
      var html = (data.categories || []).map(renderCategory).join('');
      root.innerHTML = '<div class="container menu-container">' + html + '</div>';
      document.dispatchEvent(new CustomEvent('sushi:menu-ready'));
    } catch (e) {
      root.innerHTML = '<p class="menu-load-error">Impossible de charger la carte.</p>';
      console.error(e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
