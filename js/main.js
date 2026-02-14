// Arquivo principal que integra todas as funcionalidades

// ==========================================
// SISTEMA DE PASTA DE TRABALHO
// ==========================================
let pastaTrabalhoHandle = null;

// Função para escolher pasta de trabalho
async function escolherPastaTrabalho() {
    try {
        if (!('showDirectoryPicker' in window)) {
            alert('Seu navegador não suporta a seleção de pastas. Use Chrome, Edge ou Opera GX.');
            return;
        }

        const handle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        pastaTrabalhoHandle = handle;

        // Salva o handle no IndexedDB para persistir
        await salvarHandlePastaTrabalho(handle);

        // Atualiza o status na interface
        atualizarStatusPastaTrabalho(handle.name);

        console.log('✅ Pasta de trabalho selecionada:', handle.name);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro ao selecionar pasta:', error);
            alert('Erro ao selecionar pasta: ' + error.message);
        }
    }
}

// Função para criar estrutura de pastas para uma igreja
async function criarPastasIgreja(nomeIgreja) {
    if (!pastaTrabalhoHandle) {
        console.log('⚠️ Nenhuma pasta de trabalho selecionada');
        return null;
    }

    try {
        // Verifica permissão
        const permissao = await pastaTrabalhoHandle.requestPermission({ mode: 'readwrite' });
        if (permissao !== 'granted') {
            console.error('❌ Permissão negada para a pasta de trabalho');
            return null;
        }

        // Sanitiza o nome da igreja (remove caracteres inválidos)
        const nomePastaSanitizado = nomeIgreja
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

        // Cria pasta da igreja
        const pastaIgreja = await pastaTrabalhoHandle.getDirectoryHandle(nomePastaSanitizado, { create: true });

        // Cria subpastas
        const pastaFotos = await pastaIgreja.getDirectoryHandle('FOTOS', { create: true });
        const pastaImprimir = await pastaIgreja.getDirectoryHandle('IMPRIMIR', { create: true });
        const pastaOrcamento = await pastaIgreja.getDirectoryHandle('ORÇAMENTO', { create: true });

        console.log(`✅ Estrutura de pastas criada para: ${nomePastaSanitizado}`);

        return {
            igreja: pastaIgreja,
            fotos: pastaFotos,
            imprimir: pastaImprimir,
            orcamento: pastaOrcamento
        };
    } catch (error) {
        console.error('❌ Erro ao criar pastas:', error);
        return null;
    }
}

// Função para verificar se arquivo existe na pasta
async function arquivoExiste(pastaHandle, nomeArquivo) {
    try {
        await pastaHandle.getFileHandle(nomeArquivo, { create: false });
        return true;
    } catch {
        return false;
    }
}

// Função para gerar nome único (adiciona número sequencial se arquivo já existe)
async function gerarNomeUnico(pastaHandle, nomeArquivo) {
    // Separa nome e extensão
    const ultimoPonto = nomeArquivo.lastIndexOf('.');
    const nome = ultimoPonto > 0 ? nomeArquivo.substring(0, ultimoPonto) : nomeArquivo;
    const extensao = ultimoPonto > 0 ? nomeArquivo.substring(ultimoPonto) : '';

    // Se o arquivo não existe, retorna o nome original
    if (!(await arquivoExiste(pastaHandle, nomeArquivo))) {
        return nomeArquivo;
    }

    // Procura um número sequencial disponível
    let contador = 2;
    let novoNome = `${nome} (${contador})${extensao}`;

    while (await arquivoExiste(pastaHandle, novoNome)) {
        contador++;
        novoNome = `${nome} (${contador})${extensao}`;

        // Limite de segurança para evitar loop infinito
        if (contador > 100) {
            // Usa timestamp como fallback
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            novoNome = `${nome}_${timestamp}${extensao}`;
            break;
        }
    }

    console.log(`📁 Arquivo já existe, salvando como: ${novoNome}`);
    return novoNome;
}

// Função para salvar PDF em uma pasta específica (sem sobrescrever arquivos existentes)
async function salvarPDFEmPasta(pastaHandle, nomeArquivo, pdfBlob) {
    try {
        // Gera nome único se arquivo já existir
        const nomeUnico = await gerarNomeUnico(pastaHandle, nomeArquivo);

        const arquivoHandle = await pastaHandle.getFileHandle(nomeUnico, { create: true });
        const writable = await arquivoHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        console.log(`✅ PDF salvo: ${nomeUnico}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar PDF ${nomeArquivo}:`, error);
        return false;
    }
}

// Funções para persistir o handle da pasta no IndexedDB
async function abrirBDPastaTrabalho() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PastaTrabalhooDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles');
            }
        };
    });
}

async function salvarHandlePastaTrabalho(handle) {
    try {
        const db = await abrirBDPastaTrabalho();
        const transaction = db.transaction(['handles'], 'readwrite');
        const store = transaction.objectStore('handles');
        await store.put(handle, 'pastaTrabalho');
        console.log('✅ Handle da pasta salvo no IndexedDB');
    } catch (error) {
        console.error('Erro ao salvar handle da pasta:', error);
    }
}

async function obterHandlePastaTrabalho() {
    try {
        const db = await abrirBDPastaTrabalho();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['handles'], 'readonly');
            const store = transaction.objectStore('handles');
            const request = store.get('pastaTrabalho');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Erro ao obter handle da pasta:', error);
        return null;
    }
}

async function inicializarPastaTrabalho() {
    try {
        const handle = await obterHandlePastaTrabalho();
        if (handle) {
            pastaTrabalhoHandle = handle;
            atualizarStatusPastaTrabalho(handle.name);
            console.log('✅ Pasta de trabalho restaurada:', handle.name);
        }
    } catch (error) {
        console.warn('Sem pasta de trabalho salva:', error);
    }
}

function atualizarStatusPastaTrabalho(nomePasta) {
    const statusElement = document.getElementById('pastaTrabalhoStatus');
    if (statusElement) {
        statusElement.innerHTML = `<span style="color: #4ADC77;">✅ ${nomePasta}</span>`;
    }
}

// Expõe funções globalmente
window.escolherPastaTrabalho = escolherPastaTrabalho;
window.criarPastasIgreja = criarPastasIgreja;
window.salvarPDFEmPasta = salvarPDFEmPasta;

// ==========================================
// FIM DO SISTEMA DE PASTA DE TRABALHO
// ==========================================

// Objeto global para armazenar as logos em base64
const logosBase64 = {
    impactoSolucoes: null,
    spgDaSilva: null,
    virtualGuitar: null,
    glauber: null,
    ggProauto: null,
    stv: null,
    upServicos: null,
    sena: null,
    instalassom: null,
    megaLogo: null,
    megaCarimbo: null,
    tellaLogo: null,
    tellaCarimbo: null
};

// Textos padrão para cada tipo de relatório
const TEXTOS_RELATORIO = {
    manutencao: `Relatório Técnico Detalhado

1. Caixas de Som
Foi realizada a verificação da integridade física. Testes de funcionamento confirmaram alguns ruídos, que foram eliminados após ajustes. Cabos e conexões foram revisados e substituídos onde necessário. O posicionamento das caixas foi otimizado para melhor distribuição sonora.

2. Amplificadores
Foi realizado teste de ligação e ajuste para melhor resposta de som. Inspeção dos cabos resultou na substituição de algumas conexões defeituosas. Configurações foram ajustadas para melhor desempenho.

3. Mesa de Som
Canais e equalizadores foram testados e corrigidos conforme necessidade. Saídas e entradas foram revisadas e alguns ruídos foram eliminados. Potenciômetros e sliders passaram por limpeza e lubrificação. Integração com os demais equipamentos foi otimizada.

4. Microfone sem Fio
Testes de captação e transmissão foram realizados com êxito. Limpeza e higienização foram efetuadas. Alcance foi testado e ampliado para maior mobilidade.

5. Microfone Gooseneck
Captação foi testada e melhorada através de ajustes finos. Conexões e cabos passaram por revisão e algumas substituições foram feitas. Flexibilidade e posicionamento foram ajustados para melhor usabilidade. Integração com a mesa de som foi otimizada.

6. Caixa de Retorno
Testes de funcionamento foram realizados e a qualidade do som foi aprimorada. Conexões e cabos foram revisados e substituídos onde necessário. Posicionamento foi ajustado para melhor aproveitamento do som pelos músicos. Limpeza externa e interna foi realizada. Equalização foi ajustada conforme as necessidades dos usuários.

Conclusão
A igreja apresentava algumas falhas no sistema de som, que foram devidamente identificadas e corrigidas. Foram tomadas as providências necessárias para garantir seu funcionamento adequado, incluindo substituição de cabos, ajustes de configuração, limpeza e melhorias na distribuição sonora. O sistema agora encontra-se em condições ideais para o uso.`,

    igreja_nova: `Relatório Técnico Detalhado

1. Caixas de Som
Foram instaladas novas caixas de som em pontos estratégicos, visando uma distribuição sonora uniforme em todo o ambiente. Os suportes foram fixados com segurança e os cabos de áudio foram devidamente canalizados e organizados. Conexões foram testadas e protegidas contra interferências. O sistema foi calibrado para evitar distorções e garantir clareza sonora.

2. Amplificadores
Novos amplificadores foram integrados ao sistema, com ligação direta à mesa de som. A instalação seguiu as especificações técnicas dos equipamentos, com atenção especial à ventilação e dissipação de calor. Foram realizados testes de potência e resposta de frequência, assegurando o desempenho ideal para o espaço.

3. Mesa de Som
A mesa de som foi instalada em local de fácil acesso e visibilidade. Todos os canais foram configurados e equalizados conforme os equipamentos conectados. Entradas e saídas foram devidamente organizadas e identificadas. O sistema foi testado em conjunto com os demais dispositivos para garantir total compatibilidade e operação fluida.

4. Microfones sem Fio
Foram instalados microfones sem fio com receptores fixos ligados à mesa. A disposição dos equipamentos levou em consideração o alcance e a mobilidade dos usuários. Foram feitos testes de frequência e captação, com ajustes finos para evitar interferência e perda de sinal.

5. Microfone Gooseneck (de púlpito)
O microfone gooseneck foi instalado no púlpito com base fixa e conexão direta à mesa. Foram realizados testes de posicionamento e captação para assegurar clareza e presença vocal. A instalação buscou máxima discrição visual sem comprometer a performance.

6. Caixa de Retorno
Caixas de retorno foram posicionadas na área dos músicos e vocalistas, com foco na inteligibilidade e equilíbrio de volume. Foram conectadas diretamente à mesa via canais auxiliares. Equalizações específicas foram aplicadas conforme as necessidades de palco.

Conclusão
Foi realizada a instalação completa de um novo sistema de som na igreja, contemplando caixas acústicas, amplificadores, mesa de som, microfones com e sem fio e caixas de retorno. Todo o cabeamento foi feito com materiais de qualidade, seguindo padrões técnicos e de segurança. O sistema foi testado, ajustado e entregue em pleno funcionamento, oferecendo qualidade sonora e confiabilidade para os eventos da igreja.`
};

// Função para carregar imagens como base64
function carregarImagemComoBase64(imagem, callback) {
    // Cria um elemento para carregar a imagem
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = function () {
        // Cria um canvas para converter a imagem
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        // Desenha a imagem no canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Obtém a string base64
        const dataURL = canvas.toDataURL('image/png');
        callback(dataURL);
    };

    img.onerror = function () {
        console.error('Erro ao carregar imagem:', imagem);
        callback(null);
    };

    // Inicia o carregamento da imagem
    img.src = imagem;
}

// Função para inicializar o sistema de uploads das logos
function inicializarUploadLogos() {
    function handleImageUpload(inputId, imageId, logoKey, statusId) {
        const input = document.getElementById(inputId);
        const image = document.getElementById(imageId);
        const statusEl = document.getElementById(statusId);

        input.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                // Atualiza o status para "Carregando..."
                if (statusEl) statusEl.textContent = "Status: Carregando...";

                const reader = new FileReader();
                reader.onload = function (e) {
                    const imageData = e.target.result;
                    image.src = imageData;
                    image.style.display = 'block';

                    // Armazena a imagem em base64 na configuração
                    logosBase64[logoKey] = imageData;
                    console.log(`Logo ${logoKey} carregada com sucesso!`);

                    // Atualiza o status para "Carregada com sucesso"
                    if (statusEl) statusEl.textContent = "Status: Carregada com sucesso!";

                    // Salva as logos atualizadas no localStorage
                    salvarLogosNoLocalStorage(logosBase64);
                };
                reader.onerror = function () {
                    console.error("Erro ao ler o arquivo");
                    if (statusEl) statusEl.textContent = "Status: Erro ao carregar a imagem";
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Inicializa os uploads de cada logo
    handleImageUpload('inputLogoImpacto', 'logoImpacto', 'impactoSolucoes', 'statusLogoImpacto');
    handleImageUpload('inputLogoSPG', 'logoSPG', 'spgDaSilva', 'statusLogoSPG');
    handleImageUpload('inputLogoVirtualGuitar', 'logoVirtualGuitar', 'virtualGuitar', 'statusLogoVirtualGuitar');

    // Novas logos
    handleImageUpload('inputLogoGGProauto', 'logoGGProauto', 'ggProauto', 'statusLogoGGProauto');
    handleImageUpload('inputLogoSTV', 'logoSTV', 'stv', 'statusLogoSTV');
    handleImageUpload('inputLogoUPServicos', 'logoUPServicos', 'upServicos', 'statusLogoUPServicos');
    handleImageUpload('inputLogoSena', 'logoSena', 'sena', 'statusLogoSena');
    handleImageUpload('inputLogoInstalassom', 'logoInstalassom', 'instalassom', 'statusLogoInstalassom');
    handleImageUpload('inputLogoGlauber', 'logoGlauber', 'glauber', 'statusLogoGlauber');

    // Concorrentes Especiais
    handleImageUpload('inputLogoMegaEventos', 'logoMegaEventos', 'megaLogo', 'statusLogoMegaEventos');
    handleImageUpload('inputCarimboMegaEventos', 'carimboMegaEventos', 'megaCarimbo', 'statusCarimboMegaEventos');
    handleImageUpload('inputLogoTellaVideo', 'logoTellaVideo', 'tellaLogo', 'statusLogoTellaVideo');
    handleImageUpload('inputCarimboTellaVideo', 'carimboTellaVideo', 'tellaCarimbo', 'statusCarimboTellaVideo');
}

// Função para exibir as logos carregadas na interface
function exibirLogosCarregadas() {
    // Mostra as logos salvas na interface
    function mostrarLogoSeDisponivel(logoKey, imageId) {
        const image = document.getElementById(imageId);
        const statusEl = document.getElementById(`status${imageId}`);

        if (logosBase64[logoKey]) {
            image.src = logosBase64[logoKey];
            image.style.display = 'block';
            if (statusEl) statusEl.textContent = "Status: Carregada com sucesso!";
        }
    }

    // Para cada logo salva, exibe na interface
    mostrarLogoSeDisponivel('impactoSolucoes', 'logoImpacto');
    mostrarLogoSeDisponivel('spgDaSilva', 'logoSPG');
    mostrarLogoSeDisponivel('virtualGuitar', 'logoVirtualGuitar');

    // Novas logos
    mostrarLogoSeDisponivel('ggProauto', 'logoGGProauto');
    mostrarLogoSeDisponivel('stv', 'logoSTV');
    mostrarLogoSeDisponivel('upServicos', 'logoUPServicos');
    mostrarLogoSeDisponivel('sena', 'logoSena');
    mostrarLogoSeDisponivel('instalassom', 'logoInstalassom');
    mostrarLogoSeDisponivel('glauber', 'logoGlauber');
    // Concorrentes Especiais
    mostrarLogoSeDisponivel('megaLogo', 'logoMegaEventos');
    mostrarLogoSeDisponivel('megaCarimbo', 'carimboMegaEventos');
    mostrarLogoSeDisponivel('tellaLogo', 'logoTellaVideo');
    mostrarLogoSeDisponivel('tellaCarimbo', 'carimboTellaVideo');
}

// Função para carregar logos das empresas que já estão no DOM
function inicializarLogos() {
    // Primeiro, tenta carregar logos do localStorage
    const logosSalvas = carregarLogosDoLocalStorage();

    if (logosSalvas) {
        // Se existirem logos salvas, usa-as
        console.log("Logos encontradas no localStorage!");
        Object.assign(logosBase64, logosSalvas);
        exibirLogosCarregadas();
    } else {
        // Caso contrário, verifica se há elementos de imagem com IDs específicos
        const logoImpacto = document.getElementById('logoImpacto');
        if (logoImpacto && logoImpacto.src && logoImpacto.src !== "" && !logoImpacto.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoImpacto.src, (base64) => {
                if (base64) {
                    logosBase64.impactoSolucoes = base64;
                    console.log("Logo Impacto Soluções carregada!");
                    salvarLogosNoLocalStorage(logosBase64); // Salva após carregar
                }
            });
        }

        const logoSPG = document.getElementById('logoSPG');
        if (logoSPG && logoSPG.src && logoSPG.src !== "" && !logoSPG.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoSPG.src, (base64) => {
                if (base64) {
                    logosBase64.spgDaSilva = base64;
                    console.log("Logo SPG da Silva carregada!");
                    salvarLogosNoLocalStorage(logosBase64); // Salva após carregar
                }
            });
        }

        const logoVirtualGuitar = document.getElementById('logoVirtualGuitar');
        if (logoVirtualGuitar && logoVirtualGuitar.src && logoVirtualGuitar.src !== "" && !logoVirtualGuitar.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoVirtualGuitar.src, (base64) => {
                if (base64) {
                    logosBase64.virtualGuitar = base64;
                    console.log("Logo Virtual Guitar Shop carregada!");
                    salvarLogosNoLocalStorage(logosBase64); // Salva após carregar
                }
            });
        }

        // Novas logos
        const logoGGProauto = document.getElementById('logoGGProauto');
        if (logoGGProauto && logoGGProauto.src && logoGGProauto.src !== "" && !logoGGProauto.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoGGProauto.src, (base64) => {
                if (base64) {
                    logosBase64.ggProauto = base64;
                    console.log("Logo GG PROAUTO LTDA carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }

        const logoSTV = document.getElementById('logoSTV');
        if (logoSTV && logoSTV.src && logoSTV.src !== "" && !logoSTV.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoSTV.src, (base64) => {
                if (base64) {
                    logosBase64.stv = base64;
                    console.log("Logo STV IMAGEM E SOM carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }

        const logoUPServicos = document.getElementById('logoUPServicos');
        if (logoUPServicos && logoUPServicos.src && logoUPServicos.src !== "" && !logoUPServicos.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoUPServicos.src, (base64) => {
                if (base64) {
                    logosBase64.upServicos = base64;
                    console.log("Logo UP SERVIÇOS carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }

        const logoSena = document.getElementById('logoSena');
        if (logoSena && logoSena.src && logoSena.src !== "" && !logoSena.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoSena.src, (base64) => {
                if (base64) {
                    logosBase64.sena = base64;
                    console.log("Logo SENA AUDIOVISUAL PRODUÇÕES carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }

        const logoInstalassom = document.getElementById('logoInstalassom');
        if (logoInstalassom && logoInstalassom.src && logoInstalassom.src !== "" && !logoInstalassom.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoInstalassom.src, (base64) => {
                if (base64) {
                    logosBase64.instalassom = base64;
                    console.log("Logo INSTALASSOM carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }

        const logoGlauber = document.getElementById('logoGlauber');
        if (logoGlauber && logoGlauber.src && logoGlauber.src !== "" && !logoGlauber.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoGlauber.src, (base64) => {
                if (base64) {
                    logosBase64.glauber = base64;
                    console.log("Logo GLAUBER SISTEMAS CONSTRUTIVOS carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }

        // Mega Eventos e Tella Vídeo (logo e carimbo), se já estiverem no DOM
        const logoMegaEventos = document.getElementById('logoMegaEventos');
        if (logoMegaEventos && logoMegaEventos.src && logoMegaEventos.src !== "" && !logoMegaEventos.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoMegaEventos.src, (base64) => {
                if (base64) {
                    logosBase64.megaLogo = base64;
                    console.log("Logo MEGA EVENTOS carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }
        const carimboMegaEventos = document.getElementById('carimboMegaEventos');
        if (carimboMegaEventos && carimboMegaEventos.src && carimboMegaEventos.src !== "" && !carimboMegaEventos.src.endsWith('undefined')) {
            carregarImagemComoBase64(carimboMegaEventos.src, (base64) => {
                if (base64) {
                    logosBase64.megaCarimbo = base64;
                    console.log("Carimbo MEGA EVENTOS carregado!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }
        const logoTellaVideo = document.getElementById('logoTellaVideo');
        if (logoTellaVideo && logoTellaVideo.src && logoTellaVideo.src !== "" && !logoTellaVideo.src.endsWith('undefined')) {
            carregarImagemComoBase64(logoTellaVideo.src, (base64) => {
                if (base64) {
                    logosBase64.tellaLogo = base64;
                    console.log("Logo TELLA VIDEO carregada!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }
        const carimboTellaVideo = document.getElementById('carimboTellaVideo');
        if (carimboTellaVideo && carimboTellaVideo.src && carimboTellaVideo.src !== "" && !carimboTellaVideo.src.endsWith('undefined')) {
            carregarImagemComoBase64(carimboTellaVideo.src, (base64) => {
                if (base64) {
                    logosBase64.tellaCarimbo = base64;
                    console.log("Carimbo TELLA VIDEO carregado!");
                    salvarLogosNoLocalStorage(logosBase64);
                }
            });
        }
    }
}

// Função para gerar orçamentos
async function iniciarGeracaoOrcamentos() {
    // Remover listener existente para evitar duplicação
    const gerarBtn = document.getElementById('gerarOrcamentosBtn');

    if (!gerarBtn) {
        console.error("Botão de gerar orçamentos não encontrado!");
        return;
    }

    const novoGerarBtn = gerarBtn.cloneNode(true);
    gerarBtn.parentNode.replaceChild(novoGerarBtn, gerarBtn);

    // Adiciona o event listener ao novo botão
    novoGerarBtn.addEventListener('click', async function () {
        console.log("Botão de gerar orçamentos clicado!");

        if (igrejasAdicionadas.length === 0) {
            alert('Por favor, adicione pelo menos uma igreja à lista.');
            return;
        }

        const dataOrcamento = document.getElementById('dataOrcamento').value;
        const prazoExecucao = document.getElementById('prazoExecucao').value;
        // Textos personalizados agora vêm armazenados em cada igreja ao adicionar

        // Muda para a tab de resultados
        const tabResultados = document.querySelector('[data-tab="resultados"]');
        if (tabResultados) {
            tabResultados.click();
        } else {
            console.error("Tab de resultados não encontrada!");
        }

        // Limpa resultados anteriores
        orcamentosGerados.length = 0; // Limpa o array
        for (const key in pdfsGerados) {
            delete pdfsGerados[key];
        }

        const pdfsDisplay = document.getElementById('pdfsDisplay');
        if (pdfsDisplay) {
            pdfsDisplay.innerHTML = '';
        }

        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (downloadAllBtn) {
            downloadAllBtn.disabled = true;
        }

        // Inicializa barra de progresso
        const progressBar = document.getElementById('progressBar');
        const statusMessage = document.getElementById('statusMessage');

        if (progressBar) {
            progressBar.style.width = '0%';
        }

        if (statusMessage) {
            statusMessage.innerHTML = `<p>Gerando orçamentos para ${igrejasAdicionadas.length} igrejas...</p>`;
        }

        try {
            for (let i = 0; i < igrejasAdicionadas.length; i++) {
                const igreja = igrejasAdicionadas[i];
                const empresaSelecionada = igreja.empresa;

                if (progressBar) {
                    progressBar.style.width = `${(i / igrejasAdicionadas.length) * 100}%`;
                }

                if (statusMessage) {
                    statusMessage.innerHTML = `<p>Processando igreja ${i + 1}/${igrejasAdicionadas.length}: ${igreja.nome}</p>`;
                }

                // Gera dados dos orçamentos com a empresa específica
                const dadosOrcamento = gerarDadosOrcamento(
                    igreja,
                    dataOrcamento,
                    prazoExecucao,
                    configuracao,
                    empresaSelecionada
                );
                // Marca pedido especial para controle de textos
                if (igreja.tipoPedido === 'especial') {
                    dadosOrcamento.especialSemPadrao = true;
                }

                // Passa o tipo de texto para o orçamento
                dadosOrcamento.tipoTexto = igreja.tipoTexto || 'padrao';

                // Anexa textos personalizados se tipoTexto for personalizado
                if (igreja.tipoTexto === 'personalizado') {
                    const sua = (igreja.textoSuaEmpresa || '').trim();
                    let conc = (igreja.textoConcorrente || '').trim();
                    if (!conc) conc = gerarTextoConcorrenteAuto(sua);
                    dadosOrcamento.textoPersonalizadoSuaEmpresa = sua;
                    dadosOrcamento.textoPersonalizadoConcorrente = conc;
                    // Garante que tipoTexto seja 'personalizado' para a lógica do PDF
                    dadosOrcamento.tipoTexto = 'personalizado';
                }

                orcamentosGerados.push(dadosOrcamento);

                // Gera os PDFs
                await gerarPDFs(dadosOrcamento, i, pdfsGerados);

                // Atualiza a interface - passando pdfsGerados como parâmetro
                if (typeof atualizarInterfaceResultados === 'function') {
                    atualizarInterfaceResultados(dadosOrcamento, i, pdfsGerados);
                } else {
                    console.error("Função atualizarInterfaceResultados não encontrada");
                }

                // Pausa breve para permitir que a UI atualize
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Completa a barra de progresso
            if (progressBar) {
                progressBar.style.width = '100%';
            }

            if (statusMessage) {
                statusMessage.innerHTML = `<p>Todos os orçamentos foram gerados com sucesso!</p>`;
            }

            if (downloadAllBtn) {
                downloadAllBtn.disabled = false;
            }

            // Zera campos de texto personalizado após a geração
            try {
                const chk = document.getElementById('usarTextoPersonalizadoOrcamento');
                const bloco = document.getElementById('blocoTextoOrcamento');
                const txtSua = document.getElementById('textoOrcamentoSuaEmpresa');
                const txtConc = document.getElementById('textoOrcamentoConcorrente');
                if (chk) chk.checked = false;
                if (bloco) bloco.style.display = 'none';
                if (txtSua) txtSua.value = '';
                if (txtConc) txtConc.value = '';
            } catch (_) { }

        } catch (error) {
            console.error('Erro ao gerar orçamentos:', error);
            if (statusMessage) {
                statusMessage.innerHTML = `<p class="alert alert-error">Erro ao gerar orçamentos: ${error.message}</p>`;
            }
        }
    });

    console.log("Evento de geração de orçamentos inicializado com sucesso!");
}

// Função para baixar todos os PDFs como ZIP
async function inicializarDownloadZip() {
    // Remover listener existente para evitar duplicação
    const downloadBtn = document.getElementById('downloadAllBtn');
    const novoDownloadBtn = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(novoDownloadBtn, downloadBtn);

    novoDownloadBtn.addEventListener('click', async function () {
        const JSZip = window.JSZip;
        const zip = new JSZip();

        for (const key in pdfsGerados) {
            const dados = pdfsGerados[key];
            const igreja = dados.igreja;
            const orcamento = dados.orcamento;

            // Formatação do nome da igreja para evitar caracteres inválidos em nome de arquivo
            const nomeIgrejaSeguro = igreja.nome.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            const codigoIgreja = igreja.codigo.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);

            // Nome da empresa formatado
            const empresaNome = orcamento.suaEmpresa.nome.replace(/[^a-zA-Z0-9]/g, '_');
            zip.file(`${codigoIgreja}_${nomeIgrejaSeguro}_${empresaNome}.pdf`,
                dados.pdfSuaEmpresa.output('blob'));

            // Adiciona concorrentes conforme existirem
            if (dados.pdfConcorrente && dados.empresaConcorrente) {
                const concorrenteNome = dados.empresaConcorrente.replace(/[^a-zA-Z0-9]/g, '_');
                zip.file(`${codigoIgreja}_${nomeIgrejaSeguro}_${concorrenteNome}.pdf`, dados.pdfConcorrente.output('blob'));
            }
            if (dados.pdfConcorrenteMega && dados.empresaConcorrenteMega) {
                const megaNome = dados.empresaConcorrenteMega.replace(/[^a-zA-Z0-9]/g, '_');
                zip.file(`${codigoIgreja}_${nomeIgrejaSeguro}_${megaNome}.pdf`, dados.pdfConcorrenteMega.output('blob'));
            }
            if (dados.pdfConcorrenteTella && dados.empresaConcorrenteTella) {
                const tellaNome = dados.empresaConcorrenteTella.replace(/[^a-zA-Z0-9]/g, '_');
                zip.file(`${codigoIgreja}_${nomeIgrejaSeguro}_${tellaNome}.pdf`, dados.pdfConcorrenteTella.output('blob'));
            }
        }

        // Gera e baixa o arquivo ZIP
        const zipContent = await zip.generateAsync({ type: 'blob' });
        saveAs(zipContent, 'Orçamentos_Igrejas.zip');
    });
}

// Expõe a função de baixar PDF para uso global
window.baixarPDF = function (index, tipo) {
    baixarPDF(index, tipo, pdfsGerados);
};

// Disponibilizar logos para outros scripts
window.obterLogos = function () {
    return logosBase64;
};

// --- Relatório Técnico (NOVO SISTEMA) ---
let relatoriosAdicionados = [];
let pdfsRelatoriosGerados = {};
let relatoriosData = {
    pendentes: [],      // Igrejas com relatório pendente
    gerados: [],        // Igrejas com relatório gerado
    pedidosSandro: []   // Pedidos do Sandro
};
let igrejaAtualRelatorio = null; // Igreja selecionada no modal
let relatorioFileHandle = null; // Handle do arquivo JSON vinculado
let abaAtivaRelatorio = 'pendentes'; // Aba ativa atual

// ==========================================
// PERSISTÊNCIA EM ARQUIVO JSON (RELATÓRIOS)
// ==========================================

const RELATORIO_DB_NAME = 'relatorio-db';
const RELATORIO_STORE = 'handles';
const RELATORIO_HANDLE_KEY = 'relatorioDataFile';

function openRelatorioDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(RELATORIO_DB_NAME, 1);
        request.onupgradeneeded = function () {
            const db = request.result;
            if (!db.objectStoreNames.contains(RELATORIO_STORE)) {
                db.createObjectStore(RELATORIO_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getStoredRelatorioHandle() {
    const db = await openRelatorioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(RELATORIO_STORE, 'readonly');
        const store = tx.objectStore(RELATORIO_STORE);
        const req = store.get(RELATORIO_HANDLE_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function setStoredRelatorioHandle(handle) {
    const db = await openRelatorioDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(RELATORIO_STORE, 'readwrite');
        const store = tx.objectStore(RELATORIO_STORE);
        const req = store.put(handle, RELATORIO_HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Carrega dados dos relatórios do localStorage
function carregarDadosRelatorios() {
    try {
        const salvo = localStorage.getItem('relatoriosData');
        if (salvo) {
            relatoriosData = JSON.parse(salvo);
            // Garante estrutura correta
            if (!relatoriosData.pendentes) relatoriosData.pendentes = [];
            if (!relatoriosData.gerados) relatoriosData.gerados = [];
            if (!relatoriosData.pedidosSandro) relatoriosData.pedidosSandro = [];

            // Migra dados antigos (se existir estrutura antiga com "igrejas")
            if (relatoriosData.igrejas && Array.isArray(relatoriosData.igrejas)) {
                relatoriosData.igrejas.forEach(ig => {
                    if (ig.status === 'gerado') {
                        if (!relatoriosData.gerados.find(g => g.nome === ig.nome && g.id === ig.id)) {
                            relatoriosData.gerados.push(ig);
                        }
                    } else {
                        if (!relatoriosData.pendentes.find(p => p.nome === ig.nome && p.id === ig.id)) {
                            relatoriosData.pendentes.push(ig);
                        }
                    }
                });
                delete relatoriosData.igrejas;
                salvarDadosRelatorios();
            }
        }
        const total = relatoriosData.pendentes.length + relatoriosData.gerados.length + relatoriosData.pedidosSandro.length;
        console.log('✅ Dados de relatórios carregados:', total, 'igrejas');
    } catch (e) {
        console.error('Erro ao carregar dados dos relatórios:', e);
        relatoriosData = { pendentes: [], gerados: [], pedidosSandro: [] };
    }
}

// Salva dados dos relatórios no localStorage e arquivo vinculado
function salvarDadosRelatorios() {
    try {
        localStorage.setItem('relatoriosData', JSON.stringify(relatoriosData));
        console.log('✅ Dados de relatórios salvos no localStorage');

        // Salva também no arquivo vinculado (se existir)
        if (relatorioFileHandle) {
            salvarRelatoriosEmArquivo().catch(err =>
                console.error('❌ Erro ao salvar no arquivo:', err)
            );
        }
    } catch (e) {
        console.error('❌ Erro ao salvar dados dos relatórios:', e);
    }
}

// Lê dados do arquivo JSON vinculado
async function lerRelatoriosDoArquivo() {
    try {
        if (!relatorioFileHandle) return;
        const file = await relatorioFileHandle.getFile();
        const text = await file.text();

        const json = JSON.parse(text || '{}');

        // Garante estrutura correta
        relatoriosData = {
            pendentes: Array.isArray(json.pendentes) ? json.pendentes : [],
            gerados: Array.isArray(json.gerados) ? json.gerados : [],
            pedidosSandro: Array.isArray(json.pedidosSandro) ? json.pedidosSandro : []
        };

        localStorage.setItem('relatoriosData', JSON.stringify(relatoriosData));
        const total = relatoriosData.pendentes.length + relatoriosData.gerados.length + relatoriosData.pedidosSandro.length;
        console.log('✅ Dados de relatórios carregados do arquivo:', total, 'igrejas');

        atualizarListaRelatoriosNovo();
    } catch (error) {
        console.error('❌ Erro ao ler relatórios do arquivo:', error);
    }
}

// Salva dados no arquivo JSON vinculado
async function salvarRelatoriosEmArquivo() {
    try {
        if (!relatorioFileHandle) {
            console.log('📭 Nenhum arquivo vinculado para salvar');
            return;
        }

        // Verifica se temos permissão antes de salvar
        const permissao = await relatorioFileHandle.queryPermission({ mode: 'readwrite' });
        if (permissao !== 'granted') {
            console.log('⏳ Sem permissão para salvar, solicitando...');
            const resultado = await relatorioFileHandle.requestPermission({ mode: 'readwrite' });
            if (resultado !== 'granted') {
                console.warn('❌ Permissão de escrita negada');
                return;
            }
        }

        const writable = await relatorioFileHandle.createWritable();
        const conteudo = JSON.stringify(relatoriosData, null, 2);
        await writable.write(conteudo);
        await writable.close();
        console.log('✅ Relatórios salvos no arquivo vinculado');
    } catch (error) {
        console.error('❌ Erro ao salvar relatórios no arquivo:', error);
        // Se o erro for de permissão, limpa o handle
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
            console.warn('⚠️ Handle inválido, será necessário vincular novamente');
        }
    }
}

// Seleciona arquivo JSON existente para vincular
async function selecionarArquivoRelatorios() {
    try {
        if (!('showOpenFilePicker' in window)) {
            alert('Seu navegador não suporta vincular arquivo diretamente. Use Importar/Exportar JSON.');
            return;
        }
        const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        relatorioFileHandle = handle;
        await setStoredRelatorioHandle(handle);
        console.log('✅ Handle salvo no IndexedDB:', handle.name);
        await lerRelatoriosDoArquivo();
        atualizarStatusArquivoRelatorio(handle.name);
        alert('Arquivo JSON de relatórios vinculado com sucesso!');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro ao vincular arquivo de relatórios:', error);
        }
    }
}

// Cria novo arquivo JSON para relatórios
async function criarArquivoRelatorios() {
    try {
        if (!('showSaveFilePicker' in window)) {
            alert('Seu navegador não suporta criar arquivo diretamente. Use Exportar JSON.');
            return;
        }
        const handle = await window.showSaveFilePicker({
            suggestedName: 'relatorios_data.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        relatorioFileHandle = handle;
        await setStoredRelatorioHandle(handle);
        console.log('✅ Handle salvo no IndexedDB:', handle.name);
        await salvarRelatoriosEmArquivo();
        atualizarStatusArquivoRelatorio(handle.name);
        alert('Arquivo JSON de relatórios criado e vinculado!');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erro ao criar arquivo de relatórios:', error);
        }
    }
}

// Exporta JSON para download manual
function exportarRelatoriosJson() {
    const conteudo = JSON.stringify(relatoriosData, null, 2);
    const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
    saveAs(blob, 'relatorios_data.json');
}

// Importa JSON de arquivo
function importarRelatoriosJson(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);

            // Valida e garante estrutura
            relatoriosData = {
                pendentes: Array.isArray(json.pendentes) ? json.pendentes : [],
                gerados: Array.isArray(json.gerados) ? json.gerados : [],
                pedidosSandro: Array.isArray(json.pedidosSandro) ? json.pedidosSandro : []
            };

            salvarDadosRelatorios();
            atualizarListaRelatoriosNovo();
            alert('Dados de relatórios importados com sucesso!');
        } catch (err) {
            alert('Erro ao importar JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Inicializa arquivo de relatórios (restaura handle vinculado)
async function inicializarArquivoRelatorios() {
    try {
        console.log('🔄 Tentando restaurar arquivo de relatórios...');
        const handle = await getStoredRelatorioHandle();

        if (handle) {
            console.log('📁 Handle encontrado:', handle.name);

            // Verifica permissão
            const permissao = await handle.queryPermission({ mode: 'readwrite' });
            console.log('🔐 Permissão atual:', permissao);

            if (permissao === 'granted') {
                relatorioFileHandle = handle;
                await lerRelatoriosDoArquivo();
                atualizarStatusArquivoRelatorio(handle.name);
                console.log('✅ Arquivo de relatórios reconectado automaticamente!');
            } else {
                // Tenta pedir permissão
                console.log('⏳ Pedindo permissão...');
                const resultado = await handle.requestPermission({ mode: 'readwrite' });
                console.log('🔐 Resultado da permissão:', resultado);

                if (resultado === 'granted') {
                    relatorioFileHandle = handle;
                    await lerRelatoriosDoArquivo();
                    atualizarStatusArquivoRelatorio(handle.name);
                    console.log('✅ Arquivo de relatórios reconectado após permissão!');
                } else {
                    console.warn('❌ Permissão negada pelo usuário');
                }
            }
        } else {
            console.log('📭 Nenhum arquivo de relatórios vinculado anteriormente');
        }
    } catch (error) {
        console.warn('⚠️ Erro ao restaurar arquivo de relatórios:', error);
    }
}

// Atualiza status do arquivo vinculado na interface
function atualizarStatusArquivoRelatorio(nome) {
    const status = document.getElementById('relatorioArquivoStatus');
    if (status) {
        status.innerHTML = `<span style="color: #4ADC77;">✅ ${nome}</span>`;
    }
}

// Função para verificar e pedir permissão do arquivo de relatórios
async function verificarPermissaoRelatorio() {
    try {
        const handle = await getStoredRelatorioHandle();
        if (!handle) {
            console.log('📁 Relatório: Nenhum arquivo vinculado');
            return { vinculado: false };
        }

        console.log('📁 Relatório: Arquivo encontrado:', handle.name);

        const permissaoLeitura = await handle.queryPermission({ mode: 'read' });
        if (permissaoLeitura !== 'granted') {
            console.log('⏳ Relatório: Pedindo permissão de leitura...');
            const resultado = await handle.requestPermission({ mode: 'read' });
            if (resultado !== 'granted') {
                return { vinculado: true, permissao: false };
            }
        }

        const permissaoEscrita = await handle.queryPermission({ mode: 'readwrite' });
        if (permissaoEscrita !== 'granted') {
            console.log('⏳ Relatório: Pedindo permissão de escrita...');
            const resultado = await handle.requestPermission({ mode: 'readwrite' });
            if (resultado !== 'granted') {
                return { vinculado: true, permissao: 'leitura' };
            }
        }

        relatorioFileHandle = handle;

        // Lê os dados do arquivo e atualiza a interface
        await lerRelatoriosDoArquivo();
        atualizarStatusArquivoRelatorio(handle.name);

        console.log('✅ Relatório: Permissão concedida e dados carregados!');
        return { vinculado: true, permissao: true };
    } catch (error) {
        console.error('❌ Relatório: Erro ao verificar permissão:', error);
        return { vinculado: false, erro: error.message };
    }
}

// Expõe função de verificação de permissão
window.verificarPermissaoRelatorio = verificarPermissaoRelatorio;

// Função que SEMPRE pede permissão (sem verificar antes)
async function forcarPermissaoRelatorio() {
    try {
        const handle = await getStoredRelatorioHandle();
        if (!handle) {
            console.log('📭 Relatório: Nenhum arquivo vinculado');
            return { vinculado: false };
        }

        console.log('🔐 Relatório: Solicitando permissão para:', handle.name);

        // SEMPRE pede permissão, mesmo se já tiver
        const resultado = await handle.requestPermission({ mode: 'readwrite' });

        if (resultado === 'granted') {
            relatorioFileHandle = handle;
            await lerRelatoriosDoArquivo();
            atualizarStatusArquivoRelatorio(handle.name);
            console.log('✅ Relatório: Permissão concedida!');
            return { vinculado: true, permissao: true };
        } else {
            console.warn('❌ Relatório: Permissão negada');
            return { vinculado: true, permissao: false };
        }
    } catch (error) {
        console.error('❌ Relatório: Erro:', error);
        return { vinculado: false, erro: error.message };
    }
}

window.forcarPermissaoRelatorio = forcarPermissaoRelatorio;

// ==========================================
// FIM DA PERSISTÊNCIA EM ARQUIVO
// ==========================================

// Sincroniza a lista de igrejas com as Notas Fiscais
function sincronizarIgrejasRelatorio() {
    try {
        const nfDataStr = localStorage.getItem('notasFiscais');
        if (!nfDataStr) return;

        const nfData = JSON.parse(nfDataStr);
        const igrejasNF = nfData.igrejas || [];

        // PASSO 1: Remover igrejas que não existem mais nas Notas Fiscais
        ['pendentes', 'gerados', 'pedidosSandro'].forEach(categoria => {
            relatoriosData[categoria] = relatoriosData[categoria].filter(igrejaRel => {
                const aindaExiste = igrejasNF.some(igrejaNF =>
                    igrejaNF.nome === igrejaRel.nome && igrejaNF.id === igrejaRel.id
                );
                if (!aindaExiste) {
                    console.log(`🗑️ Removendo igreja do Relatório (${categoria}): "${igrejaRel.nome}"`);
                }
                return aindaExiste;
            });
        });

        // PASSO 2: Adicionar igrejas novas como pendentes
        igrejasNF.forEach(igrejaNF => {
            const jaPendente = relatoriosData.pendentes.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);
            const jaGerado = relatoriosData.gerados.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);
            const jaSandro = relatoriosData.pedidosSandro.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);

            if (!jaPendente && !jaGerado && !jaSandro) {
                relatoriosData.pendentes.push({
                    nome: igrejaNF.nome,
                    id: igrejaNF.id,
                    dataGeracao: null
                });
                console.log(`➕ Nova igreja adicionada ao Relatório: "${igrejaNF.nome}"`);
            }
        });

        salvarDadosRelatorios();
    } catch (error) {
        console.error('Erro ao sincronizar igrejas para relatório:', error);
    }
}

// Move igreja para Pendentes
function moverParaPendentesRelatorio(tipoOrigem, index) {
    const igreja = relatoriosData[tipoOrigem][index];
    if (!igreja) return;

    relatoriosData[tipoOrigem].splice(index, 1);
    relatoriosData.pendentes.push(igreja);

    salvarDadosRelatorios();
    atualizarListaRelatoriosNovo();
}

// Move igreja para Gerados
function moverParaGeradosRelatorio(tipoOrigem, index) {
    const igreja = relatoriosData[tipoOrigem][index];
    if (!igreja) return;

    relatoriosData[tipoOrigem].splice(index, 1);
    igreja.dataGeracao = new Date().toISOString();
    relatoriosData.gerados.push(igreja);

    salvarDadosRelatorios();
    atualizarListaRelatoriosNovo();
}

// Move igreja para Sandro
function moverParaSandroRelatorio(tipoOrigem, index) {
    const igreja = relatoriosData[tipoOrigem][index];
    if (!igreja) return;

    relatoriosData[tipoOrigem].splice(index, 1);
    relatoriosData.pedidosSandro.push(igreja);

    salvarDadosRelatorios();
    atualizarListaRelatoriosNovo();
}

// Atualiza a lista de igrejas na interface de relatórios
function atualizarListaRelatoriosNovo() {
    const container = document.getElementById('relatorioIgrejasList');
    if (!container) return;

    // Sincroniza com NF antes de exibir
    sincronizarIgrejasRelatorio();

    container.innerHTML = '';

    // Cria as tabs
    const tabsHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="relatorio-tabs" style="display: flex; gap: 5px;">
                <button class="relatorio-tab-button ${abaAtivaRelatorio === 'pendentes' ? 'active' : ''}" onclick="mudarAbaRelatorio('pendentes')">
                    Pendentes (${relatoriosData.pendentes.length})
                </button>
                <button class="relatorio-tab-button ${abaAtivaRelatorio === 'gerados' ? 'active' : ''}" onclick="mudarAbaRelatorio('gerados')">
                    Gerados (${relatoriosData.gerados.length})
                </button>
                <button class="relatorio-tab-button ${abaAtivaRelatorio === 'pedidosSandro' ? 'active' : ''}" onclick="mudarAbaRelatorio('pedidosSandro')">
                    Sandro (${relatoriosData.pedidosSandro.length})
                </button>
            </div>
            <button onclick="recarregarRelatorios()" class="btn-secondary" style="padding: 8px 15px; font-size: 13px;">
                <i class="fas fa-sync-alt"></i> Atualizar
            </button>
        </div>
    `;
    container.innerHTML = tabsHTML;

    // Obtém lista da aba ativa
    const listaAtual = relatoriosData[abaAtivaRelatorio] || [];

    if (listaAtual.length === 0) {
        container.innerHTML += `
            <div style="text-align: center; padding: 40px; color: #666; border: 1px dashed #ddd; border-radius: 8px;">
                <i class="fas fa-inbox" style="font-size: 36px; margin-bottom: 10px; opacity: 0.3;"></i>
                <p>Nenhuma igreja nesta categoria.</p>
            </div>
        `;
    } else {
        // Tabela
        let tabelaHTML = `
            <div class="relatorio-tabela">
                <div class="relatorio-header">
                    <div>Igreja</div>
                    <div>Status</div>
                    <div>Ações</div>
                </div>
        `;

        listaAtual.forEach((igreja, index) => {
            const chave = `${igreja.nome}_${igreja.id}`;

            // Define status visual baseado na aba
            let statusClass, statusText;
            if (abaAtivaRelatorio === 'pendentes') {
                statusClass = 'status-pendente';
                statusText = 'Pendente';
            } else if (abaAtivaRelatorio === 'gerados') {
                statusClass = 'status-gerado';
                statusText = 'Gerado';
            } else {
                statusClass = 'status-sandro';
                statusText = 'Sandro';
            }

            const dataGeracao = igreja.dataGeracao ?
                new Date(igreja.dataGeracao).toLocaleDateString('pt-BR') : '';

            tabelaHTML += `
                <div class="relatorio-row">
                    <div class="relatorio-col-igreja">
                        <strong>${igreja.nome}</strong>
                        ${igreja.id ? `<span class="relatorio-id">ID: ${igreja.id}</span>` : ''}
                        ${dataGeracao ? `<span class="relatorio-id" style="color: #4ADC77;">Gerado em: ${dataGeracao}</span>` : ''}
                    </div>
                    <div>
                        <span class="relatorio-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="relatorio-col-acoes">
                        <button class="btn-relatorio btn-relatorio-gerar" onclick="abrirModalRelatorio('${igreja.nome}', '${igreja.id || ''}', ${index}, '${abaAtivaRelatorio}')">
                            <i class="fas fa-file-pdf"></i> Gerar
                        </button>
                        ${abaAtivaRelatorio !== 'pendentes' ? `
                            <button class="btn-relatorio btn-relatorio-icon" onclick="moverParaPendentesRelatorio('${abaAtivaRelatorio}', ${index})" title="Mover para Pendentes">
                                <i class="fas fa-clock"></i>
                            </button>
                        ` : ''}
                        ${abaAtivaRelatorio !== 'gerados' ? `
                            <button class="btn-relatorio btn-relatorio-icon" onclick="moverParaGeradosRelatorio('${abaAtivaRelatorio}', ${index})" title="Mover para Gerados">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        ${abaAtivaRelatorio !== 'pedidosSandro' ? `
                            <button class="btn-relatorio btn-relatorio-icon" onclick="moverParaSandroRelatorio('${abaAtivaRelatorio}', ${index})" title="Mover para Sandro">
                                <i class="fas fa-user"></i>
                            </button>
                        ` : ''}
                        ${pdfsRelatoriosGerados[chave] ? `
                            <button class="btn-relatorio btn-relatorio-download" onclick="baixarRelatorioIndividual('${chave}')" title="Baixar PDF">
                                <i class="fas fa-download"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        tabelaHTML += '</div>';
        container.innerHTML += tabelaHTML;
    }

    // Adiciona botões de gerenciamento de JSON
    container.insertAdjacentHTML('beforeend', criarBotoesGerenciamentoRelatorio());
}

// Muda aba ativa
function mudarAbaRelatorio(aba) {
    abaAtivaRelatorio = aba;
    atualizarListaRelatoriosNovo();
}

// Recarrega dados dos relatórios
function recarregarRelatorios() {
    sincronizarIgrejasRelatorio();
    atualizarListaRelatoriosNovo();
}

// Expõe funções de movimento globalmente
window.moverParaPendentesRelatorio = moverParaPendentesRelatorio;
window.moverParaGeradosRelatorio = moverParaGeradosRelatorio;
window.moverParaSandroRelatorio = moverParaSandroRelatorio;
window.mudarAbaRelatorio = mudarAbaRelatorio;
window.recarregarRelatorios = recarregarRelatorios;

// Cria os botões de gerenciamento de JSON para relatórios
function criarBotoesGerenciamentoRelatorio() {
    return `
        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
            <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                <i class="fas fa-database"></i> Gerenciamento de Dados
            </h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <button onclick="exportarRelatoriosJson()" class="btn-secondary" style="padding: 8px 15px; font-size: 13px;">
                    <i class="fas fa-download"></i> Exportar JSON
                </button>
                <input type="file" id="relatorioImportInput" accept="application/json" style="display:none" 
                    onchange="importarRelatoriosJson(this.files[0]); this.value=null;">
                <button onclick="document.getElementById('relatorioImportInput').click()" class="btn-secondary" style="padding: 8px 15px; font-size: 13px;">
                    <i class="fas fa-upload"></i> Importar JSON
                </button>
                <button onclick="selecionarArquivoRelatorios()" class="btn-secondary" style="padding: 8px 15px; font-size: 13px;">
                    <i class="fas fa-link"></i> Vincular JSON
                </button>
                <button onclick="criarArquivoRelatorios()" class="btn-secondary" style="padding: 8px 15px; font-size: 13px;">
                    <i class="fas fa-file"></i> Criar JSON
                </button>
                <span id="relatorioArquivoStatus" style="font-size: 12px; color: #666; margin-left: 10px;">
                    Nenhum arquivo vinculado
                </span>
            </div>
        </div>
    `;
}

// Abre o modal para gerar relatório
function abrirModalRelatorio(nome, id, index, tipoOrigem = 'pendentes') {
    igrejaAtualRelatorio = { nome, id, index, tipoOrigem };

    // Atualiza título do modal
    document.getElementById('modalRelatorioTitulo').textContent = `Gerar Relatório - ${nome}`;

    // Reseta campos do modal
    document.getElementById('modalTipoRelatorio').value = 'manutencao';
    document.getElementById('modalImagensRelatorio').value = '';
    document.getElementById('modalUsarTextoPersonalizado').checked = false;
    document.getElementById('modalTextoPersonalizado').value = '';
    document.getElementById('modalTextoPersonalizado').style.display = 'none';
    document.getElementById('modalSalvarPastaImprimir').checked = true;

    // Mostra o modal
    document.getElementById('modalRelatorio').style.display = 'flex';
}

// Fecha o modal de relatório
function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').style.display = 'none';
    igrejaAtualRelatorio = null;
}

// Toggle do texto personalizado no modal
function toggleTextoPersonalizadoModal() {
    const checkbox = document.getElementById('modalUsarTextoPersonalizado');
    const textarea = document.getElementById('modalTextoPersonalizado');
    textarea.style.display = checkbox.checked ? 'block' : 'none';
}

// Gera o relatório a partir do modal
async function gerarRelatorioDoModal() {
    if (!igrejaAtualRelatorio) {
        alert('Erro: Nenhuma igreja selecionada.');
        return;
    }

    const inputImagens = document.getElementById('modalImagensRelatorio');
    const imagens = Array.from(inputImagens.files);

    if (imagens.length === 0 || imagens.length > 5) {
        alert('Por favor, selecione de 1 a 5 imagens na ordem correta.');
        return;
    }

    const tipoRelatorio = document.getElementById('modalTipoRelatorio').value;
    const usarTexto = document.getElementById('modalUsarTextoPersonalizado').checked;
    const textoPersonalizado = usarTexto ? document.getElementById('modalTextoPersonalizado').value.trim() : '';
    const salvarPasta = document.getElementById('modalSalvarPastaImprimir').checked;

    // Monta dados do relatório
    const relatorio = {
        nome: igrejaAtualRelatorio.nome,
        id: igrejaAtualRelatorio.id,
        imagens,
        tipoRelatorio,
        textoPersonalizado,
        salvarPasta,
        tipoOrigem: igrejaAtualRelatorio.tipoOrigem
    };

    try {
        // Mostra loading
        const btnGerar = document.querySelector('#modalRelatorio .btn-success');
        const textoOriginal = btnGerar.innerHTML;
        btnGerar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
        btnGerar.disabled = true;

        // Gera o relatório
        const pdf = await gerarRelatorioTecnicoIndividual(relatorio);

        // Armazena o PDF
        const chave = `${relatorio.nome}_${relatorio.id}`;
        pdfsRelatoriosGerados[chave] = { nome: relatorio.nome, pdf };

        // Move para a aba "gerados" se estava em outra aba
        if (relatorio.tipoOrigem && relatorio.tipoOrigem !== 'gerados') {
            const index = igrejaAtualRelatorio.index;
            const igreja = relatoriosData[relatorio.tipoOrigem][index];
            if (igreja) {
                relatoriosData[relatorio.tipoOrigem].splice(index, 1);
                igreja.dataGeracao = new Date().toISOString();
                relatoriosData.gerados.push(igreja);
            }
        } else {
            // Atualiza data de geração se já estava em "gerados"
            const igreja = relatoriosData.gerados.find(ig => ig.nome === relatorio.nome && ig.id === relatorio.id);
            if (igreja) {
                igreja.dataGeracao = new Date().toISOString();
            }
        }
        salvarDadosRelatorios();

        // Salva na pasta IMPRIMIR se habilitado
        if (salvarPasta && typeof window.criarPastasIgreja === 'function') {
            try {
                const pastas = await window.criarPastasIgreja(relatorio.nome);
                if (pastas && pastas.imprimir) {
                    const pdfBlob = pdf.output('blob');
                    await window.salvarPDFEmPasta(
                        pastas.imprimir,
                        `Relatorio_Tecnico_${relatorio.nome.replace(/[<>:"/\\|?*]/g, '_')}.pdf`,
                        pdfBlob
                    );
                    console.log('✅ Relatório salvo na pasta IMPRIMIR');
                }
            } catch (err) {
                console.warn('⚠️ Não foi possível salvar na pasta:', err);
            }
        }

        // Restaura botão
        btnGerar.innerHTML = textoOriginal;
        btnGerar.disabled = false;

        // Fecha modal e atualiza lista
        fecharModalRelatorio();
        atualizarListaRelatoriosNovo();

        // Pergunta se quer baixar
        if (confirm('Relatório gerado com sucesso!\n\nDeseja fazer o download agora?')) {
            pdf.save(`Relatorio_Tecnico_${relatorio.nome}.pdf`);
        }

    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        alert('Erro ao gerar relatório: ' + error.message);

        const btnGerar = document.querySelector('#modalRelatorio .btn-success');
        btnGerar.innerHTML = '<i class="fas fa-file-pdf"></i> Gerar Relatório';
        btnGerar.disabled = false;
    }
}

// Baixa relatório individual já gerado
function baixarRelatorioIndividual(chave) {
    const dados = pdfsRelatoriosGerados[chave];
    if (dados && dados.pdf) {
        dados.pdf.save(`Relatorio_Tecnico_${dados.nome}.pdf`);
    } else {
        alert('Relatório não encontrado. Por favor, gere novamente.');
    }
}

// Função para gerar um único relatório técnico
async function gerarRelatorioTecnicoIndividual(rel) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Primeira página - Texto
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(`RELATÓRIO TÉCNICO - ${rel.nome.toUpperCase()}`, 105, 20, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    let y = 35;

    // Se houver texto personalizado, usa-o
    if (rel.textoPersonalizado && rel.textoPersonalizado.trim()) {
        const linhasPers = pdf.splitTextToSize(rel.textoPersonalizado.trim(), 185);
        for (const linha of linhasPers) {
            pdf.text(linha, 13, y);
            y += 5;
        }
    } else if (rel.tipoRelatorio === 'manutencao') {
        // Gera texto de manutenção com variações
        const secoes = ['Caixas de Som', 'Amplificadores', 'Mesa de Som', 'Microfone sem Fio', 'Microfone Gooseneck', 'Caixa de Retorno'];

        for (let j = 0; j < secoes.length; j++) {
            const secao = secoes[j];
            pdf.text(`${j + 1}. ${secao}`, 13, y);
            y += 7;
            const textoSecao = gerarVariacaoTexto(secao);
            const linhas = pdf.splitTextToSize(textoSecao, 185);
            for (const linha of linhas) {
                pdf.text(linha, 13, y);
                y += 5;
            }
            y += 3;
        }

        y += 2;
        pdf.text('Conclusão', 13, y);
        y += 7;
        const textoConclusao = gerarVariacaoTexto('Conclusão');
        const linhasConclusao = pdf.splitTextToSize(textoConclusao, 185);
        for (const linha of linhasConclusao) {
            pdf.text(linha, 13, y);
            y += 5;
        }
    } else {
        // Igreja nova
        const textoRelatorio = TEXTOS_RELATORIO[rel.tipoRelatorio] || TEXTOS_RELATORIO.igreja_nova;
        const linhas = pdf.splitTextToSize(textoRelatorio, 185);
        for (const linha of linhas) {
            pdf.text(linha, 13, y);
            y += 5;
        }
    }

    // Segunda página - Fotos
    pdf.addPage();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('FOTOS DA IGREJA', 105, 20, { align: 'center' });

    const margemLateral = 20;
    const margemSuperior = 40;
    const espacamento = 10;
    const larguraUtil = 170;
    const alturaUtil = 220;

    const totalImgs = Math.min(rel.imagens.length, 5);
    let larguraImagem, alturaImagem;

    if (totalImgs <= 2) {
        larguraImagem = (larguraUtil - espacamento) / 2;
        alturaImagem = alturaUtil / 2;
    } else if (totalImgs <= 4) {
        larguraImagem = (larguraUtil - espacamento) / 2;
        alturaImagem = (alturaUtil - espacamento) / 2;
    } else {
        larguraImagem = (larguraUtil - 2 * espacamento) / 3;
        alturaImagem = (alturaUtil - espacamento) / 2;
    }

    for (let idx = 0; idx < totalImgs; idx++) {
        let x, yImg;

        if (totalImgs <= 2) {
            x = margemLateral + idx * (larguraImagem + espacamento);
            yImg = margemSuperior + (alturaUtil - alturaImagem) / 2;
        } else if (totalImgs <= 4) {
            const row = Math.floor(idx / 2);
            const col = idx % 2;
            x = margemLateral + col * (larguraImagem + espacamento);
            yImg = margemSuperior + row * (alturaImagem + espacamento);
        } else {
            if (idx < 2) {
                x = margemLateral + idx * (larguraUtil / 2 + espacamento / 2);
                yImg = margemSuperior;
                larguraImagem = (larguraUtil - espacamento) / 2;
            } else {
                x = margemLateral + (idx - 2) * (larguraUtil / 3 + espacamento / 2);
                yImg = margemSuperior + alturaUtil / 2 + espacamento;
                larguraImagem = (larguraUtil - 2 * espacamento) / 3;
            }
        }

        const imgData = await processarImagem(rel.imagens[idx]);
        const props = await getImageProps(imgData);

        const ratio = Math.min(larguraImagem / props.width, alturaImagem / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;

        const finalX = x + (larguraImagem - w) / 2;
        const finalY = yImg + (alturaImagem - h) / 2;

        pdf.addImage(imgData, 'JPEG', finalX, finalY, w, h, undefined, 'NONE');
    }

    return pdf;
}

async function inicializarRelatorioTecnico() {
    // Carrega dados salvos do localStorage
    carregarDadosRelatorios();

    // Atualiza a lista inicial (cria os elementos da interface)
    atualizarListaRelatoriosNovo();

    // Inicializa arquivo vinculado (se existir) - DEPOIS da lista ser criada
    await inicializarArquivoRelatorios();
}

// Expõe funções de gerenciamento de JSON globalmente
window.exportarRelatoriosJson = exportarRelatoriosJson;
window.importarRelatoriosJson = importarRelatoriosJson;
window.selecionarArquivoRelatorios = selecionarArquivoRelatorios;
window.criarArquivoRelatorios = criarArquivoRelatorios;

// Expõe funções globalmente
window.abrirModalRelatorio = abrirModalRelatorio;
window.fecharModalRelatorio = fecharModalRelatorio;
window.toggleTextoPersonalizadoModal = toggleTextoPersonalizadoModal;
window.gerarRelatorioDoModal = gerarRelatorioDoModal;
window.baixarRelatorioIndividual = baixarRelatorioIndividual;
window.atualizarListaRelatoriosNovo = atualizarListaRelatoriosNovo;

// Mantém funções antigas para compatibilidade
function atualizarListaRelatorios() {
    // Função mantida para compatibilidade, mas não faz nada
    console.log('atualizarListaRelatorios chamada (compatibilidade)');
}

// Função para gerar variações de texto para cada item
function gerarVariacaoTexto(item) {
    const variacoes = {
        'Caixas de Som': [
            'Foi realizada a verificação da integridade física. Testes de funcionamento confirmaram alguns ruídos, que foram eliminados após ajustes. Cabos e conexões foram revisados e substituídos onde necessário. O posicionamento das caixas foi otimizado para melhor distribuição sonora.',
            'Realizamos inspeção completa do estado físico. Os testes operacionais identificaram interferências sonoras, posteriormente corrigidas com ajustes técnicos. Procedemos com a revisão e substituição de cabos e conexões conforme necessidade. Reposicionamos as caixas para distribuição acústica ideal.',
            'Executamos checagem detalhada da condição física. Durante os testes, foram detectados e corrigidos ruídos indesejados. Efetuamos manutenção em cabos e conexões, com substituições quando necessário. A disposição das caixas foi ajustada para otimizar a cobertura sonora.'
        ],
        'Amplificadores': [
            'Foi realizado teste de ligação e ajuste para melhor resposta de som. Inspeção dos cabos resultou na substituição de algumas conexões defeituosas. Configurações foram ajustadas para melhor desempenho.',
            'Executamos testes de funcionamento e calibração para otimizar a resposta sonora. A verificação da fiação levou à troca de conexões comprometidas. Realizamos ajustes nas configurações visando performance ideal.',
            'Procedemos com testes operacionais e regulagem para resposta acústica superior. Durante a inspeção, identificamos e substituímos conexões problemáticas. Os parâmetros foram recalibrados para máxima eficiência.'
        ],
        'Mesa de Som': [
            'Canais e equalizadores foram testados e corrigidos conforme necessidade. Saídas e entradas foram revisadas e alguns ruídos foram eliminados. Potenciômetros e sliders passaram por limpeza e lubrificação. Integração com os demais equipamentos foi otimizada.',
            'Realizamos testes em todos os canais e equalizadores, fazendo correções necessárias. Verificamos entradas e saídas, eliminando interferências. Executamos limpeza e lubrificação de potenciômetros e faders. Otimizamos a integração com o sistema completo.',
            'Procedemos com verificação completa de canais e equalização, aplicando ajustes quando necessário. Inspecionamos portas de entrada e saída, removendo ruídos. Efetuamos manutenção em potenciômetros e controles deslizantes. A comunicação com outros equipamentos foi aperfeiçoada.'
        ],
        'Microfone sem Fio': [
            'Testes de captação e transmissão foram realizados com êxito. Limpeza e higienização foram efetuadas. Alcance foi testado e ampliado para maior mobilidade.',
            'Executamos verificação completa dos sistemas de captação e transmissão. Procedemos com limpeza profunda e sanitização. O alcance do sinal foi otimizado para melhor mobilidade.',
            'Realizamos testes abrangentes de recepção e transmissão. Efetuamos procedimentos de limpeza e higiene. Ajustamos e ampliamos a área de cobertura do sinal.'
        ],
        'Microfone Gooseneck': [
            'Captação foi testada e melhorada através de ajustes finos. Conexões e cabos passaram por revisão e algumas substituições foram feitas. Flexibilidade e posicionamento foram ajustados para melhor usabilidade. Integração com a mesa de som foi otimizada.',
            'Realizamos testes e aprimoramentos na captação através de calibração precisa. Verificamos e renovamos conexões e cabeamento conforme necessidade. Ajustamos articulação e posição para uso ideal. Sincronização com a mesa foi refinada.',
            'Executamos verificação e otimização da captação com ajustes detalhados. Inspecionamos e atualizamos conexões e fiação quando necessário. Regulamos mobilidade e posicionamento para máxima eficiência. Alinhamos integração com o sistema de áudio.'
        ],
        'Caixa de Retorno': [
            'Testes de funcionamento foram realizados e a qualidade do som foi aprimorada. Conexões e cabos foram revisados e substituídos onde necessário. Posicionamento foi ajustado para melhor aproveitamento do som pelos músicos. Limpeza externa e interna foi realizada. Equalização foi ajustada conforme as necessidades dos usuários.',
            'Executamos verificação operacional completa e otimizamos a qualidade sonora. Inspecionamos e renovamos conexões e cabeamento conforme necessidade. Reposicionamos o equipamento para melhor monitoramento pelos músicos. Realizamos limpeza detalhada interna e externa. Personalizamos equalização segundo requisitos dos usuários.',
            'Procedemos com testes funcionais e melhorias na qualidade acústica. Revisamos e atualizamos conexões e fiação quando necessário. Ajustamos localização para retorno ideal aos músicos. Efetuamos limpeza completa do equipamento. Configuramos equalização de acordo com as preferências dos usuários.'
        ],
        'Conclusão': [
            'A igreja apresentava algumas falhas no sistema de som, que foram devidamente identificadas e corrigidas. Foram tomadas as providências necessárias para garantir seu funcionamento adequado, incluindo substituição de cabos, ajustes de configuração, limpeza e melhorias na distribuição sonora. O sistema agora encontra-se em condições ideais para o uso.',
            'O sistema de som da igreja exibia certas deficiências que foram identificadas e solucionadas. Implementamos todas as medidas necessárias para assegurar operação apropriada, incluindo renovação de cabeamento, calibração de equipamentos, procedimentos de limpeza e otimização acústica. O conjunto agora opera em condições ótimas.',
            'Foram detectadas e resolvidas diversas inconsistências no sistema sonoro da igreja. Executamos todos os procedimentos necessários para garantir funcionamento correto, incluindo atualização de conexões, ajustes técnicos, manutenção preventiva e melhorias na propagação do som. O sistema está agora em estado ideal de operação.'
        ]
    };

    // Seleciona aleatoriamente uma das variações para o item
    const opcoes = variacoes[item] || ['Texto não disponível para este item'];
    return opcoes[Math.floor(Math.random() * opcoes.length)];
}

// Gera uma versão "concorrente" a partir do texto da sua empresa
function gerarTextoConcorrenteAuto(textoBase) {
    try {
        if (!textoBase || !textoBase.trim()) return '';
        let t = textoBase;

        // Substituições simples de pessoa/posse (pt-BR) para uma forma neutra
        const subs = [
            [/\bnós\b/gi, 'a empresa concorrente'],
            [/\bnos\b/gi, 'à empresa concorrente'],
            [/\bconosco\b/gi, 'com a empresa concorrente'],
            [/\bnosso\b/gi, 'da empresa concorrente'],
            [/\bnossos\b/gi, 'da empresa concorrente'],
            [/\bnossa\b/gi, 'da empresa concorrente'],
            [/\bnossas\b/gi, 'da empresa concorrente'],
            [/\bminha\b/gi, 'da empresa concorrente'],
            [/\bmeu\b/gi, 'da empresa concorrente'],
            // Verbos comuns na 1ª pessoa do plural -> 3ª pessoa do singular
            [/\boferecemos\b/gi, 'oferece'],
            [/\brealizamos\b/gi, 'realiza'],
            [/\bexecutamos\b/gi, 'executa'],
            [/\bfornecemos\b/gi, 'fornece'],
            [/\bgarantimos\b/gi, 'garante'],
            [/\butilizamos\b/gi, 'utiliza'],
            [/\baplicamos\b/gi, 'aplica'],
            [/\bseguimos\b/gi, 'segue'],
            [/\batuamos\b/gi, 'atua'],
            [/\bprestamos\b/gi, 'presta']
        ];
        subs.forEach(([rgx, rep]) => { t = t.replace(rgx, rep); });

        // Pequeno preâmbulo adicionando contexto
        const cabecalho = 'De acordo com a proposta da empresa concorrente, ';
        // Evita duplicar o cabeçalho se já existir
        if (!/^De acordo com a proposta da empresa concorrente,/i.test(t.trim())) {
            t = cabecalho + t.trim();
        }
        return t;
    } catch (_) {
        return textoBase || '';
    }
}

// Função para processar imagem e manter orientação original
async function processarImagem(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Determinar a orientação correta
                let width = img.width;
                let height = img.height;

                // Configurar canvas com as dimensões corretas
                canvas.width = width;
                canvas.height = height;

                // Desenhar a imagem mantendo a orientação original
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', 1.0));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function gerarRelatoriosTecnicos(relatorios) {
    const { jsPDF } = window.jspdf;
    pdfsRelatoriosGerados = {};
    const progressBar = document.getElementById('progressBarRelatorio');
    const statusMessage = document.getElementById('statusMessageRelatorio');
    const pdfsDisplay = document.getElementById('pdfsRelatoriosDisplay');
    pdfsDisplay.innerHTML = '';
    if (progressBar) progressBar.style.width = '0%';
    if (statusMessage) statusMessage.innerHTML = `<p>Gerando relatórios para ${relatorios.length} igrejas...</p>`;

    for (let i = 0; i < relatorios.length; i++) {
        const rel = relatorios[i];
        if (progressBar) progressBar.style.width = `${(i / relatorios.length) * 100}%`;
        if (statusMessage) statusMessage.innerHTML = `<p>Processando relatório ${i + 1}/${relatorios.length}: ${rel.nome}</p>`;

        // Criar novo PDF
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Primeira página - Texto
        // Título centralizado e em negrito
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(`RELATÓRIO TÉCNICO - ${rel.nome.toUpperCase()}`, 105, 20, { align: 'center' });

        // Texto principal
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        let y = 35;

        // Se houver texto personalizado, usa-o e ignora as variações/padrões
        if (rel.textoPersonalizado && rel.textoPersonalizado.trim()) {
            const linhasPers = pdf.splitTextToSize(rel.textoPersonalizado.trim(), 185);
            for (const linha of linhasPers) {
                pdf.text(linha, 13, y);
                y += 5;
            }
        } else if (rel.tipoRelatorio === 'manutencao') {
            // Se for relatório de manutenção, gera texto com variações
            // Gera texto para cada seção com variações
            const secoes = [
                'Caixas de Som',
                'Amplificadores',
                'Mesa de Som',
                'Microfone sem Fio',
                'Microfone Gooseneck',
                'Caixa de Retorno'
            ];

            // Adiciona numeração e gera variação para cada seção
            for (let j = 0; j < secoes.length; j++) {
                const secao = secoes[j];
                const numero = j + 1;

                // Adiciona título da seção
                pdf.text(`${numero}. ${secao}`, 13, y);
                y += 7;

                // Gera e adiciona texto da seção
                const textoSecao = gerarVariacaoTexto(secao);
                const linhas = pdf.splitTextToSize(textoSecao, 185);
                for (const linha of linhas) {
                    pdf.text(linha, 13, y);
                    y += 5;
                }
                y += 3; // Espaço extra entre seções
            }

            // Adiciona conclusão
            y += 2;
            pdf.text('Conclusão', 13, y);
            y += 7;
            const textoConclusao = gerarVariacaoTexto('Conclusão');
            const linhasConclusao = pdf.splitTextToSize(textoConclusao, 185);
            for (const linha of linhasConclusao) {
                pdf.text(linha, 13, y);
                y += 5;
            }
        } else {
            // Se for igreja nova, usa o texto padrão
            const textoRelatorio = TEXTOS_RELATORIO[rel.tipoRelatorio];
            const linhas = pdf.splitTextToSize(textoRelatorio, 185);
            for (const linha of linhas) {
                pdf.text(linha, 13, y);
                y += 5;
            }
        }

        // Forçar nova página para as fotos (apenas um addPage)
        pdf.addPage();

        // Segunda página - Fotos
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('FOTOS DA IGREJA', 105, 20, { align: 'center' });

        // Configuração para o grid de imagens
        const margemLateral = 20;
        const margemSuperior = 40;
        const espacamento = 10;
        const larguraUtil = 170;
        const alturaUtil = 220; // Voltando para o tamanho original pois agora temos uma página inteira

        // Ajusta o layout baseado no número de imagens
        const totalImgs = Math.min(rel.imagens.length, 5); // Permite até 5 imagens
        let larguraImagem, alturaImagem;

        if (totalImgs <= 2) {
            // Para 1 ou 2 imagens: layout 1x2
            larguraImagem = (larguraUtil - espacamento) / 2;
            alturaImagem = alturaUtil / 2;
        } else if (totalImgs <= 4) {
            // Para 3 ou 4 imagens: layout 2x2
            larguraImagem = (larguraUtil - espacamento) / 2;
            alturaImagem = (alturaUtil - espacamento) / 2;
        } else {
            // Para 5 imagens: layout especial (2 em cima, 3 embaixo)
            larguraImagem = (larguraUtil - 2 * espacamento) / 3;
            alturaImagem = (alturaUtil - espacamento) / 2;
        }

        // Posiciona as imagens de acordo com o layout
        for (let idx = 0; idx < totalImgs; idx++) {
            let x, y;

            if (totalImgs <= 2) {
                // Layout 1x2
                x = margemLateral + idx * (larguraImagem + espacamento);
                y = margemSuperior + (alturaUtil - alturaImagem) / 2;
            } else if (totalImgs <= 4) {
                // Layout 2x2
                const row = Math.floor(idx / 2);
                const col = idx % 2;
                x = margemLateral + col * (larguraImagem + espacamento);
                y = margemSuperior + row * (alturaImagem + espacamento);
            } else {
                // Layout especial para 5 imagens
                if (idx < 2) {
                    // Duas imagens maiores em cima
                    x = margemLateral + idx * (larguraUtil / 2 + espacamento / 2);
                    y = margemSuperior;
                    larguraImagem = (larguraUtil - espacamento) / 2;
                } else {
                    // Três imagens menores embaixo
                    x = margemLateral + (idx - 2) * (larguraUtil / 3 + espacamento / 2);
                    y = margemSuperior + alturaUtil / 2 + espacamento;
                    larguraImagem = (larguraUtil - 2 * espacamento) / 3;
                }
            }

            // Processa a imagem mantendo a orientação original
            const imgData = await processarImagem(rel.imagens[idx]);
            const props = await getImageProps(imgData);

            // Calcula as dimensões mantendo a proporção original
            const ratio = Math.min(
                larguraImagem / props.width,
                alturaImagem / props.height
            );

            const w = props.width * ratio;
            const h = props.height * ratio;

            // Centraliza a imagem no seu espaço
            const finalX = x + (larguraImagem - w) / 2;
            const finalY = y + (alturaImagem - h) / 2;

            // Adiciona a imagem sem compressão e mantendo a orientação original
            pdf.addImage(imgData, 'JPEG', finalX, finalY, w, h, undefined, 'NONE');
        }

        pdfsRelatoriosGerados[`relatorio_${i}`] = { nome: rel.nome, pdf };

        // Atualiza interface
        const card = document.createElement('div');
        card.className = 'pdf-card';
        card.innerHTML = `
            <div class='igreja-info'>
                <h3>${rel.nome}</h3>
                <p>Tipo: ${rel.tipoRelatorio === 'igreja_nova' ? 'Igreja Nova' : 'Manutenção'}</p>
            </div>
            <div class='download-buttons'>
                <button class='btn-download' onclick='baixarPDFRelatorio(${i})'>Baixar Relatório</button>
            </div>`;
        pdfsDisplay.appendChild(card);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (progressBar) progressBar.style.width = '100%';
    if (statusMessage) statusMessage.innerHTML = `<p>Todos os relatórios foram gerados com sucesso!</p>`;
    document.getElementById('downloadAllRelatoriosBtn').disabled = false;
}

function fitAspect(origW, origH, maxW, maxH) {
    let ratio = Math.min(maxW / origW, maxH / origH);
    return { w: origW * ratio, h: origH * ratio };
}

function getImageProps(dataUrl) {
    return new Promise(resolve => {
        const img = new window.Image();
        img.onload = function () {
            resolve({ width: img.width, height: img.height });
        };
        img.src = dataUrl;
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsDataURL(file);
    });
}

function baixarPDFRelatorio(idx) {
    const dados = pdfsRelatoriosGerados[`relatorio_${idx}`];
    if (dados && dados.pdf) {
        dados.pdf.save(`Relatorio_Tecnico_${dados.nome}.pdf`);
    }
}

async function baixarTodosRelatorios() {
    try {
        // Verifica se há relatórios para baixar
        const keys = Object.keys(pdfsRelatoriosGerados);
        if (keys.length === 0) {
            alert('Nenhum relatório foi gerado ainda!');
            return;
        }

        const JSZip = window.JSZip;
        if (!JSZip) {
            alert('Erro: Biblioteca JSZip não carregada.');
            return;
        }

        const zip = new JSZip();

        for (const key of keys) {
            const dados = pdfsRelatoriosGerados[key];
            if (dados && dados.pdf) {
                const pdfBlob = dados.pdf.output('blob');
                zip.file(`Relatorio_Tecnico_${dados.nome}.pdf`, pdfBlob);
            }
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });
        saveAs(zipContent, 'Relatorios_Tecnicos.zip');

        console.log('✅ Relatórios baixados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao baixar relatórios:', error);
        alert('Erro ao baixar relatórios: ' + error.message);
    }
}

// Expõe a função globalmente
window.baixarTodosRelatorios = baixarTodosRelatorios;

// Adiciona o event listener quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function () {
    const btnDownloadAll = document.getElementById('downloadAllRelatoriosBtn');
    if (btnDownloadAll) {
        btnDownloadAll.addEventListener('click', baixarTodosRelatorios);
    }
});

// Função para inicializar o sistema de abas
function inicializarAbas() {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    function mostrarAba(tabId) {
        // Esconde todos os conteúdos
        contents.forEach(content => {
            content.style.display = 'none';
        });

        // Remove a classe active de todas as abas
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });

        // Mostra o conteúdo selecionado
        const selectedContent = document.getElementById(tabId);
        if (selectedContent) {
            selectedContent.style.display = 'block';
        }

        // Adiciona a classe active na aba selecionada
        const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Se for a aba de Notas Fiscais, atualiza a lista
        if (tabId === 'notasFiscais' && window.atualizarListaNF) {
            window.atualizarListaNF();
        }
    }

    // Adiciona os event listeners
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            mostrarAba(tabId);
        });
    });

    // Mostra a primeira aba por padrão
    mostrarAba('orcamentos');
}

// Inicializa tudo quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando sistema...");

    // Inicializa a interface e outros componentes
    if (typeof inicializarInterface === 'function') {
        inicializarInterface();
    } else {
        console.error("Função inicializarInterface não encontrada!");
    }

    // Inicializa o sistema de upload de logos
    inicializarUploadLogos();

    // Inicializa logos já existentes no DOM
    inicializarLogos();

    // Inicializa o gerador de orçamentos
    iniciarGeracaoOrcamentos();
    inicializarDownloadZip();

    inicializarRelatorioTecnico();

    inicializarAbas();

    // Inicializa o sistema de pasta de trabalho
    inicializarPastaTrabalho();

    // Event listener para o botão de escolher pasta
    const btnEscolherPasta = document.getElementById('escolherPastaTrabalho');
    if (btnEscolherPasta) {
        btnEscolherPasta.addEventListener('click', escolherPastaTrabalho);
    }

    console.log("Sistema inicializado com sucesso!");
}); 