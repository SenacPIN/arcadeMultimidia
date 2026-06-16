const state = {
  games: [],
  classes: [],
  turma: new URLSearchParams(window.location.search).get("turma") || "all",
  search: ""
};

const elements = {
  totalGames: document.querySelector("#total-games"),
  gamesGrid: document.querySelector("#games-grid"),
  resultCount: document.querySelector("#result-count"),
  emptyState: document.querySelector("#empty-state"),
  classContext: document.querySelector("#class-context"),
  searchInput: document.querySelector("#search-input"),
  filterButtons: document.querySelectorAll(".filter-button"),
  dialog: document.querySelector("#game-dialog"),
  dialogClose: document.querySelector(".dialog-close"),
  dialogMedia: document.querySelector("#dialog-media"),
  dialogMeta: document.querySelector("#dialog-meta"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogDescription: document.querySelector("#dialog-description"),
  dialogTeachers: document.querySelector("#dialog-teachers"),
  dialogAuthors: document.querySelector("#dialog-authors"),
  dialogTech: document.querySelector("#dialog-tech"),
  dialogType: document.querySelector("#dialog-type"),
  dialogTheme: document.querySelector("#dialog-theme"),
  dialogTags: document.querySelector("#dialog-tags"),
  dialogPlay: document.querySelector("#dialog-play")
};

async function loadGames() {
  try {
    const [gamesResponse, classesResponse] = await Promise.all([
      fetch("data/jogos.json"),
      fetch("data/turmas.json")
    ]);

    if (!gamesResponse.ok || !classesResponse.ok) {
      throw new Error("Nao foi possivel carregar os dados.");
    }

    state.games = await gamesResponse.json();
    state.classes = await classesResponse.json();
    render();
  } catch (error) {
    elements.resultCount.textContent = "Nao foi possivel carregar a galeria.";
    elements.emptyState.hidden = false;
    elements.emptyState.textContent = "Confira se o arquivo data/jogos.json esta disponivel.";
  }
}

function render() {
  const visibleGames = state.games.filter((game) => game.status !== "rascunho");
  const filteredGames = getFilteredGames(visibleGames);

  elements.totalGames.textContent = `${visibleGames.length} jogos cadastrados`;
  elements.gamesGrid.innerHTML = filteredGames.map(createGameCard).join("");
  elements.resultCount.textContent = `${filteredGames.length} disponiveis`;
  elements.emptyState.hidden = filteredGames.length > 0;
  elements.classContext.innerHTML = createClassContext(filteredGames);

  bindCardActions();
}

function getFilteredGames(games) {
  return games.filter((game) => {
    const matchesTurma = state.turma === "all" || game.turma === state.turma;
    const searchText = `${game.titulo} ${game.turma} ${game.categoria} ${game.tipoProjeto || ""} ${game.tags.join(" ")}`.toLowerCase();
    const matchesSearch = searchText.includes(state.search.toLowerCase());

    return matchesTurma && matchesSearch;
  });
}

function createClassContext(games) {
  if (state.turma !== "all") {
    const classInfo = getClassInfo(state.turma);

    return `
      <div class="context-card">
        <div>
          <p class="eyebrow">${classInfo.nome}</p>
          <h2>${classInfo.temaTitulo}</h2>
          <strong><p>${classInfo.temaDescricao}</p></strong>
          <p>${classInfo.descricao}</p>
        </div>
        <span class="context-badge">${classInfo.proposta}</span>
      </div>
    `;
  }

  return "";
}

function getClassInfo(classId) {
  return state.classes.find((classInfo) => classInfo.id === classId) || {
    id: classId,
    nome: classId,
    temaTitulo: "Tema gerador a cadastrar",
    temaDescricao: "Adicione aqui uma descricao curta do tema gerador.",
    descricao: "Contexto da turma ainda nao cadastrado.",
    proposta: "Proposta a cadastrar"
  };
}

function createGameCard(game) {
  const cover = game.capa
    ? `<img src="${getAssetUrl(game.capa)}" alt="Capa do jogo ${game.titulo}" loading="lazy" onerror="this.parentElement.textContent='${game.turma}'">`
    : game.turma;
  const playUrl = `jogar.html?jogo=${encodeURIComponent(game.id)}`;
  const canPlay = game.status === "publicado" && game.linkJogo;
  const playControl = canPlay
    ? `<a class="button primary" href="${playUrl}">Jogar</a>`
    : `<span class="button disabled">Em ajuste</span>`;

  return `
    <article class="game-card">
      <div class="game-cover">${cover}</div>
      <div class="game-body">
        <div class="game-meta">
          <span class="pill primary">${game.turma}</span>
          <span class="pill">${game.ano}</span>
          <span class="pill">${game.tipoProjeto || "Projeto"}</span>
          <span class="pill">${game.categoria}</span>
          ${game.status === "em-ajuste" ? '<span class="pill warning">Em ajuste</span>' : ""}
        </div>
        <h3>${game.titulo}</h3>
        <p>${game.descricaoCurta}</p>
        <div class="tag-list">
          ${game.tags.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <div class="card-actions">
          ${playControl}
          <button class="button details-button" type="button" data-game-id="${game.id}" aria-label="Ver detalhes de ${game.titulo}">i</button>
        </div>
      </div>
    </article>
  `;
}

function bindCardActions() {
  document.querySelectorAll("[data-game-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const game = state.games.find((item) => item.id === button.dataset.gameId);
      openDialog(game);
    });
  });
}

function openDialog(game) {
  if (!game) {
    return;
  }

  elements.dialogMedia.innerHTML = game.capa
    ? `<img src="${getAssetUrl(game.capa)}" alt="Capa do jogo ${game.titulo}" onerror="this.parentElement.textContent='${game.turma}'">`
    : game.turma;
  elements.dialogMeta.textContent = `${game.turma} - ${game.ano} - ${game.categoria}`;
  elements.dialogTitle.textContent = game.titulo;
  elements.dialogDescription.textContent = game.descricaoCompleta || game.descricaoCurta;
  elements.dialogTeachers.textContent = game.docente || "Nao informado";
  elements.dialogAuthors.textContent = game.autores.join(", ");
  elements.dialogTech.textContent = game.tecnologias.join(", ");
  elements.dialogType.textContent = game.tipoProjeto || "Projeto";
  elements.dialogTheme.textContent = getClassInfo(game.turma).temaTitulo;
  elements.dialogTags.innerHTML = game.tags.map((tag) => `<span class="tag">${tag}</span>`).join("");
  if (game.status === "publicado" && game.linkJogo) {
    elements.dialogPlay.href = `jogar.html?jogo=${encodeURIComponent(game.id)}`;
    elements.dialogPlay.textContent = "Jogar";
    elements.dialogPlay.classList.remove("disabled");
  } else {
    elements.dialogPlay.removeAttribute("href");
    elements.dialogPlay.textContent = "Jogo em ajuste";
    elements.dialogPlay.classList.add("disabled");
  }

  elements.dialog.showModal();
}

function getAssetUrl(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

elements.filterButtons.forEach((button) => {
  if (button.dataset.filter === state.turma) {
    elements.filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  }

  button.addEventListener("click", () => {
    elements.filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.turma = button.dataset.filter;
    render();
  });
});

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

elements.dialogClose.addEventListener("click", () => {
  elements.dialog.close();
});

elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) {
    elements.dialog.close();
  }
});

loadGames();
