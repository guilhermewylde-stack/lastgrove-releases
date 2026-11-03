(function () {
  const STORAGE_KEY = "lastgrove-portal-v1";

  const NAV = [
    ["index.html", "noticias", "Notícias"],
    ["ranking.html", "ranking", "Ranking"],
    ["mundo.html", "mundo", "Mundo"],
    ["baixar.html", "baixar", "Baixar"],
    ["criar.html", "criar", "Criar conta"],
    ["entrar.html", "entrar", "Entrar"],
  ];

  const EXAMPLE_BOARD = [
    { apelido: "Brasa", lado: "troll", partidas: 18, vitorias: 11 },
    { apelido: "Musgo", lado: "elfo", partidas: 22, vitorias: 14 },
    { apelido: "Cerne", lado: "elfo", partidas: 16, vitorias: 9 },
    { apelido: "Seiva", lado: "troll", partidas: 15, vitorias: 8 },
    { apelido: "Névoa", lado: "elfo", partidas: 14, vitorias: 7 },
    { apelido: "Tocha", lado: "elfo", partidas: 12, vitorias: 6 },
    { apelido: "Pinho", lado: "troll", partidas: 11, vitorias: 5 },
    { apelido: "Casca", lado: "elfo", partidas: 9, vitorias: 4 },
    { apelido: "Vaga-lume", lado: "elfo", partidas: 8, vitorias: 3 },
    { apelido: "Rocha", lado: "troll", partidas: 7, vitorias: 2 },
  ];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { accounts: [], session: null };
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.accounts)) return { accounts: [], session: null };
      return { accounts: data.accounts, session: data.session || null };
    } catch (_error) {
      return { accounts: [], session: null };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function apelidoKey(apelido) {
    return apelido.toLocaleLowerCase("pt-BR");
  }

  function normalizeApelido(value) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  function currentAccount() {
    const state = loadState();
    if (!state.session) return null;
    return state.accounts.find((account) => account.key === state.session) || null;
  }

  async function digest(apelido, password) {
    const text = `${apelidoKey(apelido)}\n${password}`;
    if (globalThis.crypto && crypto.subtle) {
      try {
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      } catch (_error) {
        /* file:// pages do not expose subtle crypto */
      }
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv-${(hash >>> 0).toString(16)}`;
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function accountError(apelido) {
    if (apelido.length < 1 || apelido.length > 16) {
      return "O Apelido precisa ter de 1 a 16 caracteres.";
    }
    return "";
  }

  async function criar(fields) {
    const apelido = normalizeApelido(fields.apelido || "");
    const email = (fields.email || "").trim();
    const password = fields.password || "";
    const confirm = fields.confirm || "";
    const lado = fields.lado === "troll" ? "troll" : fields.lado === "elfo" ? "elfo" : "";
    const nickError = accountError(apelido);
    if (nickError) return { ok: false, error: nickError };
    if (!validEmail(email)) return { ok: false, error: "E-mail inválido." };
    if (password.length < 8) return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres." };
    if (password !== confirm) return { ok: false, error: "A confirmação da senha não confere." };
    if (!lado) return { ok: false, error: "Escolha Elfo ou Troll." };

    const state = loadState();
    const key = apelidoKey(apelido);
    if (state.accounts.some((account) => account.key === key)) {
      return { ok: false, error: "Esse Apelido já está no portal." };
    }
    state.accounts.push({
      key,
      apelido,
      email,
      pass: await digest(apelido, password),
      lado,
      frase: "",
      createdAt: new Date().toISOString(),
    });
    state.session = key;
    saveState(state);
    return { ok: true, apelido };
  }

  async function entrar(fields) {
    const apelido = normalizeApelido(fields.apelido || "");
    const password = fields.password || "";
    const nickError = accountError(apelido);
    if (nickError) return { ok: false, error: nickError };
    const state = loadState();
    const account = state.accounts.find((item) => item.key === apelidoKey(apelido));
    if (!account || account.pass !== await digest(apelido, password)) {
      return { ok: false, error: "Apelido ou senha não conferem." };
    }
    state.session = account.key;
    saveState(state);
    return { ok: true, apelido: account.apelido };
  }

  function sair() {
    const state = loadState();
    state.session = null;
    saveState(state);
  }

  function salvarPerfil(fields) {
    const state = loadState();
    const account = state.accounts.find((item) => item.key === state.session);
    if (!account) return { ok: false, error: "Entre na conta para salvar o perfil." };
    const lado = fields.lado === "troll" ? "troll" : "elfo";
    const frase = (fields.frase || "").trim().slice(0, 80);
    account.lado = lado;
    account.frase = frase;
    saveState(state);
    return { ok: true };
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Cuiaba",
    });
  }

  function ladoLabel(lado) {
    return lado === "troll" ? "Troll" : "Elfo";
  }

  function sortedBoard() {
    return EXAMPLE_BOARD.slice().sort((a, b) => {
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.partidas !== a.partidas) return b.partidas - a.partidas;
      return a.apelido.localeCompare(b.apelido, "pt-BR");
    });
  }

  function renderChrome() {
    const page = document.body.dataset.page || "";
    const account = currentAccount();
    const top = document.getElementById("top");
    if (!top) return;
    const links = NAV.map(([href, id, label]) => {
      const current = id === page ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${label}</a>`;
    }).join("");
    const sessionLink = account
      ? `<a href="conta.html"${page === "conta" || page === "perfil" ? ' aria-current="page"' : ""}>Conta: ${escapeHtml(account.apelido)}</a>`
      : "";
    top.innerHTML = `
      <a class="skip" href="#conteudo">Ir ao conteúdo</a>
      <div class="banner">
        <img src="assets/grove-icon.png" width="196" height="196" alt="Bosque à noite, uma tocha no centro e a sombra do Troll atrás das árvores.">
        <div>
          <p class="eyebrow">Playtest com amigos</p>
          <h1>Last Grove</h1>
          <p class="sub">Trolls and Elves</p>
          <span class="version">Versão 0.1.1 · Windows</span>
        </div>
      </div>
      <nav class="nav" aria-label="Seções">${links}${sessionLink}</nav>`;
    const foot = document.getElementById("foot");
    if (foot) {
      foot.className = "site";
      foot.innerHTML = "Protótipo do portal. A conta fica neste navegador e não entra na Partida. O placar é de exemplo, tirado do vocabulário da versão 0.1.1.";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setError(form, message) {
    const slot = form.querySelector("[data-error]");
    if (slot) slot.textContent = message || "";
  }

  function fieldValue(form, name) {
    const element = form.elements.namedItem(name);
    if (!element) return "";
    if (element instanceof RadioNodeList) return element.value;
    return element.value;
  }

  function fillLoginBox() {
    const box = document.getElementById("login-box");
    if (!box) return;
    const account = currentAccount();
    if (!account) return;
    box.innerHTML = `
      <h2>Conta</h2>
      <p>Você entrou como <strong class="gold">${escapeHtml(account.apelido)}</strong>, lado ${ladoLabel(account.lado)}.</p>
      <div class="row-actions">
        <a class="btn" href="conta.html">Menu da conta</a>
        <button type="button" data-action="sair">Sair</button>
      </div>`;
  }

  function fillTopFive() {
    const list = document.getElementById("top-cinco");
    if (!list) return;
    list.innerHTML = sortedBoard().slice(0, 5).map((row, index) => `
      <li>
        <span>${index + 1}</span>
        <a href="ranking.html">${escapeHtml(row.apelido)}</a>
        <span class="lado-${row.lado}">${ladoLabel(row.lado)}</span>
      </li>`).join("");
  }

  function fillRanking() {
    const body = document.getElementById("placar");
    if (!body) return;
    const query = (document.getElementById("busca")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const lado = document.getElementById("filtro-lado")?.value || "";
    const account = currentAccount();
    const rows = sortedBoard().filter((row) => {
      if (lado && row.lado !== lado) return false;
      if (query && !row.apelido.toLocaleLowerCase("pt-BR").includes(query)) return false;
      return true;
    });
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="5">Nenhum Apelido com esse texto.</td></tr>`;
    } else {
      body.innerHTML = rows.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.apelido)}</td>
          <td class="lado-${row.lado}">${ladoLabel(row.lado)}</td>
          <td>${row.partidas}</td>
          <td>${row.vitorias}</td>
        </tr>`).join("");
    }
    const yours = document.getElementById("sua-linha");
    if (!yours) return;
    if (!account) {
      yours.innerHTML = `<p class="note">Entre na conta para ver a sua linha. Ela começa em zero: o jogo ainda não manda Partidas para cá.</p>`;
      return;
    }
    yours.innerHTML = `
      <table>
        <thead><tr><th>Apelido</th><th>Lado</th><th>Partidas</th><th>Vitórias</th></tr></thead>
        <tbody>
          <tr class="is-you">
            <td>${escapeHtml(account.apelido)}</td>
            <td class="lado-${account.lado}">${ladoLabel(account.lado)}</td>
            <td>0</td>
            <td>0</td>
          </tr>
        </tbody>
      </table>`;
  }

  function fillSessionPages() {
    const account = currentAccount();
    document.querySelectorAll("[data-needs='session']").forEach((node) => {
      node.hidden = !account;
    });
    document.querySelectorAll("[data-needs='guest']").forEach((node) => {
      node.hidden = Boolean(account);
    });
    if (!account) return;
    const name = document.getElementById("perfil-apelido");
    if (name) name.textContent = account.apelido;
    const since = document.getElementById("perfil-desde");
    if (since) since.textContent = formatDate(account.createdAt);
    const email = document.getElementById("perfil-email");
    if (email) email.textContent = account.email;
    const frase = document.getElementById("frase");
    if (frase && document.activeElement !== frase) frase.value = account.frase || "";
    const lado = document.querySelector(`input[name='lado'][value='${account.lado}']`);
    if (lado) lado.checked = true;
    const ladoTexto = document.getElementById("perfil-lado");
    if (ladoTexto) {
      ladoTexto.textContent = ladoLabel(account.lado);
      ladoTexto.className = `lado-${account.lado}`;
    }
    const fraseLeitura = document.getElementById("perfil-frase");
    if (fraseLeitura) {
      fraseLeitura.textContent = account.frase || "Sem frase no portão.";
    }
  }

  async function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const action = form.dataset.action;
    if (!action) return;
    event.preventDefault();
    setError(form, "");
    const fields = {
      apelido: fieldValue(form, "apelido"),
      email: fieldValue(form, "email"),
      password: fieldValue(form, "senha"),
      confirm: fieldValue(form, "confirmar"),
      lado: fieldValue(form, "lado"),
      frase: fieldValue(form, "frase"),
    };
    if (action === "criar") {
      const result = await criar(fields);
      if (!result.ok) return setError(form, result.error);
      location.href = "conta.html";
      return;
    }
    if (action === "entrar") {
      const result = await entrar(fields);
      if (!result.ok) return setError(form, result.error);
      location.href = "conta.html";
      return;
    }
    if (action === "perfil") {
      const result = salvarPerfil(fields);
      if (!result.ok) return setError(form, result.error);
      setError(form, "");
      const done = form.querySelector("[data-saved]");
      if (done) done.textContent = "Perfil salvo neste navegador.";
      renderChrome();
      fillSessionPages();
    }
  }

  function onClick(event) {
    const button = event.target.closest("[data-action='sair']");
    if (!button) return;
    sair();
    location.href = "index.html";
  }

  function onFilter() {
    fillRanking();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderChrome();
    fillLoginBox();
    fillTopFive();
    fillRanking();
    fillSessionPages();
    document.addEventListener("submit", onSubmit);
    document.addEventListener("click", onClick);
    document.getElementById("busca")?.addEventListener("input", onFilter);
    document.getElementById("filtro-lado")?.addEventListener("change", onFilter);
  });

  window.LastGrovePortal = {
    criar,
    entrar,
    sair,
    salvarPerfil,
    currentAccount,
    loadState,
    sortedBoard,
  };
})();
