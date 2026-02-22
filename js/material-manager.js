// Gerenciador de Material para Igrejas

// Estrutura de dados para materiais
let materialData = {
    pendentes: [], // Igrejas com status "Não Enviado"
    enviadas: [],  // Igrejas com status "Enviado"
    pedidosSandro: [] // Pedidos do Sandro
};

// Flag: impede salvar no Firebase durante o carregamento inicial
let _materialCarregando = false;

// Carrega os dados do localStorage
function carregarDadosMaterial() {
    _materialCarregando = true;
    try {
        const dadosSalvos = localStorage.getItem('materiaisIgrejas');
        if (dadosSalvos) {
            materialData = JSON.parse(dadosSalvos);

            // Garante que a estrutura básica existe
            if (!materialData.pendentes) materialData.pendentes = [];
            if (!materialData.enviadas) materialData.enviadas = [];
            if (!materialData.pedidosSandro) materialData.pedidosSandro = [];

            console.log('Dados de material carregados:', materialData);

            // Migra dados antigos para o JSON das Notas Fiscais
            migrarDadosParaNF();
        } else {
            materialData = { pendentes: [], enviadas: [], pedidosSandro: [] };
        }

        // Sincroniza com as igrejas das Notas Fiscais
        sincronizarIgrejasNF();
        atualizarListaMaterial();
    } catch (error) {
        console.error('Erro ao carregar dados de material:', error);
        materialData = { pendentes: [], enviadas: [], pedidosSandro: [] };
    } finally {
        _materialCarregando = false;
    }
}

// Migra dados antigos para o JSON das Notas Fiscais (executa uma vez)
function migrarDadosParaNF() {
    try {
        const nfDataStr = localStorage.getItem('notasFiscais');
        if (!nfDataStr) return;

        const nfData = JSON.parse(nfDataStr);
        if (!nfData.igrejas) return;

        let houveAlteracao = false;

        // Percorre todas as igrejas do NF
        nfData.igrejas.forEach(igrejaNF => {
            // Procura a igreja nas abas de material
            let igrejaComMaterial = null;
            let statusMaterial = null;

            const pendente = materialData.pendentes.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);
            const enviada = materialData.enviadas.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);
            const sandro = materialData.pedidosSandro.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);

            if (pendente) {
                igrejaComMaterial = pendente;
                statusMaterial = 'pendente';
            } else if (enviada) {
                igrejaComMaterial = enviada;
                statusMaterial = 'enviado';
            } else if (sandro) {
                igrejaComMaterial = sandro;
                statusMaterial = 'sandro';
            }

            // Se encontrou e tem materiais, migra para o NF
            if (igrejaComMaterial && igrejaComMaterial.materiais && igrejaComMaterial.materiais.length > 0) {
                // Só migra se ainda não tiver materiais salvos no NF
                if (!igrejaNF.materiais || igrejaNF.materiais.length === 0) {
                    igrejaNF.materiais = igrejaComMaterial.materiais;
                    igrejaNF.statusMaterial = statusMaterial;
                    houveAlteracao = true;
                    console.log('Migrado materiais de:', igrejaNF.nome);
                }
            }
        });

        // Salva o JSON atualizado se houve migração
        if (houveAlteracao) {
            localStorage.setItem('notasFiscais', JSON.stringify(nfData));
            console.log('Migração de dados concluída!');
        }
    } catch (error) {
        console.error('Erro ao migrar dados:', error);
    }
}

// Salva os dados no localStorage E integra com Notas Fiscais
function salvarDadosMaterial() {
    try {
        // Marca timestamp para resolver conflitos
        materialData._ts = Date.now();

        // Salva no localStorage próprio
        localStorage.setItem('materiaisIgrejas', JSON.stringify(materialData));

        // Salva no Firebase (se não estamos recebendo sync e não estamos no carregamento inicial)
        if (!window._fbReceivendo && !_materialCarregando && typeof salvarNoDatabase === 'function' && typeof firebaseDisponivel !== 'undefined' && firebaseDisponivel) {
            if (typeof window._piscarBadgeSync === 'function') window._piscarBadgeSync();
            salvarNoDatabase('dados/materiais', materialData)
                .then(() => console.log('✅ Material salvo no Firebase'))
                .catch(err => console.warn('⚠️ Material não salvo no Firebase:', err));
        }

        // Integra com o JSON das Notas Fiscais
        const nfDataStr = localStorage.getItem('notasFiscais');
        if (nfDataStr) {
            const nfData = JSON.parse(nfDataStr);

            // Atualiza cada igreja no NF com os dados de material
            if (nfData.igrejas) {
                nfData.igrejas.forEach(igrejaNF => {
                    // Procura a igreja em todas as abas de material
                    let igrejaComMaterial = null;
                    let statusMaterial = 'pendente';

                    const pendente = materialData.pendentes.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);
                    const enviada = materialData.enviadas.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);
                    const sandro = materialData.pedidosSandro.find(ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id);

                    if (pendente) {
                        igrejaComMaterial = pendente;
                        statusMaterial = 'pendente';
                    } else if (enviada) {
                        igrejaComMaterial = enviada;
                        statusMaterial = 'enviado';
                    } else if (sandro) {
                        igrejaComMaterial = sandro;
                        statusMaterial = 'sandro';
                    }

                    // Adiciona os dados de material à igreja do NF
                    if (igrejaComMaterial) {
                        igrejaNF.materiais = igrejaComMaterial.materiais || [];
                        igrejaNF.statusMaterial = statusMaterial;
                        console.log(`✅ Material salvo para ${igrejaNF.nome}: ${igrejaNF.materiais.length} itens (${statusMaterial})`);
                    }
                });
            }

            // Salva o JSON atualizado das Notas Fiscais
            localStorage.setItem('notasFiscais', JSON.stringify(nfData));
            console.log('✅ Dados de material salvos e integrados com NF');

            // Atualiza o arquivo de NF (só fora do carregamento inicial, para não sobrescrever Firebase)
            if (!_materialCarregando && typeof window.salvarDadosNF === 'function') {
                window.salvarDadosNF();
            }
        }

        // Salva também no arquivo JSON vinculado (Material)
        if (materialFileHandle) {
            salvarDadosEmArquivoMaterial().catch(err => console.error('❌ Erro ao salvar no arquivo vinculado de Material:', err));
        }
    } catch (error) {
        console.error('❌ Erro ao salvar dados de material:', error);
    }
}

// Sincroniza a lista de igrejas com as Notas Fiscais
function sincronizarIgrejasNF() {
    try {
        const nfDataStr = localStorage.getItem('notasFiscais');
        if (!nfDataStr) return;

        const nfData = JSON.parse(nfDataStr);
        const igrejasNF = nfData.igrejas || [];

        // PASSO 1: Remover igrejas do Material que não existem mais nas Notas Fiscais
        ['pendentes', 'enviadas', 'pedidosSandro'].forEach(categoria => {
            materialData[categoria] = materialData[categoria].filter(igrejaMat => {
                const aindaExiste = igrejasNF.some(igrejaNF =>
                    igrejaNF.nome === igrejaMat.nome && igrejaNF.id === igrejaMat.id
                );

                if (!aindaExiste) {
                    console.log(`🗑️ Removendo igreja "${igrejaMat.nome}" (ID: ${igrejaMat.id}) do Material - não existe mais nas NFs`);
                }

                return aindaExiste;
            });
        });

        // PASSO 2: Adiciona igrejas que estão em NF mas não em Material
        igrejasNF.forEach(igrejaNF => {
            const jaExistePendente = materialData.pendentes.find(
                ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id
            );
            const jaExisteEnviada = materialData.enviadas.find(
                ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id
            );
            const jaExisteSandro = materialData.pedidosSandro.find(
                ig => ig.nome === igrejaNF.nome && ig.id === igrejaNF.id
            );

            if (!jaExistePendente && !jaExisteEnviada && !jaExisteSandro) {
                // Verifica se a igreja já tem dados de material salvos no JSON
                const statusMaterial = igrejaNF.statusMaterial || 'pendente';
                const materiaisSalvos = igrejaNF.materiais || [];

                const novaIgreja = {
                    nome: igrejaNF.nome,
                    id: igrejaNF.id || '',
                    link: igrejaNF.link || '',
                    materiais: materiaisSalvos
                };

                // Adiciona na aba correta baseado no status salvo
                if (statusMaterial === 'enviado') {
                    materialData.enviadas.push(novaIgreja);
                } else if (statusMaterial === 'sandro') {
                    materialData.pedidosSandro.push(novaIgreja);
                } else {
                    materialData.pendentes.push(novaIgreja);
                }

                console.log(`➕ Nova igreja adicionada ao Material: "${novaIgreja.nome}" (ID: ${novaIgreja.id})`);
            } else {
                // Atualiza materiais de igrejas existentes com dados do JSON
                const igrejaExistente = jaExistePendente || jaExisteEnviada || jaExisteSandro;
                if (igrejaExistente && igrejaNF.materiais && igrejaNF.materiais.length > 0) {
                    // Se o JSON tem materiais mas a estrutura local não, restaura
                    if (!igrejaExistente.materiais || igrejaExistente.materiais.length === 0) {
                        igrejaExistente.materiais = igrejaNF.materiais;
                    }
                }
            }
        });

        salvarDadosMaterial();
    } catch (error) {
        console.error('Erro ao sincronizar igrejas:', error);
    }
}

// Variável para rastrear a aba ativa atual
let abaAtivaMaterial = 'pendentes';

// Atualiza a lista de igrejas na interface
function atualizarListaMaterial() {
    const container = document.getElementById('materialList');
    if (!container) return;

    container.innerHTML = '';

    // Conta as igrejas em cada categoria
    const countPendentes = (materialData.pendentes || []).length;
    const countEnviadas = (materialData.enviadas || []).length;
    const countSandro = (materialData.pedidosSandro || []).length;

    // Cria as tabs com botão de atualizar
    const tabsHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div class="material-tabs">
                <button class="material-tab-button ${abaAtivaMaterial === 'pendentes' ? 'active' : ''}" data-tipo="pendentes">
                    <i class="fas fa-clock"></i> Pendentes (${countPendentes})
                </button>
                <button class="material-tab-button ${abaAtivaMaterial === 'enviadas' ? 'active' : ''}" data-tipo="enviadas">
                    <i class="fas fa-check-circle"></i> Enviadas (${countEnviadas})
                </button>
                <button class="material-tab-button ${abaAtivaMaterial === 'pedidosSandro' ? 'active' : ''}" data-tipo="pedidosSandro">
                    <i class="fas fa-user"></i> Sandro (${countSandro})
                </button>
            </div>
            <button onclick="recarregarMateriais()" class="btn-primary" title="Atualizar lista de igrejas">
                <i class="fas fa-sync-alt"></i> Atualizar
            </button>
        </div>
        <div class="material-content-container"></div>
    `;

    container.innerHTML = tabsHTML;

    // Adiciona eventos aos botões de tabs
    const tabButtons = container.querySelectorAll('.material-tab-button');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tipo = btn.getAttribute('data-tipo');
            abaAtivaMaterial = tipo; // Salva a aba ativa
            mostrarListaTipo(tipo);
        });
    });

    // Adiciona botões de gerenciamento de JSON
    const botoesContainer = document.createElement('div');
    botoesContainer.className = 'material-botoes-container';
    botoesContainer.style.cssText = 'margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;';
    botoesContainer.innerHTML = `
        <button onclick="salvarMaterialJsonEmArquivo()" class="btn-success">
            <i class="fas fa-download"></i> Exportar JSON
        </button>
        <input type="file" id="materialImportInput" accept="application/json" style="display:none" onchange="importarMaterialJsonDeArquivo(this.files[0]); this.value=null;">
        <button onclick="document.getElementById('materialImportInput').click()" class="btn-primary">
            <i class="fas fa-upload"></i> Importar JSON
        </button>
        <button onclick="selecionarArquivoMaterial()" class="btn-warning">
            <i class="fas fa-link"></i> Vincular JSON
        </button>
        <button onclick="criarArquivoMaterial()" class="btn-primary">
            <i class="fas fa-file"></i> Criar JSON
        </button>
    `;

    container.appendChild(botoesContainer);

    // Mostra a lista da aba ativa atual
    mostrarListaTipo(abaAtivaMaterial);
}

// Mostra a lista de um tipo específico
function mostrarListaTipo(tipo) {
    const contentContainer = document.querySelector('.material-content-container');
    if (!contentContainer) return;

    contentContainer.innerHTML = '';

    const dados = materialData[tipo] || [];

    if (dados.length === 0) {
        contentContainer.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><h3>Nenhuma igreja nesta categoria</h3><p>Adicione igrejas através das Notas Fiscais</p></div>';
        return;
    }

    // Cria a tabela
    const tabela = document.createElement('div');
    tabela.className = 'material-table';
    tabela.innerHTML = `
        <div class="material-header">
            <div class="material-col-igreja"><i class="fas fa-church"></i> Igreja</div>
            <div class="material-col-status-header"><i class="fas fa-clipboard-check"></i> Status</div>
            <div class="material-col-acoes"><i class="fas fa-cog"></i> Ações</div>
        </div>
    `;

    dados.forEach((igreja, index) => {
        const linha = document.createElement('div');
        linha.className = 'material-row';

        const totalItens = igreja.materiais ? igreja.materiais.length : 0;

        // Define o status baseado na categoria
        let statusClass, statusText;
        if (tipo === 'pendentes') {
            statusClass = 'status-nao-enviado';
            statusText = 'Não Enviado';
        } else if (tipo === 'enviadas') {
            statusClass = 'status-enviado';
            statusText = 'Enviado';
        } else {
            statusClass = 'status-sandro';
            statusText = 'Sandro';
        }

        linha.innerHTML = `
            <div class="material-col-igreja">
                <strong><i class="fas fa-church" style="margin-right: 8px; color: var(--gradient-start);"></i>${igreja.nome}</strong>
                ${igreja.id ? `<span class="material-id"><i class="fas fa-tag"></i> ID: ${igreja.id}</span>` : ''}
                ${totalItens > 0 ? `<span class="material-count"><i class="fas fa-boxes"></i> ${totalItens} ${totalItens === 1 ? 'item' : 'itens'}</span>` : ''}
            </div>
            <div class="material-col-status">
                <span class="material-status ${statusClass}">${statusText}</span>
            </div>
            <div class="material-col-acoes">
                ${tipo !== 'pendentes' ? `<button class="btn-icon btn-warning" onclick="moverParaPendentes('${tipo}', ${index})" title="Mover para Pendentes">
                    <i class="fas fa-clock"></i>
                </button>` : ''}
                ${tipo !== 'enviadas' ? `<button class="btn-icon btn-success" onclick="moverParaEnviadas('${tipo}', ${index})" title="Mover para Enviadas">
                    <i class="fas fa-check"></i>
                </button>` : ''}
                ${tipo !== 'pedidosSandro' ? `<button class="btn-icon btn-secondary" onclick="moverParaSandro('${tipo}', ${index})" title="Mover para Pedidos do Sandro">
                    <i class="fas fa-user"></i>
                </button>` : ''}
                <button class="btn-primary" onclick="abrirModalMaterial('${tipo}', ${index})">
                    <i class="fas fa-box"></i> Gerenciar Material
                </button>
            </div>
        `;

        tabela.appendChild(linha);
    });

    contentContainer.appendChild(tabela);
}

// Funções para mover igrejas entre categorias
function moverParaPendentes(tipoOrigem, index) {
    const igreja = materialData[tipoOrigem][index];
    if (!igreja) return;

    materialData[tipoOrigem].splice(index, 1);
    materialData.pendentes.push(igreja);

    salvarDadosMaterial();
    atualizarListaMaterial();
}

function moverParaEnviadas(tipoOrigem, index) {
    const igreja = materialData[tipoOrigem][index];
    if (!igreja) return;

    materialData[tipoOrigem].splice(index, 1);
    materialData.enviadas.push(igreja);

    salvarDadosMaterial();
    atualizarListaMaterial();
}

function moverParaSandro(tipoOrigem, index) {
    const igreja = materialData[tipoOrigem][index];
    if (!igreja) return;

    materialData[tipoOrigem].splice(index, 1);
    materialData.pedidosSandro.push(igreja);

    salvarDadosMaterial();
    atualizarListaMaterial();
}

// Abre o modal principal para gerenciar materiais de uma igreja
function abrirModalMaterial(tipo, index) {
    const igreja = materialData[tipo][index];
    if (!igreja) return;

    const modal = document.createElement('div');
    modal.className = 'material-modal';
    modal.innerHTML = `
        <div class="material-modal-content" style="animation: modalSlideIn 0.3s ease;">
            <div class="material-modal-header">
                <h3><i class="fas fa-box" style="margin-right: 10px;"></i>Gerenciar Material - ${igreja.nome}</h3>
                <button class="material-modal-close" onclick="this.closest('.material-modal').remove()">×</button>
            </div>

            <div class="material-modal-body">
                <div class="material-actions">
                    <button class="btn-success" onclick="abrirModalAdicionarItem('${tipo}', ${index})">
                        <i class="fas fa-plus"></i> Adicionar Item
                    </button>
                    <button onclick="compartilharWhatsApp('${tipo}', ${index})"
                            style="background:#25D366; color:#fff; border:none; border-radius:8px;
                                   padding:10px 18px; font-size:0.9em; font-weight:600;
                                   cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <i class="fab fa-whatsapp"></i> Compartilhar no WhatsApp
                    </button>
                </div>

                <div id="listaMateriais_${tipo}_${index}" class="material-lista">
                    <!-- Lista de materiais será inserida aqui -->
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    atualizarListaMaterialModal(tipo, index);
}

// Atualiza a lista de materiais dentro do modal
function atualizarListaMaterialModal(tipo, igrejaIndex) {
    const igreja = materialData[tipo][igrejaIndex];
    const lista = document.getElementById(`listaMateriais_${tipo}_${igrejaIndex}`);

    if (!lista) return;

    if (!igreja.materiais || igreja.materiais.length === 0) {
        lista.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h3>Nenhum material adicionado</h3><p>Clique em "Adicionar Item" para começar</p></div>';
        return;
    }

    lista.innerHTML = '<h4 style="color: var(--gradient-start); margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid var(--gradient-start);"><i class="fas fa-list"></i> Materiais Adicionados:</h4>';

    const tabelaMateriais = document.createElement('div');
    tabelaMateriais.className = 'material-items-table';

    igreja.materiais.forEach((material, materialIndex) => {
        const item = document.createElement('div');
        item.className = 'material-item';
        item.innerHTML = `
            <div class="material-item-info" onclick="editarMaterial('${tipo}', ${igrejaIndex}, ${materialIndex})" style="cursor: pointer;" title="Clique para editar">
                <span class="material-item-nome"><i class="fas fa-box" style="margin-right: 8px; color: var(--gradient-start);"></i>${material.item}</span>
                <span class="material-item-qtd"><i class="fas fa-hashtag" style="margin-right: 5px;"></i>Quantidade: ${material.quantidade}</span>
            </div>
            <button class="btn-danger" onclick="removerMaterial('${tipo}', ${igrejaIndex}, ${materialIndex})" title="Remover">
                <i class="fas fa-trash"></i>
            </button>
        `;
        tabelaMateriais.appendChild(item);
    });

    lista.appendChild(tabelaMateriais);
}

// Abre o modal secundário para adicionar um item
function abrirModalAdicionarItem(tipo, igrejaIndex) {
    const modal = document.createElement('div');
    modal.className = 'material-modal material-modal-small';
    modal.innerHTML = `
        <div class="material-modal-content material-modal-content-small" style="animation: modalSlideIn 0.3s ease;">
            <div class="material-modal-header">
                <h3><i class="fas fa-plus-circle" style="margin-right: 10px;"></i>Adicionar Item</h3>
                <button class="material-modal-close" onclick="this.closest('.material-modal').remove()">×</button>
            </div>
            
            <div class="material-modal-form-body">
                <form id="formAdicionarItem" onsubmit="adicionarItem(event, '${tipo}', ${igrejaIndex})">
                    <div class="form-group">
                        <label for="itemNome"><i class="fas fa-tag"></i> Item:</label>
                        <input type="text" id="itemNome" placeholder="Ex: Cabo HDMI" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="itemQuantidade"><i class="fas fa-sort-numeric-up"></i> Quantidade:</label>
                        <input type="number" id="itemQuantidade" placeholder="Ex: 5" min="1" required>
                    </div>
                    
                    <div class="material-modal-buttons">
                        <button type="submit" class="btn-primary"><i class="fas fa-check"></i> Adicionar</button>
                        <button type="button" class="btn-secondary" onclick="this.closest('.material-modal').remove()"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Foca no primeiro campo
    setTimeout(() => {
        document.getElementById('itemNome').focus();
    }, 100);
}

// Adiciona um item à lista de materiais
function adicionarItem(event, tipo, igrejaIndex) {
    event.preventDefault();

    const item = document.getElementById('itemNome').value.trim();
    const quantidade = document.getElementById('itemQuantidade').value.trim();

    if (!item || !quantidade) return;

    const igreja = materialData[tipo][igrejaIndex];
    if (!igreja.materiais) {
        igreja.materiais = [];
    }

    igreja.materiais.push({
        item: item,
        quantidade: quantidade
    });

    salvarDadosMaterial();
    atualizarListaMaterialModal(tipo, igrejaIndex);
    atualizarListaMaterial(); // Atualiza a lista principal para mostrar a contagem

    // Fecha o modal de adicionar item
    event.target.closest('.material-modal').remove();
}

// Edita um material da lista
function editarMaterial(tipo, igrejaIndex, materialIndex) {
    const igreja = materialData[tipo][igrejaIndex];
    const material = igreja.materiais[materialIndex];

    const modal = document.createElement('div');
    modal.className = 'material-modal material-modal-small';
    modal.innerHTML = `
        <div class="material-modal-content material-modal-content-small" style="animation: modalSlideIn 0.3s ease;">
            <div class="material-modal-header">
                <h3><i class="fas fa-edit" style="margin-right: 10px;"></i>Editar Item</h3>
                <button class="material-modal-close" onclick="this.closest('.material-modal').remove()">×</button>
            </div>
            
            <div class="material-modal-form-body">
                <form id="formEditarItem" onsubmit="salvarEdicaoMaterial(event, '${tipo}', ${igrejaIndex}, ${materialIndex})">
                    <div class="form-group">
                        <label for="itemNomeEdit"><i class="fas fa-tag"></i> Item:</label>
                        <input type="text" id="itemNomeEdit" value="${material.item}" placeholder="Ex: Cabo HDMI" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="itemQuantidadeEdit"><i class="fas fa-sort-numeric-up"></i> Quantidade:</label>
                        <input type="number" id="itemQuantidadeEdit" value="${material.quantidade}" placeholder="Ex: 5" min="1" required>
                    </div>
                    
                    <div class="material-modal-buttons">
                        <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Salvar</button>
                        <button type="button" class="btn-secondary" onclick="this.closest('.material-modal').remove()"><i class="fas fa-times"></i> Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Foca no primeiro campo
    setTimeout(() => {
        document.getElementById('itemNomeEdit').focus();
        document.getElementById('itemNomeEdit').select();
    }, 100);
}

// Salva a edição de um material
function salvarEdicaoMaterial(event, tipo, igrejaIndex, materialIndex) {
    event.preventDefault();

    const item = document.getElementById('itemNomeEdit').value.trim();
    const quantidade = document.getElementById('itemQuantidadeEdit').value.trim();

    if (!item || !quantidade) return;

    const igreja = materialData[tipo][igrejaIndex];
    igreja.materiais[materialIndex] = {
        item: item,
        quantidade: quantidade
    };

    salvarDadosMaterial();
    atualizarListaMaterialModal(tipo, igrejaIndex);
    atualizarListaMaterial(); // Atualiza a lista principal para mostrar a contagem

    // Fecha o modal de editar item
    event.target.closest('.material-modal').remove();
}

// Remove um material da lista
function removerMaterial(tipo, igrejaIndex, materialIndex) {
    if (!confirm('Deseja remover este item?')) return;

    const igreja = materialData[tipo][igrejaIndex];
    igreja.materiais.splice(materialIndex, 1);

    salvarDadosMaterial();
    atualizarListaMaterialModal(tipo, igrejaIndex);
    atualizarListaMaterial(); // Atualiza a lista principal para mostrar a contagem
}

// Compartilha a lista de materiais via WhatsApp
function compartilharWhatsApp(tipo, igrejaIndex) {
    const igreja = materialData[tipo][igrejaIndex];
    if (!igreja) return;

    if (!igreja.materiais || igreja.materiais.length === 0) {
        alert('Adicione pelo menos um material antes de compartilhar.');
        return;
    }

    // Monta mensagem: nome - id\n\nitem - qtd.\n...
    const id = (igreja.id || '').toString().trim();
    let mensagem = (igreja.nome || '');
    if (id) mensagem += ' - ' + id;
    mensagem += '\n\n';
    igreja.materiais.forEach(m => {
        mensagem += m.item + ' - ' + m.quantidade + '.\n';
    });
    mensagem = mensagem.trim();
    const encoded = encodeURIComponent(mensagem);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        // Celular: share nativo ou deep link direto
        if (navigator.share) {
            navigator.share({ text: mensagem }).catch(() => {
                window.location.href = 'whatsapp://send?text=' + encoded;
            });
        } else {
            window.location.href = 'whatsapp://send?text=' + encoded;
        }
    } else {
        // PC: abre WhatsApp Web direto (chamado de click = não é bloqueado)
        window.open('https://web.whatsapp.com/send?text=' + encoded, '_blank');
    }

    // Move para "Enviadas" automaticamente e fecha o modal
    if (tipo !== 'enviadas') {
        const igrejaCopy = Object.assign({}, igreja);
        materialData[tipo].splice(igrejaIndex, 1);
        materialData.enviadas.push(igrejaCopy);
        salvarDadosMaterial();
        atualizarListaMaterial();
    }
    const modal = document.querySelector('.material-modal');
    if (modal) modal.remove();
}

// ===== GERENCIAMENTO DE ARQUIVO JSON =====

let materialFileHandle = null;

// Exporta os dados de material para um arquivo JSON
function salvarMaterialJsonEmArquivo() {
    try {
        const conteudo = JSON.stringify(materialData, null, 2);
        const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'material_data.json';
        a.click();
        URL.revokeObjectURL(url);
        console.log('✅ JSON de Material exportado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao exportar JSON de Material:', error);
        alert('Erro ao exportar arquivo JSON.');
    }
}

// Importa os dados de material de um arquivo JSON
function importarMaterialJsonDeArquivo(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const dadosImportados = JSON.parse(e.target.result);

            // Valida estrutura básica
            if (!dadosImportados.pendentes) dadosImportados.pendentes = [];
            if (!dadosImportados.enviadas) dadosImportados.enviadas = [];
            if (!dadosImportados.pedidosSandro) dadosImportados.pedidosSandro = [];

            materialData = dadosImportados;
            salvarDadosMaterial();
            atualizarListaMaterial();
            console.log('✅ JSON de Material importado com sucesso!');
            alert('Dados de Material importados com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao importar JSON de Material:', error);
            alert('Erro ao importar arquivo JSON. Verifique se o arquivo está correto.');
        }
    };
    reader.readAsText(file);
}

// Salva os dados em um arquivo vinculado
async function salvarDadosEmArquivoMaterial() {
    try {
        if (!materialFileHandle) return;
        const writable = await materialFileHandle.createWritable();
        const conteudo = JSON.stringify(materialData, null, 2);
        await writable.write(new Blob([conteudo], { type: 'application/json;charset=utf-8' }));
        await writable.close();
        console.log('✅ Dados salvos no arquivo vinculado');
    } catch (error) {
        console.error('❌ Erro ao salvar no arquivo vinculado:', error);
    }
}

// Função para recarregar/atualizar a lista de materiais
function recarregarMateriais() {
    try {
        console.log('🔄 Recarregando materiais...');

        // Força a sincronização com as Notas Fiscais
        sincronizarIgrejasNF();

        // Atualiza a interface
        atualizarListaMaterial();

        // Feedback visual
        const btnAtualizar = document.querySelector('button[onclick="recarregarMateriais()"]');
        if (btnAtualizar) {
            const iconAtualizar = btnAtualizar.querySelector('i');
            if (iconAtualizar) {
                iconAtualizar.classList.add('fa-spin');
                setTimeout(() => {
                    iconAtualizar.classList.remove('fa-spin');
                }, 500);
            }
        }

        console.log('✅ Materiais recarregados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao recarregar materiais:', error);
        alert('Erro ao atualizar a lista de materiais. Verifique o console para mais detalhes.');
    }
}

// Lê os dados de um arquivo vinculado
async function lerMaterialDoArquivo() {
    try {
        if (!materialFileHandle) return;
        const file = await materialFileHandle.getFile();
        const text = await file.text();
        const json = JSON.parse(text || '{}');

        // Valida estrutura
        if (!json.pendentes) json.pendentes = [];
        if (!json.enviadas) json.enviadas = [];
        if (!json.pedidosSandro) json.pedidosSandro = [];

        materialData = json;
        localStorage.setItem('materiaisIgrejas', JSON.stringify(materialData));
        atualizarListaMaterial();
        console.log('✅ Dados carregados do arquivo vinculado');
    } catch (error) {
        console.error('❌ Erro ao ler do arquivo vinculado:', error);
    }
}

// Seleciona um arquivo JSON existente para vincular
async function selecionarArquivoMaterial() {
    try {
        if (!window.showOpenFilePicker) {
            alert('Seu navegador não suporta esta funcionalidade. Use Chrome ou Edge.');
            return;
        }

        const [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }]
        });

        materialFileHandle = fileHandle;
        await salvarHandleMaterial(fileHandle); // Salva para auto-vinculação
        await lerMaterialDoArquivo();
        alert('Arquivo vinculado com sucesso! As alterações serão salvas automaticamente nele.\n\nDa próxima vez que abrir a aplicação, o arquivo será carregado automaticamente.');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('❌ Erro ao selecionar arquivo:', error);
        }
    }
}

// Cria um novo arquivo JSON e vincula
async function criarArquivoMaterial() {
    try {
        if (!window.showSaveFilePicker) {
            alert('Seu navegador não suporta esta funcionalidade. Use Chrome ou Edge.');
            return;
        }

        const fileHandle = await window.showSaveFilePicker({
            suggestedName: 'material_data.json',
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }]
        });

        materialFileHandle = fileHandle;
        await salvarHandleMaterial(fileHandle); // Salva para auto-vinculação
        await salvarDadosEmArquivoMaterial();
        alert('Arquivo criado e vinculado com sucesso!\n\nTodas as alterações serão salvas automaticamente.\nDa próxima vez que abrir a aplicação, o arquivo será carregado automaticamente.');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('❌ Erro ao criar arquivo:', error);
        }
    }
}

// Inicializa o sistema de arquivo - igual ao NF
async function inicializarArquivoMaterial() {
    try {
        // Tenta carregar automaticamente o arquivo material_data.json da pasta
        await tentarCarregarMaterialAutomatico();

        // Tenta restaurar handle vinculado
        const handle = await obterHandleSalvoMaterial();
        if (handle) {
            materialFileHandle = handle;
            await lerMaterialDoArquivo();
        }
    } catch (error) {
        console.warn('Sem arquivo de Material vinculado ou erro ao carregar handle:', error);
    }
}

// Função para verificar e pedir permissão do arquivo Material
async function verificarPermissaoMaterial() {
    try {
        const handle = await obterHandleSalvoMaterial();
        if (!handle) {
            console.log('📁 Material: Nenhum arquivo vinculado');
            return { vinculado: false };
        }

        // Verifica se tem permissão de leitura
        const permissaoLeitura = await handle.queryPermission({ mode: 'read' });

        if (permissaoLeitura !== 'granted') {
            console.log('🔐 Material: Solicitando permissão de leitura...');
            const resultado = await handle.requestPermission({ mode: 'read' });
            if (resultado !== 'granted') {
                console.warn('❌ Material: Permissão de leitura negada');
                return { vinculado: true, permissao: false };
            }
        }

        // Verifica se tem permissão de escrita
        const permissaoEscrita = await handle.queryPermission({ mode: 'readwrite' });

        if (permissaoEscrita !== 'granted') {
            console.log('🔐 Material: Solicitando permissão de escrita...');
            const resultado = await handle.requestPermission({ mode: 'readwrite' });
            if (resultado !== 'granted') {
                console.warn('⚠️ Material: Permissão de escrita negada (somente leitura)');
                return { vinculado: true, permissao: 'leitura' };
            }
        }

        // Permissão concedida, atualiza o handle
        materialFileHandle = handle;
        console.log('✅ Material: Permissão concedida!');
        return { vinculado: true, permissao: true };
    } catch (error) {
        console.error('❌ Material: Erro ao verificar permissão:', error);
        return { vinculado: false, erro: error.message };
    }
}

// Expõe a função globalmente
window.verificarPermissaoMaterial = verificarPermissaoMaterial;

// Função que SEMPRE pede permissão (sem verificar antes)
async function forcarPermissaoMaterial() {
    try {
        const handle = await obterHandleSalvoMaterial();
        if (!handle) {
            console.log('📭 Material: Nenhum arquivo vinculado');
            return { vinculado: false };
        }

        console.log('🔐 Material: Solicitando permissão para:', handle.name);

        // SEMPRE pede permissão, mesmo se já tiver
        const resultado = await handle.requestPermission({ mode: 'readwrite' });

        if (resultado === 'granted') {
            materialFileHandle = handle;
            await lerMaterialDoArquivo();
            console.log('✅ Material: Permissão concedida!');
            return { vinculado: true, permissao: true };
        } else {
            console.warn('❌ Material: Permissão negada');
            return { vinculado: true, permissao: false };
        }
    } catch (error) {
        console.error('❌ Material: Erro:', error);
        return { vinculado: false, erro: error.message };
    }
}

window.forcarPermissaoMaterial = forcarPermissaoMaterial;

// Tenta carregar automaticamente o arquivo JSON da mesma pasta
async function tentarCarregarMaterialAutomatico() {
    try {
        // Tenta fazer fetch do arquivo material_data.json na mesma pasta
        const response = await fetch('material_data.json');
        if (response.ok) {
            const dadosImportados = await response.json();

            // Valida estrutura básica
            if (!dadosImportados.pendentes) dadosImportados.pendentes = [];
            if (!dadosImportados.enviadas) dadosImportados.enviadas = [];
            if (!dadosImportados.pedidosSandro) dadosImportados.pedidosSandro = [];

            materialData = dadosImportados;
            localStorage.setItem('materiaisIgrejas', JSON.stringify(materialData));
            console.log('✅ Arquivo material_data.json carregado automaticamente!');
            atualizarListaMaterial();

            // Oferece vincular o arquivo para salvamento automático
            if (window.showOpenFilePicker && !materialFileHandle) {
                setTimeout(async () => {
                    if (confirm('Arquivo material_data.json encontrado!\n\nDeseja vinculá-lo para salvamento automático?')) {
                        await selecionarArquivoMaterial();
                    }
                }, 500);
            }
        }
    } catch (error) {
        // Arquivo não encontrado (normal na primeira vez)
        console.log('Arquivo material_data.json não encontrado na pasta');
    }
}

// Funções para gerenciar IndexedDB (armazenar o file handle)
async function abrirBDMaterial() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MaterialDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('fileHandles')) {
                db.createObjectStore('fileHandles');
            }
        };
    });
}

async function salvarHandleMaterial(handle) {
    try {
        const db = await abrirBDMaterial();
        const transaction = db.transaction(['fileHandles'], 'readwrite');
        const store = transaction.objectStore('fileHandles');
        await store.put(handle, 'materialFileHandle');
    } catch (error) {
        console.error('Erro ao salvar handle:', error);
    }
}

async function obterHandleSalvoMaterial() {
    try {
        const db = await abrirBDMaterial();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['fileHandles'], 'readonly');
            const store = transaction.objectStore('fileHandles');
            const request = store.get('materialFileHandle');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Erro ao obter handle salvo:', error);
        return null;
    }
}

// Expõe funções globalmente
window.abrirModalMaterial = abrirModalMaterial;
window.abrirModalAdicionarItem = abrirModalAdicionarItem;
window.adicionarItem = adicionarItem;
window.editarMaterial = editarMaterial;
window.salvarEdicaoMaterial = salvarEdicaoMaterial;
window.removerMaterial = removerMaterial;
window.compartilharWhatsApp = compartilharWhatsApp;
window.moverParaPendentes = moverParaPendentes;
window.moverParaEnviadas = moverParaEnviadas;
window.moverParaSandro = moverParaSandro;
window.sincronizarIgrejasNF = sincronizarIgrejasNF;
window.recarregarMateriais = recarregarMateriais;
window.salvarMaterialJsonEmArquivo = salvarMaterialJsonEmArquivo;
window.importarMaterialJsonDeArquivo = importarMaterialJsonDeArquivo;
window.selecionarArquivoMaterial = selecionarArquivoMaterial;
window.criarArquivoMaterial = criarArquivoMaterial;

// Inicializa quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando módulo de Material...');
    carregarDadosMaterial();
    inicializarArquivoMaterial();
});

