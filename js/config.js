// Configurações e variáveis globais
const configuracao = {
    servicos: [
        "Confecção de cabeamento de microfone",
        "Confecção de cabeamento de periféricos de som",
        "Confecção de Cabos para instrumentos e Mics",
        "Instalação de cabeamento de caixas de som",
        "Manutenção de cabos de som",
        "Manutenção do periférico",
        "Manutenção e intstalação do Sistema do Projeção",
        "Reposicionamento das caixas de PA",
        "Reposicionamento das caixas de retorno",
        "Reposicionamento dos microfones sem fio"
    ],
    valorMinimo: 3200,
    valorMaximo: 4000,
    margemConcorrente1: 10,
    margemConcorrente2: 15,
    suaEmpresa1: "Impacto Soluções",
    suaEmpresa2: "SPG da Silva Sonorização e Iluminação",
    concorrente1: "Virtual Guitar Shop",
    concorrente2: "GG PROAUTO LTDA"
};

let orcamentosGerados = [];
let pdfsGerados = {};
let igrejasAdicionadas = [];

// Não precisamos mais exportar as configurações pois elas estarão no escopo global
// quando o arquivo for carregado diretamente

// Disponibiliza as configurações globalmente (opcional, já que já estarão no escopo global)
window.configuracao = configuracao;
window.orcamentosGerados = orcamentosGerados;
window.pdfsGerados = pdfsGerados;
window.igrejasAdicionadas = igrejasAdicionadas; 