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
  const gameControlsBar = document.getElementById("game-controls-bar");
  
  // Elementos do Play Overlay
  const playOverlay = document.getElementById("play-overlay");
  const playOverlayBg = document.getElementById("play-overlay-bg");
  const playTriggerBtn = document.getElementById("play-trigger-btn");

  // Elementos de Áudio
  const volumeSlider = document.getElementById("volume-slider");
  const volumeToggleBtn = document.getElementById("volume-toggle-btn");
  const iconVolHigh = volumeToggleBtn.querySelector(".icon-vol-high");
  const iconVolMuted = volumeToggleBtn.querySelector(".icon-vol-muted");

  // Elementos de Fullscreen
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const iconExpand = fullscreenBtn.querySelector(".icon-expand");
  const iconMinimize = fullscreenBtn.querySelector(".icon-minimize");

  // Estado global da página
  let game = null;
  let currentVolume = 0.8; // Volume inicial padrão (80%)
  let preMuteVolume = 0.8;

  // --- Inicializar Volume por localStorage ---
  const savedVolume = localStorage.getItem("arcade-volume");
  if (savedVolume !== null) {
    currentVolume = parseFloat(savedVolume);
  }
  volumeSlider.value = currentVolume * 100;
  updateVolumeIcons(currentVolume);

  // Carregar dados dos jogos
  try {
    const response = await fetch("data/jogos.json");
    if (!response.ok) throw new Error("Não foi possível carregar os jogos.");
    
    const games = await response.json();
    game = games.find(g => g.id === gameId);

    if (!game || game.status !== "publicado" || !game.linkJogo) {
      window.location.href = "index.html";
      return;
    }

    // Preencher dados do jogo na página
    document.title = `${game.titulo} | Arcade Multimidia`;
    detailsTitle.textContent = game.titulo;
    
    // Adicionar tags dinâmicas (Turma e Engine)
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

    // Setar o banner de background no play-overlay
    if (game.capa) {
      // Decode e encode para suportar caracteres especiais e espaços
      const bannerUrl = game.capa.split("/").map(part => encodeURIComponent(part)).join("/");
      playOverlayBg.style.backgroundImage = `url('${bannerUrl}')`;
    }

  } catch (error) {
    console.error("Erro ao carregar o jogo:", error);
    window.location.href = "index.html";
    return;
  }

  // --- Função para atualizar volume ---
  function setVolume(value) {
    currentVolume = value / 100;
    localStorage.setItem("arcade-volume", currentVolume);
    updateVolumeIcons(currentVolume);

    // Enviar valor para a função de injeção dentro do iframe (se já estiver carregado)
    if (gameIframe.contentWindow && typeof gameIframe.contentWindow.setMasterVolume === "function") {
      gameIframe.contentWindow.setMasterVolume(currentVolume);
    }
  }

  function updateVolumeIcons(volume) {
    if (volume === 0) {
      iconVolHigh.style.display = "none";
      iconVolMuted.style.display = "inline-block";
    } else {
      iconVolHigh.style.display = "inline-block";
      iconVolMuted.style.display = "none";
    }
  }

  // Eventos de Áudio
  volumeSlider.addEventListener("input", (e) => {
    setVolume(e.target.value);
  });

  volumeToggleBtn.addEventListener("click", () => {
    if (currentVolume > 0) {
      preMuteVolume = currentVolume;
      volumeSlider.value = 0;
      setVolume(0);
    } else {
      volumeSlider.value = preMuteVolume * 100;
      setVolume(preMuteVolume * 100);
    }
  });

  // --- Ação de Inicialização (Play Button) ---
  playTriggerBtn.addEventListener("click", async () => {
    if (!game) return;

    try {
      // Carregar a página HTML original do jogo via Fetch
      const response = await fetch(game.linkJogo);
      if (!response.ok) throw new Error("Não foi possível recuperar os arquivos do jogo.");
      let html = await response.text();

      // Definir a pasta base do jogo para resolver caminhos relativos
      const baseHref = game.linkJogo.substring(0, game.linkJogo.lastIndexOf("/") + 1);

      // Injeção de áudio e caminhos base na cabeça do HTML do jogo
      const injection = `
        <base href="${baseHref}">
        <script>
          (function() {
            window.masterVolume = ${currentVolume};
            window._masterGains = [];

            // Intercepta conexões de áudio para controle por GainNode (Web Audio API)
            if (window.AudioNode && window.AudioNode.prototype.connect) {
              const originalConnect = window.AudioNode.prototype.connect;
              window.AudioNode.prototype.connect = function(destination, output, input) {
                if (destination === this.context.destination) {
                  if (!this.context._masterGain) {
                    const gain = this.context.createGain();
                    gain.gain.value = window.masterVolume;
                    originalConnect.call(gain, this.context.destination);
                    this.context._masterGain = gain;
                    window._masterGains.push(gain);
                  }
                  return originalConnect.call(this, this.context._masterGain, output, input);
                }
                return originalConnect.call(this, destination, output, input);
              };
            }

            // Função chamada pelo portal pai para alterar volume dinamicamente
            window.setMasterVolume = function(volume) {
              window.masterVolume = volume;
              if (window._masterGains) {
                window._masterGains.forEach(gain => {
                  try {
                    gain.gain.setValueAtTime(volume, gain.context.currentTime);
                  } catch(e) {}
                });
              }
              try {
                const mediaElements = document.querySelectorAll('audio, video');
                mediaElements.forEach(media => {
                  media.volume = volume;
                });
              } catch(e) {}
            };
          })();
        </script>
      `;

      // Injeta logo após a abertura do head (ou no início do documento)
      if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>\n" + injection);
      } else {
        html = injection + html;
      }

      // Esconder o Overlay com efeito de transição
      playOverlay.classList.add("hidden");

      // Inserir o HTML modificado no iframe e forçar o foco no carregamento
      gameIframe.srcdoc = html;
      gameIframe.onload = () => {
        gameIframe.focus();
      };

    } catch (err) {
      console.error("Erro ao carregar e iniciar o jogo:", err);
      // Fallback em caso de falha de fetch: carrega o link direto no iframe
      playOverlay.classList.add("hidden");
      gameIframe.src = game.linkJogo;
    }
  });

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

  // Botão Voltar (com suporte a preservar filtros do portal pai)
  const backButton = document.getElementById("back-button");
  backButton.addEventListener("click", (e) => {
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
      e.preventDefault();
      window.history.back();
    }
  });
});
