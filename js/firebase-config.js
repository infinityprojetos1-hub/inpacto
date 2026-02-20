// ===== CONFIGURAÇÃO DO FIREBASE =====
// Configuração do projeto Firebase (inpacto) - REALTIME DATABASE

const firebaseConfig = {
  apiKey: "AIzaSyAE8sXb5mZvq-t4j3VummmsI0_iyvPlQA",
  authDomain: "inpacto-9e38c.firebaseapp.com",
  databaseURL: "https://inpacto-9e38c-default-rtdb.firebaseio.com",
  projectId: "inpacto-9e38c",
  storageBucket: "inpacto-9e38c.firebasestorage.app",
  messagingSenderId: "225840938291",
  appId: "1:225840938291:web:b5ff5219effaa0an857fe5",
  measurementId: "G-7Q5W0PEZZ"
};

// Inicializa o Firebase com tratamento de erro
let database = null;
let firebaseDisponivel = false;

try {
  firebase.initializeApp(firebaseConfig);
  database = firebase.database();
  firebaseDisponivel = true;
  
  console.log('🔥 Firebase Realtime Database inicializado com sucesso!');
  
  // Testa a conexão
  database.ref('.info/connected').on('value', (snapshot) => {
    if (snapshot.val() === true) {
      console.log('✅ Conectado ao Realtime Database!');
    } else {
      console.log('⚠️ Desconectado do Realtime Database');
    }
  });
    
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase:', error);
  console.warn('📝 Sistema continuará funcionando com localStorage');
  firebaseDisponivel = false;
}

// ===== FUNÇÕES AUXILIARES =====

// Salva dados no Realtime Database
async function salvarNoDatabase(caminho, dados) {
  try {
    if (!firebaseDisponivel || !database) {
      console.warn('⚠️ Firebase não disponível. Salvando apenas localmente.');
      return null;
    }
    
    await database.ref(caminho).set(dados);
    console.log(`✅ Dados salvos em: ${caminho}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao salvar em ${caminho}:`, error);
    console.warn('📝 Dados salvos apenas localmente');
    return null;
  }
}

// Atualiza dados no Realtime Database (merge)
async function atualizarNoDatabase(caminho, dados) {
  try {
    if (!firebaseDisponivel || !database) {
      console.warn('⚠️ Firebase não disponível. Salvando apenas localmente.');
      return null;
    }
    
    await database.ref(caminho).update(dados);
    console.log(`✅ Dados atualizados em: ${caminho}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao atualizar em ${caminho}:`, error);
    console.warn('📝 Dados salvos apenas localmente');
    return null;
  }
}

// Busca dados do Realtime Database
async function buscarDoDatabase(caminho) {
  try {
    if (!firebaseDisponivel || !database) {
      console.warn('⚠️ Firebase não disponível.');
      return null;
    }
    
    const snapshot = await database.ref(caminho).once('value');
    const dados = snapshot.val();
    
    if (dados) {
      console.log(`✅ Dados obtidos de: ${caminho}`);
      return dados;
    }
    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar de ${caminho}:`, error);
    return null;
  }
}

// Deleta dados do Realtime Database
async function deletarDoDatabase(caminho) {
  try {
    if (!firebaseDisponivel || !database) {
      console.warn('⚠️ Firebase não disponível.');
      return null;
    }
    
    await database.ref(caminho).remove();
    console.log(`✅ Dados deletados de: ${caminho}`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao deletar de ${caminho}:`, error);
    return null;
  }
}

// Salva arquivo como base64 (já que não temos Storage)
async function salvarArquivoBase64(caminho, base64String) {
  try {
    if (!firebaseDisponivel || !database) {
      console.warn('⚠️ Firebase não disponível. Arquivo não salvo na nuvem.');
      return null;
    }
    
    // Salva o base64 diretamente no database
    await database.ref(caminho).set(base64String);
    console.log(`✅ Arquivo salvo em: ${caminho}`);
    return caminho;
  } catch (error) {
    console.error('❌ Erro ao salvar arquivo:', error);
    return null;
  }
}

// Busca arquivo base64
async function buscarArquivoBase64(caminho) {
  try {
    if (!firebaseDisponivel || !database) {
      return null;
    }
    
    const snapshot = await database.ref(caminho).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('❌ Erro ao buscar arquivo:', error);
    return null;
  }
}

// ===== MIGRAÇÃO DO LOCALSTORAGE PARA FIREBASE =====

async function migrarLocalStorageParaFirebase() {
  console.log('🔄 Iniciando migração do localStorage para Firebase Realtime Database...');
  
  const migracoes = [];
  
  try {
    // 1. Migrar Igrejas (Orçamentos) - MIGRAÇÃO COMPLETA DE TODOS OS DADOS
    const igrejasLS = localStorage.getItem('igrejas');
    if (igrejasLS) {
      const igrejas = JSON.parse(igrejasLS);
      console.log(`📊 Migrando ${igrejas.length} igrejas com TODOS os dados...`);
      
      for (const igreja of igrejas) {
        const igrejaId = (igreja.id || igreja.nome.replace(/[^a-z0-9]/gi, '_')).toLowerCase();
        await salvarNoDatabase(`igrejas/${igrejaId}`, {
          // Migra TODOS os campos da igreja
          ...igreja,
          dataMigracao: new Date().toISOString(),
          origem: 'migracao_localstorage'
        });
      }
      migracoes.push(`✅ ${igrejas.length} igrejas migradas (dados completos)`);
    }
    
    // 2. Migrar Notas Fiscais
    const nfLS = localStorage.getItem('notasFiscais');
    if (nfLS) {
      const nfData = JSON.parse(nfLS);
      console.log('📊 Migrando Notas Fiscais...');
      
      await salvarNoDatabase('configuracoes/notasFiscais', {
        dados: nfData,
        dataAtualizacao: new Date().toISOString()
      });
      
      migracoes.push('✅ Notas Fiscais migradas');
    }
    
    // 3. Migrar Material
    const materialLS = localStorage.getItem('materiaisIgrejas');
    if (materialLS) {
      const materialData = JSON.parse(materialLS);
      console.log('📊 Migrando Material...');
      
      await salvarNoDatabase('configuracoes/materiais', {
        dados: materialData,
        dataAtualizacao: new Date().toISOString()
      });
      
      migracoes.push('✅ Material migrado');
    }
    
    // 4. Migrar Checklists (SEM imagens/assinaturas para economizar espaço)
    const checklistLS = localStorage.getItem('checklistsIgrejas');
    if (checklistLS) {
      const checklistData = JSON.parse(checklistLS);
      console.log('📊 Migrando Checklists (sem imagens)...');
      
      if (checklistData.igrejas && checklistData.igrejas.length > 0) {
        for (const igreja of checklistData.igrejas) {
          if (igreja.checklist) {
            const checklistId = (igreja.id || igreja.nome.replace(/[^a-z0-9]/gi, '_')).toLowerCase();
            
            await salvarNoDatabase(`checklists/${checklistId}`, {
              igreja: igreja.nome,
              igrejaId: igreja.id,
              responsavel: igreja.checklist.responsavel,
              respostas: igreja.checklist.respostas,
              // NÃO migra assinatura (economiza espaço)
              dataPreenchimento: igreja.checklist.dataPreenchimento,
              dataMigracao: new Date().toISOString()
            });
          }
        }
      }
      
      migracoes.push('✅ Checklists migrados (sem imagens)');
    }
    
    // 5. Migrar Logos (SEM salvar no Firebase para economizar espaço)
    const logosLS = localStorage.getItem('logosBase64');
    if (logosLS) {
      console.log('📊 Logos detectadas (mantidas apenas localmente para economizar espaço)');
      migracoes.push('ℹ️ Logos mantidas apenas localmente');
    }
    
    // 6. Migrar Relatórios Técnicos (SEM imagens)
    const relatoriosLS = localStorage.getItem('relatoriosTecnicos');
    if (relatoriosLS) {
      const relatorios = JSON.parse(relatoriosLS);
      console.log('📊 Migrando Relatórios Técnicos (sem imagens)...');
      
      // Migra apenas os dados textuais, não as imagens
      const relatoriosSemImagens = {};
      for (const [key, relatorio] of Object.entries(relatorios)) {
        relatoriosSemImagens[key] = {
          ...relatorio,
          fotos: relatorio.fotos ? relatorio.fotos.length : 0 // Apenas conta as fotos
          // Não migra as imagens em si
        };
      }
      
      await salvarNoDatabase('configuracoes/relatoriosTecnicos', {
        dados: relatoriosSemImagens,
        dataAtualizacao: new Date().toISOString()
      });
      
      migracoes.push('✅ Relatórios Técnicos migrados (sem imagens)');
    }
    
    console.log('✅ Migração concluída com sucesso!');
    console.log('📋 Resumo:', migracoes);
    
    return {
      sucesso: true,
      migracoes: migracoes
    };
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    return {
      sucesso: false,
      erro: error.message,
      migracoes: migracoes
    };
  }
}

// ===== SINCRONIZAÇÃO BIDIRECIONAL =====

// Listener para sincronizar dados em tempo real
function iniciarSincronizacaoTempoReal() {
  if (!firebaseDisponivel || !database) {
    console.warn('⚠️ Firebase não disponível para sincronização');
    return;
  }
  
  console.log('🔄 Iniciando sincronização em tempo real...');
  
  // Escuta mudanças nas Notas Fiscais
  database.ref('configuracoes/notasFiscais/dados').on('value', (snapshot) => {
    const dados = snapshot.val();
    if (dados) {
      localStorage.setItem('notasFiscais', JSON.stringify(dados));
      console.log('🔄 Notas Fiscais sincronizadas');
      window.dispatchEvent(new CustomEvent('firebaseSync', { detail: { tipo: 'notasFiscais' } }));
    }
  });
  
  // Escuta mudanças nos Materiais
  database.ref('configuracoes/materiais/dados').on('value', (snapshot) => {
    const dados = snapshot.val();
    if (dados) {
      localStorage.setItem('materiaisIgrejas', JSON.stringify(dados));
      console.log('🔄 Materiais sincronizados');
      window.dispatchEvent(new CustomEvent('firebaseSync', { detail: { tipo: 'materiais' } }));
    }
  });
  
  // Escuta mudanças nos Checklists
  database.ref('checklists').on('value', (snapshot) => {
    const dados = snapshot.val();
    if (dados) {
      const checklistsAtualizados = { igrejas: [] };
      
      Object.values(dados).forEach(checklist => {
        checklistsAtualizados.igrejas.push({
          nome: checklist.igreja,
          id: checklist.igrejaId,
          checklist: {
            responsavel: checklist.responsavel,
            respostas: checklist.respostas,
            assinatura: null, // Será carregado quando necessário
            assinaturaPath: checklist.assinaturaPath,
            dataPreenchimento: checklist.dataPreenchimento
          }
        });
      });
      
      localStorage.setItem('checklistsIgrejas', JSON.stringify(checklistsAtualizados));
      console.log('🔄 Checklists sincronizados');
      window.dispatchEvent(new CustomEvent('firebaseSync', { detail: { tipo: 'checklists' } }));
    }
  });
}

// Expõe funções globalmente
window.firebaseDB = {
  salvar: salvarNoDatabase,
  atualizar: atualizarNoDatabase,
  buscar: buscarDoDatabase,
  deletar: deletarDoDatabase,
  salvarArquivo: salvarArquivoBase64,
  buscarArquivo: buscarArquivoBase64,
  migrarDados: migrarLocalStorageParaFirebase,
  iniciarSync: iniciarSincronizacaoTempoReal,
  disponivel: () => firebaseDisponivel
};

console.log('✅ Firebase Realtime Database Config carregado e pronto!');
