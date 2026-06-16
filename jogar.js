document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get("jogo");

  if (!gameId) {
    window.location.href = "index.html";
    return;
  }

  // Elementos da página
  const detailsTitle = document.getElementById("details-title");
  const detailsTags = document.getElementById("details-tags");
  const detailsAuthorsList = document.getElementById("details-authors-list");
  const detailsDescriptionText = document.getElementById("details-description-text");
  const detailsTeachersList = document.getElementById("details-teachers-list");
  const gameIframe = document.getElementById("game-iframe");
  const gameWrapper = document.getElementById("game-wrapper");
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const iconExpand = fullscreenBtn.querySelector(".icon-expand");
  const iconMinimize = fullscreenBtn.querySelector(".icon-minimize");

  // Carregar dados dos jogos
  try {
    const response = await fetch("data/jogos.json");
    if (!response.ok) throw new Error("Não foi possível carregar os jogos.");
    
    const games = await response.json();
    const game = games.find(g => g.id === gameId);

    if (!game || game.status !== "publicado" || !game.linkJogo) {
      window.location.href = "index.html";
      return;
    }

    // Preencher dados do jogo na página
    document.title = `${game.titulo} | Arcade Multimidia`;
    detailsTitle.textContent = game.titulo;
    
    // Adicionar tags dinâmicas
    let tagsHtml = `<span class="pill primary">${game.turma}</span>`;
    if (game.tecnologias && game.tecnologias.length > 0) {
      game.tecnologias.forEach(tech => {
        tagsHtml += `<span class="pill warning">${tech}</span>`;
      });
    }
    detailsTags.innerHTML = tagsHtml;

    // Autores, Descrição e Docentes
    detailsAuthorsList.textContent = game.autores && game.autores.length > 0 
      ? game.autores.join(", ") 
      : "Não informado";
      
    detailsDescriptionText.textContent = game.descricaoCompleta || game.descricaoCurta || "Sem descrição disponível.";
    detailsTeachersList.textContent = game.docente || "Não informado";

    // Carregar o iframe com o jogo
    gameIframe.src = game.linkJogo;

  } catch (error) {
    console.error("Erro ao carregar o jogo:", error);
    window.location.href = "index.html";
    return;
  }

  // --- Controle de Tela Cheia (Fullscreen API) ---
  
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      gameWrapper.requestFullscreen().catch(err => {
        console.error(`Erro ao tentar ativar tela cheia: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Erro ao tentar sair da tela cheia: ${err.message}`);
      });
    }
  }

  fullscreenBtn.addEventListener("click", toggleFullscreen);

  // Escuta mudanças no estado de tela cheia
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === gameWrapper) {
      fullscreenBtn.classList.add("active");
      iconExpand.style.display = "none";
      iconMinimize.style.display = "inline-block";
    } else {
      fullscreenBtn.classList.remove("active");
      iconExpand.style.display = "inline-block";
      iconMinimize.style.display = "none";
      gameWrapper.classList.remove("mouse-idle");
    }
  });

  // --- Efeito Premium: Esconder cursor e controles após inatividade no Fullscreen ---
  let mouseTimer;
  gameWrapper.addEventListener("mousemove", () => {
    if (!document.fullscreenElement) return;
    
    gameWrapper.classList.remove("mouse-idle");
    clearTimeout(mouseTimer);
    
    mouseTimer = setTimeout(() => {
      if (document.fullscreenElement === gameWrapper) {
        gameWrapper.classList.add("mouse-idle");
      }
    }, 2500); // 2.5 segundos de inatividade
  });

  // Garante que o botão de voltar retorne para a página inicial com filtros caso existam na história,
  // ou simplesmente navegue de volta.
  const backButton = document.getElementById("back-button");
  backButton.addEventListener("click", (e) => {
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
      e.preventDefault();
      window.history.back();
    }
  });
});
