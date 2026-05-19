(function () {
  'use strict';

  const LS_TABLE_CODE = 'sushi_table_code';
  const LS_CLIENT_TOKEN = 'sushi_client_token';
  const LS_NICKNAME = 'sushi_nickname';

  function $(id) {
    return document.getElementById(id);
  }

  function getSession() {
    return {
      tableCode: localStorage.getItem(LS_TABLE_CODE),
      clientToken: localStorage.getItem(LS_CLIENT_TOKEN),
      nickname: localStorage.getItem(LS_NICKNAME)
    };
  }

  function setSession({ tableCode, clientToken, nickname }) {
    localStorage.setItem(LS_TABLE_CODE, tableCode);
    localStorage.setItem(LS_CLIENT_TOKEN, clientToken);
    localStorage.setItem(LS_NICKNAME, nickname);
  }

  function clearSession() {
    localStorage.removeItem(LS_TABLE_CODE);
    localStorage.removeItem(LS_CLIENT_TOKEN);
    localStorage.removeItem(LS_NICKNAME);
  }

  async function apiCreateTableAndJoin(nickname, requestedCode) {
    const payload = {};
    if (requestedCode) payload.code = requestedCode;
    const resCreate = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  async function submitOrderToTable() {
    const { tableCode, clientToken } = getSession();
    if (!tableCode || !clientToken) {
      alert('Veuillez d’abord rejoindre (ou créer) une table.');
      return;
    }
    if (typeof window.getCurrentOrderItems !== 'function') {
      alert('La récupération de votre commande n’est pas prête.');
      return;
    }

    const items = window.getCurrentOrderItems();
    const res = await fetch(`/api/tables/${encodeURIComponent(tableCode)}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + clientToken
      },
      body: JSON.stringify({ items })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      alert('Envoi impossible. ' + (txt || ''));
      return;
    }

    alert('Commande envoyée à la table.');
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
    return (items || []).reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
  }

  let ws = null;
  let reconnectTimer = null;
  let reconnectEnabled = true;
  let activeWsTableCode = null;
  let heartbeatTimer = null;

  function setLiveStatus(text) {
    const statusText = $('tableLiveStatus');
    if (statusText) statusText.textContent = text;
  }

  function cleanupHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function startHeartbeat() {
    cleanupHeartbeat();
    // Le serveur attend des messages texte; envoyer un "ping" évite les déconnexions par idle.
    heartbeatTimer = setInterval(function () {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send('ping');
      } catch (e) {}
    }, 25000);
  }

  function renderTableSummary(payload) {
    const itemsRoot = $('tableSummaryItems');
    const clientsRoot = $('tableSummaryClients');
    const panel = $('tableSummaryPanel');
    if (!itemsRoot || !clientsRoot || !panel) return;

    if (!payload || !Array.isArray(payload.items)) return;

    // Affichage onglet "Table" :
    // - Total global + total par plat (pour la fiche restaurant)
    // - Détails par personne (pseudos + ce que chacun a envoyé) pour éviter les confusions
    itemsRoot.innerHTML = '';
    const totalQty = computeTotal(payload.items);

    const totalLine = document.createElement('div');
    totalLine.style.color = '#333';
    totalLine.style.fontWeight = '700';
    totalLine.style.marginBottom = '10px';
    totalLine.textContent = `Quantité totale: ${totalQty}`;
    itemsRoot.appendChild(totalLine);

    const byPlatTitle = document.createElement('div');
    byPlatTitle.style.fontWeight = '700';
    byPlatTitle.style.color = '#333';
    byPlatTitle.style.marginBottom = '8px';
    byPlatTitle.textContent = 'Total par plat';
    itemsRoot.appendChild(byPlatTitle);

    const itemsList = document.createElement('div');
    itemsList.style.display = 'flex';
    itemsList.style.flexDirection = 'column';
    itemsList.style.gap = '8px';

    if (payload.items.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#777';
      empty.textContent = 'Aucun plat pour le moment.';
      itemsList.appendChild(empty);
    } else {
      payload.items.forEach((it) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.gap = '12px';
        row.style.padding = '6px 8px';
        row.style.border = '1px solid #eee';
        row.style.borderRadius = '10px';
        row.style.background = '#fff';

        row.innerHTML = `<span style="flex:1; color:#333; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(it.name)}</span><span style="color:#555; font-weight:700;">${it.quantity}</span>`;
        itemsList.appendChild(row);
      });
    }

    itemsRoot.appendChild(itemsList);

    // Commandes par personne (ici : uniquement les pseudos, pas le détail)
    clientsRoot.innerHTML = '';
    const clients = Array.isArray(payload.clients) ? payload.clients : [];
    if (clients.length === 0) {
      clientsRoot.innerHTML = '<div style="color:#777;">En attente de commandes des personnes sur la table.</div>';
    } else {
      const byUserTitle = document.createElement('div');
      byUserTitle.style.fontWeight = '700';
      byUserTitle.style.color = '#333';
      byUserTitle.style.marginBottom = '8px';
      byUserTitle.textContent = 'Personnes sur la table';
      clientsRoot.appendChild(byUserTitle);

      const nickList = document.createElement('div');
      nickList.style.display = 'flex';
      nickList.style.flexWrap = 'wrap';
      nickList.style.gap = '8px';

      clients.forEach((cl) => {
        const nickname = cl && cl.nickname ? String(cl.nickname) : '—';
        const nick = document.createElement('div');
        nick.style.border = '1px solid #eee';
        nick.style.borderRadius = '9999px';
        nick.style.padding = '8px 12px';
        nick.style.background = '#fff';
        nick.style.color = '#333';
        nick.style.fontWeight = '600';
        nick.textContent = nickname;
        nickList.appendChild(nick);
      });

      clientsRoot.appendChild(nickList);
    }
  }

  function connectWS(tableCode) {
    if (!tableCode) return;

    // Si on est déjà connecté sur la bonne table, ne pas recréer une connexion.
    if (
      ws &&
      activeWsTableCode === tableCode &&
      (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (ws) {
      try {
        ws.close();
      } catch (e) {}
      ws = null;
    }

    if (reconnectTimer) clearTimeout(reconnectTimer);
    setLiveStatus('Connexion en cours...');

    ws = new WebSocket(wsUrl(tableCode));
    activeWsTableCode = tableCode;

    ws.onopen = function () {
      setLiveStatus('Connecté. Mise à jour en temps réel.');
      startHeartbeat();
    };

    ws.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg && msg.type === 'summary') {
          renderTableSummary(msg);
        }
      } catch (e) {}
    };

    ws.onerror = function () {
      setLiveStatus('Erreur de connexion.');
    };

    ws.onclose = function () {
      if (!reconnectEnabled) return;
      const { tableCode: tc } = getSession();
      if (!tc) return;
      setLiveStatus('Déconnecté. Reconnexion...');
      cleanupHeartbeat();
      reconnectTimer = setTimeout(function () {
        connectWS(tc);
      }, 3000);
    };

    ws.onerror = function () {
      cleanupHeartbeat();
      // on laisse `onclose` déclencher la reconnexion contrôlée
    };
  }

  function showTablePanelFromSession() {
    const { tableCode, clientToken, nickname } = getSession();
    const panel = $('tableSummaryPanel');
    const codeText = $('tableCodeBadgeText');
    const nickText = $('tableNicknameBadgeText');
    const submitBtn = $('submitOrderBtn');
    const leaveBtn = $('leaveTableBtn');
    const authBox = $('tableAuthBox');
    const liveBox = $('tableLiveBox');
    if (!panel || !codeText || !nickText || !submitBtn || !leaveBtn) return;

    if (!tableCode || !clientToken) {
      return;
    }

    codeText.textContent = tableCode;
    nickText.textContent = nickname || '-';
    panel.style.display = 'block';
    if (authBox) authBox.style.display = 'none';
    if (liveBox) liveBox.style.display = 'block';
    submitBtn.onclick = submitOrderToTable;
    leaveBtn.onclick = leaveTable;
  }

  const tabCarteBtn = $('tabCarteBtn');
  const tabTableBtn = $('tabTableBtn');
  let currentTab = 'carte';
  const orderSummaryBtn = $('orderSummaryBtn');
  const resetBtn = $('resetBtn');

  function setMainMenuButtonsVisible(visible) {
    if (orderSummaryBtn) orderSummaryBtn.style.display = visible ? '' : 'none';
    if (resetBtn) resetBtn.style.display = visible ? '' : 'none';
  }

  function setClassicVisible(visible) {
    // Cache/affiche uniquement la carte (les blocs menu).
    document.querySelectorAll('.menu-section').forEach((el) => {
      el.style.display = visible ? '' : 'none';
    });
  }

  function setTabButtonsActive(tab) {
    if (tabCarteBtn) {
      tabCarteBtn.style.backgroundColor = tab === 'carte' ? '#ff9800' : 'transparent';
    }
    if (tabTableBtn) {
      tabTableBtn.style.backgroundColor = tab === 'table' ? '#ff9800' : 'transparent';
    }
  }

  function setActiveTab(tab) {
    currentTab = tab;
    setTabButtonsActive(tab);

    const panel = $('tableSummaryPanel');
    if (!panel) return;

    if (tab === 'carte') {
      setMainMenuButtonsVisible(true);
      reconnectEnabled = false;
      // Quitte l'onglet table : on stoppe le flux temps réel.
      try {
        if (ws) ws.close();
      } catch (e) {}
      ws = null;
      activeWsTableCode = null;
      cleanupHeartbeat();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;

      panel.style.display = 'none';
      setLiveStatus('Aucune table active.');
      setClassicVisible(true);
      return;
    }

    // Onglet table
    setMainMenuButtonsVisible(false);
    reconnectEnabled = true;
    // Onglet "Table" : on n'affiche que la partie table (pas la carte classique).
    setClassicVisible(false);

    const { tableCode, clientToken } = getSession();
    const authBox = $('tableAuthBox');
    const liveBox = $('tableLiveBox');

    panel.style.display = 'block';
    if (!tableCode || !clientToken) {
      if (authBox) authBox.style.display = 'block';
      if (liveBox) liveBox.style.display = 'none';
      setLiveStatus('Aucune table active.');
      return;
    }

    if (authBox) authBox.style.display = 'none';
    if (liveBox) liveBox.style.display = 'block';
    showTablePanelFromSession();
    connectWS(tableCode);

    // Remet l'UI "Table" en haut sans être masquée par le menu fixe.
    if (panel) {
      requestAnimationFrame(function () {
        try {
          panel.scrollIntoView({ block: 'start' });
        } catch (e) {}
      });
    }
  }

  function leaveTable() {
    try {
      if (ws) ws.close();
    } catch (e) {}
    ws = null;
    reconnectEnabled = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    activeWsTableCode = null;
    cleanupHeartbeat();
    clearSession();

    const panel = $('tableSummaryPanel');
    const authBox = $('tableAuthBox');
    const liveBox = $('tableLiveBox');
    if (panel && currentTab !== 'table') panel.style.display = 'none';
    if (authBox) authBox.style.display = 'block';
    if (liveBox) liveBox.style.display = 'none';
    setLiveStatus('Aucune table active.');
  }

  window.submitOrderToTable = submitOrderToTable;

  function setupOverlay() {
    const createBtn = $('createTableBtn');
    const joinBtn = $('joinTableBtn');
    const nicknameInput = $('tableNicknameInput');
    const codeInput = $('tableCodeInput');

    if (!createBtn || !joinBtn || !nicknameInput || !codeInput) return;

    createBtn.onclick = async function () {
      const nickname = (nicknameInput.value || '').trim();
      if (!nickname) return alert('Veuillez saisir un pseudo.');

      try {
        const requestedCode = (codeInput.value || '').trim().toUpperCase();
        const joined = await apiCreateTableAndJoin(
          nickname,
          requestedCode ? requestedCode : null
        );
        setSession(joined);
        setActiveTab('table');
      } catch (e) {
        alert(e && e.message ? e.message : 'Erreur');
      }
    };

    joinBtn.onclick = async function () {
      const nickname = (nicknameInput.value || '').trim();
      const code = (codeInput.value || '').trim().toUpperCase();

      if (!nickname) return alert('Veuillez saisir un pseudo.');
      if (!code) return alert('Veuillez saisir un code de table.');

      try {
        const joined = await apiJoinTable(code, nickname);
        setSession(joined);
        setActiveTab('table');
      } catch (e) {
        alert(e && e.message ? e.message : 'Erreur');
      }
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupOverlay();

    // Décale le contenu sous le menu fixe en haut (évite que tout démarre "trop haut").
    (function setMenuOffset() {
      var nav = document.querySelector('nav.nav-bar');
      if (!nav) return;
      var navRect = nav.getBoundingClientRect();
      // offset = bas réel du menu dans le viewport
      var offset = navRect.bottom;
      document.documentElement.style.setProperty('--menu-offset', offset + 'px');

      var spacer = document.getElementById('menuSpacer');
      if (spacer) spacer.style.height = offset + 'px';
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

    // Valeur par défaut : onglet "carte".
    const initialTab =
      window.location.hash && window.location.hash.toLowerCase() === '#table'
        ? 'table'
        : 'carte';
    setActiveTab(initialTab);

    // Stopper/réduire la charge quand l'onglet est masqué.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        // Si on est sur l'onglet table, on ferme proprement sans effacer la session.
        if (currentTab === 'table') {
          reconnectEnabled = false;
          try {
            if (ws) ws.close();
          } catch (e) {}
          ws = null;
          activeWsTableCode = null;
          cleanupHeartbeat();
        }
      } else {
        // Reconnect uniquement si on est sur "table" et qu'il y a une session valide.
        if (currentTab === 'table') {
          reconnectEnabled = true;
          const { tableCode, clientToken } = getSession();
          if (tableCode && clientToken) connectWS(tableCode);
        }
      }
    });

    // Menu fixe sous le bandeau/entete UNIQUEMENT quand on est en haut.
    // Quand on scroll et que l'entête n'est plus visible, on ramène le menu en haut.
    (function adjustNav() {
      var nav = document.querySelector('nav.nav-bar');
      var header = document.querySelector('.site-header');
      if (!nav || !header) return;

      function update() {
        // bottom de l'en-tête dans le viewport.
        var headerBottom = header.getBoundingClientRect().bottom;
        var navHeight = nav.getBoundingClientRect().height;

        if (headerBottom > 0) {
          nav.style.top = headerBottom + 'px';
        } else {
          nav.style.top = '0px';
        }

        // Recalcule sur la position réelle après ajustement.
        var navRect = nav.getBoundingClientRect();
        var offset = navRect.bottom;
        document.documentElement.style.setProperty('--menu-offset', offset + 'px');

        var spacer = document.getElementById('menuSpacer');
        if (spacer) spacer.style.height = offset + 'px';
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

