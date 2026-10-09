// =====================================================================
//  CONFIGURAÇÃO DO APP — edite aqui para adaptar sem mexer no resto.
// =====================================================================

// Firebase (copiado do console do Firebase → Configurações do projeto)
export const firebaseConfig = {
  apiKey: "AIzaSyDiqnJOTlPQFmqCYzcsfhqPiUDIokJetgs",
  authDomain: "equipamentosiur.firebaseapp.com",
  projectId: "equipamentosiur",
  storageBucket: "equipamentosiur.firebasestorage.app",
  messagingSenderId: "960323848348",
  appId: "1:960323848348:web:dd82c923459eb2c1630559"
};

// Administrador(es) fixo(s). Precisa ser igual à função proprietario() no firestore.rules.
export const OWNERS = ['fdesigner@gmail.com'];

export const APP_NAME = 'Expedições IUR';
export const APP_SUB = 'Instituto Últimos Refúgios · documentário e fotografia de natureza';

// Perfis de acesso. A ordem define o que aparece no seletor da aba Equipe.
// edit: cria/edita projetos, diárias e inventário · team: gerencia pessoas · allProjects: vê todos os projetos
export const ROLES = {
  admin:  { label: 'Administrador', edit: true,  team: true,  allProjects: true  },
  editor: { label: 'Editor',        edit: true,  team: false, allProjects: true  },
  member: { label: 'Membro',        edit: false, team: false, allProjects: false },
};

// Funções no projeto, em ordem de hierarquia (a primeira é a mais alta).
// Para incluir, renomear ou reordenar, basta editar esta lista. O "id" é o que fica salvo no banco.
export const FUNCTIONS = [
  { id: 'direcao',    label: 'Direção' },
  { id: 'producao',   label: 'Produção' },
  { id: 'dirfoto',    label: 'Direção de fotografia' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'camera',     label: 'Câmera / assistente' },
  { id: 'som',        label: 'Som' },
  { id: 'logger',     label: 'Logger' },
  { id: 'drone',      label: 'Piloto de drone' },
  { id: 'apoio',      label: 'Apoio / motorista' },
];

// Horários padrão de cada diária (formato HH:MM). Deixe '' para não usar um deles.
export const DEFAULT_TIMES = [
  { id: 'saida',  label: 'Saída',  value: '08:00' },
  { id: 'almoco', label: 'Almoço', value: '12:00' },
  { id: 'volta',  label: 'Volta',  value: '18:00' },
];

// A partir desta hora, o resumo do projeto mostra a diária do dia seguinte.
export const NEXT_DAY_FROM_HOUR = 20;

// Veículos que todo projeto novo recebe. daily:false = só na viagem sede → hospedagem.
export const DEFAULT_VEHICLES = [
  { id: 'toro',       name: 'Fiat Toro',    daily: true  },
  { id: 'hilux',      name: 'Toyota Hilux', daily: true  },
  { id: 'carretinha', name: 'Carretinha',   daily: false },
];

// Busca de locais (gratuita, sem chave): Photon / OpenStreetMap. As sugestões priorizam a região abaixo.
export const PLACE_SEARCH = { url: 'https://photon.komoot.io/api/', lat: -20.3, lon: -40.3, limit: 6 };

// Nome da frente criada automaticamente em cada diária
export const DEFAULT_FRONT_NAME = 'Equipe principal';

// Inventário
export const ITEM_STATUS = {
  owned:   { t: 'Em posse' },
  ordered: { t: 'Encomendado', c: 'p-acc' },
  tobuy:   { t: 'A comprar',   c: 'p-idle' },
};
export const CONDITIONS = {
  ok:     { t: 'Em condições de uso',   c: 'p-ok',   s: 's-ok' },
  needs:  { t: 'Precisa de manutenção', c: 'p-warn', s: 's-warn' },
  repair: { t: 'Em manutenção',         c: 'p-bad',  s: 's-bad' },
};

// Foto do equipamento: lado maior em px e qualidade JPEG (fica gravada no próprio item)
export const PHOTO_MAX_PX = 360;
export const PHOTO_QUALITY = 0.72;
