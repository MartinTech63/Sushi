(function () {
  'use strict';

  const LS_TABLE_CODE = 'sushi_table_code';
  const LS_CLIENT_TOKEN = 'sushi_client_token';
  const LS_NICKNAME = 'sushi_nickname';

  function $(id) {
    return document.getElementById(id);
  }

  function toast(message, isError) {
    const host = $('toastHost');
    if (!host) {
      window.alert(message);
      return;
    }
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast--error' : '');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2600);
  }

  function getSession() {
    return {
      tableCode: localStorage.getItem(LS_TABLE_CODE),
      clientToken: localStorage.getItem(LS_CLIENT_TOKEN),
      nickname: localStorage.getItem(LS_NICKNAME)
    };
  }

  function setSession(data) {
    localStorage.setItem(LS_TABLE_CODE, data.tableCode);
    localStorage.setItem(LS_CLIENT_TOKEN, data.clientToken);
    localStorage.setItem(LS_NICKNAME, data.nickname);
  }

  function clearSession() {
    localStorage.removeItem(LS_TABLE_CODE);
    localStorage.removeItem(LS_CLIENT_TOKEN);
    localStorage.removeItem(LS_NICKNAME);
  }

  function hasSession() {
    const s = getSession();
    return !!(s.tableCode && s.clientToken);
  }

  function tableInviteUrl(tableCode) {
    const url = new URL(window.location.href);
    url.searchParams.set('table', tableCode);
    url.hash = 'table';
    return url.toString();
  }

  async function apiCreateTableAndJoin(nickname, requestedCode) {
    const payload = {};
    if (requestedCode) payload.code = requestedCode;
    const resCreate = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resCreate.ok) throw new Error('Impossible de créer une table');
    const created = await resCreate.json();

    const resJoin = await fetch('/api/tables/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: created.code, nickname })
    });
    if (!resJoin.ok) throw new Error('Impossible de rejoindre la table créée');
    return resJoin.json();
  }

  async function apiJoinTable(code, nickname) {
    const resJoin = await fetch('/api/tables/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname })
    });
    if (!resJoin.ok) throw new Error('Code de table invalide');
    return resJoin.json();
  }

  let submitting = false;

  async function submitOrderToTable() {
    const { tableCode, clientToken } = getSession();
    if (!tableCode || !clientToken) {
      toast('Rejoins d’abord une table.', true);
      setActiveTab('table');
      return;
    }
    if (typeof window.getCurrentOrderItems !== 'function') {
      toast('Commande pas prête.', true);
      return;
    }

    const items = window.getCurrentOrderItems();
    if (!items.length) {
      toast('Ajoute au moins un plat avant d’envoyer.', true);
      return;
    }

    if (submitting) return;
    submitting = true;
    setSendBusy(true);
    setStickyHint('Envoi…');

    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableCode)}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + clientToken
        },
        body: JSON.stringify({ items })
      });

      if (!res.ok) {
        const txt = await res.text().catch(function () { return ''; });
        let detail = txt;
        try {
          const parsed = JSON.parse(txt);
          if (parsed && parsed.detail) detail = String(parsed.detail);
        } catch (e) {}
        throw new Error(detail || 'Envoi impossible');
      }

      toast('Commande envoyée');
      setStickyHint('Envoyée — live à jour');
    } catch (e) {
      toast(e && e.message ? e.message : 'Envoi impossible', true);
      setStickyHint('Échec — réessaie');
    } finally {
      submitting = false;
      setSendBusy(false);
    }
  }

  function setSendBusy(busy) {
    const stickyBtn = $('tableStickySendBtn');
    const panelBtn = $('submitOrderBtn');
    if (stickyBtn) stickyBtn.disabled = !!busy;
    if (panelBtn) panelBtn.disabled = !!busy;
  }

  function setStickyHint(text) {
    const hint = $('tableStickyHint');
    if (hint) hint.textContent = text;
  }

  function updateStickyBar() {
    const bar = $('tableStickyBar');
    const codeEl = $('tableStickyCode');
    if (!bar) return;

    const session = getSession();
    const show = !!(session.tableCode && session.clientToken);
    bar.hidden = !show;
    document.body.classList.toggle('has-table-sticky', show);
    if (show && codeEl) codeEl.textContent = session.tableCode;
    if (typeof window.adjustButtonPosition === 'function') {
      window.adjustButtonPosition();
    } else if (typeof adjustButtonPosition === 'function') {
      adjustButtonPosition();
    }
  }

  function wsUrl(tableCode) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}/ws/${encodeURIComponent(tableCode)}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function computeTotal(items) {
    return (items || []).reduce(function (sum, it) {
      return sum + (parseInt(it.quantity, 10) || 0);
    }, 0);
  }

  let ws = null;
  let reconnectTimer = null;
  let reconnectEnabled = true;
  let activeWsTableCode = null;
  let heartbeatTimer = null;
  let reconnectAttempt = 0;
  let intentionalClose = false;

  function setLivePill(online) {
    const pill = $('tableLivePill');
    if (!pill) return;
    pill.textContent = online ? 'live' : 'hors-ligne';
    pill.classList.toggle('is-offline', !online);
  }

  function setLiveStatus(text) {
    const statusText = $('tableLiveStatus');
    if (statusText) statusText.textContent = text;
  }

  function applyLiveSummary(payload) {
    renderTableSummary(payload);
    const totalQty = computeTotal(payload && payload.items);
    setStickyHint('Live · ' + totalQty + ' pièce' + (totalQty > 1 ? 's' : ''));
    setLivePill(true);
  }

  function cleanupHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function startHeartbeat() {
    cleanupHeartbeat();
    heartbeatTimer = setInterval(function () {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send('ping');
      } catch (e) {}
    }, 25000);
  }

  function renderTableSummary(payload) {
    const itemsRoot = $('tableSummaryItems');
    const clientsRoot = $('tableSummaryClients');
    if (!itemsRoot || !clientsRoot) return;
    if (!payload || !Array.isArray(payload.items)) return;

    const totalQty = computeTotal(payload.items);
    let html = `<div class="table-total-line">Total : ${totalQty} pièce${totalQty > 1 ? 's' : ''}</div>`;

    if (payload.items.length === 0) {
      html += '<div class="table-empty">Aucun plat pour le moment.</div>';
    } else {
      payload.items.forEach(function (it) {
        html +=
          `<div class="table-row">` +
          `<span class="table-row-name">${escapeHtml(it.name)}</span>` +
          `<span class="table-row-qty">×${it.quantity}</span>` +
          `</div>`;
      });
    }
    itemsRoot.innerHTML = html;

    const clients = Array.isArray(payload.clients) ? payload.clients : [];
    if (clients.length === 0) {
      clientsRoot.innerHTML = '<div class="table-empty">En attente des commandes…</div>';
      return;
    }

    clientsRoot.innerHTML = clients
      .map(function (cl) {
        const nickname = cl && cl.nickname ? String(cl.nickname) : '—';
        const items = Array.isArray(cl.items) ? cl.items : [];
        const qty = computeTotal(items);
        const lis = items
          .map(function (it) {
            return `<li>${escapeHtml(it.name)} ×${it.quantity}</li>`;
          })
          .join('');
        return (
          `<article class="table-person">` +
          `<div class="table-person-head">` +
          `<span class="table-person-name">${escapeHtml(nickname)}</span>` +
          `<span class="table-person-qty">${qty} pièce${qty > 1 ? 's' : ''}</span>` +
          `</div>` +
          `<ul class="table-person-items">${lis}</ul>` +
          `</article>`
        );
      })
      .join('');
  }

  function nextReconnectDelayMs() {
    const base = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt));
    reconnectAttempt += 1;
    return base + Math.floor(Math.random() * 400);
  }

  function scheduleReconnect(tableCode) {
    if (!reconnectEnabled || !tableCode) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = nextReconnectDelayMs();
    const secs = Math.ceil(delay / 1000);
    setLiveStatus('Connexion perdue · nouvel essai dans ' + secs + 's');
    setStickyHint('Hors-ligne · retry ' + secs + 's');
    setLivePill(false);
    reconnectTimer = setTimeout(function () {
      connectWS(tableCode);
    }, delay);
  }

  function connectWS(tableCode) {
    if (!tableCode) return;

    if (
      ws &&
      activeWsTableCode === tableCode &&
      (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    intentionalClose = true;
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
      ws = null;
    }
    intentionalClose = false;

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    setLiveStatus('Connexion…');

    let socket;
    try {
      socket = new WebSocket(wsUrl(tableCode));
    } catch (e) {
      scheduleReconnect(tableCode);
      return;
    }

    ws = socket;
    activeWsTableCode = tableCode;

    socket.onopen = function () {
      if (ws !== socket) return;
      reconnectAttempt = 0;
      setLiveStatus('Connecté · mise à jour auto');
      setLivePill(true);
      setStickyHint('Live · en attente');
      startHeartbeat();
    };

    socket.onmessage = function (event) {
      if (ws !== socket) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.type === 'summary') {
          applyLiveSummary(msg);
          setLiveStatus('Connecté · mise à jour auto');
        }
        if (msg && msg.type === 'error' && msg.detail === 'rate_limited') {
          setLiveStatus('Serveur saturé · pause…');
          setLivePill(false);
          setStickyHint('Pause réseau');
        }
      } catch (e) {}
    };

    socket.onerror = function () {
      if (ws !== socket) return;
      cleanupHeartbeat();
      setLivePill(false);
    };

    socket.onclose = function () {
      if (ws !== socket) return;
      cleanupHeartbeat();
      ws = null;
      setLivePill(false);
      if (intentionalClose || !reconnectEnabled) return;
      const session = getSession();
      if (!session.tableCode) return;
      scheduleReconnect(session.tableCode);
    };
  }

  function stopWS() {
    reconnectEnabled = false;
    intentionalClose = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    cleanupHeartbeat();
    try {
      if (ws) ws.close();
    } catch (e) {}
    ws = null;
    activeWsTableCode = null;
    reconnectAttempt = 0;
  }

  function ensureWSForSession() {
    const session = getSession();
    if (!session.tableCode || !session.clientToken) {
      stopWS();
      return;
    }
    reconnectEnabled = true;
    connectWS(session.tableCode);
  }

  function showLiveSessionUI() {
    const session = getSession();
    const codeText = $('tableCodeBadgeText');
    const nickText = $('tableNicknameBadgeText');
    const authBox = $('tableAuthBox');
    const liveBox = $('tableLiveBox');
    if (!session.tableCode || !session.clientToken) return;

    if (codeText) codeText.textContent = session.tableCode;
    if (nickText) nickText.textContent = session.nickname || '-';
    if (authBox) authBox.hidden = true;
    if (liveBox) liveBox.hidden = false;
  }

  const tabCarteBtn = $('tabCarteBtn');
  const tabTableBtn = $('tabTableBtn');
  let currentTab = 'carte';
  const orderSummaryBtn = $('orderSummaryBtn');
  const resetBtn = $('resetBtn');

  function setMainMenuButtonsVisible(visible) {
    var actions = $('fabActions');
    if (actions) actions.hidden = !visible;
    if (orderSummaryBtn) orderSummaryBtn.style.display = visible ? '' : 'none';
    if (resetBtn) resetBtn.style.display = visible ? '' : 'none';
  }

  function setClassicVisible(visible) {
    var root = document.getElementById('menuRoot');
    if (root) root.style.display = visible ? '' : 'none';
    document.querySelectorAll('.menu-section').forEach(function (el) {
      el.style.display = visible ? '' : 'none';
    });
  }

  function setTabButtonsActive(tab) {
    if (tabCarteBtn) {
      tabCarteBtn.classList.toggle('is-active', tab === 'carte');
      tabCarteBtn.style.backgroundColor = '';
    }
    if (tabTableBtn) {
      tabTableBtn.classList.toggle('is-active', tab === 'table');
      tabTableBtn.style.backgroundColor = '';
    }
  }

  function setActiveTab(tab) {
    currentTab = tab;
    setTabButtonsActive(tab);

    const panel = $('tableSummaryPanel');
    if (!panel) return;

    if (tab === 'carte') {
      setMainMenuButtonsVisible(true);
      panel.hidden = true;
      setClassicVisible(true);
      updateStickyBar();
      // Garde le WS ouvert si session : évite le spam de reconnexions Carte↔Table.
      if (hasSession()) {
        ensureWSForSession();
        setStickyHint('Live · en attente');
      } else {
        stopWS();
        setLiveStatus('Aucune table active.');
      }
      return;
    }

    setMainMenuButtonsVisible(false);
    setClassicVisible(false);
    panel.hidden = false;

    const authBox = $('tableAuthBox');
    const liveBox = $('tableLiveBox');
    const session = getSession();

    if (!session.tableCode || !session.clientToken) {
      if (authBox) authBox.hidden = false;
      if (liveBox) liveBox.hidden = true;
      setLiveStatus('Aucune table active.');
      stopWS();
      updateStickyBar();
      return;
    }

    showLiveSessionUI();
    ensureWSForSession();
    updateStickyBar();
    setStickyHint('Live · en attente');

    requestAnimationFrame(function () {
      try {
        panel.scrollIntoView({ block: 'start' });
      } catch (e) {}
    });
  }

  async function shareTable() {
    const session = getSession();
    if (!session.tableCode) {
      toast('Aucune table active.', true);
      return;
    }
    const url = tableInviteUrl(session.tableCode);
    const text = `Rejoins ma table sushi : ${session.tableCode}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Table Sushi', text: text, url: url });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié');
    } catch (e) {
      toast('Code : ' + session.tableCode);
    }
  }

  function leaveTable() {
    stopWS();
    clearSession();

    const panel = $('tableSummaryPanel');
    const authBox = $('tableAuthBox');
    const liveBox = $('tableLiveBox');
    if (panel && currentTab !== 'table') panel.hidden = true;
    if (authBox) authBox.hidden = false;
    if (liveBox) liveBox.hidden = true;
    setLiveStatus('Aucune table active.');
    updateStickyBar();
    toast('Table quittée');
  }

  window.submitOrderToTable = submitOrderToTable;

  function setupOverlay() {
    const createBtn = $('createTableBtn');
    const joinBtn = $('joinTableBtn');
    const shareBtn = $('shareTableBtn');
    const leaveBtn = $('leaveTableBtn');
    const stickySend = $('tableStickySendBtn');
    const panelSend = $('submitOrderBtn');
    const nicknameInput = $('tableNicknameInput');
    const codeInput = $('tableCodeInput');

    if (leaveBtn) leaveBtn.onclick = leaveTable;
    if (shareBtn) shareBtn.onclick = shareTable;
    if (stickySend) stickySend.onclick = submitOrderToTable;
    if (panelSend) panelSend.onclick = submitOrderToTable;

    if (!createBtn || !joinBtn || !nicknameInput || !codeInput) return;

    createBtn.onclick = async function () {
      const nickname = (nicknameInput.value || '').trim();
      if (!nickname) return toast('Saisis un pseudo.', true);

      createBtn.disabled = true;
      try {
        const requestedCode = (codeInput.value || '').trim().toUpperCase();
        const joined = await apiCreateTableAndJoin(
          nickname,
          requestedCode ? requestedCode : null
        );
        setSession(joined);
        toast('Table ' + joined.tableCode + ' créée');
        setActiveTab('table');
      } catch (e) {
        toast(e && e.message ? e.message : 'Erreur', true);
      } finally {
        createBtn.disabled = false;
      }
    };

    joinBtn.onclick = async function () {
      const nickname = (nicknameInput.value || '').trim();
      const code = (codeInput.value || '').trim().toUpperCase();

      if (!nickname) return toast('Saisis un pseudo.', true);
      if (!code) return toast('Saisis un code de table.', true);

      joinBtn.disabled = true;
      try {
        const joined = await apiJoinTable(code, nickname);
        setSession(joined);
        toast('Table ' + joined.tableCode + ' rejointe');
        setActiveTab('table');
      } catch (e) {
        toast(e && e.message ? e.message : 'Erreur', true);
      } finally {
        joinBtn.disabled = false;
      }
    };
  }

  function applyInviteFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = (params.get('table') || '').trim().toUpperCase();
      if (!code) return false;
      const codeInput = $('tableCodeInput');
      if (codeInput && !codeInput.value) codeInput.value = code;
      return true;
    } catch (e) {
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupOverlay();

    (function setMenuOffset() {
      var nav = document.querySelector('nav.nav-bar');
      if (!nav) return;
      var navRect = nav.getBoundingClientRect();
      // Popup / overlays: bas réel de la nav dans le viewport
      document.documentElement.style.setProperty('--menu-offset', navRect.bottom + 'px');
      // Spacer dans le flux (après le header) : hauteur de la nav seule
      var spacer = document.getElementById('menuSpacer');
      if (spacer) spacer.style.height = nav.offsetHeight + 'px';
    })();

    if (tabCarteBtn) {
      tabCarteBtn.addEventListener('click', function (e) {
        e.preventDefault();
        setActiveTab('carte');
      });
    }

    if (tabTableBtn) {
      tabTableBtn.addEventListener('click', function (e) {
        e.preventDefault();
        setActiveTab('table');
      });
    }

    const invited = applyInviteFromUrl();
    const hashTable =
      window.location.hash && window.location.hash.toLowerCase().indexOf('table') !== -1;
    const initialTab = invited || hashTable ? 'table' : 'carte';
    setActiveTab(initialTab);
    updateStickyBar();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        // Pause propre sans storm de reconnect pendant que l'app est en arrière-plan.
        intentionalClose = true;
        reconnectEnabled = false;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        cleanupHeartbeat();
        try {
          if (ws) ws.close();
        } catch (e) {}
        ws = null;
        activeWsTableCode = null;
      } else if (hasSession()) {
        ensureWSForSession();
      }
    });

    (function adjustNav() {
      var nav = document.querySelector('nav.nav-bar');
      var header = document.querySelector('.site-header');
      if (!nav || !header) return;

      function update() {
        var headerBottom = header.getBoundingClientRect().bottom;
        if (headerBottom > 0) nav.style.top = headerBottom + 'px';
        else nav.style.top = '0px';

        var navRect = nav.getBoundingClientRect();
        document.documentElement.style.setProperty('--menu-offset', navRect.bottom + 'px');
        var spacer = document.getElementById('menuSpacer');
        if (spacer) spacer.style.height = nav.offsetHeight + 'px';
      }

      update();
      window.addEventListener('scroll', function () {
        window.requestAnimationFrame(update);
      });
      window.addEventListener('resize', function () {
        window.requestAnimationFrame(update);
      });
    })();
  });
})();
