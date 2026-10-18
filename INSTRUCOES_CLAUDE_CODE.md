# Novo site ROCPAIN + portfólio de som — instruções para o Claude Code

Cole o texto abaixo no Claude Code, aberto na pasta do repositório `rocpainsite`, com o arquivo `rocpain-site-novo.patch` na raiz do repositório (ou informe o caminho onde ele está).

---

## Prompt para o Claude Code

Aplique o patch `rocpain-site-novo.patch` neste repositório (felipemattar/rocpainsite, publicado em rocpaingames.com via GitHub Pages). Siga estes passos:

1. Confirme que estamos no repositório certo (`CNAME` contém `rocpaingames.com`) e que não há alterações pendentes (`git status`). Se houver, pare e me avise.
2. Atualize a `main` (`git pull`) e crie a branch `site-novo`.
3. Aplique o patch com `git am rocpain-site-novo.patch`. Se der conflito, use `git apply --3way` e me mostre o que conflitou antes de resolver.
4. Confira que o patch mexe só nestes arquivos:
   - `index.html` (substituído: página única bilíngue PT/EN com Jogos, Aplicativos, Soluções com IA, Como trabalhamos, Sobre e Contato)
   - `index_pt.html` e `index_en.html` (viram redirecionamentos para `index.html?lang=pt` / `?lang=en`, para não quebrar links antigos)
   - `som/index.html` (novo: portfólio de som de Felipe Mattar, em rocpaingames.com/som)
   Não altere as pastas `Games/` e `iur/`, nem `privacy_policy.html`, `privacy_policy_android.html`, `terms.html`, `CNAME` e o arquivo de verificação do Google.
5. Verifique localmente:
   - Sirva a pasta (`python -m http.server 8000`) e abra `/`, `/?lang=en`, `/index_pt.html`, `/index_en.html` e `/som/`.
   - O botão PT/EN troca os textos nas duas páginas, sem erros no console.
   - O ícone do favicon carrega em `/som/` (usa `../imagens/favicon.png`).
   - Os links “Política de privacidade” e “Termos de uso” do rodapé abrem.
   - O link “Portfólio de som de Felipe Mattar” no Sobre leva para `/som/`, e a página de som tem link de volta para a ROCPAIN.
   - Em largura de celular (390 px) não há rolagem horizontal.
6. Me mostre um resumo do que verificou. Só depois de eu aprovar:
   - faça push da branch `site-novo` e abra um pull request para a `main` com o título “Novo site ROCPAIN e portfólio de som em /som”; ou
   - se eu pedir para publicar direto, faça merge na `main` e push.

---

## O que vem no patch

**Site principal (`index.html`)**
- Visual novo baseado na identidade da ROCPAIN (vinho e dourado, planeta), uma única página com seletor PT/EN que detecta corretamente `pt-BR` (o site antigo mandava brasileiros para a versão em inglês).
- Jogos: DeckToon em destaque (em desenvolvimento, contratado pela Funktoon, direitos da Editora Guará), Cyber Control, Rio de Lama, ROCPAIN: Pedra Papel Tesoura e Choque de Cultura Racing (marcado como demo, fora de desenvolvimento). Capas puxadas da Steam, trailers como miniaturas leves do YouTube.
- Aplicativos: apps Android e multiplataforma, sistemas web, jogos educativos e gamificação, apps para áudio e campo.
- Soluções com IA: catalogação de fotos e sons, IA em áudio e pós-produção, IA dentro de jogos e apps.
- Metadados para Google e redes sociais (descrição, Open Graph, schema.org).

**Portfólio de som (`som/index.html`)**
- Filmografia completa do currículo atualizado: 6 longas (com miniatura de trailer), 8 médias, 3 séries e 11 curtas, com direção, produtora, função e prêmios.
- Serviços: edição de som, desenho de som, mixagem e captação ambisônica multicanal com o Zoom H3-VR.
- Destaques (Cine PE, Berlinale, Mar Negro, A Mata Negra), pesquisa (dissertação, artigo, Lattes), sobre e contato.
- Bilíngue PT/EN, com link de ida e volta para o site da ROCPAIN.

## Pontos para revisar depois
- WhatsApp usado nas duas páginas: (27) 99501-3617.
- Corredores (2024) está sem link de trailer.
- Trabalhos recentes de som ainda a incluir.
