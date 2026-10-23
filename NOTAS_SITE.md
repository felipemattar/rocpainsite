# Notas do site ROCPAIN + portfólio de som

Registro de como o site novo foi montado e do que ficou em aberto. Atualizado em 18/10/2026.

## Estrutura

- `index.html`: página única bilíngue (PT/EN) da ROCPAIN. Seções: Jogos, Aplicativos, Soluções com IA, Como trabalhamos, Sobre, Contato.
- `index_pt.html` e `index_en.html`: só redirecionam para `index.html?lang=pt` / `?lang=en` (não quebrar links antigos).
- `som/index.html`: portfólio de som de Felipe Mattar (rocpaingames.com/som). Também bilíngue.
- `som/imagens/`: imagens do portfólio feitas à mão (`lacuna.webp`, `destino-das-sombras.webp`).
- Não mexer em `Games/`, `iur/`, políticas de privacidade, `terms.html`, `CNAME` e no arquivo de verificação do Google.
- Publicação: GitHub Pages direto da `main` (`felipemattar/rocpainsite`). Push na `main` = site no ar em poucos minutos.

## Como o idioma funciona

- Os textos em PT ficam no próprio HTML com `data-i18n="chave"`. Os de EN ficam num objeto `en` dentro do `<script>` no fim da página.
- Ordem de escolha: `?lang=` na URL, depois o que ficou salvo no navegador (`localStorage`), depois o idioma do navegador.
- Texto novo na página precisa de `data-i18n` e da tradução no objeto `en`, senão fica só em PT.

## Portfólio de som: o que existe

- **Destaque** antes dos longas: *É Quase Verdade* (telefilme 2026, Dir. Gustavo Moraes, 55 Cine e Globo Filmes, exibido na Tela Quente; IMDb tt41296717). Funções: edição de som e mixagem.
- **Categorias retráteis** (`<details class="group">`, sinal +/−, contagem calculada pelo script). Longas abre por padrão e mostra 6; botão "Ver mais" libera o resto (`data-limit="6"` em `.features.clamped`). Médias, séries e curtas começam fechadas.
- **Longas** (ordem na página): Lacuna (em finalização), Águas do Itapemirim (2025), Corredores (2024), O Cemitério das Almas Perdidas, A Mata Negra, Destino das Sombras, Punhal, Mar Negro.
- Para incluir um filme: copiar um `<article class="feature">` (longas) ou `<li>` (demais) e traduzir os textos novos. A contagem se atualiza sozinha.

## Imagens feitas para o portfólio

- **Lacuna**: o cartaz original é vertical (730x956). `som/imagens/lacuna.webp` é uma recomposição 16:9 (1280x720) em fundo preto com título, "É uma coprodução", logos Horizonte Líquido e Livres Filmes e a faixa de realização. O cartaz vertical original **não está no repositório**; se precisar refazer, peça de novo a imagem. A recomposição foi feita com Pillow (recortes do cartaz, logos "levantados" por máscara de brilho/cor, seta do carrossel do Instagram apagada).
- **Destino das Sombras**: quadro do título recortado em 16:9, porque o Vimeo não entregava miniatura.
- **Choque de Cultura Racing** (em `index.html`): usa `Games/ChoqueImages/Store_Capsule_Main.png` (1232x706), porque a imagem da Steam em português não carregava. O card corta um pouco em cima e embaixo (proporção 460/215).

## Dados conferidos e suposições

- Águas do Itapemirim: o título dos créditos (descrição do YouTube) é "Águas do Itapemirim"; o título do vídeo diz "Águas de Itapemirim". Usei o dos créditos. Direção: Klaus'Berg. Realização: Instituto Últimos Refúgios. Edição de som: Felipe Mattar (mixagem foi de Alexandre Barcelos, então não consta mixagem).
- Lacuna: direção de Saskia Sá, função "edição de som", marcado "Em finalização" (fonte: página da Saskia no Mapa Cultural ES). Link do card vai para o Instagram do filme (@lacuna.filme).
- É Quase Verdade: as funções (edição e mixagem) vieram de Felipe; o IMDb não lista a equipe de som. O vídeo linkado é uma chamada da Tela Quente 04/05/2026 de um canal de terceiros, não o trailer oficial.
- Corredores: o card agora usa o trailer do YouTube (Wei6ujBgdYc) como capa e link.

## Melhorias aplicadas em 23/10/2026 (revisão de UX/SEO)

- **Imagens de compartilhamento 1200x630**: `imagens/og-rocpain.jpg` (home) e `som/imagens/og-som.jpg` (/som/), com `og:image:width/height/alt`, `og:locale` e `twitter:image`. Foram geradas com Pillow a partir de `capa_itch.jpg` e de uma onda sonora desenhada; para refazer, rode o mesmo tipo de script (texto em Arial Black do Windows).
- **SEO**: `sitemap.xml`, `robots.txt` e `404.html` (bilíngue, `noindex`). Removi os `hreflang` com `?lang=` porque conflitavam com o `canonical`; só voltam se existirem páginas estáticas separadas (`/en/`).
- **Acessibilidade**: `aria-label` agora é traduzido junto com o idioma (atributo `data-i18n-label="chave"` + chave no objeto `en`). Os três "H2" do bloco de áreas da home viraram `<strong>` (não são seções). Botões e links ganharam altura de toque de 36 a 44 px; ficaram só links dentro de texto.
- **Categorias da filmografia**: continuam `<details>/<summary>` com `<h3>` dentro. Esse é o padrão nativo e funciona sem JavaScript, mas leitores de tela não listam as categorias na navegação por títulos. Trocar exigiria um acordeão com botões e JS; decidi não fazer.
- **Botão de contato no topo do /som/** ("Fale sobre o seu filme").
- **Reel no /som/**: foi feito e depois removido a pedido (23/10/2026). Se quiser voltar, é uma seção com player que só carrega ao clicar (youtube-nocookie), recuperável no commit `ba0157d`.

- **Fontes hospedadas no site** (`fonts/`: Anybody e Atkinson Hyperlegible Next, subsets latin e latin-ext, licença OFL), carregadas por `fonts/fonts.css` com `preload`. Nenhuma requisição ao Google Fonts. Se aparecer caractere fora do latin (ex.: vietnamita), é preciso baixar o subset.
- **Jogos na home**: Cyber Control, Rio de Lama, ROCPAIN: Pedra Papel Tesoura e Choque de Cultura Racing mostram a capa do jogo com botão de play; o clique abre o vídeo do YouTube em nova aba (sem embed, sem autoplay). A seção "Trailers e gameplay" foi removida. DeckToon tem só a capa (não há vídeo). Para trocar um vídeo, mude o `href` do `<a class="video-link">` do card. As capas ficam em `imagens/jogos/*.webp`.
- **Ícones**: `favicon-32.png`, `favicon-192.png` e `apple-touch-icon.png`, gerados de `favicon.png` (que continua no JSON-LD).
- **Botões flutuantes** (home e /som/): "voltar ao topo" e, no celular, "Contato". Aparecem depois de rolar 700 px e somem na seção de contato e no rodapé.
- **Hero da home no celular**: o "ROCPAIN" sobre o planeta parece normal no celular do Felipe; nenhuma mudança.
- `imagens/icon2048.png` (3 MB) não é usado por nenhuma página do site; não foi apagado. Confirmar antes de remover.

## Pendências e ideias

1. Conferir o site no ar depois do último push (nunca foi aberto em rocpaingames.com, só em localhost).
2. Decidir o título final de "Águas do Itapemirim" (ver acima).
3. Confirmar o ano exato e o lançamento de Lacuna quando sair (hoje aparece "Em finalização").
4. Se tiver link oficial ou trailer de É Quase Verdade (Globoplay ou canal da produtora), trocar o da chamada.
5. Médias, séries e curtas são listas só de texto (com botão "Assistir"), sem miniaturas; dá para acrescentar imagens se quiser.
6. Remover da pasta raiz, quando não precisar mais: `rocpain-site-novo.patch`, `INSTRUCOES_CLAUDE_CODE.md`, `debug.log`, `index_backup.html`, `index portfolio.html`, `FelipeMattar.html` (arquivos antigos; confirmar antes de apagar qualquer um).
8. O Git avisa que `som/index.html` vai trocar LF por CRLF; é inofensivo, mas dá para fixar com um `.gitattributes`.

## Fora do escopo desta sessão

Os arquivos novos em `iur/expedicoes-iur/` (CLAUDE.md, TASKS.md, PASSAGEM.md etc.) vêm de outro trabalho e aparecem como não rastreados; não foram tocados aqui.
