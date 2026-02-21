// Gerenciador de Checklists para Igrejas

// Estrutura de dados para checklists
let checklistData = {
    igrejas: [] // Lista de igrejas com seus checklists
};

// Perguntas do checklist (baseadas nas imagens fornecidas)
const perguntasChecklist = {
    responsavel: [
        { id: 'data', label: 'Data', tipo: 'date' },
        { id: 'aprovadoPor', label: 'Aprovado por', tipo: 'text', placeholder: 'Digite o nome do aprovador' },
        { id: 'cpf', label: 'CPF', tipo: 'text', placeholder: '000.000.000-00' },
        { id: 'telefone', label: 'Telefone', tipo: 'tel', placeholder: '(00) 00000-0000' }
    ],
    itens: [
        'TODAS AS CAIXAS DO TEMPLO ESTÃO FUNCIONANDO PERFEITAMENTE?',
        'OS DIÂMETROS DOS CABOS DE LIGAÇÃO DAS CAIXAS ESTÃO DENTRO DAS NORMAS?',
        'TODOS OS RETORNOS ESTÃO FUNCIONANDO PERFEITAMENTE?',
        'OS CABOS DO RETORNO SÃO PP?',
        'AS CAIXAS DO TEMPLO ESTÃO ALINHADAS?',
        'TODOS OS CANAIS DA MESA FORAM TESTADOS?',
        'TODOS AS LIGAÇÕES DOS CANAIS DOS AMPLIFICADORES ESTÃO CORRETAS?',
        'O MICROFONE DO PÚLPITO ESTÁ FUNCIONANDO?',
        'TODOS OS CABOS FORAM TESTADOS E ESTÃO APTOS A UTILIZAR?',
        'OS CABOS ESTÃO ORGANIZADOS?',
        'OS EQUIPAMENTOS ESTÃO EM BOAS CONDIÇÕES OU CONSERVADO?',
        'OS MICROFONES ESPECÍFICOS (CORDAS, METAIS, GRUPO, ETC.) ESTÃO FUNCIONANDO?',
        'O SISTEMA DE SATÉLITE ESTÁ FUNCIONANDO CORRETAMENTE?',
        'O PROCESSADOR ESTÁ ALINHADO COM O LOCAL?',
        'TODAS AS VIAS DA MEDUSA ESTÃO FUNCIONANDO?',
        'A IGREJA POSSUI SISTEMA DE ATERRAMENTO PARA O SOM?',
        'A IGREJA POSSUI UM DISJUNTOR EXCLUSIVO PARA O SOM?',
        'A IGREJA POSSUI EQUIPAMENTOS EXCEDENTES?'
    ]
};

// Flag: impede salvar no Firebase durante o carregamento inicial
let _checklistCarregando = false;

// Carrega os dados do localStorage
function carregarDadosChecklist() {
    _checklistCarregando = true;
    try {
        const dadosSalvos = localStorage.getItem('checklistsIgrejas');
        if (dadosSalvos) {
            checklistData = JSON.parse(dadosSalvos);
            if (!checklistData.igrejas) checklistData.igrejas = [];
            console.log('Dados de checklist carregados:', checklistData);
        }
        sincronizarIgrejasChecklistNF();
        atualizarListaChecklist();
    } catch (error) {
        console.error('Erro ao carregar dados de checklist:', error);
        checklistData = { igrejas: [] };
    } finally {
        _checklistCarregando = false;
    }
}

// Salva os dados no localStorage e no Firebase
function salvarDadosChecklist() {
    try {
        // Marca timestamp
        checklistData._ts = Date.now();

        localStorage.setItem('checklistsIgrejas', JSON.stringify(checklistData));
        console.log('✅ Dados de checklist salvos localmente');

        // Salva no Firebase sem assinaturas (economiza espaço), fora do carregamento inicial
        if (!window._fbReceivendo && !_checklistCarregando && typeof salvarNoDatabase === 'function' && typeof firebaseDisponivel !== 'undefined' && firebaseDisponivel) {
            if (typeof window._piscarBadgeSync === 'function') window._piscarBadgeSync();
            const dadosSemAssinatura = {
                _ts: checklistData._ts,
                igrejas: (checklistData.igrejas || []).map(ig => {
                    const igCopy = Object.assign({}, ig);
                    if (igCopy.checklist) {
                        igCopy.checklist = Object.assign({}, igCopy.checklist);
                        delete igCopy.checklist.assinatura; // Não sobe imagem para Firebase
                    }
                    return igCopy;
                })
            };
            salvarNoDatabase('dados/checklists', dadosSemAssinatura)
                .then(() => console.log('✅ Checklist salvo no Firebase'))
                .catch(err => console.warn('⚠️ Checklist não salvo no Firebase:', err));
        }
    } catch (error) {
        console.error('❌ Erro ao salvar dados de checklist:', error);
    }
}

// Sincroniza a lista de igrejas com as Notas Fiscais
function sincronizarIgrejasChecklistNF() {
    try {
        const nfDataStr = localStorage.getItem('notasFiscais');
        if (!nfDataStr) return;

        const nfData = JSON.parse(nfDataStr);
        const igrejasNF = nfData.igrejas || [];

        // Remove igrejas que não existem mais nas Notas Fiscais
        checklistData.igrejas = checklistData.igrejas.filter(igrejaCheck => {
            const aindaExiste = igrejasNF.some(igrejaNF =>
                igrejaNF.nome === igrejaCheck.nome && igrejaNF.id === igrejaCheck.id
            );
            if (!aindaExiste) {
                console.log(`🗑️ Removendo igreja "${igrejaCheck.nome}" do Checklist - não existe mais nas NFs`);
            }
            return aindaExiste;
        });

        // Adiciona igrejas que estão em NF mas não em Checklist
        igrejasNF.forEach(igrejaNF => {
            const jaExiste = checklistData.igrejas.find(
                ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id
            );

            if (!jaExiste) {
                const novaIgreja = {
                    nome: igrejaNF.nome,
                    id: igrejaNF.id || '',
                    link: igrejaNF.link || '',
                    checklist: null,
                    pdf: null
                };
                checklistData.igrejas.push(novaIgreja);
                console.log(`➕ Nova igreja adicionada ao Checklist: "${novaIgreja.nome}"`);
            }
        });

        salvarDadosChecklist();
    } catch (error) {
        console.error('Erro ao sincronizar igrejas do checklist:', error);
    }
}

// Atualiza a lista de igrejas na interface
function atualizarListaChecklist() {
    const container = document.getElementById('checklistList');
    if (!container) return;

    container.innerHTML = '';

    const igrejas = checklistData.igrejas || [];

    if (igrejas.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard"></i><h3>Nenhuma igreja cadastrada</h3><p>Adicione igrejas através das Notas Fiscais</p></div>';
        return;
    }

    // Cria a tabela
    const tabela = document.createElement('div');
    tabela.className = 'checklist-table';
    tabela.innerHTML = `
        <div class="checklist-header">
            <div><i class="fas fa-church"></i> Igreja</div>
            <div><i class="fas fa-clipboard-check"></i> Status</div>
            <div><i class="fas fa-cog"></i> Ações</div>
        </div>
    `;

    igrejas.forEach((igreja, index) => {
        const linha = document.createElement('div');
        linha.className = 'checklist-row';

        const temChecklist = igreja.checklist && igreja.checklist.respostas;
        const statusClass = temChecklist ? 'preenchido' : 'pendente';
        const statusText = temChecklist ? 'Preenchido' : 'Pendente';

        linha.innerHTML = `
            <div class="checklist-col-igreja">
                <strong><i class="fas fa-church" style="margin-right: 8px; color: var(--gradient-start);"></i>${igreja.nome}</strong>
                ${igreja.id ? `<span class="checklist-id"><i class="fas fa-tag"></i> ID: ${igreja.id}</span>` : ''}
            </div>
            <div>
                <span class="checklist-status ${statusClass}">${statusText}</span>
            </div>
            <div class="checklist-col-acoes">
                ${temChecklist ? `
                    <button class="btn-icon btn-primary" onclick="visualizarChecklist(${index})" title="Visualizar Checklist">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-success" onclick="downloadChecklistPDF(${index})" title="Baixar PDF">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
                <button class="btn-primary" onclick="abrirModalChecklist(${index})">
                    <i class="fas fa-clipboard-check"></i> ${temChecklist ? 'Editar' : 'Adicionar'} Checklist
                </button>
            </div>
        `;

        tabela.appendChild(linha);
    });

    container.appendChild(tabela);
}

// Abre o modal para preencher/editar checklist
function abrirModalChecklist(igrejaIndex) {
    const igreja = checklistData.igrejas[igrejaIndex];
    if (!igreja) return;

    const checklistExistente = igreja.checklist || {};
    const responsavel = checklistExistente.responsavel || {};
    const respostas = checklistExistente.respostas || {};

    const modal = document.createElement('div');
    modal.className = 'material-modal';
    modal.style.overflowY = 'auto';
    
    let htmlResposavel = '';
    perguntasChecklist.responsavel.forEach(campo => {
        let valor = responsavel[campo.id] || '';
        
        // Se for o campo de data e não tiver valor, pega a data atual
        if (campo.id === 'data' && !valor) {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const dia = String(hoje.getDate()).padStart(2, '0');
            valor = `${ano}-${mes}-${dia}`;
        }
        
        htmlResposavel += `
            <div class="form-group">
                <label for="resp_${campo.id}"><i class="fas fa-${campo.id === 'data' ? 'calendar' : campo.id === 'cpf' ? 'id-card' : campo.id === 'telefone' ? 'phone' : 'user'}"></i> ${campo.label}:</label>
                <input type="${campo.tipo}" id="resp_${campo.id}" value="${valor}" ${campo.placeholder ? `placeholder="${campo.placeholder}"` : ''} ${campo.id === 'data' ? 'readonly' : ''} required>
            </div>
        `;
    });

    let htmlItens = '';
    perguntasChecklist.itens.forEach((pergunta, index) => {
        const respostaAtual = respostas[`item_${index}`] || '';
        htmlItens += `
            <div class="checklist-question">
                <span class="checklist-question-text">${pergunta}</span>
                <div class="checklist-options">
                    <div class="checklist-option">
                        <input type="radio" id="item_${index}_sim" name="item_${index}" value="SIM" ${respostaAtual === 'SIM' ? 'checked' : ''} required>
                        <label for="item_${index}_sim">SIM</label>
                    </div>
                    <div class="checklist-option">
                        <input type="radio" id="item_${index}_nao" name="item_${index}" value="NÃO" ${respostaAtual === 'NÃO' ? 'checked' : ''}>
                        <label for="item_${index}_nao">NÃO</label>
                    </div>
                    <div class="checklist-option">
                        <input type="radio" id="item_${index}_na" name="item_${index}" value="N/A" ${respostaAtual === 'N/A' ? 'checked' : ''}>
                        <label for="item_${index}_na">N/A</label>
                    </div>
                </div>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="material-modal-content" style="animation: modalSlideIn 0.3s ease; max-width: 800px;">
            <div class="material-modal-header">
                <h3><i class="fas fa-clipboard-check" style="margin-right: 10px;"></i>Novo Checklist - ${igreja.nome}</h3>
                <button class="material-modal-close" onclick="this.closest('.material-modal').remove()">×</button>
            </div>
            
            <div class="material-modal-body">
                <form id="formChecklist" onsubmit="salvarChecklist(event, ${igrejaIndex})">
                    <!-- Informações do Responsável -->
                    <div class="checklist-form-section">
                        <h4><i class="fas fa-user-tie"></i> Informações do Responsável</h4>
                        ${htmlResposavel}
                    </div>

                    <!-- Itens do Checklist -->
                    <div class="checklist-form-section">
                        <h4><i class="fas fa-tasks"></i> Itens do Checklist</h4>
                        ${htmlItens}
                    </div>

                    <!-- Assinatura Digital -->
                    <div class="checklist-form-section">
                        <h4><i class="fas fa-signature"></i> Assinatura Digital</h4>
                        <div class="signature-canvas-wrapper">
                            <canvas id="signatureCanvas" class="signature-canvas" width="600" height="200"></canvas>
                            <div class="signature-buttons">
                                <button type="button" class="btn-warning" onclick="limparAssinatura()">
                                    <i class="fas fa-eraser"></i> Limpar
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="material-modal-buttons">
                        <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Salvar Checklist</button>
                        <button type="button" class="btn-secondary" onclick="this.closest('.material-modal').remove()"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // Inicializa o canvas de assinatura
    setTimeout(() => inicializarCanvasAssinatura(checklistExistente.assinatura), 100);
}

// Canvas de assinatura
let canvasAssinatura = null;
let isDrawing = false;

function inicializarCanvasAssinatura(assinaturaExistente) {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    canvasAssinatura = canvas;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Se existe assinatura, carrega ela
    if (assinaturaExistente) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = assinaturaExistente;
    }

    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastX = x;
        lastY = y;
    });

    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    // Touch events para mobile
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastX = x;
        lastY = y;
    });

    canvas.addEventListener('touchend', () => isDrawing = false);
}

function limparAssinatura() {
    if (!canvasAssinatura) return;
    const ctx = canvasAssinatura.getContext('2d');
    ctx.clearRect(0, 0, canvasAssinatura.width, canvasAssinatura.height);
}

// Salva o checklist
async function salvarChecklist(event, igrejaIndex) {
    event.preventDefault();

    const igreja = checklistData.igrejas[igrejaIndex];
    if (!igreja) return;

    // Coleta dados do responsável
    const responsavel = {};
    perguntasChecklist.responsavel.forEach(campo => {
        responsavel[campo.id] = document.getElementById(`resp_${campo.id}`).value.trim();
    });

    // Coleta respostas dos itens
    const respostas = {};
    perguntasChecklist.itens.forEach((pergunta, index) => {
        const radioSelecionado = document.querySelector(`input[name="item_${index}"]:checked`);
        if (radioSelecionado) {
            respostas[`item_${index}`] = radioSelecionado.value;
        }
    });

    // Coleta assinatura
    const assinatura = canvasAssinatura ? canvasAssinatura.toDataURL() : null;

    // Salva no objeto
    igreja.checklist = {
        responsavel,
        respostas,
        assinatura,
        dataPreenchimento: new Date().toISOString()
    };

    salvarDadosChecklist();
    
    // NÃO salva assinaturas no Firebase para economizar espaço
    // Apenas salva os dados do checklist (sem imagens)
    if (typeof window.firebaseDB !== 'undefined' && window.firebaseDB.disponivel()) {
        try {
            const checklistId = igreja.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            
            // Salva checklist no Realtime Database (SEM assinatura)
            await window.firebaseDB.salvar(`checklists/${checklistId}`, {
                igreja: igreja.nome,
                igrejaId: igreja.id,
                responsavel: responsavel,
                respostas: respostas,
                // assinatura não é salva no Firebase
                dataPreenchimento: new Date().toISOString()
            });
            
            console.log('✅ Checklist salvo no Firebase Realtime Database (sem imagens)!');
        } catch (error) {
            console.error('❌ Erro ao salvar no Firebase:', error);
        }
    }
    
    atualizarListaChecklist();

    // Fecha o modal
    event.target.closest('.material-modal').remove();

    alert('✅ Checklist salvo com sucesso!');
}

// Visualiza um checklist existente
function visualizarChecklist(igrejaIndex) {
    const igreja = checklistData.igrejas[igrejaIndex];
    if (!igreja || !igreja.checklist) return;

    alert('Funcionalidade de visualização será implementada em breve!');
}

// Gera e baixa o PDF do checklist
async function downloadChecklistPDF(igrejaIndex) {
    const igreja = checklistData.igrejas[igrejaIndex];
    if (!igreja || !igreja.checklist) {
        alert('Checklist não encontrado!');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    
    const responsavel = igreja.checklist.responsavel;
    const respostas = igreja.checklist.respostas;
    const assinatura = igreja.checklist.assinatura;

    let y = 20;

    // Título
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CHECKLIST TÉCNICO', 105, y, { align: 'center' });
    y += 10;

    // Igreja
    pdf.setFontSize(14);
    pdf.text(igreja.nome, 105, y, { align: 'center' });
    y += 15;

    // Informações do Responsável
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Informações do Responsável', 20, y);
    y += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Data: ${responsavel.data || 'N/A'}`, 20, y);
    y += 6;
    pdf.text(`Aprovado por: ${responsavel.aprovadoPor || 'N/A'}`, 20, y);
    y += 6;
    pdf.text(`CPF: ${responsavel.cpf || 'N/A'}`, 20, y);
    y += 6;
    pdf.text(`Telefone: ${responsavel.telefone || 'N/A'}`, 20, y);
    y += 12;

    // Itens do Checklist
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Itens do Checklist', 20, y);
    y += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    perguntasChecklist.itens.forEach((pergunta, index) => {
        if (y > 270) {
            pdf.addPage();
            y = 20;
        }

        const resposta = respostas[`item_${index}`] || 'N/A';
        const linhas = pdf.splitTextToSize(`${index + 1}. ${pergunta}`, 150);
        
        linhas.forEach(linha => {
            pdf.text(linha, 20, y);
            y += 5;
        });
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Resposta: ${resposta}`, 25, y);
        pdf.setFont('helvetica', 'normal');
        y += 8;
    });

    // Assinatura
    if (assinatura) {
        if (y > 240) {
            pdf.addPage();
            y = 20;
        }

        y += 10;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Assinatura Digital:', 20, y);
        y += 10;

        try {
            pdf.addImage(assinatura, 'PNG', 20, y, 80, 30);
        } catch (e) {
            console.error('Erro ao adicionar assinatura ao PDF:', e);
        }
    }

    // Nome do arquivo
    const nomeArquivo = `Checklist_${igreja.nome.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // ===== SALVA LOCALMENTE NA PASTA IMPRIMIR =====
    try {
        // Verifica se tem pasta de trabalho configurada
        if (window.pastaTrabalhoHandle) {
            const igrejaId = igreja.id || igreja.nome.replace(/[^a-z0-9]/gi, '_');
            
            // Acessa a pasta da igreja
            const pastaIgreja = await window.pastaTrabalhoHandle.getDirectoryHandle(igrejaId, { create: true });
            
            // Acessa/Cria a pasta IMPRIMIR
            const pastaImprimir = await pastaIgreja.getDirectoryHandle('IMPRIMIR', { create: true });
            
            // Cria o arquivo PDF na pasta IMPRIMIR
            const fileHandle = await pastaImprimir.getFileHandle(nomeArquivo, { create: true });
            const writable = await fileHandle.createWritable();
            
            // Converte o PDF para Blob
            const pdfBlob = pdf.output('blob');
            
            // Escreve o arquivo
            await writable.write(pdfBlob);
            await writable.close();
            
            console.log(`✅ Checklist salvo localmente em: ${igrejaId}/IMPRIMIR/${nomeArquivo}`);
            alert(`✅ Checklist salvo com sucesso na pasta:\n${igrejaId}/IMPRIMIR/${nomeArquivo}`);
        } else {
            // Se não tiver pasta configurada, faz download normal
            console.warn('⚠️ Pasta de trabalho não configurada. Fazendo download normal...');
            pdf.save(nomeArquivo);
            alert('⚠️ Pasta de trabalho não configurada.\nArquivo baixado no diretório de Downloads.\n\n💡 Configure a pasta de trabalho na aba "Gerar Orçamentos".');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar checklist localmente:', error);
        // Em caso de erro, faz download normal
        pdf.save(nomeArquivo);
        alert(`⚠️ Erro ao salvar na pasta: ${error.message}\nArquivo baixado no diretório de Downloads.`);
    }
    
    // NÃO salva mais no Firebase (para economizar espaço)
    console.log('ℹ️ Checklists não são salvos no Firebase para economizar espaço.');
}

// Expõe funções globalmente
window.abrirModalChecklist = abrirModalChecklist;
window.salvarChecklist = salvarChecklist;
window.visualizarChecklist = visualizarChecklist;
window.downloadChecklistPDF = downloadChecklistPDF;
window.limparAssinatura = limparAssinatura;
window.sincronizarIgrejasChecklistNF = sincronizarIgrejasChecklistNF;

// Inicializa quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando módulo de Checklist...');
    carregarDadosChecklist();
});
