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
    igrejasSelecionadas: {},  // { chave: { nome, id, valor } }
    itensExtras: []           // [{ nome, valor }]
};

// =============================================
// HELPERS DE DADOS
// =============================================

function obterIgrejasPagamento() {
    try {
        let lista = [];

        // Tenta usar a variável global nfData (do nf-manager.js) — mais atualizada
        if (typeof nfData !== 'undefined' && Array.isArray(nfData.igrejas)) {
            lista = nfData.igrejas;
        } else {
            // Fallback: localStorage
            const nfStr = localStorage.getItem('notasFiscais');
            if (!nfStr) return [];
            const parsed = JSON.parse(nfStr);
            lista = parsed.igrejas || [];
        }

        // Filtra inválidas e remove duplicatas por nome+id
        const vistas = new Set();
        return lista.filter(ig => {
            if (!ig || !ig.nome) return false;
            const chave = ig.nome + '_' + (ig.id || '');
            if (vistas.has(chave)) return false;
            vistas.add(chave);
            return true;
        });
    } catch (e) {
        console.error('[Pagamento] Erro ao obter igrejas:', e);
        return [];
    }
}

function chaveIgreja(ig) {
    return ig.nome + '_' + (ig.id || '');
}

function gerarOpcoesAno(anoAtual) {
    let html = '';
    for (let a = anoAtual - 2; a <= anoAtual + 2; a++) {
        html += '<option value="' + a + '"' + (a === anoAtual ? ' selected' : '') + '>' + a + '</option>';
    }
    return html;
}

// =============================================
// RENDERIZAÇÃO PRINCIPAL
// =============================================

function renderizarAbaPagamento() {
    try {
        const container = document.getElementById('pagamentoContainer');
        if (!container) {
            console.warn('[Pagamento] Container não encontrado');
            return;
        }

        const igrejas = obterIgrejasPagamento();
        const mesAtual = pagamentoState.mesSelecionado;
        const anoAtual = pagamentoState.anoSelecionado;

        let listaIgrejasHTML = '';
        if (igrejas.length === 0) {
            listaIgrejasHTML = '<div class="pag-empty"><i class="fas fa-church"></i><p>Nenhuma igreja encontrada.<br>Adicione igrejas nas Notas Fiscais.</p></div>';
        } else {
            listaIgrejasHTML = '<div class="pag-busca-wrapper"><i class="fas fa-search"></i><input type="text" id="pagBusca" placeholder="Buscar igreja..." oninput="filtrarIgrejasPagamento(this.value)" class="pag-busca-input"></div><div id="pagIgrejaLista" class="pag-igreja-lista">' + renderizarListaIgrejas(igrejas, '') + '</div>';
        }

        container.innerHTML =
            '<div class="pag-layout">' +

            // ===== COLUNA ESQUERDA =====
            '<div class="pag-coluna-esq">' +

            // Seletor de mês/ano
            '<div class="pag-card">' +
            '<h3 class="pag-card-titulo"><i class="fas fa-calendar-alt"></i> Período de Pagamento</h3>' +
            '<div class="pag-mes-grid">' +
            '<div class="pag-field"><label>Mês</label><select id="pagMes" onchange="alterarMesPagamento(this.value)">' + MESES_PT.map(function(m, i) { return '<option value="' + i + '"' + (i === mesAtual ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
            '<div class="pag-field"><label>Ano</label><select id="pagAno" onchange="alterarAnoPagamento(this.value)">' + gerarOpcoesAno(anoAtual) + '</select></div>' +
            '</div></div>' +

            // Lista de igrejas
            '<div class="pag-card">' +
            '<div class="pag-card-header"><h3 class="pag-card-titulo"><i class="fas fa-church"></i> Igrejas</h3><span class="pag-badge">' + igrejas.length + ' igrejas</span></div>' +
            listaIgrejasHTML +
            '</div>' +

            // Itens extras
            '<div class="pag-card">' +
            '<div class="pag-card-header"><h3 class="pag-card-titulo"><i class="fas fa-plus-circle"></i> Itens Extras</h3></div>' +
            '<div id="pagItensExtras" class="pag-extras-lista">' + renderizarItensExtras() + '</div>' +
            '<div class="pag-extra-form">' +
            '<input type="text" id="pagExtraNome" placeholder="Descrição do item..." class="pag-input">' +
            '<input type="text" id="pagExtraValor" placeholder="R$ 0,00" class="pag-input pag-input-valor" oninput="mascararValorInput(this)">' +
            '<button class="pag-btn pag-btn-add" onclick="adicionarItemExtra()"><i class="fas fa-plus"></i> Adicionar</button>' +
            '</div></div>' +

            '</div>' + // fim coluna esq

            // ===== COLUNA DIREITA =====
            '<div class="pag-coluna-dir">' +

            // Resumo
            '<div class="pag-card pag-card-resumo">' +
            '<h3 class="pag-card-titulo"><i class="fas fa-receipt"></i> Resumo</h3>' +
            '<div id="pagResumo" class="pag-resumo-lista">' + renderizarResumo() + '</div>' +
            '<div class="pag-total-box" id="pagTotalBox">' + renderizarTotal() + '</div>' +
            '</div>' +

            // Preview & Gerar
            '<div class="pag-card">' +
            '<h3 class="pag-card-titulo"><i class="fas fa-image"></i> Imagem de Pagamento</h3>' +
            '<canvas id="pagCanvas" class="pag-canvas-preview"></canvas>' +
            '<div class="pag-acoes">' +
            '<button class="pag-btn pag-btn-gerar" onclick="gerarImagemPagamento()"><i class="fas fa-magic"></i> Gerar Imagem</button>' +
            '<button class="pag-btn pag-btn-baixar" id="pagBtnBaixar" onclick="baixarImagemPagamento()" style="display:none"><i class="fas fa-download"></i> Baixar</button>' +
            '<button class="pag-btn pag-btn-whatsapp" id="pagBtnWhats" onclick="compartilharWhatsApp()" style="display:none"><i class="fab fa-whatsapp"></i> Compartilhar</button>' +
            '</div>' +
            '<p class="pag-hint" id="pagHint">Selecione as igrejas e clique em "Gerar Imagem"</p>' +
            '</div>' +

            '</div>' + // fim coluna dir

            '</div>'; // fim pag-layout

        console.log('[Pagamento] Renderizado com ' + igrejas.length + ' igrejas');
    } catch (e) {
        console.error('[Pagamento] Erro ao renderizar aba:', e);
    }
}

// =============================================
// RENDERIZADORES PARCIAIS
// =============================================

function renderizarListaIgrejas(igrejas, busca) {
    try {
        var termo = busca.toLowerCase().trim();
        var filtradas = termo ? igrejas.filter(function(ig) { return ig.nome.toLowerCase().indexOf(termo) !== -1; }) : igrejas;

        if (filtradas.length === 0) {
            return '<div class="pag-empty-busca">Nenhuma igreja encontrada para "' + busca + '"</div>';
        }

        return filtradas.map(function(ig) {
            var chave = chaveIgreja(ig);
            var selecionada = !!pagamentoState.igrejasSelecionadas[chave];
            var valorAtual = selecionada ? pagamentoState.igrejasSelecionadas[chave].valor : '';
            var chaveEsc = chave.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var nomeEsc = ig.nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var idEsc = (ig.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            var inputValor = selecionada
                ? '<input type="text" class="pag-valor-input" placeholder="R$ 0,00" value="' + valorAtual + '" oninput="mascararValorInput(this); atualizarValorIgreja(\'' + chaveEsc + '\', this.value)" onfocus="this.select()">'
                : '';

            return '<div class="pag-igreja-item' + (selecionada ? ' pag-selecionada' : '') + '" data-chave="' + chave.replace(/"/g, '&quot;') + '">' +
                '<label class="pag-check-label">' +
                '<input type="checkbox" class="pag-checkbox"' + (selecionada ? ' checked' : '') +
                ' onchange="toggleIgrejaPagamento(\'' + chaveEsc + '\', this.checked, \'' + nomeEsc + '\', \'' + idEsc + '\')">' +
                '<span class="pag-check-box"></span>' +
                '<div class="pag-igreja-info">' +
                '<strong>' + ig.nome + '</strong>' +
                (ig.id ? '<span class="pag-ig-id">ID: ' + ig.id + '</span>' : '') +
                '</div>' +
                '</label>' +
                inputValor +
                '</div>';
        }).join('');
    } catch (e) {
        console.error('[Pagamento] Erro ao renderizar lista de igrejas:', e);
        return '';
    }
}

function renderizarItensExtras() {
    if (pagamentoState.itensExtras.length === 0) {
        return '<p class="pag-extras-vazio">Nenhum item extra adicionado.</p>';
    }
    return pagamentoState.itensExtras.map(function(item, i) {
        return '<div class="pag-extra-item">' +
            '<div class="pag-extra-info">' +
            '<span class="pag-extra-nome">' + item.nome + '</span>' +
            '<span class="pag-extra-val">' + (item.valor || '—') + '</span>' +
            '</div>' +
            '<button class="pag-btn-remover" onclick="removerItemExtra(' + i + ')" title="Remover"><i class="fas fa-times"></i></button>' +
            '</div>';
    }).join('');
}

function renderizarResumo() {
    var selecionadas = Object.values(pagamentoState.igrejasSelecionadas);
    var extras = pagamentoState.itensExtras;

    if (selecionadas.length === 0 && extras.length === 0) {
        return '<p class="pag-resumo-vazio">Selecione igrejas para ver o resumo.</p>';
    }

    var html = '';
    selecionadas.forEach(function(ig) {
        var val = parsearValor(ig.valor);
        html += '<div class="pag-resumo-item">' +
            '<span class="pag-resumo-nome"><i class="fas fa-church"></i> ' + ig.nome + '</span>' +
            '<span class="pag-resumo-val' + (val > 0 ? '' : ' pag-sem-valor') + '">' + (val > 0 ? formatarMoeda(val) : '—') + '</span>' +
            '</div>';
    });
    extras.forEach(function(item) {
        var val = parsearValor(item.valor);
        html += '<div class="pag-resumo-item pag-resumo-extra">' +
            '<span class="pag-resumo-nome"><i class="fas fa-plus-circle"></i> ' + item.nome + '</span>' +
            '<span class="pag-resumo-val' + (val > 0 ? '' : ' pag-sem-valor') + '">' + (val > 0 ? formatarMoeda(val) : '—') + '</span>' +
            '</div>';
    });
    return html;
}

function renderizarTotal() {
    var total = calcularTotal();
    return '<div class="pag-total-label">Total</div><div class="pag-total-valor">' + formatarMoeda(total) + '</div>';
}

// =============================================
// AÇÕES DO USUÁRIO
// =============================================

function alterarMesPagamento(valor) {
    pagamentoState.mesSelecionado = parseInt(valor, 10);
}

function alterarAnoPagamento(valor) {
    pagamentoState.anoSelecionado = parseInt(valor, 10);
}

function filtrarIgrejasPagamento(busca) {
    var igrejas = obterIgrejasPagamento();
    var lista = document.getElementById('pagIgrejaLista');
    if (lista) lista.innerHTML = renderizarListaIgrejas(igrejas, busca);
}

function toggleIgrejaPagamento(chave, marcada, nome, id) {
    if (marcada) {
        pagamentoState.igrejasSelecionadas[chave] = { nome: nome, id: id, valor: '' };
    } else {
        delete pagamentoState.igrejasSelecionadas[chave];
    }
    atualizarItemVisualPagamento(chave, marcada);
    atualizarResumoPagamento();
}

function atualizarItemVisualPagamento(chave, selecionada) {
    // Encontra o item pelo data-chave
    var item = document.querySelector('[data-chave="' + chave.replace(/"/g, '&quot;') + '"]');
    if (!item) return;

    item.classList.toggle('pag-selecionada', selecionada);

    var existente = item.querySelector('.pag-valor-input');
    if (selecionada && !existente) {
        var chaveEsc = chave.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'pag-valor-input';
        input.placeholder = 'R$ 0,00';
        input.setAttribute('oninput', 'mascararValorInput(this); atualizarValorIgreja(\'' + chaveEsc + '\', this.value)');
        input.setAttribute('onfocus', 'this.select()');
        item.appendChild(input);
        setTimeout(function() { input.focus(); }, 10);
    } else if (!selecionada && existente) {
        existente.remove();
    }
}

function atualizarValorIgreja(chave, valor) {
    if (pagamentoState.igrejasSelecionadas[chave]) {
        pagamentoState.igrejasSelecionadas[chave].valor = valor;
    }
    atualizarResumoPagamento();
}

function adicionarItemExtra() {
    var nomeEl = document.getElementById('pagExtraNome');
    var valorEl = document.getElementById('pagExtraValor');
    var nome = nomeEl ? nomeEl.value.trim() : '';
    var valor = valorEl ? valorEl.value.trim() : '';

    if (!nome) {
        if (nomeEl) nomeEl.focus();
        return;
    }

    pagamentoState.itensExtras.push({ nome: nome, valor: valor });
    if (nomeEl) nomeEl.value = '';
    if (valorEl) valorEl.value = '';

    var lista = document.getElementById('pagItensExtras');
    if (lista) lista.innerHTML = renderizarItensExtras();
    atualizarResumoPagamento();
}

function removerItemExtra(index) {
    pagamentoState.itensExtras.splice(index, 1);
    var lista = document.getElementById('pagItensExtras');
    if (lista) lista.innerHTML = renderizarItensExtras();
    atualizarResumoPagamento();
}

function atualizarResumoPagamento() {
    var resumo = document.getElementById('pagResumo');
    var totalBox = document.getElementById('pagTotalBox');
    if (resumo) resumo.innerHTML = renderizarResumo();
    if (totalBox) totalBox.innerHTML = renderizarTotal();
}

// =============================================
// FORMATAÇÃO
// =============================================

function mascararValorInput(input) {
    var v = input.value.replace(/\D/g, '');
    if (v === '') { input.value = ''; return; }
    var n = parseInt(v, 10);
    input.value = 'R$ ' + (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsearValor(str) {
    if (!str) return 0;
    var num = parseFloat(String(str).replace(/[^\d,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularTotal() {
    var total = 0;
    Object.values(pagamentoState.igrejasSelecionadas).forEach(function(ig) {
        total += parsearValor(ig.valor);
    });
    pagamentoState.itensExtras.forEach(function(item) {
        total += parsearValor(item.valor);
    });
    return total;
}

// =============================================
// GERAÇÃO DE IMAGEM (CANVAS)
// =============================================

function gerarImagemPagamento() {
    try {
        var canvas = document.getElementById('pagCanvas');
        if (!canvas) return;

        var selecionadas = Object.values(pagamentoState.igrejasSelecionadas);
        var extras = pagamentoState.itensExtras;
        var total = calcularTotal();
        var mes = MESES_PT[pagamentoState.mesSelecionado];
        var ano = pagamentoState.anoSelecionado;

        var todosItens = [];
        selecionadas.forEach(function(ig) {
            todosItens.push({ nome: ig.nome, valor: parsearValor(ig.valor), tipo: 'igreja' });
        });
        extras.forEach(function(it) {
            todosItens.push({ nome: it.nome, valor: parsearValor(it.valor), tipo: 'extra' });
        });

        if (todosItens.length === 0) {
            mostrarHintPagamento('Selecione pelo menos uma igreja para gerar a imagem.');
            return;
        }

        var LARGURA = 800;
        var PADDING = 40;
        var HEADER_H = 130;
        var ITEM_H = 52;
        var FOOTER_H = 110;
        var altura = HEADER_H + todosItens.length * ITEM_H + FOOTER_H + PADDING;

        canvas.width = LARGURA;
        canvas.height = altura;
        canvas.style.display = 'block';

        var ctx = canvas.getContext('2d');

        // Fundo gradiente escuro
        var grad = ctx.createLinearGradient(0, 0, LARGURA, altura);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(0.5, '#16213e');
        grad.addColorStop(1, '#0f3460');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, LARGURA, altura);

        // Bordas arredondadas simuladas (clip)
        ctx.save();
        ctx.beginPath();
        var r = 20;
        ctx.moveTo(r, 0);
        ctx.lineTo(LARGURA - r, 0);
        ctx.quadraticCurveTo(LARGURA, 0, LARGURA, r);
        ctx.lineTo(LARGURA, altura - r);
        ctx.quadraticCurveTo(LARGURA, altura, LARGURA - r, altura);
        ctx.lineTo(r, altura);
        ctx.quadraticCurveTo(0, altura, 0, altura - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.clip();

        // Fundo de novo (com clip)
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, LARGURA, altura);

        // Brilho radial superior
        var brilho = ctx.createRadialGradient(LARGURA / 2, 0, 10, LARGURA / 2, 0, 400);
        brilho.addColorStop(0, 'rgba(100,100,255,0.12)');
        brilho.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = brilho;
        ctx.fillRect(0, 0, LARGURA, altura);

        // Linha decorativa topo
        var linhaTopo = ctx.createLinearGradient(PADDING, 0, LARGURA - PADDING, 0);
        linhaTopo.addColorStop(0, 'rgba(99,102,241,0)');
        linhaTopo.addColorStop(0.5, '#6366f1');
        linhaTopo.addColorStop(1, 'rgba(236,72,153,0)');
        ctx.strokeStyle = linhaTopo;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PADDING, 28);
        ctx.lineTo(LARGURA - PADDING, 28);
        ctx.stroke();

        // Marca do sistema
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'rgba(150,150,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('INPACTO · SISTEMA DE GESTÃO', LARGURA / 2, 22);

        // Título mês/ano
        ctx.font = 'bold 40px Arial';
        var gradTitulo = ctx.createLinearGradient(200, 0, 600, 0);
        gradTitulo.addColorStop(0, '#a78bfa');
        gradTitulo.addColorStop(1, '#f472b6');
        ctx.fillStyle = gradTitulo;
        ctx.textAlign = 'center';
        ctx.fillText(mes + ' / ' + ano, LARGURA / 2, 80);

        // Subtítulo
        ctx.font = '15px Arial';
        ctx.fillStyle = 'rgba(200,200,255,0.55)';
        ctx.fillText('Relatório de Pagamentos', LARGURA / 2, 106);

        // Linha separadora header
        var linhaH = ctx.createLinearGradient(PADDING, 0, LARGURA - PADDING, 0);
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

        // Itens
        todosItens.forEach(function(item, i) {
            var y = HEADER_H + i * ITEM_H;
            var isAlternado = i % 2 === 0;

            if (isAlternado) {
                ctx.fillStyle = 'rgba(255,255,255,0.025)';
                ctx.fillRect(PADDING, y + 6, LARGURA - PADDING * 2, ITEM_H - 6);
            }

            // Bolinha colorida
            ctx.fillStyle = item.tipo === 'extra' ? '#f472b6' : '#818cf8';
            ctx.beginPath();
            ctx.arc(PADDING + 10, y + ITEM_H / 2, 4, 0, Math.PI * 2);
            ctx.fill();

            // Nome
            ctx.font = (item.tipo === 'extra' ? 'italic ' : '') + '15px Arial';
            ctx.fillStyle = item.valor > 0 ? 'rgba(230,230,255,0.92)' : 'rgba(180,180,220,0.5)';
            ctx.textAlign = 'left';
            // Truncar nome longo
            var nomeExib = item.nome;
            while (ctx.measureText(nomeExib).width > 460 && nomeExib.length > 1) {
                nomeExib = nomeExib.slice(0, -1);
            }
            if (nomeExib !== item.nome) nomeExib += '...';
            ctx.fillText(nomeExib, PADDING + 24, y + ITEM_H / 2 + 6);

            // Valor
            if (item.valor > 0) {
                var gradVal = ctx.createLinearGradient(LARGURA - PADDING - 160, 0, LARGURA - PADDING, 0);
                gradVal.addColorStop(0, '#a78bfa');
                gradVal.addColorStop(1, '#f472b6');
                ctx.fillStyle = gradVal;
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'right';
                ctx.fillText(formatarMoeda(item.valor), LARGURA - PADDING, y + ITEM_H / 2 + 6);
            } else {
                ctx.fillStyle = 'rgba(150,150,200,0.35)';
                ctx.font = '14px Arial';
                ctx.textAlign = 'right';
                ctx.fillText('—', LARGURA - PADDING, y + ITEM_H / 2 + 6);
            }

            // Divisória leve
            if (i < todosItens.length - 1) {
                ctx.strokeStyle = 'rgba(255,255,255,0.04)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(PADDING + 20, y + ITEM_H);
                ctx.lineTo(LARGURA - PADDING, y + ITEM_H);
                ctx.stroke();
            }
        });

        // Linha separadora rodapé
        var yFooter = HEADER_H + todosItens.length * ITEM_H;
        var linhaTot = ctx.createLinearGradient(PADDING, 0, LARGURA - PADDING, 0);
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

        // Caixa total — fundo com gradiente
        var totalGrad = ctx.createLinearGradient(PADDING, yFooter + 24, LARGURA - PADDING, yFooter + 84);
        totalGrad.addColorStop(0, 'rgba(99,102,241,0.18)');
        totalGrad.addColorStop(1, 'rgba(236,72,153,0.18)');
        ctx.fillStyle = totalGrad;
        // Retângulo com cantos arredondados manual
        var bx = PADDING, by = yFooter + 24, bw = LARGURA - PADDING * 2, bh = 60, br = 12;
        ctx.beginPath();
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + bw - br, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
        ctx.lineTo(bx + bw, by + bh - br);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
        ctx.lineTo(bx + br, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
        ctx.lineTo(bx, by + br);
        ctx.quadraticCurveTo(bx, by, bx + br, by);
        ctx.closePath();
        ctx.fill();

        // Borda caixa total
        ctx.strokeStyle = 'rgba(99,102,241,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label TOTAL
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = 'rgba(167,139,250,0.75)';
        ctx.textAlign = 'left';
        ctx.fillText('TOTAL', PADDING + 20, yFooter + 59);

        // Valor total
        var gradTotalVal = ctx.createLinearGradient(LARGURA / 2, 0, LARGURA, 0);
        gradTotalVal.addColorStop(0, '#a78bfa');
        gradTotalVal.addColorStop(1, '#f472b6');
        ctx.fillStyle = gradTotalVal;
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(formatarMoeda(total), LARGURA - PADDING - 20, yFooter + 62);

        // Assinatura rodapé
        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(150,150,200,0.35)';
        ctx.textAlign = 'center';
        ctx.fillText('Gerado em ' + new Date().toLocaleDateString('pt-BR') + ' · Inpacto Sistema de Gestão', LARGURA / 2, altura - 12);

        ctx.restore();

        exibirBotoesImagemPagamento();
        esconderHintPagamento();
    } catch (e) {
        console.error('[Pagamento] Erro ao gerar imagem:', e);
        mostrarHintPagamento('Erro ao gerar imagem. Verifique o console.');
    }
}

// =============================================
// COMPARTILHAMENTO
// =============================================

function exibirBotoesImagemPagamento() {
    var btnBaixar = document.getElementById('pagBtnBaixar');
    var btnWhats = document.getElementById('pagBtnWhats');
    if (btnBaixar) btnBaixar.style.display = 'inline-flex';
    if (btnWhats) btnWhats.style.display = 'inline-flex';
}

function esconderHintPagamento() {
    var hint = document.getElementById('pagHint');
    if (hint) hint.style.display = 'none';
}

function mostrarHintPagamento(msg) {
    var hint = document.getElementById('pagHint');
    if (hint) { hint.textContent = msg; hint.style.display = 'block'; }
}

function obterNomeArquivoPagamento() {
    return 'Pagamento_' + MESES_PT[pagamentoState.mesSelecionado] + '_' + pagamentoState.anoSelecionado + '.png';
}

function baixarImagemPagamento() {
    var canvas = document.getElementById('pagCanvas');
    if (!canvas) return;
    var link = document.createElement('a');
    link.download = obterNomeArquivoPagamento();
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function compartilharWhatsApp() {
    var canvas = document.getElementById('pagCanvas');
    if (!canvas) return;

    var mes = MESES_PT[pagamentoState.mesSelecionado];
    var ano = pagamentoState.anoSelecionado;
    var total = calcularTotal();
    var nomeArq = obterNomeArquivoPagamento();

    // Tenta Web Share API (mobile moderno)
    if (navigator.share && navigator.canShare) {
        canvas.toBlob(function(blob) {
            try {
                var file = new File([blob], nomeArq, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({
                        title: 'Pagamento ' + mes + '/' + ano,
                        text: 'Relatório de Pagamentos - ' + mes + '/' + ano + '\nTotal: ' + formatarMoeda(total),
                        files: [file]
                    }).catch(function(err) {
                        if (err.name !== 'AbortError') fallbackCompartilhar(mes, ano, total, nomeArq);
                    });
                    return;
                }
            } catch (e) {
                console.warn('[Pagamento] Web Share falhou:', e);
            }
            fallbackCompartilhar(mes, ano, total, nomeArq);
        }, 'image/png');
    } else {
        fallbackCompartilhar(mes, ano, total, nomeArq);
    }
}

function fallbackCompartilhar(mes, ano, total, nomeArq) {
    // Baixa a imagem
    var canvas = document.getElementById('pagCanvas');
    if (canvas) {
        var link = document.createElement('a');
        link.download = nomeArq;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
    // Abre WhatsApp após delay para o download iniciar
    setTimeout(function() {
        var texto = encodeURIComponent('Relatório de Pagamentos - ' + mes + '/' + ano + '\nTotal: ' + formatarMoeda(total) + '\n\n(Imagem baixada - anexe no WhatsApp)');
        var isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        var url = isMobile ? 'whatsapp://send?text=' + texto : 'https://web.whatsapp.com/';
        window.open(url, '_blank');
    }, 600);
}

// =============================================
// INICIALIZAÇÃO
// =============================================

function inicializarPagamento() {
    // Dispara o render quando o usuário clica na aba
    document.querySelectorAll('.tab-button').forEach(function(btn) {
        if (btn.getAttribute('data-tab') === 'pagamento') {
            btn.addEventListener('click', function() {
                setTimeout(renderizarAbaPagamento, 80);
            });
        }
    });
    console.log('[Pagamento] Módulo inicializado');
}

// Expõe explicitamente no window para uso via main.js
window.renderizarAbaPagamento = renderizarAbaPagamento;
window.inicializarPagamento = inicializarPagamento;
