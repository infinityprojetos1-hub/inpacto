// =============================================
// GERENCIADOR DE PAGAMENTOS
// =============================================

const MESES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

let pagamentoState = {
    mesSelecionado: new Date().getMonth(),
    anoSelecionado: new Date().getFullYear(),
    igrejasSelecionadas: {},  // { id_nome: { nome, id, valor } }
    itensExtras: []           // [{ nome, valor }]
};

// =============================================
// RENDERIZAÇÃO PRINCIPAL
// =============================================

function renderizarAbaPagamento() {
    const container = document.getElementById('pagamentoContainer');
    if (!container) return;

    const igrejas = obterIgrejasPagamento();
    const mesAtual = pagamentoState.mesSelecionado;
    const anoAtual = pagamentoState.anoSelecionado;

    container.innerHTML = `
        <div class="pag-layout">

            <!-- ===== COLUNA ESQUERDA: Config + Seleção ===== -->
            <div class="pag-coluna-esq">

                <!-- Seletor de Mês -->
                <div class="pag-card">
                    <h3 class="pag-card-titulo">
                        <i class="fas fa-calendar-alt"></i> Período de Pagamento
                    </h3>
                    <div class="pag-mes-grid">
                        <div class="pag-field">
                            <label>Mês</label>
                            <select id="pagMes" onchange="alterarMesPagamento(this.value)">
                                ${MESES_PT.map((m, i) => `<option value="${i}" ${i === mesAtual ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div class="pag-field">
                            <label>Ano</label>
                            <select id="pagAno" onchange="alterarAnoPagamento(this.value)">
                                ${gerarOpcoesAno(anoAtual)}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Lista de Igrejas -->
                <div class="pag-card">
                    <div class="pag-card-header">
                        <h3 class="pag-card-titulo">
                            <i class="fas fa-church"></i> Igrejas
                        </h3>
                        <span class="pag-badge">${igrejas.length} igrejas</span>
                    </div>

                    ${igrejas.length === 0 ? `
                        <div class="pag-empty">
                            <i class="fas fa-church"></i>
                            <p>Nenhuma igreja encontrada.<br>Adicione igrejas nas Notas Fiscais.</p>
                        </div>
                    ` : `
                        <div class="pag-busca-wrapper">
                            <i class="fas fa-search"></i>
                            <input type="text" id="pagBusca" placeholder="Buscar igreja..." oninput="filtrarIgrejasPagamento(this.value)" class="pag-busca-input">
                        </div>
                        <div id="pagIgrejaLista" class="pag-igreja-lista">
                            ${renderizarListaIgrejas(igrejas, '')}
                        </div>
                    `}
                </div>

                <!-- Itens Extras -->
                <div class="pag-card">
                    <div class="pag-card-header">
                        <h3 class="pag-card-titulo">
                            <i class="fas fa-plus-circle"></i> Itens Extras
                        </h3>
                    </div>
                    <div id="pagItensExtras" class="pag-extras-lista">
                        ${renderizarItensExtras()}
                    </div>
                    <div class="pag-extra-form">
                        <input type="text" id="pagExtraNome" placeholder="Descrição do item..." class="pag-input">
                        <input type="text" id="pagExtraValor" placeholder="R$ 0,00" class="pag-input pag-input-valor" oninput="mascararValorInput(this)">
                        <button class="pag-btn pag-btn-add" onclick="adicionarItemExtra()">
                            <i class="fas fa-plus"></i> Adicionar
                        </button>
                    </div>
                </div>
            </div>

            <!-- ===== COLUNA DIREITA: Resumo + Geração ===== -->
            <div class="pag-coluna-dir">

                <!-- Resumo -->
                <div class="pag-card pag-card-resumo">
                    <h3 class="pag-card-titulo">
                        <i class="fas fa-receipt"></i> Resumo
                    </h3>
                    <div id="pagResumo" class="pag-resumo-lista">
                        ${renderizarResumo()}
                    </div>
                    <div class="pag-total-box" id="pagTotalBox">
                        ${renderizarTotal()}
                    </div>
                </div>

                <!-- Preview & Gerar -->
                <div class="pag-card">
                    <h3 class="pag-card-titulo">
                        <i class="fas fa-image"></i> Imagem de Pagamento
                    </h3>
                    <canvas id="pagCanvas" class="pag-canvas-preview"></canvas>
                    <div class="pag-acoes">
                        <button class="pag-btn pag-btn-gerar" onclick="gerarImagemPagamento()">
                            <i class="fas fa-magic"></i> Gerar Imagem
                        </button>
                        <button class="pag-btn pag-btn-baixar" id="pagBtnBaixar" onclick="baixarImagemPagamento()" style="display:none">
                            <i class="fas fa-download"></i> Baixar
                        </button>
                        <button class="pag-btn pag-btn-whatsapp" id="pagBtnWhats" onclick="compartilharWhatsApp()" style="display:none">
                            <i class="fab fa-whatsapp"></i> Compartilhar
                        </button>
                    </div>
                    <p class="pag-hint" id="pagHint">Selecione as igrejas e clique em "Gerar Imagem"</p>
                </div>
            </div>
        </div>
    `;

    // Gera preview automático se já houver seleção
    const temSelecao = Object.keys(pagamentoState.igrejasSelecionadas).length > 0 || pagamentoState.itensExtras.length > 0;
    if (temSelecao) {
        setTimeout(gerarImagemPagamento, 100);
    }
}

// =============================================
// HELPERS DE DADOS
// =============================================

function obterIgrejasPagamento() {
    try {
        const nfStr = localStorage.getItem('notasFiscais');
        if (!nfStr) return [];
        const nf = JSON.parse(nfStr);
        const igrejas = (nf.igrejas || []).filter(ig => ig && ig.nome);
        // Remove duplicatas por nome+id
        const vistas = new Set();
        return igrejas.filter(ig => {
            const chave = `${ig.nome}_${ig.id || ''}`;
            if (vistas.has(chave)) return false;
            vistas.add(chave);
            return true;
        });
    } catch {
        return [];
    }
}

function chaveIgreja(ig) {
    return `${ig.nome}_${ig.id || ''}`;
}

function gerarOpcoesAno(anoAtual) {
    const anos = [];
    for (let a = anoAtual - 2; a <= anoAtual + 2; a++) {
        anos.push(`<option value="${a}" ${a === anoAtual ? 'selected' : ''}>${a}</option>`);
    }
    return anos.join('');
}

// =============================================
// RENDERIZADORES DE PARTES
// =============================================

function renderizarListaIgrejas(igrejas, busca) {
    const termo = busca.toLowerCase().trim();
    const filtradas = termo ? igrejas.filter(ig => ig.nome.toLowerCase().includes(termo)) : igrejas;

    if (filtradas.length === 0) {
        return `<div class="pag-empty-busca">Nenhuma igreja encontrada para "${busca}"</div>`;
    }

    return filtradas.map(ig => {
        const chave = chaveIgreja(ig);
        const selecionada = !!pagamentoState.igrejasSelecionadas[chave];
        const valorAtual = selecionada ? pagamentoState.igrejasSelecionadas[chave].valor : '';
        return `
            <div class="pag-igreja-item ${selecionada ? 'pag-selecionada' : ''}" id="pag-ig-${CSS.escape(chave)}">
                <label class="pag-check-label">
                    <input type="checkbox" class="pag-checkbox" ${selecionada ? 'checked' : ''}
                        onchange="toggleIgrejaPagamento('${escaparAttr(chave)}', this.checked, '${escaparAttr(ig.nome)}', '${escaparAttr(ig.id || '')}')">
                    <span class="pag-check-box"></span>
                    <div class="pag-igreja-info">
                        <strong>${ig.nome}</strong>
                        ${ig.id ? `<span class="pag-ig-id">ID: ${ig.id}</span>` : ''}
                    </div>
                </label>
                ${selecionada ? `
                    <input type="text" class="pag-valor-input" placeholder="R$ 0,00"
                        value="${valorAtual}"
                        oninput="mascararValorInput(this); atualizarValorIgreja('${escaparAttr(chave)}', this.value)"
                        onfocus="this.select()">
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderizarItensExtras() {
    if (pagamentoState.itensExtras.length === 0) {
        return `<p class="pag-extras-vazio">Nenhum item extra adicionado.</p>`;
    }
    return pagamentoState.itensExtras.map((item, i) => `
        <div class="pag-extra-item">
            <div class="pag-extra-info">
                <span class="pag-extra-nome">${item.nome}</span>
                <span class="pag-extra-val">${item.valor || '—'}</span>
            </div>
            <button class="pag-btn-remover" onclick="removerItemExtra(${i})" title="Remover">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function renderizarResumo() {
    const selecionadas = Object.values(pagamentoState.igrejasSelecionadas);
    const extras = pagamentoState.itensExtras;

    if (selecionadas.length === 0 && extras.length === 0) {
        return `<p class="pag-resumo-vazio">Selecione igrejas para ver o resumo.</p>`;
    }

    let html = '';
    selecionadas.forEach(ig => {
        const val = parsearValor(ig.valor);
        html += `
            <div class="pag-resumo-item">
                <span class="pag-resumo-nome"><i class="fas fa-church"></i> ${ig.nome}</span>
                <span class="pag-resumo-val ${val > 0 ? '' : 'pag-sem-valor'}">${val > 0 ? formatarMoeda(val) : '—'}</span>
            </div>
        `;
    });
    extras.forEach(item => {
        const val = parsearValor(item.valor);
        html += `
            <div class="pag-resumo-item pag-resumo-extra">
                <span class="pag-resumo-nome"><i class="fas fa-plus-circle"></i> ${item.nome}</span>
                <span class="pag-resumo-val ${val > 0 ? '' : 'pag-sem-valor'}">${val > 0 ? formatarMoeda(val) : '—'}</span>
            </div>
        `;
    });
    return html;
}

function renderizarTotal() {
    const total = calcularTotal();
    return `
        <div class="pag-total-label">Total</div>
        <div class="pag-total-valor">${formatarMoeda(total)}</div>
    `;
}

// =============================================
// AÇÕES DO USUÁRIO
// =============================================

function alterarMesPagamento(valor) {
    pagamentoState.mesSelecionado = parseInt(valor);
}

function alterarAnoPagamento(valor) {
    pagamentoState.anoSelecionado = parseInt(valor);
}

function filtrarIgrejasPagamento(busca) {
    const igrejas = obterIgrejasPagamento();
    const lista = document.getElementById('pagIgrejaLista');
    if (lista) lista.innerHTML = renderizarListaIgrejas(igrejas, busca);
}

function toggleIgrejaPagamento(chave, marcada, nome, id) {
    if (marcada) {
        pagamentoState.igrejasSelecionadas[chave] = { nome, id, valor: '' };
    } else {
        delete pagamentoState.igrejasSelecionadas[chave];
    }
    atualizarItemVisual(chave, marcada);
    atualizarResumo();
}

function atualizarItemVisual(chave, selecionada) {
    const item = document.getElementById(`pag-ig-${CSS.escape(chave)}`);
    if (!item) return;

    item.classList.toggle('pag-selecionada', selecionada);

    // Adiciona/remove o campo de valor
    const existente = item.querySelector('.pag-valor-input');
    if (selecionada && !existente) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pag-valor-input';
        input.placeholder = 'R$ 0,00';
        input.oninput = function () {
            mascararValorInput(this);
            atualizarValorIgreja(chave, this.value);
        };
        item.appendChild(input);
        input.focus();
    } else if (!selecionada && existente) {
        existente.remove();
    }
}

function atualizarValorIgreja(chave, valor) {
    if (pagamentoState.igrejasSelecionadas[chave]) {
        pagamentoState.igrejasSelecionadas[chave].valor = valor;
    }
    atualizarResumo();
}

function adicionarItemExtra() {
    const nomeEl = document.getElementById('pagExtraNome');
    const valorEl = document.getElementById('pagExtraValor');
    const nome = nomeEl ? nomeEl.value.trim() : '';
    const valor = valorEl ? valorEl.value.trim() : '';

    if (!nome) {
        nomeEl && nomeEl.focus();
        return;
    }

    pagamentoState.itensExtras.push({ nome, valor });
    if (nomeEl) nomeEl.value = '';
    if (valorEl) valorEl.value = '';

    const lista = document.getElementById('pagItensExtras');
    if (lista) lista.innerHTML = renderizarItensExtras();
    atualizarResumo();
}

function removerItemExtra(index) {
    pagamentoState.itensExtras.splice(index, 1);
    const lista = document.getElementById('pagItensExtras');
    if (lista) lista.innerHTML = renderizarItensExtras();
    atualizarResumo();
}

function atualizarResumo() {
    const resumo = document.getElementById('pagResumo');
    const totalBox = document.getElementById('pagTotalBox');
    if (resumo) resumo.innerHTML = renderizarResumo();
    if (totalBox) totalBox.innerHTML = renderizarTotal();
}

// =============================================
// FORMATAÇÃO
// =============================================

function mascararValorInput(input) {
    let v = input.value.replace(/\D/g, '');
    if (v === '') { input.value = ''; return; }
    v = parseInt(v, 10);
    input.value = 'R$ ' + (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsearValor(str) {
    if (!str) return 0;
    const num = parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularTotal() {
    let total = 0;
    Object.values(pagamentoState.igrejasSelecionadas).forEach(ig => {
        total += parsearValor(ig.valor);
    });
    pagamentoState.itensExtras.forEach(item => {
        total += parsearValor(item.valor);
    });
    return total;
}

function escaparAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// =============================================
// GERAÇÃO DA IMAGEM (CANVAS)
// =============================================

function gerarImagemPagamento() {
    const canvas = document.getElementById('pagCanvas');
    if (!canvas) return;

    const selecionadas = Object.values(pagamentoState.igrejasSelecionadas);
    const extras = pagamentoState.itensExtras;
    const total = calcularTotal();
    const mes = MESES_PT[pagamentoState.mesSelecionado];
    const ano = pagamentoState.anoSelecionado;

    const todosItens = [
        ...selecionadas.map(ig => ({ nome: ig.nome, valor: parsearValor(ig.valor), tipo: 'igreja' })),
        ...extras.map(it => ({ nome: it.nome, valor: parsearValor(it.valor), tipo: 'extra' }))
    ];

    if (todosItens.length === 0) {
        mostrarHintPagamento('Selecione pelo menos uma igreja para gerar a imagem.');
        return;
    }

    // Dimensões
    const LARGURA = 800;
    const PADDING = 40;
    const HEADER_H = 130;
    const ITEM_H = 52;
    const FOOTER_H = 100;
    const altura = HEADER_H + todosItens.length * ITEM_H + FOOTER_H + PADDING;

    canvas.width = LARGURA;
    canvas.height = altura;
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');

    // ---- FUNDO GRADIENTE ----
    const grad = ctx.createLinearGradient(0, 0, LARGURA, altura);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, LARGURA, altura, 20);
    ctx.fill();

    // ---- BRILHO SUPERIOR ----
    const brilho = ctx.createRadialGradient(LARGURA / 2, 0, 10, LARGURA / 2, 0, 400);
    brilho.addColorStop(0, 'rgba(100,100,255,0.15)');
    brilho.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(0, 0, LARGURA, altura);

    // ---- HEADER ----
    // Linha decorativa topo
    const linhaTopo = ctx.createLinearGradient(PADDING, 0, LARGURA - PADDING, 0);
    linhaTopo.addColorStop(0, 'rgba(99,102,241,0)');
    linhaTopo.addColorStop(0.5, '#6366f1');
    linhaTopo.addColorStop(1, 'rgba(236,72,153,0)');
    ctx.strokeStyle = linhaTopo;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, 28);
    ctx.lineTo(LARGURA - PADDING, 28);
    ctx.stroke();

    // Ícone / logo textual
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = 'rgba(150,150,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('INPACTO · SISTEMA DE GESTÃO', LARGURA / 2, 22);

    // Título mês/ano
    ctx.font = 'bold 38px Arial';
    const gradTitulo = ctx.createLinearGradient(0, 0, LARGURA, 0);
    gradTitulo.addColorStop(0, '#a78bfa');
    gradTitulo.addColorStop(1, '#f472b6');
    ctx.fillStyle = gradTitulo;
    ctx.textAlign = 'center';
    ctx.fillText(`${mes} / ${ano}`, LARGURA / 2, 78);

    // Subtítulo
    ctx.font = '15px Arial';
    ctx.fillStyle = 'rgba(200,200,255,0.6)';
    ctx.fillText('Relatório de Pagamentos', LARGURA / 2, 104);

    // Linha separadora header
    const linhaH = ctx.createLinearGradient(PADDING, 0, LARGURA - PADDING, 0);
    linhaH.addColorStop(0, 'rgba(99,102,241,0)');
    linhaH.addColorStop(0.3, '#6366f1');
    linhaH.addColorStop(0.7, '#ec4899');
    linhaH.addColorStop(1, 'rgba(236,72,153,0)');
    ctx.strokeStyle = linhaH;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PADDING, HEADER_H - 5);
    ctx.lineTo(LARGURA - PADDING, HEADER_H - 5);
    ctx.stroke();

    // ---- ITENS ----
    todosItens.forEach((item, i) => {
        const y = HEADER_H + i * ITEM_H;
        const isAlternado = i % 2 === 0;

        // Fundo alternado
        if (isAlternado) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(PADDING, y + 6, LARGURA - PADDING * 2, ITEM_H - 6);
        }

        // Ícone indicador
        const corIcone = item.tipo === 'extra' ? '#f472b6' : '#818cf8';
        ctx.fillStyle = corIcone;
        ctx.beginPath();
        ctx.arc(PADDING + 10, y + ITEM_H / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Nome da igreja/item
        ctx.font = `${item.tipo === 'extra' ? 'italic ' : ''}15px Arial`;
        ctx.fillStyle = item.valor > 0 ? 'rgba(230,230,255,0.95)' : 'rgba(180,180,220,0.6)';
        ctx.textAlign = 'left';
        // Truncar nome longo
        let nomeExibido = item.nome;
        if (ctx.measureText(nomeExibido).width > 480) {
            while (ctx.measureText(nomeExibido + '...').width > 480 && nomeExibido.length > 0) {
                nomeExibido = nomeExibido.slice(0, -1);
            }
            nomeExibido += '...';
        }
        ctx.fillText(nomeExibido, PADDING + 24, y + ITEM_H / 2 + 6);

        // Valor
        if (item.valor > 0) {
            const gradVal = ctx.createLinearGradient(LARGURA - PADDING - 160, 0, LARGURA - PADDING, 0);
            gradVal.addColorStop(0, '#a78bfa');
            gradVal.addColorStop(1, '#f472b6');
            ctx.fillStyle = gradVal;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(formatarMoeda(item.valor), LARGURA - PADDING, y + ITEM_H / 2 + 6);
        } else {
            ctx.fillStyle = 'rgba(150,150,200,0.4)';
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('—', LARGURA - PADDING, y + ITEM_H / 2 + 6);
        }

        // Linha divisória leve
        if (i < todosItens.length - 1) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(PADDING + 20, y + ITEM_H);
            ctx.lineTo(LARGURA - PADDING, y + ITEM_H);
            ctx.stroke();
        }
    });

    // ---- RODAPÉ / TOTAL ----
    const yFooter = HEADER_H + todosItens.length * ITEM_H;

    // Linha separadora total
    const linhaTot = ctx.createLinearGradient(PADDING, 0, LARGURA - PADDING, 0);
    linhaTot.addColorStop(0, 'rgba(99,102,241,0)');
    linhaTot.addColorStop(0.3, '#6366f1');
    linhaTot.addColorStop(0.7, '#ec4899');
    linhaTot.addColorStop(1, 'rgba(236,72,153,0)');
    ctx.strokeStyle = linhaTot;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PADDING, yFooter + 14);
    ctx.lineTo(LARGURA - PADDING, yFooter + 14);
    ctx.stroke();

    // Caixa total
    const totalGrad = ctx.createLinearGradient(PADDING, yFooter + 20, LARGURA - PADDING, yFooter + 80);
    totalGrad.addColorStop(0, 'rgba(99,102,241,0.15)');
    totalGrad.addColorStop(1, 'rgba(236,72,153,0.15)');
    ctx.fillStyle = totalGrad;
    ctx.beginPath();
    ctx.roundRect(PADDING, yFooter + 20, LARGURA - PADDING * 2, 60, 12);
    ctx.fill();

    // Borda caixa total
    ctx.strokeStyle = 'rgba(99,102,241,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(PADDING, yFooter + 20, LARGURA - PADDING * 2, 60, 12);
    ctx.stroke();

    // Label TOTAL
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = 'rgba(167,139,250,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', PADDING + 20, yFooter + 57);

    // Valor total
    ctx.font = `bold 28px Arial`;
    const gradTotal = ctx.createLinearGradient(LARGURA / 2, 0, LARGURA, 0);
    gradTotal.addColorStop(0, '#a78bfa');
    gradTotal.addColorStop(1, '#f472b6');
    ctx.fillStyle = gradTotal;
    ctx.textAlign = 'right';
    ctx.fillText(formatarMoeda(total), LARGURA - PADDING - 20, yFooter + 60);

    // Rodapé assinatura
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(150,150,200,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Inpacto Sistema de Gestão`, LARGURA / 2, altura - 10);

    // Mostra botões
    exibirBotoesImagemPagamento();
    esconderHintPagamento();
}

// =============================================
// COMPARTILHAMENTO
// =============================================

function exibirBotoesImagemPagamento() {
    const btnBaixar = document.getElementById('pagBtnBaixar');
    const btnWhats = document.getElementById('pagBtnWhats');
    if (btnBaixar) btnBaixar.style.display = 'inline-flex';
    if (btnWhats) btnWhats.style.display = 'inline-flex';
}

function esconderHintPagamento() {
    const hint = document.getElementById('pagHint');
    if (hint) hint.style.display = 'none';
}

function mostrarHintPagamento(msg) {
    const hint = document.getElementById('pagHint');
    if (hint) { hint.textContent = msg; hint.style.display = 'block'; }
}

function obterNomeArquivo() {
    const mes = MESES_PT[pagamentoState.mesSelecionado];
    const ano = pagamentoState.anoSelecionado;
    return `Pagamento_${mes}_${ano}.png`;
}

function baixarImagemPagamento() {
    const canvas = document.getElementById('pagCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = obterNomeArquivo();
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function compartilharWhatsApp() {
    const canvas = document.getElementById('pagCanvas');
    if (!canvas) return;

    const mes = MESES_PT[pagamentoState.mesSelecionado];
    const ano = pagamentoState.anoSelecionado;
    const total = calcularTotal();
    const nomeArquivo = obterNomeArquivo();

    // Tenta usar a Web Share API (mobile / navegadores modernos)
    if (navigator.share && navigator.canShare) {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], nomeArquivo, { type: 'image/png' });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Pagamento ${mes}/${ano}`,
                    text: `Relatório de Pagamentos - ${mes}/${ano}\nTotal: ${formatarMoeda(total)}`,
                    files: [file]
                });
                return;
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('Web Share API falhou, usando fallback:', err);
            } else {
                return; // Usuário cancelou
            }
        }
    }

    // Fallback: Baixa a imagem e abre WhatsApp Web
    const link = document.createElement('a');
    link.download = nomeArquivo;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Abre WhatsApp após um pequeno delay
    setTimeout(() => {
        const texto = encodeURIComponent(`Relatório de Pagamentos - ${mes}/${ano}\nTotal: ${formatarMoeda(total)}\n\n(Imagem baixada - envie no WhatsApp)`);
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        const url = isMobile
            ? `whatsapp://send?text=${texto}`
            : `https://web.whatsapp.com/`;
        window.open(url, '_blank');
    }, 500);
}

// =============================================
// INICIALIZAÇÃO
// =============================================

function inicializarPagamento() {
    // Recarrega quando a aba é aberta via click
    document.querySelectorAll('.tab-button').forEach(btn => {
        if (btn.getAttribute('data-tab') === 'pagamento') {
            btn.addEventListener('click', () => {
                setTimeout(renderizarAbaPagamento, 50);
            });
        }
    });
}
