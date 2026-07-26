/**
 * Season registry loader.
 * Reads /content/seasons.json, activates matching seasons, loads CSS/effects.
 *
 * Test / force (hors dates) :
 *   ?season=sakura
 *   ?season=halloween
 *   ?season=sakura,halloween
 *   ?season=off          → aucune saison
 * Console :
 *   SushiSeasons.force('halloween')
 *   SushiSeasons.force('sakura')
 *   SushiSeasons.clearForce()
 */
(function () {
  'use strict';

  var DEFAULT_LOGO = '/assets/logo.png';
  var FORCE_KEY = 'sushi_season_force';
  var active = [];
  var catalog = [];

  function todayMD() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return m + '-' + day;
  }

  function inWindow(md, start, end) {
    if (start <= end) return md >= start && md <= end;
    return md >= start || md <= end;
  }

  function isActiveByDate(season, md) {
    var windows = season.windows || [];
    for (var i = 0; i < windows.length; i++) {
      if (inWindow(md, windows[i].start, windows[i].end)) return true;
    }
    return false;
  }

  function parseForceList() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get('season');
      if (fromUrl !== null) {
        if (!fromUrl || fromUrl === 'off' || fromUrl === 'none') return [];
        return fromUrl
          .split(',')
          .map(function (s) { return s.trim().toLowerCase(); })
          .filter(Boolean);
      }
    } catch (e) {}

    try {
      var saved = localStorage.getItem(FORCE_KEY);
      if (saved === 'off') return [];
      if (saved) {
        return saved
          .split(',')
          .map(function (s) { return s.trim().toLowerCase(); })
          .filter(Boolean);
      }
    } catch (e) {}

    return null; // null = follow calendar
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function loadCss(href) {
    if (document.querySelector('link[data-season-css="' + href + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.seasonCss = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-season-js="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.dataset.seasonJs = src;
      s.onload = function () { resolve(); };
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function updateLogo(season) {
    var logoEl = document.getElementById('mainLogo');
    if (!logoEl) return;
    logoEl.src = season && season.logo ? season.logo : DEFAULT_LOGO;
  }

  function renderToggle(season) {
    var host = document.getElementById('seasonToggleHost');
    if (!host || !season.toggle) return;

    var wrap = document.createElement('div');
    wrap.className = 'switch-container popup-switch';
    wrap.id = 'seasonSwitch_' + season.id;
    wrap.innerHTML =
      '<span>' + (season.toggleLabel || season.label) + '</span>' +
      '<label class="switch">' +
      '<input type="checkbox" id="seasonToggle_' + season.id + '" />' +
      '<span class="slider round"></span>' +
      '</label>';
    host.appendChild(wrap);

    var input = document.getElementById('seasonToggle_' + season.id);
    if (!input) return;

    var key = 'sushi_season_toggle_' + season.id;
    var saved = localStorage.getItem(key);
    var enabled = saved === null ? true : saved === '1';
    input.checked = enabled;

    function apply() {
      document.dispatchEvent(
        new CustomEvent('sushi:season-toggle', {
          detail: { id: season.id, enabled: input.checked }
        })
      );
      localStorage.setItem(key, input.checked ? '1' : '0');
    }

    input.addEventListener('change', apply);
    apply();
  }

  async function activate(season, forced) {
    if (active.some(function (s) { return s.id === season.id; })) return;

    var copy = Object.assign({}, season);
    if (forced && copy.id === 'halloween') {
      copy.toggle = true;
      copy.toggleLabel = copy.toggleLabel || 'Effets Halloween';
    }

    active.push(copy);
    if (copy.bodyClass) document.body.classList.add(copy.bodyClass);
    if (copy.css) loadCss(copy.css);
    if (copy.logo) updateLogo(copy);
    renderToggle(copy);

    var skipFx = copy.reducedMotionDisablesEffect && prefersReducedMotion();
    if (copy.effect && !skipFx) {
      try {
        await loadScript(copy.effect);
      } catch (e) {
        console.warn('Season effect failed', copy.id, e);
      }
    }
  }

  async function boot() {
    try {
      var res = await fetch('/content/seasons.json', { cache: 'no-cache' });
      if (!res.ok) return;
      var data = await res.json();
      catalog = data.seasons || [];
      var force = parseForceList();
      var md = todayMD();
      var host = document.getElementById('seasonToggleHost');
      if (host) host.innerHTML = '';

      if (force !== null) {
        for (var i = 0; i < catalog.length; i++) {
          if (force.indexOf(catalog[i].id) !== -1) {
            await activate(catalog[i], true);
          }
        }
        if (force.length) {
          console.info('[SushiSeasons] mode test:', force.join(', '));
        } else {
          console.info('[SushiSeasons] mode test: aucune saison');
        }
      } else {
        for (var j = 0; j < catalog.length; j++) {
          if (isActiveByDate(catalog[j], md)) await activate(catalog[j], false);
        }
      }

      if (!active.some(function (s) { return s.logo; })) updateLogo(null);

      var logoEl = document.getElementById('mainLogo');
      if (logoEl) {
        new MutationObserver(function () {
          var hallo = active.find(function (s) { return s.id === 'halloween'; });
          if (document.body.classList.contains('halloween') && hallo && hallo.logo) {
            logoEl.src = hallo.logo;
          } else if (!document.body.classList.contains('halloween')) {
            logoEl.src = DEFAULT_LOGO;
          }
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    } catch (e) {
      console.warn('seasons boot failed', e);
    }
  }

  function reloadWithForce(ids) {
    try {
      if (ids === null) localStorage.removeItem(FORCE_KEY);
      else if (!ids.length) localStorage.setItem(FORCE_KEY, 'off');
      else localStorage.setItem(FORCE_KEY, ids.join(','));
    } catch (e) {}
    var url = new URL(window.location.href);
    if (ids === null) url.searchParams.delete('season');
    else if (!ids.length) url.searchParams.set('season', 'off');
    else url.searchParams.set('season', ids.join(','));
    window.location.href = url.toString();
  }

  window.SushiSeasons = {
    getActive: function () { return active.slice(); },
    list: function () { return catalog.slice(); },
    force: function (idOrList) {
      var ids = Array.isArray(idOrList) ? idOrList : [idOrList];
      reloadWithForce(ids.map(String));
    },
    clearForce: function () {
      reloadWithForce(null);
    },
    register: function () {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
