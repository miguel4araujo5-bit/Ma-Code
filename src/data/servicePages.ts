export type ServicePageSlug =
  | 'criacao-websites'
  | 'lojas-online'
  | 'sistemas-marcacao'
  | 'automacao-ia'

export type ServicePagePath = `/${ServicePageSlug}`

export type ServicePageStat = {
  value: string
  label: string
}

export type ServicePageSection = {
  title: string
  description: string
}

export type ServicePageProcessStep = {
  title: string
  description: string
}

export type ServicePageFaq = {
  question: string
  answer: string
}

export type ServicePageData = {
  slug: ServicePageSlug
  path: ServicePagePath
  label: string
  shortLabel: string
  seo: {
    title: string
    description: string
    keywords: string
    canonical: string
    ogTitle: string
    ogDescription: string
  }
  hero: {
    eyebrow: string
    title: string
    highlightedTitle: string
    description: string
    primaryCta: string
    secondaryCta: string
  }
  stats: ServicePageStat[]
  intro: {
    title: string
    paragraphs: string[]
  }
  idealFor: string[]
  benefits: ServicePageSection[]
  deliverables: ServicePageSection[]
  process: ServicePageProcessStep[]
  faq: ServicePageFaq[]
  relatedServices: ServicePageSlug[]
}

export const siteUrl = 'https://ma-code.pt'

export const servicePages: ServicePageData[] = [
  {
    slug: 'criacao-websites',
    path: '/criacao-websites',
    label: 'Criação de Websites Profissionais',
    shortLabel: 'Websites',
    seo: {
      title: 'Criação de Websites Profissionais em Portugal | MA-Code',
      description:
        'Criação de websites profissionais, modernos, rápidos e adaptados a telemóvel para negócios que querem transmitir confiança, captar contactos e crescer online.',
      keywords:
        'criação de websites, websites profissionais, criação de sites, desenvolvimento web Portugal, sites para empresas, websites responsivos, MA-Code',
      canonical: `${siteUrl}/criacao-websites`,
      ogTitle: 'Criação de Websites Profissionais | MA-Code',
      ogDescription:
        'Websites modernos, rápidos e preparados para gerar contactos, apresentar serviços e transmitir mais confiança ao seu negócio.',
    },
    hero: {
      eyebrow: 'Criação de websites',
      title: 'Websites profissionais para negócios que querem',
      highlightedTitle: 'ser encontrados e gerar confiança',
      description:
        'Criamos websites modernos, rápidos e adaptados a telemóvel, pensados para apresentar o seu negócio com clareza, transmitir credibilidade e transformar visitantes em pedidos de contacto.',
      primaryCta: 'Pedir orçamento',
      secondaryCta: 'Ver projetos',
    },
    stats: [
      {
        value: 'Mobile-first',
        label: 'Experiência pensada para telemóvel',
      },
      {
        value: 'SEO base',
        label: 'Estrutura preparada para Google',
      },
      {
        value: 'Desde 19€/mês',
        label: 'Projetos ajustados ao objetivo',
      },
    ],
    intro: {
      title: 'Um website não deve ser apenas bonito. Deve explicar, orientar e converter.',
      paragraphs: [
        'A presença digital de uma empresa começa muitas vezes pelo website. Quando alguém pesquisa pelo seu negócio, compara serviços ou procura confiança antes de pedir orçamento, o site é uma das primeiras provas de profissionalismo.',
        'Na MA-Code criamos websites com foco em clareza, velocidade, design responsivo e estrutura comercial. O objetivo é simples: apresentar bem o negócio, facilitar o contacto e criar uma base digital preparada para crescer.',
      ],
    },
    idealFor: [
      'Empresas que precisam de um website institucional profissional',
      'Negócios locais que querem aparecer melhor online',
      'Profissionais independentes que querem transmitir mais credibilidade',
      'Marcas que precisam de renovar um site antigo ou pouco eficaz',
      'Serviços que dependem de pedidos de orçamento, contactos ou marcações',
    ],
    benefits: [
      {
        title: 'Imagem mais profissional',
        description:
          'Um site moderno ajuda o cliente a perceber rapidamente quem é, o que faz e porque deve confiar no seu negócio.',
      },
      {
        title: 'Mais pedidos de contacto',
        description:
          'A estrutura é pensada para guiar o visitante até à ação certa: pedir orçamento, enviar mensagem, telefonar ou consultar serviços.',
      },
      {
        title: 'Preparado para mobile',
        description:
          'A experiência é construída para funcionar bem em telemóvel, tablet e computador, sem perder clareza nem velocidade.',
      },
      {
        title: 'Base para SEO',
        description:
          'Organizamos títulos, conteúdos, estrutura e metadata para que o site tenha uma base técnica mais forte para motores de pesquisa.',
      },
    ],
    deliverables: [
      {
        title: 'Página inicial profissional',
        description:
          'Hero section, apresentação do negócio, serviços principais, argumentos de confiança e chamada para contacto.',
      },
      {
        title: 'Páginas de serviços',
        description:
          'Estrutura preparada para explicar melhor cada serviço e aumentar a relevância para pesquisas específicas.',
      },
      {
        title: 'Formulário de contacto',
        description:
          'Formulário simples e direto para receber pedidos de orçamento ou mensagens de potenciais clientes.',
      },
      {
        title: 'Otimização visual e técnica',
        description:
          'Design responsivo, carregamento rápido, hierarquia visual clara e compatibilidade com os principais dispositivos.',
      },
    ],
    process: [
      {
        title: 'Diagnóstico',
        description:
          'Percebemos o negócio, o público, os serviços, os objetivos e o tipo de contacto que pretende gerar.',
      },
      {
        title: 'Estrutura',
        description:
          'Organizamos as secções, mensagens, páginas e percurso do utilizador antes de avançar para o desenvolvimento.',
      },
      {
        title: 'Desenvolvimento',
        description:
          'Criamos o website com foco em performance, experiência mobile, SEO base e apresentação profissional.',
      },
      {
        title: 'Publicação',
        description:
          'Colocamos o site online e deixamos uma base preparada para futuras melhorias, páginas ou integrações.',
      },
    ],
    faq: [
      {
        question: 'Quanto custa criar um website profissional?',
        answer:
          'O valor depende do número de páginas, conteúdos, funcionalidades e nível de personalização. A MA-Code trabalha com soluções ajustadas ao objetivo do projeto, incluindo opções desde 19€/mês.',
      },
      {
        question: 'O website fica adaptado a telemóvel?',
        answer:
          'Sim. Todos os websites são pensados para funcionar bem em telemóvel, tablet e computador, com atenção à velocidade, legibilidade e facilidade de contacto.',
      },
      {
        question: 'Também ajudam com texto e estrutura do site?',
        answer:
          'Sim. Podemos ajudar a organizar a mensagem, estruturar as secções e criar textos mais claros e orientados para conversão.',
      },
      {
        question: 'O site pode evoluir para loja online ou sistema de marcações?',
        answer:
          'Sim. A estrutura pode ser preparada para crescer com novas páginas, loja online, sistema de marcações, automações, integrações ou área administrativa.',
      },
      {
        question: 'Preciso de já ter textos e imagens antes de começar?',
        answer:
          'Não obrigatoriamente. Podemos começar pela estrutura do website e ajudar a transformar a informação do negócio em conteúdo claro, profissional e orientado para contacto.',
      },
      {
        question: 'O website pode incluir domínio e alojamento?',
        answer:
          'Sim. Quando fizer sentido para o projeto, podemos incluir domínio, alojamento e configuração técnica para que o negócio tenha uma solução mais simples de gerir.',
      },
    ],
    relatedServices: ['lojas-online', 'sistemas-marcacao', 'automacao-ia'],
  },
  {
    slug: 'lojas-online',
    path: '/lojas-online',
    label: 'Criação de Lojas Online',
    shortLabel: 'Lojas Online',
    seo: {
      title: 'Criação de Lojas Online em Portugal | E-commerce | MA-Code',
      description:
        'Criação de lojas online modernas com catálogo, carrinho de compras, checkout, estrutura de produtos e base preparada para pagamentos e gestão de encomendas.',
      keywords:
        'criação de lojas online, loja online Portugal, e-commerce Portugal, criação ecommerce, loja virtual, carrinho de compras, checkout online, MA-Code',
      canonical: `${siteUrl}/lojas-online`,
      ogTitle: 'Criação de Lojas Online | MA-Code',
      ogDescription:
        'Lojas online modernas, responsivas e preparadas para vender produtos com catálogo, carrinho, checkout e gestão organizada.',
    },
    hero: {
      eyebrow: 'Lojas online e e-commerce',
      title: 'Lojas online criadas para apresentar produtos, vender melhor e',
      highlightedTitle: 'organizar encomendas',
      description:
        'Desenvolvemos lojas online modernas, responsivas e preparadas para venda direta, com catálogo de produtos, carrinho de compras, checkout estruturado e uma experiência clara para o cliente.',
      primaryCta: 'Pedir orçamento',
      secondaryCta: 'Ver projetos',
    },
    stats: [
      {
        value: 'Catálogo',
        label: 'Produtos organizados por categorias',
      },
      {
        value: 'Checkout',
        label: 'Fluxo de compra simples e claro',
      },
      {
        value: 'Backoffice',
        label: 'Base para gestão de encomendas',
      },
    ],
    intro: {
      title: 'Uma loja online precisa de mais do que uma montra bonita.',
      paragraphs: [
        'Para vender online, o cliente tem de encontrar facilmente os produtos, compreender a oferta, confiar no processo e concluir a compra sem confusão.',
        'Na MA-Code criamos lojas online com foco na experiência do utilizador, apresentação profissional dos produtos, navegação clara e estrutura preparada para crescimento.',
      ],
    },
    idealFor: [
      'Negócios que querem começar a vender produtos online',
      'Marcas que precisam de substituir uma loja antiga ou limitada',
      'Projetos que precisam de catálogo, carrinho e checkout',
      'Empresas que querem organizar encomendas de forma mais profissional',
      'Lojas que querem uma presença digital mais credível e responsiva',
    ],
    benefits: [
      {
        title: 'Produtos melhor apresentados',
        description:
          'Organizamos produtos, categorias, imagens, descrições e chamadas à ação para facilitar a decisão de compra.',
      },
      {
        title: 'Compra mais simples',
        description:
          'Criamos um fluxo com carrinho e checkout estruturado para reduzir fricção e tornar a encomenda mais intuitiva.',
      },
      {
        title: 'Gestão mais organizada',
        description:
          'A loja pode incluir base para acompanhamento de encomendas, estados de pagamento e consulta interna.',
      },
      {
        title: 'Base preparada para crescer',
        description:
          'A solução pode evoluir com pagamentos online, área administrativa, analytics, automações e integrações externas.',
      },
    ],
    deliverables: [
      {
        title: 'Catálogo de produtos',
        description:
          'Listagem de produtos com categorias, imagens, preços, informação essencial e navegação clara.',
      },
      {
        title: 'Páginas de produto',
        description:
          'Páginas individuais com informação detalhada, imagens, preço, descrição e botão de compra.',
      },
      {
        title: 'Carrinho de compras',
        description:
          'Experiência de carrinho preparada para rever produtos, quantidades, totais e avançar para checkout.',
      },
      {
        title: 'Checkout estruturado',
        description:
          'Fluxo de encomenda com dados do cliente, morada, método de pagamento e resumo da compra.',
      },
      {
        title: 'Área administrativa',
        description:
          'Quando necessário, criamos uma área privada para consultar e acompanhar encomendas.',
      },
    ],
    process: [
      {
        title: 'Mapeamento da loja',
        description:
          'Definimos categorias, tipos de produto, fluxo de compra, necessidades de pagamento e gestão interna.',
      },
      {
        title: 'Estrutura de venda',
        description:
          'Organizamos páginas, produto, carrinho, checkout e pontos de confiança para orientar o cliente.',
      },
      {
        title: 'Desenvolvimento e testes',
        description:
          'Criamos a loja, testamos navegação, carrinho, formulários, estados e experiência em mobile.',
      },
      {
        title: 'Publicação e evolução',
        description:
          'Publicamos a loja e deixamos a base preparada para novos produtos, métodos de pagamento e automações.',
      },
    ],
    faq: [
      {
        question: 'A loja online pode ter carrinho e checkout?',
        answer:
          'Sim. Podemos criar catálogo, páginas de produto, carrinho de compras e checkout estruturado para receber encomendas.',
      },
      {
        question: 'É possível integrar pagamentos online?',
        answer:
          'Sim. A loja pode ser preparada para integrar métodos de pagamento como PayPal, Stripe, MB WAY ou outros, dependendo das necessidades e disponibilidade técnica.',
      },
      {
        question: 'Posso gerir encomendas numa área privada?',
        answer:
          'Sim. Quando o projeto precisa, podemos criar uma área administrativa para consultar encomendas, estados e dados relevantes.',
      },
      {
        question: 'A loja fica preparada para SEO?',
        answer:
          'Sim. Podemos estruturar páginas, títulos, descrições, categorias e metadata para criar uma base mais forte para motores de pesquisa.',
      },
      {
        question: 'Posso começar com poucos produtos e crescer depois?',
        answer:
          'Sim. A loja pode começar com um catálogo mais simples e evoluir com novas categorias, produtos, métodos de pagamento, automações e área administrativa.',
      },
      {
        question: 'Que informação devo preparar para criar uma loja online?',
        answer:
          'O ideal é reunir nomes dos produtos, preços, imagens, descrições, categorias, regras de entrega, métodos de pagamento pretendidos e forma como quer gerir encomendas.',
      },
    ],
    relatedServices: ['criacao-websites', 'automacao-ia', 'sistemas-marcacao'],
  },
  {
    slug: 'sistemas-marcacao',
    path: '/sistemas-marcacao',
    label: 'Sistemas de Marcação Online',
    shortLabel: 'Marcações',
    seo: {
      title: 'Sistema de Marcações Online para Empresas | MA-Code',
      description:
        'Criação de sistemas de marcação online para salões, clínicas, serviços locais e negócios que precisam de organizar horários, pedidos e agenda.',
      keywords:
        'sistema de marcações online, agenda online, marcações online, reservas online, sistema de reservas, marcações para salão, marcações para clínica, MA-Code',
      canonical: `${siteUrl}/sistemas-marcacao`,
      ogTitle: 'Sistemas de Marcação Online | MA-Code',
      ogDescription:
        'Sistemas de marcação online para receber pedidos, organizar agenda e reduzir trabalho manual em negócios com horários.',
    },
    hero: {
      eyebrow: 'Sistemas de marcação online',
      title: 'Marcações online para negócios que precisam de',
      highlightedTitle: 'organização, agenda e menos mensagens perdidas',
      description:
        'Criamos sistemas de marcação online para salões, clínicas, serviços locais e profissionais que precisam de receber pedidos, organizar horários e consultar agenda de forma simples.',
      primaryCta: 'Pedir orçamento',
      secondaryCta: 'Ver projetos',
    },
    stats: [
      {
        value: 'Agenda',
        label: 'Horários e pedidos organizados',
      },
      {
        value: 'Admin',
        label: 'Painel privado para gestão',
      },
      {
        value: 'Mobile',
        label: 'Pensado para clientes no telemóvel',
      },
    ],
    intro: {
      title: 'Quando as marcações dependem só de chamadas e mensagens, é fácil perder controlo.',
      paragraphs: [
        'Muitos negócios recebem pedidos por telefone, WhatsApp, Instagram ou presencialmente. Isso pode funcionar no início, mas torna-se confuso quando há vários horários, serviços, clientes e alterações.',
        'Um sistema de marcações online ajuda a centralizar pedidos, reduzir falhas, melhorar a experiência do cliente e dar ao negócio uma imagem mais profissional.',
      ],
    },
    idealFor: [
      'Cabeleireiros, barbearias e salões de estética',
      'Clínicas, terapeutas e profissionais de saúde não urgente',
      'Consultores, formadores e prestadores de serviços',
      'Negócios locais que funcionam por horário ou reserva',
      'Empresas que querem reduzir gestão manual de agenda',
    ],
    benefits: [
      {
        title: 'Pedidos centralizados',
        description:
          'Os clientes podem pedir marcação através do site, evitando mensagens dispersas e informação perdida.',
      },
      {
        title: 'Agenda mais clara',
        description:
          'O negócio passa a ter uma visão mais organizada dos horários, pedidos, bloqueios e disponibilidade.',
      },
      {
        title: 'Melhor experiência para o cliente',
        description:
          'O cliente consegue consultar a informação essencial e enviar o pedido sem depender de chamadas demoradas.',
      },
      {
        title: 'Menos trabalho manual',
        description:
          'A gestão fica mais simples, especialmente quando existe painel privado para consultar, confirmar ou acompanhar pedidos.',
      },
    ],
    deliverables: [
      {
        title: 'Formulário de marcação',
        description:
          'Pedido de marcação com nome, contacto, serviço, data, hora e observações relevantes.',
      },
      {
        title: 'Página de serviços',
        description:
          'Apresentação dos serviços disponíveis, preços ou informações úteis antes do pedido.',
      },
      {
        title: 'Painel administrativo',
        description:
          'Área privada para consultar marcações, gerir estados, ver agenda e organizar pedidos.',
      },
      {
        title: 'Gestão de horários',
        description:
          'Estrutura para disponibilidade, bloqueios, horários de funcionamento ou regras específicas do negócio.',
      },
      {
        title: 'Notificações e contacto',
        description:
          'Possibilidade de preparar notificações, mensagens de confirmação ou ligação com canais como WhatsApp.',
      },
    ],
    process: [
      {
        title: 'Levantamento de regras',
        description:
          'Percebemos horários, serviços, duração das marcações, pausas, bloqueios e forma de confirmação.',
      },
      {
        title: 'Desenho da experiência',
        description:
          'Criamos um fluxo simples para o cliente pedir marcação e para o negócio consultar os pedidos.',
      },
      {
        title: 'Desenvolvimento do sistema',
        description:
          'Implementamos formulário, lógica de horários, área administrativa e estrutura adaptada ao caso real.',
      },
      {
        title: 'Testes e publicação',
        description:
          'Testamos pedidos, horários, mensagens, mobile e utilização diária antes de colocar online.',
      },
    ],
    faq: [
      {
        question: 'O sistema confirma marcações automaticamente?',
        answer:
          'Pode ser configurado de diferentes formas. Alguns negócios preferem receber pedidos para confirmar manualmente, enquanto outros podem evoluir para confirmação automática com regras de disponibilidade.',
      },
      {
        question: 'Dá para ter um painel privado de administração?',
        answer:
          'Sim. Podemos criar uma área privada para consultar marcações, gerir estados, bloquear horários e acompanhar a agenda.',
      },
      {
        question: 'Funciona para cabeleireiros e clínicas?',
        answer:
          'Sim. O sistema pode ser adaptado a salões, clínicas, consultórios, serviços locais, formações ou qualquer negócio que trabalhe por horários.',
      },
      {
        question: 'O cliente recebe confirmação?',
        answer:
          'Podemos preparar mensagens de confirmação, instruções no ecrã, ligação com WhatsApp ou notificações, dependendo da solução pretendida.',
      },
      {
        question: 'É possível começar só com pedido de marcação e evoluir depois?',
        answer:
          'Sim. O sistema pode começar como um pedido de marcação simples e evoluir para confirmação automática, painel de gestão, notificações, bloqueios de agenda ou regras mais avançadas.',
      },
      {
        question: 'O sistema adapta-se aos horários e serviços do negócio?',
        answer:
          'Sim. A estrutura pode ser ajustada à duração dos serviços, horários de funcionamento, pausas, dias indisponíveis, bloqueios manuais e forma de confirmação usada pela equipa.',
      },
    ],
    relatedServices: ['criacao-websites', 'automacao-ia', 'lojas-online'],
  },
  {
    slug: 'automacao-ia',
    path: '/automacao-ia',
    label: 'Automação e Inteligência Artificial para Empresas',
    shortLabel: 'Automação IA',
    seo: {
      title: 'Automação com IA para Empresas em Portugal | MA-Code',
      description:
        'Automação com IA, integrações, assistentes digitais, formulários inteligentes e sistemas para reduzir tarefas repetitivas e organizar processos internos.',
      keywords:
        'automação com IA, inteligência artificial para empresas, automação de processos, assistente IA, integrações API, automação empresarial, MA-Code',
      canonical: `${siteUrl}/automacao-ia`,
      ogTitle: 'Automação e IA para Empresas | MA-Code',
      ogDescription:
        'Soluções de automação, IA e integrações para reduzir tarefas repetitivas, organizar processos e tornar o negócio mais eficiente.',
    },
    hero: {
      eyebrow: 'Automação, IA e integrações',
      title: 'Automação com IA para empresas que querem',
      highlightedTitle: 'poupar tempo e trabalhar melhor',
      description:
        'Criamos soluções digitais com automação, inteligência artificial, integrações API, assistentes e sistemas internos para reduzir tarefas repetitivas e melhorar a organização do negócio.',
      primaryCta: 'Pedir orçamento',
      secondaryCta: 'Ver projetos',
    },
    stats: [
      {
        value: 'IA',
        label: 'Assistentes e fluxos inteligentes',
      },
      {
        value: 'API',
        label: 'Integrações entre sistemas',
      },
      {
        value: 'Tempo',
        label: 'Menos tarefas repetitivas',
      },
    ],
    intro: {
      title: 'A automação certa não substitui o negócio. Remove trabalho repetitivo.',
      paragraphs: [
        'Muitas empresas perdem tempo com tarefas manuais: copiar dados, responder sempre às mesmas perguntas, organizar pedidos, consultar folhas, enviar mensagens ou atualizar informação em vários sítios.',
        'A MA-Code cria soluções de automação e IA ajustadas ao processo real do negócio, com foco em poupar tempo, reduzir erros e tornar a operação mais clara.',
      ],
    },
    idealFor: [
      'Empresas com tarefas repetitivas ou processos manuais',
      'Negócios que recebem muitos pedidos, mensagens ou formulários',
      'Equipas que precisam de integrar ferramentas e bases de dados',
      'Lojas online que querem automatizar partes da operação',
      'Serviços que querem assistentes digitais ou respostas inteligentes',
    ],
    benefits: [
      {
        title: 'Menos tarefas repetitivas',
        description:
          'Automatizamos processos manuais para reduzir tempo perdido em ações que podem ser sistematizadas.',
      },
      {
        title: 'Mais organização interna',
        description:
          'Criamos fluxos que ajudam a centralizar dados, pedidos, mensagens e informação operacional.',
      },
      {
        title: 'Melhor resposta ao cliente',
        description:
          'Assistentes digitais, formulários inteligentes e respostas orientadas podem melhorar a experiência e acelerar o atendimento.',
      },
      {
        title: 'Integração entre sistemas',
        description:
          'Ligamos APIs, bases de dados, websites, formulários e ferramentas para evitar trabalho duplicado.',
      },
    ],
    deliverables: [
      {
        title: 'Assistentes digitais',
        description:
          'Assistentes com IA para orientar utilizadores, responder a perguntas frequentes ou apoiar processos internos.',
      },
      {
        title: 'Formulários inteligentes',
        description:
          'Formulários que recolhem, organizam e encaminham informação de forma mais útil para o negócio.',
      },
      {
        title: 'Integrações API',
        description:
          'Ligação entre sistemas, websites, bases de dados, ferramentas externas e fluxos internos.',
      },
      {
        title: 'Automação de processos',
        description:
          'Fluxos para reduzir tarefas repetitivas, melhorar consistência e acelerar operações.',
      },
      {
        title: 'Sistemas internos',
        description:
          'Pequenas aplicações web para consultar, organizar, gerir ou acompanhar informação importante.',
      },
    ],
    process: [
      {
        title: 'Mapeamento do processo',
        description:
          'Identificamos onde o negócio perde tempo, onde existem erros e que tarefas fazem sentido automatizar.',
      },
      {
        title: 'Desenho da solução',
        description:
          'Definimos dados, ferramentas, integrações, regras, permissões e resultado esperado.',
      },
      {
        title: 'Implementação',
        description:
          'Criamos a automação, integração ou sistema com testes progressivos e foco em utilização prática.',
      },
      {
        title: 'Ajuste e evolução',
        description:
          'Afinamos o fluxo com base na utilização real e deixamos a solução preparada para crescer.',
      },
    ],
    faq: [
      {
        question: 'Que tipo de tarefas podem ser automatizadas?',
        answer:
          'Pedidos de contacto, organização de dados, respostas frequentes, envio de notificações, ligação entre ferramentas, atualização de registos e processos internos repetitivos.',
      },
      {
        question: 'A IA pode ser integrada no meu website?',
        answer:
          'Sim. Podemos criar assistentes digitais, fluxos com IA, formulários inteligentes ou ferramentas internas ligadas ao website.',
      },
      {
        question: 'É preciso já ter sistemas avançados?',
        answer:
          'Não. Muitas automações começam com processos simples, como formulários, folhas de cálculo, emails, bases de dados ou tarefas repetidas manualmente.',
      },
      {
        question: 'A solução fica personalizada ao meu negócio?',
        answer:
          'Sim. O objetivo é adaptar a automação ao processo real, não aplicar uma solução genérica que depois a equipa não usa.',
      },
      {
        question: 'Como sei se o meu negócio precisa de automação?',
        answer:
          'Normalmente há oportunidade de automação quando a equipa repete muitas vezes a mesma tarefa, copia dados entre ferramentas, responde sempre às mesmas perguntas ou perde tempo a organizar informação manualmente.',
      },
      {
        question: 'Podemos começar com uma automação pequena?',
        answer:
          'Sim. Muitas soluções começam por uma fase pequena e prática, como automatizar pedidos, organizar respostas, ligar um formulário a uma base de dados ou criar um assistente para perguntas frequentes.',
      },
    ],
    relatedServices: ['criacao-websites', 'lojas-online', 'sistemas-marcacao'],
  },
]

export const servicePagePaths = servicePages.map((page) => page.path)

export function getServicePageBySlug(slug: ServicePageSlug) {
  return servicePages.find((page) => page.slug === slug)
}

export function getServicePageByPath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'

  return servicePages.find((page) => page.path === path)
}
