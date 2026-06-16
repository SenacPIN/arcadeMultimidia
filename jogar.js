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
      const bannerUrl = game.capa.split("/").map(part => encodeURIComponent(part)).join("/");
      playOverlayBg.style.backgroundImage = `url('${bannerUrl}')`;
    }

  } catch (error) {
    console.error("Erro ao carregar o jogo:", error);
    window.location.href = "index.html";
    return;
  }

  // --- Função de Injeção de Áudio via Protótipo ---
  function hookAudio(win) {
    try {
      if (!win || !win.AudioNode || !win.AudioNode.prototype.connect) return;
      if (win._hooked) return;

      const originalConnect = win.AudioNode.prototype.connect;
      win.AudioNode.prototype.connect = function(destination, output, input) {
        if (destination === this.context.destination) {
          if (!this.context._masterGain) {
            const gain = this.context.createGain();
            gain.gain.value = currentVolume;
            originalConnect.call(gain, this.context.destination);
            this.context._masterGain = gain;
            win._masterGains = win._masterGains || [];
            win._masterGains.push(gain);
          }
          return originalConnect.call(this, this.context._masterGain, output, input);
        }
        return originalConnect.call(this, destination, output, input);
      };

      win.setMasterVolume = function(volume) {
        if (win._masterGains) {
          win._masterGains.forEach(gain => {
            try {
              gain.gain.setValueAtTime(volume, gain.context.currentTime);
            } catch(e) {}
          });
        }
        try {
          const mediaElements = win.document.querySelectorAll('audio, video');
          mediaElements.forEach(media => {
            media.volume = volume;
          });
        } catch(e) {}
      };

      // Tentar setar o volume inicial nos elementos de mídia já criados
      try {
        const mediaElements = win.document.querySelectorAll('audio, video');
        mediaElements.forEach(media => {
          media.volume = currentVolume;
        });
      } catch(e) {}

      win._hooked = true;
    } catch (err) {
      console.error("Erro ao aplicar hook de áudio:", err);
    }
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
  playTriggerBtn.addEventListener("click", () => {
    if (!game) return;

    // Esconder o Overlay
    playOverlay.classList.add("hidden");

    // Definir a URL do iframe diretamente (evita erros de CORS do srcdoc)
    gameIframe.src = game.linkJogo;

    // Polling rápido para injetar o hook de áudio assim que a window do iframe carregar o novo documento
    let hooked = false;
    const interval = setInterval(() => {
      try {
        const win = gameIframe.contentWindow;
        if (win && win.AudioNode && win.AudioNode.prototype.connect && !win._hooked) {
          hookAudio(win);
          hooked = true;
        }
      } catch (e) {
        // Ignora erros de cross-origin caso a página mude de domínio temporariamente durante o carregamento
      }
    }, 2);

    // Cancela o polling após 6 segundos por segurança
    setTimeout(() => clearInterval(interval), 6000);
  });

  // Fallback quando o iframe terminar de carregar (garante foco e hook de segurança)
  gameIframe.addEventListener("load", () => {
    try {
      const win = gameIframe.contentWindow;
      if (win) {
        hookAudio(win);
        // Atualiza o volume no carregamento final
        if (typeof win.setMasterVolume === "function") {
          win.setMasterVolume(currentVolume);
        }
      }
      gameIframe.focus();
    } catch (e) {
      console.warn("Não foi possível acessar a janela do iframe para finalização:", e);
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

  // Botão Voltar
  const backButton = document.getElementById("back-button");
  backButton.addEventListener("click", (e) => {
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
      e.preventDefault();
      window.history.back();
    }
  });
});
