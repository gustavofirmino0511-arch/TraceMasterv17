window.addEventListener('load', () => {
    // Injeta fontes Google dentro do SVG texto-layer
    // Carrega Google Fonts dinamicamente (funciona quando online)
    function carregarGoogleFonts() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Righteous&family=Fredoka+One&family=Pacifico&family=Lobster&family=Press+Start+2P&family=Orbitron:wght@700&family=Cinzel:wght@700&family=Raleway:wght@800&family=Oswald:wght@700&family=Playfair+Display:wght@700&family=Dancing+Script:wght@700&family=Abril+Fatface&family=Black+Han+Sans&family=Boogaloo&family=Chewy&family=Permanent+Marker&family=Russo+One&family=Saira+Stencil+One&family=Yatra+One&display=swap';
        link.onload = () => {
            // Atualiza preview após fontes carregarem
            const prev = document.getElementById('fonte-preview');
            if (prev) prev.style.fontFamily = document.getElementById('fonte-select')?.value || 'sans-serif';
            console.log('Google Fonts carregadas!');
        };
        link.onerror = () => console.warn('Google Fonts não carregou — sem internet?');
        document.head.appendChild(link);
    }
    carregarGoogleFonts();

    // ── INDICADOR DE CARREGAMENTO DO OPENCV ──────────────────────────────────
    // OpenCV.js é carregado de forma assíncrona; mostra badge enquanto não estiver pronto.
    (function iniciarBadgeOpenCV() {
        if (window._cvReady) return; // já carregou antes do load — nada a fazer
        const badge = document.createElement('div');
        badge.id = 'cv-loading-badge';
        badge.textContent = '⏳ Carregando OpenCV...';
        badge.style.cssText = [
            'position:fixed', 'top:8px', 'left:50%', 'transform:translateX(-50%)',
            'background:rgba(0,0,0,0.75)', 'color:#fff', 'padding:4px 14px',
            'border-radius:14px', 'font-size:11px', 'z-index:99999',
            'pointer-events:none', 'transition:opacity .4s'
        ].join(';');
        document.body.appendChild(badge);
        const poll = setInterval(() => {
            if (window._cvReady) {
                badge.style.opacity = '0';
                setTimeout(() => badge.remove(), 400);
                clearInterval(poll);
            }
        }, 500);
    })();
    // ─────────────────────────────────────────────────────────────────────────

    const workSurface = document.getElementById('work-surface'),
          svgArea     = document.getElementById('svg-render-area'),
          hCanvas     = document.getElementById('hidden-canvas'),
          hCtx        = hCanvas.getContext('2d'),
          drawLayer   = document.getElementById('draw-layer'),
          penLayer    = document.getElementById('pen-layer'),
          vp          = document.getElementById('viewport');

    let scale = 0.8, posX = 20, posY = 80, distIni = null, isDragging = false, lastX, lastY;
    let rotacao = 0; // rotação da folha em graus
    let pinching = false, pinchDistIni = 0, pinchCxIni = 0, pinchCyIni = 0;
    let pinchScaleIni = 1, pinchPosXIni = 0, pinchPosYIni = 0;
    let pinchAnguloIni = 0, pinchRotacaoIni = 0;
    let zoomAncoraCx = 0, zoomAncoraCy = 0, zoomAncoraScreenX = 0, zoomAncoraScreenY = 0;

    // ── ESTADO GLOBAL CENTRALIZADO ────────────────────────────────────────────
    // Todas as variáveis de estado do app em um único objeto.
    // As variáveis individuais abaixo são aliases que apontam para appState,
    // mantendo compatibilidade total com o código existente.
    const appState = {
        // ── VIEWPORT ─────────────────────────────────────────────────────────
        // Controlam zoom, posição e rotação da folha de trabalho
        // Originais: L1229 (scale, posX, posY), L1230 (rotacao)
        // Leitura: update(), clientParaCanvas(), canvasParaClient(), _clampPos()
        // Escrita: touchmove pinch, touchmove pan, resetView()
        get scale()   { return scale; },   set scale(v)   { scale = v; },
        get posX()    { return posX; },    set posX(v)    { posX = v; },
        get posY()    { return posY; },    set posY(v)    { posY = v; },
        get rotacao() { return rotacao; }, set rotacao(v) { rotacao = v; },

        // ── CAMADAS ───────────────────────────────────────────────────────────
        // Originais: L1582–L1585
        // Leitura: renderizarTodos(), renderizarPainel(), salvarProjeto()
        // Escrita: novaCamada(), deletarCamada(), carregarProjeto()
        get camadas()     { return camadas; },      set camadas(v)     { camadas = v; },
        get camadaAtiva() { return camadaAtiva; },  set camadaAtiva(v) { camadaAtiva = v; },
        get camadaFoto()  { return camadaFoto; },   set camadaFoto(v)  { camadaFoto = v; },
        get idCounter()   { return idCounter; },    set idCounter(v)   { idCounter = v; },

        // ── HISTÓRICO ─────────────────────────────────────────────────────────
        // Originais: L1236
        // Leitura/Escrita: salvarHistorico(), desfazerPen(), refazerPen()
        get historico()       { return historico; },       set historico(v)       { historico = v; },
        get historicoFuturo() { return historicoFuturo; }, set historicoFuturo(v) { historicoFuturo = v; },

        // ── FERRAMENTAS / MODOS ───────────────────────────────────────────────
        // Originais: L1238–L1244, L1575, L2337, L3000, L3514, L3559, L4345, L5314
        // Leitura: touchstart/move/end, selecionarFerramenta()
        // Escrita: toggle*() functions
        get ferramentaAtiva() { return ferramentaAtiva; }, set ferramentaAtiva(v) { ferramentaAtiva = v; },
        get modoPen()         { return modoPen; },         set modoPen(v)         { modoPen = v; },
        get modoEditar()      { return modoEditar; },      set modoEditar(v)      { modoEditar = v; },
        get modoLivre()       { return modoLivre; },       set modoLivre(v)       { modoLivre = v; },
        get modoBorracha()    { return modoBorracha; },    set modoBorracha(v)    { modoBorracha = v; },
        get modoFormas()      { return modoFormas; },      set modoFormas(v)      { modoFormas = v; },
        get modoDegrade()     { return modoDegrade; },     set modoDegrade(v)     { modoDegrade = v; },
        get modoSelecao()     { return modoSelecao; },     set modoSelecao(v)     { modoSelecao = v; },
        get modoContaGotas()  { return modoContaGotas; },  set modoContaGotas(v)  { modoContaGotas = v; },
        get modoEspelho()     { return modoEspelho; },     set modoEspelho(v)     { modoEspelho = v; },
        get modoOutline()     { return modoOutline; },     set modoOutline(v)     { modoOutline = v; },
        get modoInfinito()    { return modoInfinito; },    set modoInfinito(v)    { modoInfinito = v; },
        get folhaTravada()    { return folhaTravada; },    set folhaTravada(v)    { folhaTravada = v; },

        // ── PINCEL ────────────────────────────────────────────────────────────
        // Original: L1700
        // Leitura: iniciarPincel(), continuarPincel()
        // Escrita: selecionarPincel()
        get pincelAtual() { return pincelAtual; }, set pincelAtual(v) { pincelAtual = v; },

        // ── COR / TAMANHO / OPACIDADE ─────────────────────────────────────────
        // Lidas do DOM via getCor()/getTam()/getOpac() — sem estado próprio
        // Incluídas aqui como getters para acesso unificado
        get cor()       { return document.getElementById('col-main')?.value    ?? '#000000'; },
        get tamanho()   { return parseFloat(document.getElementById('brush-size')?.value    ?? 10); },
        get opacidade() { return parseFloat(document.getElementById('brush-opacity')?.value ?? 1); },

        // ── TEXTO ─────────────────────────────────────────────────────────────
        // Originais: L3124–L3125
        // Leitura/Escrita: inserirTexto(), _abrirEdicaoTexto()
        get textoFonte()  { return textoFonte; },  set textoFonte(v)  { textoFonte = v; },
        get textoBold()   { return textoBold; },   set textoBold(v)   { textoBold = v; },
        get textoItalic() { return textoItalic; }, set textoItalic(v) { textoItalic = v; },
        get textoPosX()   { return textoPosX; },   set textoPosX(v)   { textoPosX = v; },
        get textoPosY()   { return textoPosY; },   set textoPosY(v)   { textoPosY = v; },

        // ── SNAPSHOT: serializa o estado persistível ──────────────────────────
        // Usado por salvarProjeto() para garantir que tudo é capturado
        toJSON() {
            return {
                scale, posX, posY, rotacao,
                camadaAtiva,
                ferramentaAtiva, pincelAtual,
            };
        }
    };
    // ── FIM DO ESTADO GLOBAL ──────────────────────────────────────────────────

    // Histórico de desfazer/refazer
    let historico = [], historicoFuturo = [];
    // Ferramentas extras
    let modoLivre    = false;
    let modoBorracha = false;
    let folhaTravada    = false; // quando true, pan com 1 dedo fica bloqueado
    let menuFerraberto  = false;
    let ferramentaAtiva = 'pen'; // 'pen' | 'livre' | 'borracha'
    let modoFormas   = false;
    let formaAtual   = 'circulo';
    let formaStart   = null; // ponto inicial ao arrastar forma
    let pontosBorracha = []; // pontos da linha de borracha
    // Canvas de pincel livre
    const livreLayer = document.getElementById('livre-layer');
    let livrePathAtual = null; // path SVG sendo desenhado agora
    let livrePathD     = '';   // string do d acumulada
    const formaPreview   = document.getElementById('forma-preview');
    const borrachaLayer  = document.getElementById('borracha-layer');

    function renderizarBorracha() {
        borrachaLayer.innerHTML = '';
        if (pontosBorracha.length === 0) return;
        const ns = 'http://www.w3.org/2000/svg';
        const r1 = 9/scale;

        // Linha tracejada laranja conectando os pontos (como a Pen Tool)
        if (pontosBorracha.length >= 2) {
            const linePath = document.createElementNS(ns, 'path');
            let d = `M ${pontosBorracha[0].x} ${pontosBorracha[0].y}`;
            pontosBorracha.forEach(p => d += ` L ${p.x} ${p.y}`);
            linePath.setAttribute('d', d);
            linePath.setAttribute('stroke', '#ff6600');
            linePath.setAttribute('stroke-width', 2/scale);
            linePath.setAttribute('fill', 'none');
            linePath.setAttribute('stroke-dasharray', `${10/scale},${5/scale}`);
            linePath.setAttribute('stroke-linecap', 'round');
            borrachaLayer.appendChild(linePath);
        }

        // Dica de uso quando há pelo menos 1 ponto
        if (pontosBorracha.length >= 1) {
            const txt = document.createElementNS(ns, 'text');
            const pu = pontosBorracha[pontosBorracha.length - 1];
            txt.setAttribute('x', pu.x + 14/scale);
            txt.setAttribute('y', pu.y - 10/scale);
            txt.setAttribute('fill', '#ff6600');
            txt.setAttribute('font-size', 11/scale);
            txt.setAttribute('font-weight', 'bold');
            if (pontosBorracha.length === 1) txt.textContent = 'toque p/ marcar fim do rasgo';
            else txt.textContent = `${pontosBorracha.length} pontos  •  2x = cortar  •  ↩ = desfazer`;
            borrachaLayer.appendChild(txt);
        }

        // Bolinhas em cada ponto (estilo âncora da Pen Tool)
        pontosBorracha.forEach((p, i) => {
            const isLast = i === pontosBorracha.length - 1;
            const outer = document.createElementNS(ns, 'circle');
            outer.setAttribute('cx', p.x); outer.setAttribute('cy', p.y);
            outer.setAttribute('r', r1);
            outer.setAttribute('fill', isLast ? '#ff6600' : 'white');
            outer.setAttribute('stroke', '#ff6600');
            outer.setAttribute('stroke-width', 2/scale);
            borrachaLayer.appendChild(outer);
            const inner = document.createElementNS(ns, 'circle');
            inner.setAttribute('cx', p.x); inner.setAttribute('cy', p.y);
            inner.setAttribute('r', r1 * 0.45);
            inner.setAttribute('fill', isLast ? 'white' : '#ff6600');
            borrachaLayer.appendChild(inner);
        });
    }

    function aplicarBorracha() {
        if (pontosBorracha.length < 2) return;

        // ═══════════════════════════════════════════════════════════════
        // BORRACHA — Abordagem definitiva
        //
        // O usuário marcou 2 pontos: pb0 e pbN.
        // Esses 2 pontos definem uma LINHA DE CORTE.
        // Para cada traço, verificamos se a linha de corte o intersecta.
        // Se sim, calculamos os 2 pontos de interseção exatos e
        // dividimos o traço em: [início → inter1] e [inter2 → fim].
        //
        // A linha de corte tem espessura = brush-size para garantir
        // que sempre há 2 interseções com o traço (entrada e saída).
        // ═══════════════════════════════════════════════════════════════

        const pb0 = pontosBorracha[0];
        const pbN = pontosBorracha[pontosBorracha.length - 1];
        const brushR = Math.max(parseFloat(document.getElementById('brush-size').value), 8) / scale;

        // Vetor da linha de corte e sua perpendicular
        const lcDx = pbN.x - pb0.x, lcDy = pbN.y - pb0.y;
        const lcLen = Math.hypot(lcDx, lcDy);
        if (lcLen < 1) return;
        const lcNx = lcDx / lcLen, lcNy = lcDy / lcLen;   // unitário paralelo
        const lcPx = -lcNy, lcPy = lcNx;                   // unitário perpendicular

        // Projeta ponto P na direção perpendicular à linha de corte
        // (dist. com sinal: positivo de um lado, negativo do outro)
        function distPerpLC(p) {
            const dx = p.x - pb0.x, dy = p.y - pb0.y;
            return dx * lcPx + dy * lcPy;
        }

        // Projeta ponto P na direção paralela à linha de corte
        // (posição ao longo da linha: 0=pb0, lcLen=pbN)
        function distParalLC(p) {
            const dx = p.x - pb0.x, dy = p.y - pb0.y;
            return dx * lcNx + dy * lcNy;
        }

        // Interpolação linear entre dois pontos
        function lerp(a, b, t) {
            return { x: a.x + t*(b.x-a.x), y: a.y + t*(b.y-a.y), tipo:'ancora' };
        }

        // Projeta P no segmento AB — retorna {t, dist}
        function projSegmento(p, a, b) {
            const dx = b.x-a.x, dy = b.y-a.y, lenSq = dx*dx+dy*dy;
            if (lenSq < 0.0001) return { t:0, dist:Math.hypot(p.x-a.x, p.y-a.y) };
            const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq));
            return { t, dist:Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)) };
        }

        // Dado um traço (array de pontos), retorna os parâmetros t (0..1 em cada
        // segmento) onde a linha de corte (com espessura brushR*2) o cruza.
        // Retorna array de {segIdx, t, x, y} ordenado ao longo do traço.
        function acharIntersecoes(pts) {
            const hits = [];
            for (let i = 0; i < pts.length-1; i++) {
                const a = pts[i], b = pts[i+1];
                const dA = distPerpLC(a);
                const dB = distPerpLC(b);
                // Procura cruzamento de +brushR (borda 1)
                if ((dA - brushR) * (dB - brushR) <= 0 && Math.abs(dB - dA) > 0.0001) {
                    const t = (brushR - dA) / (dB - dA);
                    if (t >= 0 && t <= 1) {
                        const pt = lerp(a, b, t);
                        // Confirma que está dentro da extensão da linha de corte
                        const pParal = distParalLC(pt);
                        if (pParal >= -brushR*2 && pParal <= lcLen + brushR*2)
                            hits.push({segIdx:i, t, x:pt.x, y:pt.y});
                    }
                }
                // Procura cruzamento de -brushR (borda 2)
                if ((dA + brushR) * (dB + brushR) <= 0 && Math.abs(dB - dA) > 0.0001) {
                    const t = (-brushR - dA) / (dB - dA);
                    if (t >= 0 && t <= 1) {
                        const pt = lerp(a, b, t);
                        const pParal = distParalLC(pt);
                        if (pParal >= -brushR*2 && pParal <= lcLen + brushR*2)
                            hits.push({segIdx:i, t, x:pt.x, y:pt.y});
                    }
                }
            }
            // Ordena por posição no traço
            hits.sort((a, b) => a.segIdx !== b.segIdx ? a.segIdx-b.segIdx : a.t-b.t);
            // Remove duplicatas próximas
            const dedup = [];
            for (const h of hits) {
                const last = dedup[dedup.length-1];
                if (!last || last.segIdx !== h.segIdx || Math.abs(last.t-h.t) > 0.01)
                    dedup.push(h);
            }
            return dedup;
        }

        // Dado array de interseções ordenadas, pega a primeira e a última
        // e constrói fragAntes e fragDepois
        function construir(pts, hits) {
            if (hits.length < 2) return null;
            const hA = hits[0];
            const hB = hits[hits.length-1];

            // fragAntes: pts[0..segA] + ponto hA
            const fA = [];
            for (let i = 0; i <= hA.segIdx; i++)
                fA.push({...pts[i], tipo:pts[i].tipo||'ancora'});
            const pA = {x:hA.x, y:hA.y, tipo:'ancora'};
            if (Math.hypot(pA.x-fA[fA.length-1].x, pA.y-fA[fA.length-1].y) > 1)
                fA.push(pA);

            // fragDepois: ponto hB + pts[segB+1..fim]
            const fD = [{x:hB.x, y:hB.y, tipo:'ancora'}];
            for (let i = hB.segIdx+1; i < pts.length; i++)
                fD.push({...pts[i], tipo:pts[i].tipo||'ancora'});
            // Remove duplicata com próximo vértice
            if (fD.length >= 2 && Math.hypot(fD[0].x-fD[1].x, fD[0].y-fD[1].y) < 1)
                fD.shift();

            return { fA, fD };
        }

        // ── Encontra o traço mais próximo da linha de corte ───────────
        // "Mais próximo" = menor distância perpendicular média dos pontos ao longo do traço
        // que ainda tem interseções com a linha de corte.
        // Prioridade: traços que realmente intersectam a linha de corte.

        function distMediaAoTraco(pts) {
            let soma = 0, count = 0;
            for (const p of pts) {
                soma += Math.abs(distPerpLC(p));
                count++;
            }
            return count > 0 ? soma/count : Infinity;
        }

        // Fallback: quando a linha de corte é paralela ao traço,
        // usa projeção direta de pb0 e pbN no traço para gerar os 2 hits.
        function projDireta(p, pts) {
            let best = null;
            for (let i = 0; i < pts.length-1; i++) {
                const dx=pts[i+1].x-pts[i].x, dy=pts[i+1].y-pts[i].y;
                const lenSq=dx*dx+dy*dy;
                if (lenSq < 0.0001) continue;
                const t=Math.max(0,Math.min(1,((p.x-pts[i].x)*dx+(p.y-pts[i].y)*dy)/lenSq));
                const x=pts[i].x+t*dx, y=pts[i].y+t*dy;
                const d=Math.hypot(p.x-x,p.y-y);
                if (!best || d < best.d) best={segIdx:i,t,x,y,d};
            }
            return best;
        }

        function hitsComFallback(pts) {
            let hits = acharIntersecoes(pts);
            if (hits.length >= 2) return hits;
            // Fallback: projeta pb0 e pbN diretamente no traço
            const h0 = projDireta(pb0, pts);
            const hN = projDireta(pbN, pts);
            if (!h0 || !hN) return [];
            // Só usa fallback se os pontos estão razoavelmente próximos do traço
            const limiar = 80 / scale;
            if (h0.d > limiar || hN.d > limiar) return [];
            // Ordena
            const arr = [h0, hN].sort((a,b) => a.segIdx!==b.segIdx ? a.segIdx-b.segIdx : a.t-b.t);
            // Garante que são pontos distintos
            if (arr[0].segIdx===arr[1].segIdx && Math.abs(arr[0].t-arr[1].t)<0.005) return [];
            return arr;
        }

        // ── Pen Tool caminhos ─────────────────────────────────────────
        const caminhos = getCaminhos();

        let melhorCi = -1, melhorHits = null, melhorDist = Infinity;
        for (let ci = 0; ci < caminhos.length; ci++) {
            const pts = caminhos[ci].pontos;
            if (pts.length < 2) continue;
            const hits = hitsComFallback(pts);
            if (hits.length < 2) continue;
            const dist = distMediaAoTraco(pts);
            if (dist < melhorDist) { melhorDist = dist; melhorCi = ci; melhorHits = hits; }
        }

        if (melhorCi >= 0 && melhorHits) {
            const cam = caminhos[melhorCi];
            const resultado = construir(cam.pontos, melhorHits);
            if (resultado) {
                const { fA, fD } = resultado;
                caminhos.splice(melhorCi, 1);
                let ins = melhorCi;
                if (fA.length >= 2) caminhos.splice(ins++, 0, {
                    pontos:fA, fechado:false,
                    stroke:cam.stroke, width:cam.width,
                    opacity:cam.opacity, tipo:cam.tipo
                });
                if (fD.length >= 2) caminhos.splice(ins++, 0, {
                    pontos:fD, fechado:false,
                    stroke:cam.stroke, width:cam.width,
                    opacity:cam.opacity, tipo:cam.tipo
                });
            }
        }

        // ── Pincel livre (paths e grupos como neon) ──────────────────────
        // Coleta elementos candidatos: paths diretos + paths dentro de <g>
        let melhorEl = null, melhorHitsL = null, melhorDistL = Infinity;
        let melhorElGrupo = null; // referência ao <g> pai se o path estiver dentro de um grupo

        function _processarPathEl(el, grupoRaiz) {
            const d = el.getAttribute('d') || '';
            const livPts = [];
            d.trim().split(/(?=[ML])/).forEach(tok => {
                const vals = tok.trim().replace(/^[ML]\s*/,'').split(/[\s,]+/);
                if (vals.length >= 2) livPts.push({x:parseFloat(vals[0]),y:parseFloat(vals[1])});
            });
            if (livPts.length < 2) return;
            const hits = hitsComFallback(livPts);
            if (hits.length < 2) return;
            const dist = distMediaAoTraco(livPts);
            if (dist < melhorDistL) {
                melhorDistL = dist; melhorEl = el;
                melhorHitsL = hits; melhorEl._livPts = livPts;
                melhorElGrupo = grupoRaiz || null;
            }
        }

        [...livreLayer.children].forEach(el => {
            if (el.tagName === 'g' || el.tagName === 'G') {
                // Grupo (ex: neon, aquarela, pelo…) — usa o path principal (maior stroke-width)
                // para hit-test e apaga o grupo inteiro
                let pathPrincipal = null, maxW = -1;
                [...el.querySelectorAll('path')].forEach(p => {
                    const w = parseFloat(p.getAttribute('stroke-width') || '0');
                    // Usa o path que tem mais pontos (caminho real do traço)
                    const d = p.getAttribute('d') || '';
                    const nPts = (d.match(/[ML]/g)||[]).length;
                    if (nPts > maxW) { maxW = nPts; pathPrincipal = p; }
                });
                if (pathPrincipal) _processarPathEl(pathPrincipal, el);
            } else if (el.tagName === 'path') {
                _processarPathEl(el, null);
            }
        });

        if (melhorEl && melhorHitsL) {
            const livPts = melhorEl._livPts;
            // Se o elemento pertence a um grupo (ex: neon), apaga o grupo todo
            // e não tenta reconstruir os fragmentos (glow não tem reconstrução trivial)
            if (melhorElGrupo) {
                melhorElGrupo.remove();
                // Atualiza livreHTML da camada
                if (camadas[camadaAtiva]) camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
            } else {
                const resultado = construir(livPts, melhorHitsL);
                if (resultado) {
                    const { fA, fD } = resultado;
                    const st = melhorEl.getAttribute('stroke')||'#000';
                    const sw = melhorEl.getAttribute('stroke-width')||'2';
                    const so = melhorEl.getAttribute('stroke-opacity')||'1';
                    const lc = melhorEl.getAttribute('stroke-linecap')||'round';
                    const lj = melhorEl.getAttribute('stroke-linejoin')||'round';
                    const fi = melhorEl.getAttribute('filter')||'';
                    const da = melhorEl.getAttribute('stroke-dasharray')||'';
                    function mkPath(pontos) {
                        if (pontos.length < 2) return;
                        const np = document.createElementNS('http://www.w3.org/2000/svg','path');
                        let nd = `M ${pontos[0].x} ${pontos[0].y}`;
                        pontos.slice(1).forEach(p => nd += ` L ${p.x} ${p.y}`);
                        np.setAttribute('d',nd); np.setAttribute('stroke',st);
                        np.setAttribute('stroke-width',sw); np.setAttribute('stroke-opacity',so);
                        np.setAttribute('stroke-linecap',lc); np.setAttribute('stroke-linejoin',lj);
                        np.setAttribute('fill','none');
                        if(fi) np.setAttribute('filter',fi);
                        if(da) np.setAttribute('stroke-dasharray',da);
                        livreLayer.appendChild(np);
                    }
                    melhorEl.remove();
                    mkPath(fA);
                    mkPath(fD);
                }
            }
        }

        caminhoAtivo = -1; pontosPen = []; penLayer.innerHTML = '';
        renderizarTodos();
        pontosBorracha = []; borrachaLayer.innerHTML = '';
    }


    function segmentosSeIntersectam(a, b, c, d2) {
        const dx1 = b.x-a.x, dy1 = b.y-a.y;
        const dx2 = d2.x-c.x, dy2 = d2.y-c.y;
        const denom = dx1*dy2 - dy1*dx2;
        if (Math.abs(denom) < 0.0001) return false;
        const t = ((c.x-a.x)*dy2 - (c.y-a.y)*dx2) / denom;
        const u = ((c.x-a.x)*dy1 - (c.y-a.y)*dx1) / denom;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }
    let hasMovedTap = false, isNewPoint = false, tapStartX = 0, tapStartY = 0;
    let modoPen = false, modoEditar = false;
    let caminhoAtivo = -1, pontosPen = [], pathFechado = false;
    let noArrastado = null;

    // ── SISTEMA DE CAMADAS ────────────────────────────────────────────────────
    // camadaFoto: camada especial (vetorização) — pode ser reordenada no painel
    // camadas[]: camadas de desenho, cada uma tem seus próprios caminhos
    let camadaFoto = { opacidade: 1, visivel: true, svgHTML: '' };
    // fotoOrdem: posição da camada foto na lista (inserida entre as camadas de desenho)
    // -1 = embaixo de tudo (padrão), 0 = acima de todas, etc.
    let fotoOrdem = -1;
    let camadas    = [];          // [{ id, nome, opacidade, visivel, caminhos[] }]
    let camadaAtiva = 0;          // índice da camada ativa
    let idCounter   = 1;

    function criarCamada(nome) {
        return { id: idCounter++, nome: nome || `Camada ${idCounter-1}`,
                 opacidade: 1, visivel: true, caminhos: [], livreHTML: '' };
    }

    // Começa com uma camada padrão
    camadas.push(criarCamada('Camada 1'));

    // Atalho: caminhos da camada ativa
    function getCaminhos() { return camadas[camadaAtiva].caminhos; }

    // ── PINCEL LIVRE ─────────────────────────────────────────────────────────
    function desativarTodos() {
        modoPen = false; modoEditar = false; modoLivre = false;
        modoBorracha = false; modoFormas = false;
        if (modoDegrade) desativarDegrade();
        document.getElementById('btnFerramentas').style.background = '#ff00ff';
        document.getElementById('btnEditar').style.background      = '#333';
        document.getElementById('btnFormas').style.background      = '#333';
        document.getElementById('modal-formas').style.display      = 'none';
        document.getElementById('menu-ferramentas').style.display  = 'none';
        menuFerraberto  = false;
        ferramentaAtiva = 'pen';
        mostrarDicaEditar(false);
    }

    window.toggleLivre    = () => {
        if (modoLivre) {
            // Desseleciona
            modoLivre = false; ferramentaAtiva = '';
            document.getElementById('fBtn-livre').style.background = '#333';
            const _ficEl = document.getElementById('ferr-icon');
            const _flbEl = document.getElementById('ferr-label');
            if (_ficEl) _ficEl.textContent = '🖊';
            if (_flbEl) _flbEl.textContent = 'PEN';
            document.getElementById('menu-ferramentas').style.display = 'none';
            menuFerraberto = false;
        } else { selecionarFerramenta('livre'); }
    };
    window.toggleBorracha = () => {
        if (modoBorracha) {
            // Desseleciona
            modoBorracha = false; ferramentaAtiva = '';
            pontosBorracha = []; borrachaLayer.innerHTML = '';
            document.getElementById('fBtn-borracha').style.background = '#333';
            const _ficEl = document.getElementById('ferr-icon');
            const _flbEl = document.getElementById('ferr-label');
            if (_ficEl) _ficEl.textContent = '🖊';
            if (_flbEl) _flbEl.textContent = 'PEN';
            document.getElementById('menu-ferramentas').style.display = 'none';
            menuFerraberto = false;
        } else { selecionarFerramenta('borracha'); }
    };

    window.toggleFormas = () => {
        const ativo = modoFormas;
        desativarTodos();
        if (!ativo) {
            modoFormas = true;
            document.getElementById('btnFormas').style.background = '#aa00ff';
            document.getElementById('modal-formas').style.display = 'flex';
        }
    };

    window.fecharFormas = () => {
        modoFormas = false;
        document.getElementById('btnFormas').style.background  = '#333';
        document.getElementById('modal-formas').style.display  = 'none';
    };

    window.selecionarForma = (f) => {
        formaAtual = f;
        ['circulo','retangulo','triangulo','linha'].forEach(n => {
            document.getElementById('fBtn-' + n).style.background =
                n === f ? '#03dac6' : '#333';
        });
    };

    // Desenha forma no SVG draw-layer
    function criarElementoForma(ns, x1, y1, x2, y2) {
        let el;
        if (formaAtual === 'circulo') {
            el = document.createElementNS(ns, 'ellipse');
            el.setAttribute('cx', (x1+x2)/2); el.setAttribute('cy', (y1+y2)/2);
            el.setAttribute('rx', Math.abs(x2-x1)/2); el.setAttribute('ry', Math.abs(y2-y1)/2);
        } else if (formaAtual === 'retangulo') {
            el = document.createElementNS(ns, 'rect');
            el.setAttribute('x', Math.min(x1,x2)); el.setAttribute('y', Math.min(y1,y2));
            el.setAttribute('width', Math.abs(x2-x1)); el.setAttribute('height', Math.abs(y2-y1));
        } else if (formaAtual === 'triangulo') {
            el = document.createElementNS(ns, 'polygon');
            el.setAttribute('points', `${(x1+x2)/2},${y1} ${x1},${y2} ${x2},${y2}`);
        } else if (formaAtual === 'linha') {
            el = document.createElementNS(ns, 'line');
            el.setAttribute('x1', x1); el.setAttribute('y1', y1);
            el.setAttribute('x2', x2); el.setAttribute('y2', y2);
        }
        return el;
    }

    function aplicarEstiloForma(el) {
        const cor = document.getElementById('col-main').value;
        const tam = document.getElementById('brush-size').value;
        const op  = document.getElementById('brush-opacity').value;
        el.setAttribute('stroke', cor);
        el.setAttribute('stroke-width', tam);
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke-opacity', op);
        el.setAttribute('stroke-linecap', 'round');
    }

    function atualizarPreviewForma(x2, y2) {
        formaPreview.innerHTML = '';
        if (!formaStart) return;
        const ns = 'http://www.w3.org/2000/svg';
        const el = criarElementoForma(ns, formaStart.x, formaStart.y, x2, y2);
        if (!el) return;
        aplicarEstiloForma(el);
        el.setAttribute('stroke-dasharray', '8,4'); // tracejado para indicar preview
        formaPreview.appendChild(el);
    }

    function desenharForma(x1, y1, x2, y2) {
        formaPreview.innerHTML = '';
        const ns = 'http://www.w3.org/2000/svg';
        const el = criarElementoForma(ns, x1, y1, x2, y2);
        if (!el) return;
        aplicarEstiloForma(el);
        salvarHistorico();
        livreLayer.appendChild(el);
        if (camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // SISTEMA DE PINCÉIS — 100% SVG vetorial
    // ══════════════════════════════════════════════════════════════════════
    let pincelAtual = 'normal';
    let menuPinceisAberto = false;
    let pincelDesenhando = false;
    let pincelUltX = null, pincelUltY = null;
    let pincelGrupoAtual = null;
    let pincelPathPrincipal = null;
    let pincelPathD = '';
    let pincelPontosAcum = []; // pontos acumulados para pincéis que precisam

    const NS = 'http://www.w3.org/2000/svg';
    function mkEl(tag, attrs) {
        const el = document.createElementNS(NS, tag);
        for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    }
    function getCor()  { return document.getElementById('col-main').value; }
    function getTam()  { return parseFloat(document.getElementById('brush-size').value); }
    function getTamReal() { return getTam() / scale; } // tamanho real compensado pelo zoom
    function getOpac() { return parseFloat(document.getElementById('brush-opacity').value); }
    function hexToRgb(hex) {
        return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) };
    }
    function corMais(hex, d) {
        const {r,g,b} = hexToRgb(hex);
        const c = v => Math.min(255,Math.max(0,v+d)).toString(16).padStart(2,'0');
        return '#'+c(r)+c(g)+c(b);
    }

    // Helpers SVG
    function svgLine(x1,y1,x2,y2,cor,w,op,linecap,dash) {
        return mkEl('line',{x1,y1,x2,y2,stroke:cor,'stroke-width':w,
            'stroke-opacity':op??1,'stroke-linecap':linecap||'round',
            'stroke-dasharray':dash||'','fill':'none'});
    }
    function svgCircle(cx,cy,r,fill,op) {
        return mkEl('circle',{cx,cy,r,fill,opacity:op??1});
    }
    function svgPath(d,cor,w,op,linecap,dash,linejoin) {
        return mkEl('path',{d,stroke:cor,'stroke-width':w,'stroke-opacity':op??1,
            'stroke-linecap':linecap||'round','stroke-linejoin':linejoin||'round',
            'stroke-dasharray':dash||'','fill':'none'});
    }

    // Constrói path suavizado (Catmull-Rom simplificado) a partir de array de pontos
    function pontosParaPath(pts) {
        if (pts.length < 2) return '';
        // Para traços longos, só recalcula o segmento final (incremental)
        // O path completo é construído apenas quando necessário
        let d = `M${pts[0].x} ${pts[0].y}`;
        const n = pts.length;
        // Subsampling: para traços muito longos, pula pontos intermediários
        // mantendo o início, fim e pontos a cada N
        const step = n > 200 ? Math.floor(n / 150) : 1;
        for (let i = step; i < n; i += (i < n - 2 ? step : 1)) {
            const prev = pts[Math.max(0, i - step)], curr = pts[i];
            if (i <= step) {
                d += ` L${curr.x} ${curr.y}`;
            } else {
                const prev2 = pts[Math.max(0, i - step * 2)];
                const next  = pts[Math.min(n - 1, i + step)];
                const cpx  = prev.x + (curr.x - prev2.x) / 6;
                const cpy  = prev.y + (curr.y - prev2.y) / 6;
                const cp2x = curr.x - (next.x - prev.x) / 6;
                const cp2y = curr.y - (next.y - prev.y) / 6;
                d += ` C${cpx} ${cpy} ${cp2x} ${cp2y} ${curr.x} ${curr.y}`;
            }
        }
        // Garante que o último ponto sempre está incluído
        const last = pts[n - 1];
        if (n > 1) d += ` L${last.x} ${last.y}`;
        return d;
    }

    // Garante filtro blur no livreLayer defs
    function garantirFiltroBlur(id, desvio) {
        let defs = livreLayer.querySelector('defs');
        if (!defs) { defs = mkEl('defs',{}); livreLayer.prepend(defs); }
        if (!defs.querySelector('#'+id)) {
            const f = mkEl('filter',{id, x:'-30%', y:'-30%', width:'160%', height:'160%'});
            f.appendChild(mkEl('feGaussianBlur',{in:'SourceGraphic', stdDeviation:desvio}));
            defs.appendChild(f);
        }
    }

    // ── Definição dos pincéis ─────────────────────────────────────────────
    const PINCEIS = {

        normal: {
            iniciar(x,y) {
                pincelPathD = `M${x} ${y}`;
                pincelPathPrincipal = svgPath(pincelPathD,getCor(),getTam(),getOpac(),'round');
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual.appendChild(pincelPathPrincipal);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                pincelPathD = pontosParaPath(pincelPontosAcum);
                pincelPathPrincipal.setAttribute('d', pincelPathD);
            },
            finalizar() {}
        },

        marcador: {
            iniciar(x,y) {
                pincelPathD = `M${x} ${y}`;
                pincelPathPrincipal = svgPath(pincelPathD,getCor(),getTam()*1.8,1,'square','','miter');
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual.appendChild(pincelPathPrincipal);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                pincelPathD = pontosParaPath(pincelPontosAcum);
                pincelPathPrincipal.setAttribute('d', pincelPathD);
            },
            finalizar() {}
        },

        tracejado: {
            iniciar(x,y) {
                const t = getTam();
                pincelPathD = `M${x} ${y}`;
                pincelPathPrincipal = svgPath(pincelPathD,getCor(),t,getOpac(),'round',`${t*2} ${t*1.5}`);
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual.appendChild(pincelPathPrincipal);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                pincelPathD = pontosParaPath(pincelPontosAcum);
                pincelPathPrincipal.setAttribute('d', pincelPathD);
            },
            finalizar() {}
        },

        caligrafia: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y,px,py) {
                const t=getTam(), op=getOpac(), cor=getCor();
                const dx=x-px, dy=y-py;
                const ang = Math.atan2(dy,dx);
                const fator = Math.abs(Math.sin(ang - Math.PI/4));
                const esp = Math.max(0.5, t*0.25 + t*1.75*fator);
                pincelGrupoAtual.appendChild(svgLine(px,py,x,y,cor,esp,op,'round'));
                pincelPontosAcum.push({x,y});
            },
            finalizar() {}
        },

        aquarela: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
                const t=getTam(), cor=getCor();
                // 4 paths com offsets fixos — cada um acumula seus próprios pontos
                pincelGrupoAtual._camadas = Array.from({length:4}, (_,i) => {
                    const ox=(Math.random()-0.5)*t*0.5, oy=(Math.random()-0.5)*t*0.5;
                    const p = svgPath(`M${x+ox} ${y+oy}`, cor,
                        t*(0.6+Math.random()*1.0), 0.018+Math.random()*0.035, 'round');
                    p._ox=ox; p._oy=oy;
                    p._pts=[{x:x+ox,y:y+oy}]; // pontos próprios com offset aplicado
                    pincelGrupoAtual.appendChild(p);
                    return p;
                });
                pincelGrupoAtual._centro = svgPath(`M${x} ${y}`,cor,t*0.12,0.04,'round');
                pincelGrupoAtual._centroPts = [{x,y}];
                pincelGrupoAtual.appendChild(pincelGrupoAtual._centro);
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                // Cada camada acumula seus pontos com offset — sem regex
                pincelGrupoAtual._camadas.forEach(p => {
                    p._pts.push({x: x+p._ox, y: y+p._oy});
                    p.setAttribute('d', pontosParaPath(p._pts));
                });
                pincelGrupoAtual._centroPts.push({x,y});
                pincelGrupoAtual._centro.setAttribute('d', pontosParaPath(pincelGrupoAtual._centroPts));
            },
            finalizar() {}
        },

        carvao: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual._elCount = 0;
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
                pincelPathPrincipal = svgPath(`M${x} ${y}`,getCor(),getTam(),getOpac()*0.45,'round');
                pincelGrupoAtual.appendChild(pincelPathPrincipal);
            },
            continuar(x,y,px,py) {
                const t=getTam(), cor=getCor();
                pincelPontosAcum.push({x,y});
                pincelPathPrincipal.setAttribute('d', pontosParaPath(pincelPontosAcum));
                const dist = Math.hypot(x-px,y-py);
                if (dist > 4 && pincelGrupoAtual._elCount < 2000) {
                    const n = Math.min(Math.floor(t * 0.4), 8); // cap grãos
                    for (let j=0;j<n;j++) {
                        const ox=(Math.random()-0.5)*t*1.6, oy=(Math.random()-0.5)*t*1.6;
                        pincelGrupoAtual.appendChild(
                            svgCircle(x+ox,y+oy,Math.random()*1.0+0.2,cor,Math.random()*0.2));
                        pincelGrupoAtual._elCount++;
                    }
                }
            },
            finalizar() {}
        },

        giz: {
            iniciar(x,y) {
                garantirFiltroBlur('giz-blur','0.9');
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual._elCount = 0;
                const gGlow = mkEl('g',{filter:'url(#giz-blur)', opacity:'0.7'});
                pincelPathPrincipal = svgPath(`M${x} ${y}`,getCor(),getTam()*1.8,0.18,'round');
                gGlow.appendChild(pincelPathPrincipal);
                const gGraos = mkEl('g',{});
                pincelGrupoAtual._gGlow = gGlow;
                pincelGrupoAtual._gGraos = gGraos;
                pincelGrupoAtual.appendChild(gGlow);
                pincelGrupoAtual.appendChild(gGraos);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y,px,py) {
                const t=getTam(), cor=getCor();
                pincelPontosAcum.push({x,y});
                pincelPathPrincipal.setAttribute('d', pontosParaPath(pincelPontosAcum));
                const dist = Math.hypot(x-px,y-py);
                if (dist > 5 && pincelGrupoAtual._elCount < 1500) {
                    for (let j=0;j<2;j++) { // era 3, agora 2
                        pincelGrupoAtual._gGraos.appendChild(
                            svgCircle(x+(Math.random()-0.5)*t*1.2, y+(Math.random()-0.5)*t*1.2,
                                Math.random()*1.2+0.3, cor, Math.random()*0.09));
                        pincelGrupoAtual._elCount++;
                    }
                }
            },
            finalizar() {}
        },

        oleo: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                const t=getTam(), cor=getCor(), op=getOpac();
                pincelPathPrincipal = svgPath(`M${x} ${y}`,cor,t,op*0.9,'round');
                const hl = svgPath(`M${x} ${y}`,corMais(cor,70),t*0.28,op*0.2,'round');
                pincelGrupoAtual._hl = hl;
                pincelGrupoAtual.appendChild(pincelPathPrincipal);
                pincelGrupoAtual.appendChild(hl);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                const d = pontosParaPath(pincelPontosAcum);
                pincelPathPrincipal.setAttribute('d',d);
                pincelGrupoAtual._hl.setAttribute('d',d);
            },
            finalizar() {}
        },

        neon: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                const cor=getCor(), t=getTam(), op=getOpac();
                const d = `M${x} ${y}`;
                // 4 camadas de glow puro por opacidade — SEM filtro (evita caixa)
                // Halo externo bem difuso
                const g1 = svgPath(d,cor,t*7,op*0.04,'round');
                // Glow largo
                const g2 = svgPath(d,cor,t*4,op*0.09,'round');
                // Glow médio
                const g3 = svgPath(d,cor,t*2,op*0.22,'round');
                // Glow interno
                const g4 = svgPath(d,cor,t*1,op*0.55,'round');
                // Núcleo branco brilhante
                const g5 = svgPath(d,corMais(cor,120),t*0.35,1,'round');
                pincelGrupoAtual._els = [g1,g2,g3,g4,g5];
                [g1,g2,g3,g4,g5].forEach(el => pincelGrupoAtual.appendChild(el));
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                const d = pontosParaPath(pincelPontosAcum);
                pincelGrupoAtual._els.forEach(el => el.setAttribute('d',d));
            },
            finalizar() {}
        },

        spray: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual._elCount = 0;
                livreLayer.appendChild(pincelGrupoAtual);
            },
            continuar(x,y,px,py) {
                const t=getTam(), op=getOpac(), cor=getCor();
                const dist = Math.hypot(x-px,y-py);
                // Limita elementos máximos por grupo para não travar
                if (pincelGrupoAtual._elCount > 3000) return;
                const steps = Math.max(1, Math.floor(dist/8)); // menos steps
                for (let s=0;s<steps;s++) {
                    const tt=s/steps, bx=px+tt*(x-px), by=py+tt*(y-py);
                    const qtd = Math.min(Math.floor(t*1.2), 20); // cap de partículas
                    for (let i=0;i<qtd;i++) {
                        const ang=Math.random()*Math.PI*2;
                        const rad=Math.random()*t*1.5;
                        const fade=1-rad/(t*1.5);
                        pincelGrupoAtual.appendChild(
                            svgCircle(bx+Math.cos(ang)*rad, by+Math.sin(ang)*rad,
                                Math.random()*1.0+0.2, cor, op*(0.08+Math.random()*0.3)*fade));
                        pincelGrupoAtual._elCount++;
                    }
                }
            },
            finalizar() {}
        },

        pelo: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
                const t=getTam(), cor=getCor(), op=getOpac();
                const nFilos = Math.max(4, Math.floor(t/2));
                // Cada fio tem: offset lateral, leveza (largura), e pequeno desvio individual
                // para simular fios de cabelo reais que não são perfeitamente paralelos
                pincelGrupoAtual._filos = Array.from({length:nFilos}, (_,i) => {
                    const frac = i/(nFilos-1); // 0..1
                    const offset = (frac-0.5)*t; // distribuição lateral uniforme
                    // Fios das bordas são mais finos e transparentes (efeito natural)
                    const bordaFator = 1 - Math.abs(frac-0.5)*1.6;
                    const espessura = Math.max(0.3, (0.3+Math.random()*0.8)*bordaFator);
                    const opacidade = op * Math.max(0.1, (0.25+Math.random()*0.55)*bordaFator);
                    // Desvio aleatório fixo por fio (simula fios individuais)
                    const desvioX = (Math.random()-0.5)*t*0.15;
                    const desvioY = (Math.random()-0.5)*t*0.15;
                    const p = svgPath(`M${x} ${y}`, cor, espessura, opacidade, 'round');
                    p._offset = offset;
                    p._desvioX = desvioX;
                    p._desvioY = desvioY;
                    p._pts = [{x,y}]; // pontos próprios de cada fio
                    pincelGrupoAtual.appendChild(p);
                    return p;
                });
            },
            continuar(x,y,px,py) {
                const dx=x-px, dy=y-py, len=Math.hypot(dx,dy)||1;
                const nx=-dy/len, ny=dx/len; // perpendicular ao movimento
                pincelPontosAcum.push({x,y});
                pincelGrupoAtual._filos.forEach(filo => {
                    // Posição lateral do fio
                    const ox = nx*filo._offset + filo._desvioX;
                    const oy = ny*filo._offset + filo._desvioY;
                    // Pequena variação por ponto para dar naturalidade
                    const jx = (Math.random()-0.5)*0.8;
                    const jy = (Math.random()-0.5)*0.8;
                    filo._pts.push({x: x+ox+jx, y: y+oy+jy});
                    filo.setAttribute('d', pontosParaPath(filo._pts));
                });
            },
            finalizar() {}
        },

        estrela: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                livreLayer.appendChild(pincelGrupoAtual);
                // Traço base fino
                pincelPathPrincipal = svgPath(`M${x} ${y}`,getCor(),getTam()*0.2,getOpac()*0.2,'round');
                pincelGrupoAtual.appendChild(pincelPathPrincipal);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y,px,py) {
                const t=getTam(), op=getOpac(), cor=getCor();
                pincelPontosAcum.push({x,y});
                pincelPathPrincipal.setAttribute('d', pontosParaPath(pincelPontosAcum));
                // Faíscas esporádicas (só 40% das iterações)
                const dist=Math.hypot(x-px,y-py);
                if (dist > 8 && Math.random()<0.4) {
                    const sz=(0.5+Math.random()*1.2)*t*0.28;
                    const bright=corMais(cor,90);
                    const bx=x+(Math.random()-0.5)*t*0.6, by=y+(Math.random()-0.5)*t*0.6;
                    for (let k=0;k<4;k++) {
                        const ang=k*Math.PI/4;
                        pincelGrupoAtual.appendChild(svgLine(
                            bx-Math.cos(ang)*sz,by-Math.sin(ang)*sz,
                            bx+Math.cos(ang)*sz,by+Math.sin(ang)*sz,
                            bright,0.6,op*(0.5+Math.random()*0.5),'round'));
                    }
                }
            },
            finalizar() {}
        },

        lasso: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                const cor=getCor(), op=getOpac();
                // Path de preenchimento — fecha automaticamente com Z
                const fill = mkEl('path',{
                    d:`M${x} ${y}`, fill:cor,
                    'fill-opacity': op, stroke:'none'
                });
                // Contorno tracejado fino só durante o desenho (some no finalizar)
                const contorno = mkEl('path',{
                    d:`M${x} ${y}`, fill:'none',
                    stroke:cor, 'stroke-width': 1/scale,
                    'stroke-opacity':0.5,
                    'stroke-dasharray':`${4/scale} ${3/scale}`,
                    'stroke-linecap':'round'
                });
                pincelGrupoAtual._fill = fill;
                pincelGrupoAtual._contorno = contorno;
                pincelGrupoAtual.appendChild(fill);
                pincelGrupoAtual.appendChild(contorno);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y) {
                pincelPontosAcum.push({x,y});
                // Path suavizado + fechado = preenchimento em tempo real
                const d = pontosParaPath(pincelPontosAcum) + ' Z';
                pincelGrupoAtual._fill.setAttribute('d', d);
                pincelGrupoAtual._contorno.setAttribute('d', d);
            },
            finalizar() {
                // Remove contorno, mantém só o preenchimento
                if (pincelGrupoAtual && pincelGrupoAtual._contorno)
                    pincelGrupoAtual._contorno.remove();
            }
        },

        pontilhismo: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
                pincelGrupoAtual.appendChild(svgCircle(x,y,getTam()*0.48,getCor(),getOpac()));
            },
            continuar(x,y,px,py) {
                const t=getTam(), op=getOpac(), cor=getCor();
                const dist=Math.hypot(x-px,y-py);
                // Só adiciona ponto se andou o suficiente (evita bolinhas empilhadas)
                if (dist >= t*0.9) {
                    pincelGrupoAtual.appendChild(svgCircle(x,y,t*0.48,cor,op*(0.6+Math.random()*0.4)));
                    pincelPontosAcum.push({x,y});
                }
            },
            finalizar() {}
        },

        risco: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                pincelGrupoAtual._elCount = 0;
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y,px,py) {
                const t=getTam(), op=getOpac(), cor=getCor();
                const dist=Math.hypot(x-px,y-py);
                if (dist > 4 && pincelGrupoAtual._elCount < 2000) {
                    const n=Math.min(Math.max(2,Math.floor(t/3)), 10); // cap
                    for (let i=0;i<n;i++) {
                        const ox=(Math.random()-0.5)*t, oy=(Math.random()-0.5)*t;
                        pincelGrupoAtual.appendChild(svgLine(
                            px+ox,py+oy,x+ox,y+oy,
                            cor,0.4+Math.random()*0.8,op*(0.12+Math.random()*0.3),'round'));
                        pincelGrupoAtual._elCount++;
                    }
                    pincelPontosAcum.push({x,y});
                }
            },
            finalizar() {}
        },

        duplo: {
            iniciar(x,y) {
                pincelGrupoAtual = mkEl('g',{});
                const t=getTam(), cor=getCor(), op=getOpac();
                const l1 = svgPath(`M${x} ${y}`,cor,Math.max(0.5,t*0.35),op,'round');
                const l2 = svgPath(`M${x} ${y}`,cor,Math.max(0.5,t*0.35),op,'round');
                pincelGrupoAtual._l1=l1; pincelGrupoAtual._l2=l2;
                pincelGrupoAtual._d1=`M${x} ${y}`; pincelGrupoAtual._d2=`M${x} ${y}`;
                pincelGrupoAtual.appendChild(l1); pincelGrupoAtual.appendChild(l2);
                livreLayer.appendChild(pincelGrupoAtual);
                pincelPontosAcum = [{x,y}];
            },
            continuar(x,y,px,py) {
                const t=getTam();
                const dx=x-px, dy=y-py, len=Math.hypot(dx,dy)||1;
                const nx=-dy/len*t*0.65, ny=dx/len*t*0.65;
                pincelGrupoAtual._d1+=` L${x+nx} ${y+ny}`;
                pincelGrupoAtual._d2+=` L${x-nx} ${y-ny}`;
                pincelGrupoAtual._l1.setAttribute('d',pincelGrupoAtual._d1);
                pincelGrupoAtual._l2.setAttribute('d',pincelGrupoAtual._d2);
                pincelPontosAcum.push({x,y});
            },
            finalizar() {}
        },
    };

    // ── Ciclo de vida do pincel ────────────────────────────────────────────
    function iniciarPincel(x,y) {
        pincelDesenhando=true;
        pincelUltX=x; pincelUltY=y;
        pincelPathD=''; pincelPathPrincipal=null; pincelGrupoAtual=null;
        const p=PINCEIS[pincelAtual]||PINCEIS.normal;
        p.iniciar(x,y);
    }

    // ── Throttle de desenho via RAF ────────────────────────────────────────
    let _pincelRAFPendente = false;
    let _pincelPendX = 0, _pincelPendY = 0;
    const PINCEL_MIN_DIST = 2; // pixels mínimos entre pontos acumulados

    function continuarPincel(x,y) {
        if (!pincelDesenhando) return;
        // Filtra pontos muito próximos para não acumular pontos demais
        const dxMin = x - pincelUltX, dyMin = y - pincelUltY;
        if (Math.hypot(dxMin, dyMin) < PINCEL_MIN_DIST) return;
        _pincelPendX = x; _pincelPendY = y;
        if (_pincelRAFPendente) return; // já tem frame agendado
        _pincelRAFPendente = true;
        requestAnimationFrame(() => {
            _pincelRAFPendente = false;
            if (!pincelDesenhando) return;
            const px = pincelUltX, py = pincelUltY;
            const p = PINCEIS[pincelAtual] || PINCEIS.normal;
            p.continuar(_pincelPendX, _pincelPendY, px, py);
            pincelUltX = _pincelPendX; pincelUltY = _pincelPendY;
        });
    }

    function finalizarPincel() {
        if (!pincelDesenhando) return;
        // Cancela RAF pendente — aplica o último ponto diretamente antes de finalizar
        _pincelRAFPendente = false;
        const p=PINCEIS[pincelAtual]||PINCEIS.normal;
        // Aplica último ponto pendente se houver
        if (_pincelPendX !== pincelUltX || _pincelPendY !== pincelUltY) {
            p.continuar(_pincelPendX, _pincelPendY, pincelUltX, pincelUltY);
            pincelUltX = _pincelPendX; pincelUltY = _pincelPendY;
        }
        p.finalizar();
        pincelDesenhando=false;
        // FIX: Só salva o traço se o usuário realmente moveu o dedo (mais de 1 ponto acumulado)
        // Isso evita criar linhas fantasmas ao clicar sem arrastar
        const temMovimento = pincelPontosAcum && pincelPontosAcum.length > 1;
        if (pincelGrupoAtual && camadas[camadaAtiva] && temMovimento) {
            camadas[camadaAtiva].livreHTML = (camadas[camadaAtiva].livreHTML||'') + pincelGrupoAtual.outerHTML;
        } else if (pincelGrupoAtual && !temMovimento) {
            // Remove o grupo do SVG sem salvar (era só um toque sem movimento)
            pincelGrupoAtual.remove();
        }
        pincelGrupoAtual=null; pincelPathPrincipal=null;
        if (temMovimento) salvarHistorico(); // snapshot pós-pincelada para undo funcionar
    }

    // ── Preview dos pincéis no menu ────────────────────────────────────────
    function desenharPreviews(lista) {
        const todos=['normal','marcador','tracejado','caligrafia','aquarela','carvao','giz','oleo','neon','spray','pelo','estrela','lasso','pontilhismo','risco','duplo'];
        (lista||todos).forEach(id=>{
            const c=document.getElementById('prev-'+id);
            if(!c) return;
            c.width=48; c.height=14;
            const ctx=c.getContext('2d');
            ctx.clearRect(0,0,48,14);
            ctx.fillStyle='#1e1e1e'; ctx.fillRect(0,0,48,14);
            // Cria mini SVG, renderiza pincel, converte para imagem
            const svg=document.createElementNS(NS,'svg');
            svg.setAttribute('width','48'); svg.setAttribute('height','14');
            svg.setAttribute('xmlns',NS);
            // Define filtro neon no mini SVG
            const defs=mkEl('defs',{});
            const f=mkEl('filter',{id:'neon-glow'});
            const fb=mkEl('feGaussianBlur',{stdDeviation:'2',result:'blur'});
            const fm=mkEl('feMerge',{});
            const fn1=mkEl('feMergeNode',{in:'blur'});
            const fn2=mkEl('feMergeNode',{in:'SourceGraphic'});
            fm.appendChild(fn1); fm.appendChild(fn2);
            f.appendChild(fb); f.appendChild(fm);
            defs.appendChild(f); svg.appendChild(defs);
            // Cor e tamanho para preview
            const corOrig=getCor(), tamOrig=getTam(), opOrig=getOpac();
            document.getElementById('col-main').value='#03dac6';
            document.getElementById('brush-size').value=3;
            document.getElementById('brush-opacity').value=1;
            // Simula traço de 4→44 no y=7
            const p=PINCEIS[id]||PINCEIS.normal;
            // Usa livreLayer temporário
            const tmpLayer={_els:[], appendChild(el){this._els.push(el);}, prepend(){}};
            const origLivre=livreLayer;
            // Hack: redireciona appendChild do livreLayer temporariamente
            const origAppend=livreLayer.appendChild.bind(livreLayer);
            const addedEls=[];
            livreLayer.appendChild=el=>{addedEls.push(el); svg.appendChild(el);};
            livreLayer.querySelector=()=>null;
            livreLayer.prepend=()=>{};
            // Iniciar
            pincelGrupoAtual=null; pincelPathPrincipal=null; pincelPathD='';
            p.iniciar(4,7);
            for (let xi=6;xi<=44;xi+=3) p.continuar(xi,7,xi-3,7);
            p.finalizar();
            // Restaura
            livreLayer.appendChild=origAppend;
            livreLayer.querySelector=origLivre.querySelector.bind(origLivre);
            livreLayer.prepend=origLivre.prepend.bind(origLivre);
            pincelGrupoAtual=null; pincelPathPrincipal=null; pincelPathD='';
            // Serializa SVG e desenha no canvas
            const svgStr=new XMLSerializer().serializeToString(svg);
            const blob=new Blob([svgStr],{type:'image/svg+xml'});
            const url=URL.createObjectURL(blob);
            const img=new Image();
            img.onload=()=>{ctx.drawImage(img,0,0,48,14); URL.revokeObjectURL(url);};
            img.src=url;
            document.getElementById('col-main').value=corOrig;
            document.getElementById('brush-size').value=tamOrig;
            document.getElementById('brush-opacity').value=opOrig;
        });
    }

    // ── Toggle / selecionar ────────────────────────────────────────────────
    window.toggleMenuPinceis = () => {
        togglePopup('popup-pinceis-wrap');
        if (document.getElementById('popup-pinceis-wrap').classList.contains('aberto')) {
            trocarAba('basico');
        }
    };

    window.fecharMenuPinceis=()=>{
        fecharTodosPopups();
    };

    window.trocarAba=(aba)=>{
        ['basico','artistico','especial','textura'].forEach(g=>{
            document.getElementById('grupo-'+g).style.display=g===aba?'flex':'none';
            document.getElementById('aba-'+g).classList.toggle('ativa',g===aba);
        });
        const grupos={
            basico:['normal','marcador','tracejado'],
            artistico:['caligrafia','aquarela','carvao','giz','oleo'],
            especial:['neon','spray','pelo','estrela','lasso'],
            textura:['pontilhismo','risco','duplo']
        };
        desenharPreviews(grupos[aba]||[]);
    };

    window.selecionarPincel=(id,el)=>{
        document.querySelectorAll('#menu-pinceis .pincel-btn').forEach(b=>b.classList.remove('ativo'));
        if(el) el.classList.add('ativo');
        pincelAtual=id;
        fecharMenuPinceis();
    };


    // ══════════════════════════════════════════════════════════════════════
    // FERRAMENTA DEGRADÊ — Linear e Radial, 100% SVG vetorial
    // ══════════════════════════════════════════════════════════════════════
    let modoDegrade   = false;
    let degradeStart  = null;
    let degradeNCores = 2;         // 2, 3 ou 4
    let degradeTipo   = 'linear';  // 'linear' | 'radial'
    let degradeFill   = 'tela';    // 'tela' | 'camada'
    let degradeIdCnt  = 0;

    // Retorna array de cores atuais do degradê
    function getDegradeCores() {
        const cores = [];
        for (let i = 0; i < degradeNCores; i++) {
            const el = document.getElementById('dg-c'+i);
            if (el) cores.push(el.value);
        }
        return cores;
    }

    window.abrirModalDegrade = () => {
        document.getElementById('modal-degrade').classList.add('aberto');
        setNCores(degradeNCores); // restaura estado
        atualizarPreviewDegrade();
    };

    function setNCores(n) {
        degradeNCores = n;
        [2,3,4].forEach(i => {
            const btn = document.getElementById('dg-n'+i);
            const ativo = i === n;
            btn.style.border = ativo ? '2px solid #03dac6' : '1px solid #333';
            btn.style.background = ativo ? '#1e2e2e' : '#2a2a2a';
            btn.style.color = ativo ? '#03dac6' : '#888';
        });
        // Mostra/oculta seletores de cor
        document.getElementById('dg-sep2').style.display  = n >= 3 ? 'block' : 'none';
        document.getElementById('dg-wrap2').style.display = n >= 3 ? 'flex' : 'none';
        document.getElementById('dg-sep3').style.display  = n >= 4 ? 'block' : 'none';
        document.getElementById('dg-wrap3').style.display = n >= 4 ? 'flex' : 'none';
        atualizarPreviewDegrade();
    }
    window.fecharModalDegrade = () => {
        document.getElementById('modal-degrade').classList.remove('aberto');
    };

    window.setTipoDegrade = (t) => {
        degradeTipo = t;
        _dgPrevReset(); // Reseta cache para forçar reinicialização com o novo tipo
        document.getElementById('dg-btn-linear').style.cssText +=
            t==='linear' ? ';border:2px solid #03dac6;background:#1e2e2e;color:#03dac6'
                         : ';border:1px solid #333;background:#2a2a2a;color:#888';
        document.getElementById('dg-btn-radial').style.cssText +=
            t==='radial' ? ';border:2px solid #03dac6;background:#1e2e2e;color:#03dac6'
                         : ';border:1px solid #333;background:#2a2a2a;color:#888';
        atualizarPreviewDegrade();
    };

    window.setFillDegrade = (f) => {
        degradeFill = f;
        document.getElementById('dg-btn-tela').style.cssText +=
            f==='tela'   ? ';border:2px solid #03dac6;background:#1e2e2e;color:#03dac6'
                         : ';border:1px solid #333;background:#2a2a2a;color:#888';
        document.getElementById('dg-btn-camada').style.cssText +=
            f==='camada' ? ';border:2px solid #03dac6;background:#1e2e2e;color:#03dac6'
                         : ';border:1px solid #333;background:#2a2a2a;color:#888';
    };

    window.atualizarPreviewDegrade = () => {
        const cores = getDegradeCores();
        if (cores.length === 0) return;
        const canvas = document.getElementById('degrade-preview-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,240,56);
        let grad;
        if (degradeTipo === 'radial') {
            grad = ctx.createRadialGradient(120,28,0,120,28,110);
        } else {
            grad = ctx.createLinearGradient(0,0,240,0);
        }
        cores.forEach((c, i) => {
            grad.addColorStop(i / (cores.length - 1), c);
        });
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,240,56);
        // Reseta cache do preview SVG para que as novas cores sejam usadas ao desenhar
        _dgPrevInited = false;
        if (_dgPrevGrad) {
            // Atualiza stops do gradiente de preview SVG em tempo real se já existir
            while (_dgPrevGrad.firstChild) _dgPrevGrad.removeChild(_dgPrevGrad.firstChild);
            cores.forEach((c, i) => {
                const s = document.createElementNS(NS,'stop');
                s.setAttribute('offset', (i/(cores.length-1)*100).toFixed(1)+'%');
                s.setAttribute('stop-color', c);
                _dgPrevGrad.appendChild(s);
            });
            _dgPrevInited = true; // mantém o preview vivo com as novas cores
        }
    };

    // Atualiza preview do degradê ao mudar qualquer cor ou nº de cores
    ['dg-c0','dg-c1','dg-c2','dg-c3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => atualizarPreviewDegrade());
    });
    ['dg-n2','dg-n3','dg-n4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => {
            setNCores(parseInt(id.replace('dg-n','')));
        });
    });

    window.confirmarDegrade = () => {
        fecharModalDegrade();
        modoDegrade = true;
        degradeStart = null;
        document.getElementById('btnDegrade').style.background = '#ff6600';
        // Desativa outras ferramentas
        modoPen=false; modoLivre=false; modoBorracha=false; modoEditar=false; modoFormas=false;
        penLayer.innerHTML='';
        document.getElementById('btn-confirmar-pen').style.display='none';
        document.getElementById('ferr-icon').textContent='🖊';
        document.getElementById('ferr-label').textContent='PEN';
        document.getElementById('btnEditar').style.background='#333';
    };

    function desativarDegrade() {
        _dgPrevReset();
        modoDegrade=false; degradeStart=null;
        document.getElementById('degrade-preview-layer').innerHTML='';
        document.getElementById('btnDegrade').style.background='#e74c3c';
        document.getElementById('btn-confirmar-degrade').style.display='none';
    }

    // ── BOLINHAS DE AJUSTE DO DEGRADÊ ──────────────────────────────────────
    let _dgAjuste = null; // {el, x1, y1, x2, y2, tipo, fill}
    let _dgBolhaDrag = null; // 'a' ou 'b' — qual bolinha está sendo arrastada
    let _txtDgAjuste = null; // {degId, el, x1,y1,x2,y2, tipo, c1, c2} — degradê de texto

    function _atualizarBolinhasDegrade() {
        if (!_dgAjuste) return;
        const bA = document.getElementById('dg-bolinha-a');
        const bB = document.getElementById('dg-bolinha-b');
        const btnDG = document.getElementById('btn-confirmar-degrade');
        // Aplica as cores do degradê nas bolinhas
        const coresDg = getDegradeCores();
        const corA = coresDg[0] || '#03dac6';
        const corB = coresDg[coresDg.length-1] || '#ff00ff';
        bA.style.background = corA;
        bA.style.boxShadow  = `0 0 0 2px ${corA},0 3px 10px rgba(0,0,0,0.6)`;
        bB.style.background = corB;
        bB.style.boxShadow  = `0 0 0 2px ${corB},0 3px 10px rgba(0,0,0,0.6)`;
        // Converte coordenadas do canvas para posição na tela
        const {x: sx1, y: sy1} = canvasParaClient(_dgAjuste.x1, _dgAjuste.y1);
        const {x: sx2, y: sy2} = canvasParaClient(_dgAjuste.x2, _dgAjuste.y2);
        // Centraliza a bolinha subtraindo metade do tamanho (36px)
        bA.style.left = (sx1 - 26)+'px'; bA.style.top = (sy1 - 26)+'px'; bA.style.display='flex';
        bB.style.left = (sx2 - 26)+'px'; bB.style.top = (sy2 - 26)+'px'; bB.style.display='flex';
        // Botão sempre fixo no centro inferior — apenas garante que está visível
        btnDG.style.display = 'block';
    }

    function _esconderBolinhasDegrade() {
        document.getElementById('dg-bolinha-a').style.display='none';
        document.getElementById('dg-bolinha-b').style.display='none';
        document.getElementById('btn-confirmar-degrade').style.display='none';
        _dgAjuste = null; _dgBolhaDrag = null;
    }

    // ── BOLINHAS DEGRADÊ DE TEXTO ────────────────────────────────────────
    function _atualizarBolinhasTxtDg() {
        if (!_txtDgAjuste) return;
        const bA = document.getElementById('txt-dg-bolinha-a');
        const bB = document.getElementById('txt-dg-bolinha-b');
        bA.style.background = _txtDgAjuste.c1;
        bA.style.boxShadow  = `0 0 0 2px ${_txtDgAjuste.c1},0 2px 8px rgba(0,0,0,0.6)`;
        bB.style.background = _txtDgAjuste.c2;
        bB.style.boxShadow  = `0 0 0 2px ${_txtDgAjuste.c2},0 2px 8px rgba(0,0,0,0.6)`;
        const {x: sx1, y: sy1} = canvasParaClient(_txtDgAjuste.x1, _txtDgAjuste.y1);
        const {x: sx2, y: sy2} = canvasParaClient(_txtDgAjuste.x2, _txtDgAjuste.y2);
        bA.style.left = (sx1-16)+'px'; bA.style.top = (sy1-16)+'px'; bA.style.display='flex';
        bB.style.left = (sx2-16)+'px'; bB.style.top = (sy2-16)+'px'; bB.style.display='flex';
        document.getElementById('btn-confirmar-degrade').style.display='block';
    }

    let _txtDgRAF = null;
    function _reconstruirTxtDg() {
        if (!_txtDgAjuste) return;
        if (_txtDgRAF) return;
        _txtDgRAF = requestAnimationFrame(() => {
            _txtDgRAF = null;
            if (!_txtDgAjuste) return;
            const {degId, x1, y1, x2, y2, tipo} = _txtDgAjuste;
            // getElementById é mais confiável que querySelector para IDs com números
            const gradEl = document.getElementById(degId);
            if (!gradEl) return;
            if (tipo === 'linear') {
                gradEl.setAttribute('x1',x1); gradEl.setAttribute('y1',y1);
                gradEl.setAttribute('x2',x2); gradEl.setAttribute('y2',y2);
            } else {
                const r = Math.hypot(x2-x1, y2-y1);
                gradEl.setAttribute('cx',x1); gradEl.setAttribute('cy',y1);
                gradEl.setAttribute('fx',x1); gradEl.setAttribute('fy',y1);
                gradEl.setAttribute('r', r || 10);
            }
        });
    }

    function _esconderBolinhasTxtDg() {
        document.getElementById('txt-dg-bolinha-a').style.display='none';
        document.getElementById('txt-dg-bolinha-b').style.display='none';
        document.getElementById('btn-confirmar-degrade').style.display='none';
        _txtDgAjuste = null;
    }

    let _dgRAF = null;
    function _reconstruirDegrade() {
        if (!_dgAjuste) return;
        if (_dgRAF) return; // já tem frame pendente, pula
        _dgRAF = requestAnimationFrame(() => {
            _dgRAF = null;
            if (!_dgAjuste) return;
            const {el, x1, y1, x2, y2, tipo} = _dgAjuste;
            // Acha o gradiente já no DOM pelo fill do rect (url(#id))
            const fillVal = el.getAttribute('fill') || '';
            const idMatch = fillVal.match(/url\(#([^)]+)\)/);
            if (idMatch) {
                const gradEl = livreLayer.querySelector('#'+idMatch[1]) ||
                               document.getElementById(idMatch[1]);
                if (gradEl) {
                    if (tipo === 'linear') {
                        gradEl.setAttribute('x1', x1); gradEl.setAttribute('y1', y1);
                        gradEl.setAttribute('x2', x2); gradEl.setAttribute('y2', y2);
                    } else {
                        const dist = Math.hypot(x2-x1, y2-y1);
                        const W = workSurface.offsetWidth, H = workSurface.offsetHeight;
                        const raioMax = Math.max(dist, Math.hypot(W,H)*0.5);
                        gradEl.setAttribute('cx', x1); gradEl.setAttribute('cy', y1);
                        gradEl.setAttribute('fx', x1); gradEl.setAttribute('fy', y1);
                        gradEl.setAttribute('r',  raioMax);
                    }
                    // Salva estado
                    if (camadas[camadaAtiva]) {
                        camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
                    }
                    return;
                }
            }
            // Fallback: recria só se não achou o gradiente no DOM
            const parent = el.parentNode;
            if (!parent) return;
            let novoEl;
            if (tipo === 'linear') {
                novoEl = criarDegradeLinear(x1, y1, x2, y2, _dgAjuste.fill);
            } else {
                const dist = Math.hypot(x2-x1, y2-y1);
                novoEl = criarDegradeRadialSVG(x1, y1, dist, _dgAjuste.fill);
            }
            parent.replaceChild(novoEl, el);
            _dgAjuste.el = novoEl;
            if (camadas[camadaAtiva]) {
                camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
            }
        });
    }

    // Touch nas bolinhas — tratado no handler do viewport (ver abaixo)

    // Botão confirmar degradê — só aqui o modo é finalizado
    document.getElementById('btn-confirmar-degrade').addEventListener('touchstart', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (_txtDgAjuste) {
            // Confirma degradê de texto
            _esconderBolinhasTxtDg();
            mostrarNotificacao('✅ Degradê do texto salvo!');
            return;
        }
        document.getElementById('degrade-preview-layer').innerHTML='';
        // Salva o livreHTML com o degradê antes de encerrar
        if (camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
        }
        _esconderBolinhasDegrade(); _esconderBolinhasTxtDg();
        modoDegrade = false;
        degradeStart = null;
        document.getElementById('btnDegrade').style.background='#e74c3c';
        _dgPrevReset();
    }, {passive:false});

    // ── LISTENERS DIRETOS NAS BOLINHAS — drag suave e imediato ──────────────
    function _setupBolinhaDrag(elId, qual) {
        const el = document.getElementById(elId);
        el.addEventListener('touchstart', (e) => {
            e.stopPropagation(); e.preventDefault();
            _dgBolhaDrag = qual;
            isDragging = false;
        }, {passive:false});
        el.addEventListener('touchmove', (e) => {
            e.stopPropagation(); e.preventDefault();
            const {x: cx, y: cy} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
            if (_txtDgAjuste) {
                // Modo degradê de texto
                if (qual === 'a') { _txtDgAjuste.x1=cx; _txtDgAjuste.y1=cy; }
                else              { _txtDgAjuste.x2=cx; _txtDgAjuste.y2=cy; }
                _reconstruirTxtDg();
                _atualizarBolinhasTxtDg();
            } else if (_dgAjuste) {
                // Modo degradê normal
                if (qual === 'a') { _dgAjuste.x1=cx; _dgAjuste.y1=cy; }
                else              { _dgAjuste.x2=cx; _dgAjuste.y2=cy; }
                _reconstruirDegrade();
                _atualizarBolinhasDegrade();
            }
        }, {passive:false});
        el.addEventListener('touchend', (e) => {
            e.stopPropagation();
            _dgBolhaDrag = null;
        }, {passive:true});
    }
    _setupBolinhaDrag('dg-bolinha-a', 'a');
    _setupBolinhaDrag('dg-bolinha-b', 'b');

    // Listeners para as bolinhas menores do degradê de texto
    function _setupTxtBolinhaDrag(elId, qual) {
        const el = document.getElementById(elId);
        el.addEventListener('touchstart', (e) => {
            e.stopPropagation(); e.preventDefault();
            isDragging = false;
        }, {passive:false});
        el.addEventListener('touchmove', (e) => {
            e.stopPropagation(); e.preventDefault();
            if (!_txtDgAjuste) return;
            const {x: cx, y: cy} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
            if (qual === 'a') { _txtDgAjuste.x1=cx; _txtDgAjuste.y1=cy; }
            else              { _txtDgAjuste.x2=cx; _txtDgAjuste.y2=cy; }
            _reconstruirTxtDg();
            _atualizarBolinhasTxtDg();
        }, {passive:false});
        el.addEventListener('touchend', (e) => { e.stopPropagation(); }, {passive:true});
    }
    _setupTxtBolinhaDrag('txt-dg-bolinha-a', 'a');
    _setupTxtBolinhaDrag('txt-dg-bolinha-b', 'b');

    // Interpola cor hex entre dois valores
    function hexMid(h1,h2,t) {
        const r1=parseInt(h1.slice(1,3),16),g1=parseInt(h1.slice(3,5),16),b1=parseInt(h1.slice(5,7),16);
        const r2=parseInt(h2.slice(1,3),16),g2=parseInt(h2.slice(3,5),16),b2=parseInt(h2.slice(5,7),16);
        const r=Math.round(r1+(r2-r1)*t), g=Math.round(g1+(g2-g1)*t), b=Math.round(b1+(b2-b1)*t);
        return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    }

    // Garante <defs> no livreLayer
    function getDefs() {
        let defs = livreLayer.querySelector('defs');
        if (!defs) { defs=document.createElementNS(NS,'defs'); livreLayer.prepend(defs); }
        return defs;
    }

    // Constrói máscara SVG com todos os caminhos da camada ativa (para fill=camada)
    // USA <mask> em vez de <clipPath> para suportar stroke (traços abertos como Pen Tool)
    function construirClipPath(clipId) {
        const defs = getDefs();
        // Remove versões anteriores
        ['#mask-'+clipId, '#'+clipId].forEach(sel => {
            const old = defs.querySelector(sel);
            if (old) old.remove();
        });

        const maskId = 'mask-'+clipId;
        const mask = document.createElementNS(NS,'mask');
        mask.setAttribute('id', maskId);
        mask.setAttribute('maskUnits','userSpaceOnUse');

        const W = workSurface.offsetWidth || 800;
        const H = workSurface.offsetHeight || 1000;

        // Fundo preto — tudo mascarado inicialmente
        const bg = document.createElementNS(NS,'rect');
        bg.setAttribute('x',0); bg.setAttribute('y',0);
        bg.setAttribute('width',W); bg.setAttribute('height',H);
        bg.setAttribute('fill','black');
        mask.appendChild(bg);

        let temConteudo = false;

        // 1. Caminhos da Pen Tool — máscara diferenciada por tipo
        const cam = camadas[camadaAtiva];
        if (cam) {
            cam.caminhos.forEach(c => {
                const d = buildPathD(c.pontos, c.fechado);
                if (!d) return;
                const sw = Math.max(parseFloat(c.width)||2, 1);
                const p = document.createElementNS(NS,'path');
                p.setAttribute('d', d);
                p.setAttribute('stroke-linecap','round');
                p.setAttribute('stroke-linejoin','round');
                if (c.fechado) {
                    // Fechado: preenche só o interior
                    p.setAttribute('fill','white');
                    p.setAttribute('stroke','none');
                } else {
                    // Aberto: usa o traço
                    p.setAttribute('fill','none');
                    p.setAttribute('stroke','white');
                    p.setAttribute('stroke-width', sw);
                }
                mask.appendChild(p);
                temConteudo = true;
            });
        }

        // 2. Elementos do livreLayer (pincel livre, formas, etc.)
        function clonarParaMask(el) {
            if (el.tagName === 'defs') return;
            const fillOrig   = el.getAttribute('fill')   || 'none';
            const strokeOrig = el.getAttribute('stroke') || 'none';
            const swOrig     = parseFloat(el.getAttribute('stroke-width') || '0');
            if (fillOrig !== 'none') {
                // Elemento preenchido: só fill, sem stroke (evita vazar pelas bordas)
                const c = el.cloneNode(true);
                c.setAttribute('fill','white');
                c.setAttribute('stroke','none');
                c.removeAttribute('filter');
                mask.appendChild(c); temConteudo = true;
            } else if (strokeOrig !== 'none' && swOrig > 0) {
                // Só traço: usa o stroke
                const c = el.cloneNode(true);
                c.setAttribute('fill','none');
                c.setAttribute('stroke','white');
                c.setAttribute('stroke-width', swOrig);
                c.removeAttribute('filter');
                mask.appendChild(c); temConteudo = true;
            }
            if (el.tagName === 'g' || el.tagName === 'G') {
                [...el.children].forEach(child => clonarParaMask(child));
            }
        }
        [...livreLayer.children].forEach(el => clonarParaMask(el));

        if (!temConteudo) return null;
        defs.appendChild(mask);
        return maskId;
    }

    // Cria degradê linear SVG vetorial
    function criarDegradeLinear(x1,y1,x2,y2,fill) {
        const id  = 'lg-'+(++degradeIdCnt);
        const clipId = 'clip-dg-'+degradeIdCnt;
        const defs = getDefs();
        const W = workSurface.offsetWidth, H = workSurface.offsetHeight;

        const grad = document.createElementNS(NS,'linearGradient');
        grad.setAttribute('id',id);
        grad.setAttribute('gradientUnits','userSpaceOnUse');
        grad.setAttribute('x1',x1); grad.setAttribute('y1',y1);
        grad.setAttribute('x2',x2); grad.setAttribute('y2',y2);

        // Adiciona stops para cada cor + intermediários suaves
        const coresL = getDegradeCores();
        const nL = coresL.length;
        const stepsL = 8; // interpolação suave entre cada par
        for (let ci = 0; ci < nL - 1; ci++) {
            for (let s = 0; s <= stepsL; s++) {
                const t = s / stepsL;
                const offset = (ci + t) / (nL - 1);
                const cor = hexMid(coresL[ci], coresL[ci+1], t);
                const stop = document.createElementNS(NS,'stop');
                stop.setAttribute('offset', (offset*100).toFixed(1)+'%');
                stop.setAttribute('stop-color', cor);
                grad.appendChild(stop);
            }
        }
        defs.appendChild(grad);

        const rect = document.createElementNS(NS,'rect');
        rect.setAttribute('x',0); rect.setAttribute('y',0);
        rect.setAttribute('width',W); rect.setAttribute('height',H);
        rect.setAttribute('fill',`url(#${id})`);

        if (fill === 'camada') {
            const maskId2 = construirClipPath(clipId);
            if (maskId2) rect.setAttribute('mask',`url(#${maskId2})`);
        }
        return rect;
    }

    // Cria degradê radial SVG vetorial
    function criarDegradeRadialSVG(cx,cy,raio,fill) {
        const id  = 'rg-'+(++degradeIdCnt);
        const clipId = 'clip-dg-'+degradeIdCnt;
        const defs = getDefs();
        const W = workSurface.offsetWidth, H = workSurface.offsetHeight;

        // Interpola cor intermediária para degradê mais rico
        const grad = document.createElementNS(NS,'radialGradient');
        grad.setAttribute('id',id);
        grad.setAttribute('gradientUnits','userSpaceOnUse');
        grad.setAttribute('cx',cx); grad.setAttribute('cy',cy);
        // Raio estendido para cobrir a folha toda — o degradê "respira"
        const raioMax = Math.max(raio, Math.hypot(W,H) * 0.5);
        grad.setAttribute('r', raioMax);
        grad.setAttribute('fx',cx); grad.setAttribute('fy',cy);

        // Adiciona stops para cada cor + interpolação suave
        const coresR = getDegradeCores();
        const nR = coresR.length;
        const stepsR = 8;
        for (let ci = 0; ci < nR - 1; ci++) {
            for (let s = 0; s <= stepsR; s++) {
                const t = s / stepsR;
                const offset = (ci + t) / (nR - 1);
                const cor = hexMid(coresR[ci], coresR[ci+1], t);
                const stop = document.createElementNS(NS,'stop');
                stop.setAttribute('offset', (offset*100).toFixed(1)+'%');
                stop.setAttribute('stop-color', cor);
                grad.appendChild(stop);
            }
        }
        defs.appendChild(grad);

        const rect = document.createElementNS(NS,'rect');
        rect.setAttribute('x',0); rect.setAttribute('y',0);
        rect.setAttribute('width',W); rect.setAttribute('height',H);
        rect.setAttribute('fill',`url(#${id})`);

        if (fill === 'camada') {
            const maskId2 = construirClipPath(clipId);
            if (maskId2) rect.setAttribute('mask',`url(#${maskId2})`);
        }
        return rect;
    }

    // Preview em tempo real — elementos criados UMA VEZ, só atributos atualizados
    let _dgPrevRAF = null;
    let _dgPrevArgs = null;
    let _dgPrevInited = false;
    let _dgPrevGrad = null;
    let _dgPrevRect = null;
    let _dgPrevW = 0, _dgPrevH = 0;

    function _initPreviewDegrade() {
        const layer = document.getElementById('degrade-preview-layer');
        layer.innerHTML = '';
        _dgPrevW = workSurface.offsetWidth;
        _dgPrevH = workSurface.offsetHeight;

        const defs = document.createElementNS(NS,'defs');
        if (degradeTipo === 'linear') {
            _dgPrevGrad = document.createElementNS(NS,'linearGradient');
        } else {
            _dgPrevGrad = document.createElementNS(NS,'radialGradient');
        }
        _dgPrevGrad.setAttribute('id','dg-prev');
        _dgPrevGrad.setAttribute('gradientUnits','userSpaceOnUse');

        const cores = getDegradeCores();
        cores.forEach((c, i) => {
            const s = document.createElementNS(NS,'stop');
            s.setAttribute('offset', (i/(cores.length-1)*100).toFixed(1)+'%');
            s.setAttribute('stop-color', c);
            _dgPrevGrad.appendChild(s);
        });
        defs.appendChild(_dgPrevGrad);

        // Cria máscara de preview com o conteúdo da camada ativa (igual ao fill=camada)
        // USA <mask> para suportar stroke (traços abertos)
        const clipIdPrev = 'clip-dg-prev';
        ['#mask-'+clipIdPrev, '#'+clipIdPrev].forEach(sel => {
            const old = defs.querySelector(sel);
            if (old) old.remove();
        });

        const clip = document.createElementNS(NS,'mask');
        clip.setAttribute('id', clipIdPrev);
        clip.setAttribute('maskUnits','userSpaceOnUse');
        let temClip = false;

        // Fundo preto
        const bgPrev = document.createElementNS(NS,'rect');
        bgPrev.setAttribute('x',0); bgPrev.setAttribute('y',0);
        bgPrev.setAttribute('width', _dgPrevW || workSurface.offsetWidth || 800);
        bgPrev.setAttribute('height', _dgPrevH || workSurface.offsetHeight || 1000);
        bgPrev.setAttribute('fill','black');
        clip.appendChild(bgPrev);

        const cam = camadas[camadaAtiva];
        if (cam) {
            cam.caminhos.forEach(c => {
                const d = buildPathD(c.pontos, c.fechado);
                if (!d) return;
                const sw = Math.max(parseFloat(c.width)||2, 1);
                const p = document.createElementNS(NS,'path');
                p.setAttribute('d',d);
                p.setAttribute('stroke-linecap','round');
                if (c.fechado) {
                    p.setAttribute('fill','white'); p.setAttribute('stroke','none');
                } else {
                    p.setAttribute('fill','none'); p.setAttribute('stroke','white');
                    p.setAttribute('stroke-width', sw);
                }
                clip.appendChild(p);
                temClip = true;
            });
        }
        // Também inclui elementos do livreLayer
        function clonarParaClipPrev(el) {
            if (el.tagName === 'defs') return;
            const fillOrig   = el.getAttribute('fill')   || 'none';
            const strokeOrig = el.getAttribute('stroke') || 'none';
            const swOrig     = parseFloat(el.getAttribute('stroke-width') || '0');
            if (fillOrig !== 'none') {
                const c = el.cloneNode(true);
                c.setAttribute('fill','white');
                c.setAttribute('stroke','none');
                c.removeAttribute('filter');
                clip.appendChild(c);
                temClip = true;
            }
            if (strokeOrig !== 'none' && swOrig > 0) {
                const c = el.cloneNode(true);
                c.setAttribute('fill','none');
                c.setAttribute('stroke','white');
                c.setAttribute('stroke-width', swOrig);
                c.removeAttribute('filter');
                clip.appendChild(c);
                temClip = true;
            }
            if (el.tagName === 'g' || el.tagName === 'G') {
                [...el.children].forEach(child => clonarParaClipPrev(child));
            }
        }
        [...livreLayer.children].forEach(el => clonarParaClipPrev(el));

        if (temClip) defs.appendChild(clip);
        layer.appendChild(defs);

        _dgPrevRect = document.createElementNS(NS,'rect');
        _dgPrevRect.setAttribute('x','0'); _dgPrevRect.setAttribute('y','0');
        _dgPrevRect.setAttribute('width', _dgPrevW);
        _dgPrevRect.setAttribute('height', _dgPrevH);
        _dgPrevRect.setAttribute('fill','url(#dg-prev)');
        // Aplica mask ao preview se houver conteúdo na camada
        if (temClip) _dgPrevRect.setAttribute('mask','url(#clip-dg-prev)');
        layer.appendChild(_dgPrevRect);
        _dgPrevInited = true;
    }

    function atualizarPreviewDegradeLayer(x1,y1,x2,y2) {
        _dgPrevArgs = [x1,y1,x2,y2];
        if (_dgPrevRAF) return;
        _dgPrevRAF = requestAnimationFrame(() => {
            _dgPrevRAF = null;
            const [ax1,ay1,ax2,ay2] = _dgPrevArgs;
            if (!_dgPrevInited) _initPreviewDegrade();
            const W = _dgPrevW, H = _dgPrevH;
            // Apenas atualiza atributos — sem recriar elementos
            if (degradeTipo === 'linear') {
                _dgPrevGrad.setAttribute('x1',ax1); _dgPrevGrad.setAttribute('y1',ay1);
                _dgPrevGrad.setAttribute('x2',ax2); _dgPrevGrad.setAttribute('y2',ay2);
            } else {
                const raio = Math.hypot(ax2-ax1,ay2-ay1);
                const raioMax = Math.max(raio, Math.hypot(W,H)*0.5);
                _dgPrevGrad.setAttribute('cx',ax1); _dgPrevGrad.setAttribute('cy',ay1);
                _dgPrevGrad.setAttribute('r',raioMax);
                _dgPrevGrad.setAttribute('fx',ax1); _dgPrevGrad.setAttribute('fy',ay1);
            }
        });
    }

    function _atualizarPreviewDegradeLayerReal(x1,y1,x2,y2) {} // stub compatibilidade

    function _dgPrevReset() { _dgPrevInited=false; _dgPrevGrad=null; _dgPrevRect=null; _dgPrevW=0; _dgPrevH=0; _dgAjuste=null; _dgBolhaDrag=null; _txtDgAjuste=null; }

    function atualizarPreviewDegradeLayerReal(x1,y1,x2,y2) {
        const layer = document.getElementById('degrade-preview-layer');
        layer.innerHTML='';
        if (!_dgPrevW) { _dgPrevW = workSurface.offsetWidth; _dgPrevH = workSurface.offsetHeight; }
        const W = _dgPrevW, H = _dgPrevH;
        const defs=document.createElementNS(NS,'defs');

        let gradEl, previewEl;
        if (degradeTipo==='linear') {
            gradEl=document.createElementNS(NS,'linearGradient');
            gradEl.setAttribute('id','dg-prev');
            gradEl.setAttribute('gradientUnits','userSpaceOnUse');
            gradEl.setAttribute('x1',x1); gradEl.setAttribute('y1',y1);
            gradEl.setAttribute('x2',x2); gradEl.setAttribute('y2',y2);
        } else {
            const raio=Math.hypot(x2-x1,y2-y1);
            const raioMax=Math.max(raio, Math.hypot(W,H)*0.5);
            gradEl=document.createElementNS(NS,'radialGradient');
            gradEl.setAttribute('id','dg-prev');
            gradEl.setAttribute('gradientUnits','userSpaceOnUse');
            gradEl.setAttribute('cx',x1); gradEl.setAttribute('cy',y1);
            gradEl.setAttribute('r',raioMax);
            gradEl.setAttribute('fx',x1); gradEl.setAttribute('fy',y1);
        }
        const coresPrev = getDegradeCores();
        coresPrev.forEach((c, i) => {
            const s = document.createElementNS(NS,'stop');
            s.setAttribute('offset', (i/(coresPrev.length-1)*100).toFixed(1)+'%');
            s.setAttribute('stop-color', c);
            gradEl.appendChild(s);
        });
        defs.appendChild(gradEl); layer.appendChild(defs);

        // Rect de preview
        previewEl=document.createElementNS(NS,'rect');
        previewEl.setAttribute('x',0); previewEl.setAttribute('y',0);
        previewEl.setAttribute('width',W); previewEl.setAttribute('height',H);
        previewEl.setAttribute('fill','url(#dg-prev)');
        previewEl.setAttribute('opacity','0.85');
        layer.appendChild(previewEl);

        // Linha guia mostrando direção/raio
        const linha=document.createElementNS(NS,'line');
        linha.setAttribute('x1',x1); linha.setAttribute('y1',y1);
        linha.setAttribute('x2',x2); linha.setAttribute('y2',y2);
        linha.setAttribute('stroke','white'); linha.setAttribute('stroke-width',1.5/scale);
        linha.setAttribute('stroke-opacity','0.8');
        linha.setAttribute('stroke-dasharray',`${6/scale} ${4/scale}`);
        layer.appendChild(linha);

        // Ponto inicial (A) e final (B) com cores do degradê
        const coresPt = getDegradeCores();
        const c1El=document.createElementNS(NS,'circle');
        c1El.setAttribute('cx',x1); c1El.setAttribute('cy',y1); c1El.setAttribute('r',6/scale);
        c1El.setAttribute('fill',coresPt[0]||'#fff'); c1El.setAttribute('stroke','white');
        c1El.setAttribute('stroke-width',1.5/scale);
        layer.appendChild(c1El);
        const c2El=document.createElementNS(NS,'circle');
        c2El.setAttribute('cx',x2); c2El.setAttribute('cy',y2); c2El.setAttribute('r',6/scale);
        c2El.setAttribute('fill',coresPt[coresPt.length-1]||'#fff'); c2El.setAttribute('stroke','white');
        c2El.setAttribute('stroke-width',1.5/scale);
        layer.appendChild(c2El);
    }

    // ══════════════════════════════════════════════════════════════════════
    // NOVAS FERRAMENTAS
    // ══════════════════════════════════════════════════════════════════════

    // ── 1. SELEÇÃO E MOVER ───────────────────────────────────────────────
    let modoSelecao = false;
    let selecaoEl = null, selecaoTipo = null;
    let selecaoArrastando = false;
    let selecaoOffX = 0, selecaoOffY = 0;
    let selecaoTransX = 0, selecaoTransY = 0;

    window.toggleSelecao = () => {
        modoSelecao = !modoSelecao;
        const btn = document.getElementById('btnSelecao');
        btn.style.background = modoSelecao ? '#03dac6' : '#333';
        btn.style.color = modoSelecao ? '#000' : 'white';
        if (!modoSelecao) limparSelecao();
        if (modoSelecao) { modoPen=false; modoLivre=false; modoBorracha=false; modoEditar=false; }
    };

    function limparSelecao() {
        selecaoEl=null; _selRealEl=null;
        _selResizing=false; _selResizeCorner=null;
        _selBBox=null; _selCurrentScale=1;
        _selHandlePositions=null;
        _selRotating=false; _selRotOrigAngle=0; _selRotCurAngle=0;
        document.getElementById('selecao-layer').innerHTML='';
        _esconderHandlesHTML();
    }

    // Estado de resize da seleção
    let _selResizing = false;
    let _selResizeCorner = null;
    let _selResizeStartScale = 1;
    let _selBBox = null;
    let _selCurrentScale = 1;
    // Centro do bbox em coords de canvas (âncora oposta ao handle arrastado)
    let _selResizeAnchorCX = 0, _selResizeAnchorCY = 0;
    // Posição inicial do toque em coords de canvas
    let _selResizeTouchStartCX = 0, _selResizeTouchStartCY = 0;
    // Distância inicial entre âncora e toque (em canvas units)
    let _selResizeStartDist = 1;
    // Posições dos handles em coords canvas para hit-test robusto no touchstart
    let _selHandlePositions = null;
    // Referência ao elemento real sendo escalado (não o rect da selecao-layer)
    let _selRealEl = null;

    // Estado de rotação da seleção
    let _selRotating = false;
    let _selRotStartAngle = 0;   // ângulo inicial do toque em relação ao centro
    let _selRotCurAngle  = 0;    // rotação acumulada atual (graus)
    let _selRotOrigAngle = 0;    // rotação já existente no elemento ao iniciar gesto
    let _selRotCX = 0, _selRotCY = 0; // centro de rotação em coords canvas

    function desenharHandlesSelecao(el, bbOverride) {
        const sl = document.getElementById('selecao-layer');
        sl.innerHTML='';
        // Guarda referência ao elemento real
        if (el && el !== sl) _selRealEl = el;
        try {
            let bb;
            if (bbOverride) {
                bb = bbOverride;
            } else {
                try { bb = _selRealEl ? _selRealEl.getBBox() : el.getBBox(); } catch(_) { return; }
            }
            if (!bb || bb.width === 0 && bb.height === 0) return;
            const pad = 6/scale;
            const x0 = bb.x - pad, y0 = bb.y - pad;
            const x1 = bb.x + bb.width + pad, y1 = bb.y + bb.height + pad;
            const cx = (x0+x1)/2, cy = (y0+y1)/2;
            // Guarda posições dos handles em coords canvas para hit-test no touchstart
            _selHandlePositions = {x0,y0,x1,y1,cx,cy,hr:14/scale};

            // Borda tracejada
            const bRect = document.createElementNS(NS,'rect');
            bRect.setAttribute('x',x0); bRect.setAttribute('y',y0);
            bRect.setAttribute('width',x1-x0); bRect.setAttribute('height',y1-y0);
            bRect.setAttribute('fill','rgba(3,218,198,0.07)');
            bRect.setAttribute('stroke','#03dac6'); bRect.setAttribute('stroke-width',1.5/scale);
            bRect.setAttribute('stroke-dasharray',`${5/scale} ${3/scale}`);
            sl.appendChild(bRect);

            // Handle centro — MOVER
            const move = document.createElementNS(NS,'circle');
            move.setAttribute('cx',cx); move.setAttribute('cy',cy);
            move.setAttribute('r',11/scale);
            move.setAttribute('fill','#03dac6'); move.setAttribute('stroke','white');
            move.setAttribute('stroke-width',2/scale);
            sl.appendChild(move);
            const moveTxt = document.createElementNS(NS,'text');
            moveTxt.setAttribute('x',cx); moveTxt.setAttribute('y',cy);
            moveTxt.setAttribute('text-anchor','middle');
            moveTxt.setAttribute('dominant-baseline','middle');
            moveTxt.setAttribute('fill','#000');
            moveTxt.setAttribute('font-size',9/scale);
            moveTxt.setAttribute('pointer-events','none');
            moveTxt.textContent='✥';
            sl.appendChild(moveTxt);

            // Handle excluir — círculo vermelho afastado do canto sup-dir
            const del = document.createElementNS(NS,'circle');
            del.setAttribute('cx', x1+22/scale); del.setAttribute('cy', y0-22/scale);
            del.setAttribute('r', 10/scale);
            del.setAttribute('fill','#e74c3c'); del.setAttribute('stroke','white');
            del.setAttribute('stroke-width', 1.5/scale);
            del.setAttribute('pointer-events','all');
            del.addEventListener('touchstart',(e)=>{
                e.stopPropagation(); e.preventDefault();
                salvarHistorico();
                if (selecaoCaminhoInfo) {
                    const cam = camadas[selecaoCaminhoInfo.camadaIdx];
                    if (cam) cam.caminhos.splice(selecaoCaminhoInfo.caminhoIdx, 1);
                    selecaoCaminhoInfo = null;
                    renderizarTodos();
                } else if (_selRealEl) {
                    _selRealEl.remove();
                }
                limparSelecao(); _selRealEl = null; _selCurrentScale = 1;
            },{passive:false});
            sl.appendChild(del);
            const delTxt = document.createElementNS(NS,'text');
            delTxt.setAttribute('x', x1+22/scale); delTxt.setAttribute('y', y0-22/scale);
            delTxt.setAttribute('text-anchor','middle'); delTxt.setAttribute('dominant-baseline','middle');
            delTxt.setAttribute('fill','white'); delTxt.setAttribute('font-size', 10/scale);
            delTxt.setAttribute('font-weight','bold'); delTxt.setAttribute('pointer-events','none');
            delTxt.textContent='✕';
            sl.appendChild(delTxt);

            // Linha do handle de rotação (visual apenas)
            const rotHY_canvas = y0 - 36/scale;
            const rotLine = document.createElementNS(NS,'line');
            rotLine.setAttribute('x1', cx); rotLine.setAttribute('y1', y0);
            rotLine.setAttribute('x2', cx); rotLine.setAttribute('y2', rotHY_canvas);
            rotLine.setAttribute('stroke','#ff9800'); rotLine.setAttribute('stroke-width', 1.2/scale);
            rotLine.setAttribute('stroke-dasharray', `${3/scale} ${2/scale}`);
            rotLine.setAttribute('pointer-events','none');
            sl.appendChild(rotLine);

            // Posiciona handles HTML na tela
            _posicionarHandlesHTML(x0, y0, x1, y1, cx, cy);

        } catch(err) { console.warn('handles err',err); }
    }

    // ── Posiciona os divs HTML dos handles em coords de tela ──────────────────
    function _posicionarHandlesHTML(x0, y0, x1, y1, cx, cy) {
        const corners = {tl:[x0,y0], tr:[x1,y0], bl:[x0,y1], br:[x1,y1]};
        for (const [id, [hx,hy]] of Object.entries(corners)) {
            const sc = canvasParaClient(hx, hy);
            const div = document.getElementById('sel-handle-'+id);
            if (!div) continue;
            div.style.left = sc.x + 'px';
            div.style.top  = sc.y + 'px';
            div.style.display = 'block';
        }
        // Handle de rotação — acima do centro
        const rotCanvasY = y0 - 36/scale;
        const scRot = canvasParaClient(cx, rotCanvasY);
        const divRot = document.getElementById('sel-handle-rot');
        if (divRot) {
            divRot.style.left = scRot.x + 'px';
            divRot.style.top  = scRot.y + 'px';
            divRot.style.display = 'flex';
        }
        // Guarda centro em canvas para rotação
        _selHandlePositions.rotCanvasCX = cx;
        _selHandlePositions.rotCanvasCY = cy;
    }

    // Esconde todos os handles HTML
    function _esconderHandlesHTML() {
        ['tl','tr','bl','br'].forEach(id => {
            const d = document.getElementById('sel-handle-'+id);
            if (d) d.style.display = 'none';
        });
        const r = document.getElementById('sel-handle-rot');
        if (r) r.style.display = 'none';
    }

    // ── Event listeners dos handles HTML ─────────────────────────────────────
    // Usa setTimeout para garantir que os divs existem no DOM
    setTimeout(() => {

        // HANDLES DE RESIZE (cantos)
        ['tl','tr','bl','br'].forEach(cornerId => {
            const div = document.getElementById('sel-handle-'+cornerId);
            if (!div) return;
            div.addEventListener('touchstart', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!_selHandlePositions) return;
                const {x0,y0,x1,y1} = _selHandlePositions;
                _selResizing = true;
                _selResizeCorner = cornerId;
                _selResizeStartScale = 1;
                _selCurrentScale = 1;
                if (selecaoCaminhoInfo) {
                    const cam = camadas[selecaoCaminhoInfo.camadaIdx];
                    const c = cam.caminhos[selecaoCaminhoInfo.caminhoIdx];
                    const xs=c.pontos.map(p=>p.x), ys=c.pontos.map(p=>p.y);
                    const mnX=Math.min(...xs),mxX=Math.max(...xs),mnY=Math.min(...ys),mxY=Math.max(...ys);
                    const pad=6/scale;
                    _selBBox = {x:mnX-pad,y:mnY-pad,w:(mxX-mnX)+pad*2,h:(mxY-mnY)+pad*2};
                    c._origPontos = c.pontos.map(p=>({...p}));
                } else {
                    _selBBox = {x:x0,y:y0,w:x1-x0,h:y1-y0};
                }
                const oppX = (cornerId==='tl'||cornerId==='bl') ? x1 : x0;
                const oppY = (cornerId==='tl'||cornerId==='tr') ? y1 : y0;
                _selResizeAnchorCX = oppX;
                _selResizeAnchorCY = oppY;
                const tcStart = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
                _selResizeStartDist = Math.max(10, Math.hypot(tcStart.x-oppX, tcStart.y-oppY));
            }, {passive:false});

            div.addEventListener('touchmove', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!_selResizing || !_selBBox) return;
                const tc = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
                const curDist = Math.max(5, Math.hypot(tc.x-_selResizeAnchorCX, tc.y-_selResizeAnchorCY));
                _aplicarResize(Math.max(0.05, _selResizeStartScale*(curDist/_selResizeStartDist)));
            }, {passive:false});

            div.addEventListener('touchend', (e) => {
                e.stopPropagation();
                if (!_selResizing) return;
                _selResizing = false; _selResizeCorner = null;
                const fatorFinal = _selCurrentScale;
                if (selecaoCaminhoInfo) {
                    const cam = camadas[selecaoCaminhoInfo.camadaIdx];
                    const c = cam.caminhos[selecaoCaminhoInfo.caminhoIdx];
                    c._origPontos = c.pontos.map(p=>({...p}));
                    const xs=c.pontos.map(p=>p.x), ys=c.pontos.map(p=>p.y);
                    const minX=Math.min(...xs), maxX=Math.max(...xs);
                    const minY=Math.min(...ys), maxY=Math.max(...ys);
                    _selBBox = {x:minX,y:minY,w:maxX-minX,h:maxY-minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
                } else if (_selRealEl && _selBBox) {
                    const {x:bx,y:by,w:bw,h:bh} = _selBBox;
                    const cx2=bx+bw/2+selecaoTransX, cy2=by+bh/2+selecaoTransY;
                    const nw=bw*fatorFinal, nh=bh*fatorFinal;
                    _selBBox = {x:cx2-nw/2,y:cy2-nh/2,w:nw,h:nh,cx:cx2,cy:cy2};
                }
                _selResizeStartScale=1; _selCurrentScale=1;
                salvarHistorico();
                if (camadas[camadaAtiva]) camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
            }, {passive:false});
        });

        // HANDLE DE ROTAÇÃO
        const divRot = document.getElementById('sel-handle-rot');
        if (divRot) {
            divRot.addEventListener('touchstart', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!_selHandlePositions) return;
                const {rotCanvasCX, rotCanvasCY} = _selHandlePositions;
                _selRotating = true;
                _selRotCX = rotCanvasCX; _selRotCY = rotCanvasCY;
                const tc = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
                _selRotStartAngle = Math.atan2(tc.y-rotCanvasCY, tc.x-rotCanvasCX)*180/Math.PI;
                if (_selRealEl) {
                    const tr = _selRealEl.getAttribute('transform')||'';
                    const rm = tr.match(/rotate\(([-\d.]+)/);
                    _selRotOrigAngle = rm ? parseFloat(rm[1]) : 0;
                } else { _selRotOrigAngle = 0; }
                _selRotCurAngle = _selRotOrigAngle;
            }, {passive:false});

            divRot.addEventListener('touchmove', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!_selRotating) return;
                const tc = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
                const curAngle = Math.atan2(tc.y-_selRotCY, tc.x-_selRotCX)*180/Math.PI;
                let delta = curAngle - _selRotStartAngle;
                let novoAngulo = _selRotOrigAngle + delta;
                const snap = Math.round(novoAngulo/15)*15;
                if (Math.abs(novoAngulo-snap)<5) novoAngulo=snap;
                _selRotCurAngle = novoAngulo;
                _aplicarRotacao(novoAngulo);
            }, {passive:false});

            divRot.addEventListener('touchend', (e) => {
                e.stopPropagation();
                if (!_selRotating) return;
                _selRotating = false;
                if (selecaoCaminhoInfo) {
                    const cam = camadas[selecaoCaminhoInfo.camadaIdx];
                    const c = cam.caminhos[selecaoCaminhoInfo.caminhoIdx];
                    c._origPontos = c.pontos.map(p=>({...p}));
                }
                _selRotOrigAngle = _selRotCurAngle;
                salvarHistorico();
                if (camadas[camadaAtiva]) camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
            }, {passive:false});
        }
    }, 0); // setTimeout end

    // Detectar toque em elemento para selecionar
    let selecaoCaminhoInfo = null; // {camadaIdx, caminhoIdx} para caminhos da Pen Tool

    function tentarSelecionar(x, y) {
        selecaoCaminhoInfo = null;

        // 1. Tenta primeiro em texto-layer e livre-layer
        const layers = [document.getElementById('texto-layer'), livreLayer];
        for (const layer of layers) {
            const els = [...layer.querySelectorAll('path,text,circle,rect,ellipse,line,g,image')].reverse();
            for (const el of els) {
                try {
                    const bb = el.getBBox();
                    if (x>=bb.x-10 && x<=bb.x+bb.width+10 && y>=bb.y-10 && y<=bb.y+bb.height+10) {
                        selecaoEl = el;
                        _selRealEl = el;
                        _selCurrentScale = 1;
                        _selResizing = false;
                        _selRotating = false; _selRotOrigAngle = 0; _selRotCurAngle = 0;
                        selecaoTransX = 0; selecaoTransY = 0;
                        const cur = el.getAttribute('transform')||'';
                        const m = cur.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
                        if (m) { selecaoTransX=parseFloat(m[1]); selecaoTransY=parseFloat(m[2]); }
                        // Inicializa _selBBox para rotação e resize
                        try {
                            const bb2 = el.getBBox();
                            _selBBox = {x: bb2.x, y: bb2.y, w: bb2.width, h: bb2.height};
                        } catch(_) { _selBBox = null; }
                        desenharHandlesSelecao(el);
                        return true;
                    }
                } catch(e) {}
            }
        }

        // 2. Tenta caminhos da Pen Tool (camadas)
        for (let ci = 0; ci < camadas.length; ci++) {
            const cam = camadas[ci];
            if (!cam || !cam.visivel || !cam.caminhos) continue;
            for (let pi = 0; pi < cam.caminhos.length; pi++) {
                const c = cam.caminhos[pi];
                if (!c.pontos.length) continue;
                // Calcula bounding box dos pontos
                const xs = c.pontos.map(p=>p.x), ys = c.pontos.map(p=>p.y);
                const minX=Math.min(...xs), maxX=Math.max(...xs);
                const minY=Math.min(...ys), maxY=Math.max(...ys);
                const margem = 20/scale;
                if (x>=minX-margem && x<=maxX+margem && y>=minY-margem && y<=maxY+margem) {
                    // Seleciona este caminho — usa elemento do drawLayer como referência visual
                    selecaoCaminhoInfo = {camadaIdx: ci, caminhoIdx: pi};
                    // Guarda pontos originais para resize relativo
                    c._origPontos = c.pontos.map(p => ({...p}));
                    _selCurrentScale = 1;
                    // Cria elemento temporário para referência visual
                    const d = buildPathD(c.pontos, c.fechado);
                    const tmpEl = document.createElementNS(NS, 'path');
                    tmpEl.setAttribute('d', d);
                    drawLayer.appendChild(tmpEl);
                    selecaoEl = tmpEl;
                    selecaoTransX = 0; selecaoTransY = 0;
                    desenharHandlesSelecao(tmpEl);
                    tmpEl.remove();
                    // Usa bounding box manual
                    const sl = document.getElementById('selecao-layer');
                    sl.innerHTML = '';
                    const rect = document.createElementNS(NS,'rect');
                    rect.setAttribute('x',minX-4/scale); rect.setAttribute('y',minY-4/scale);
                    rect.setAttribute('width',(maxX-minX)+8/scale); rect.setAttribute('height',(maxY-minY)+8/scale);
                    rect.setAttribute('fill','rgba(3,218,198,0.08)');
                    rect.setAttribute('stroke','#03dac6'); rect.setAttribute('stroke-width',1.5/scale);
                    rect.setAttribute('stroke-dasharray',`${5/scale} ${3/scale}`);
                    sl.appendChild(rect);
                    selecaoEl = rect; // usa o rect como referência de posição
                    return true;
                }
            }
        }

        limparSelecao();
        return false;
    }

    // ── 2. TEXTO VETORIAL ────────────────────────────────────────────────
    let textoFonte = 'sans-serif', textoBold = false, textoItalic = false;
    let textoPosX = 400, textoPosY = 300;
    let _textoEditando = null; // elemento <text> sendo editado
    let _txtDrag = null; // { el, offX, offY } — drag de texto ativo
    let _penPontosCriados = 0; // quantos pontos foram criados no último touchstart da pen
    let _penUndoIdx = -1;      // índice do ponto criado, para desfazer corretamente

    // Abre modal preenchido com dados do texto sendo editado
    function _abrirEdicaoTexto() {
        const el = _textoEditando;
        if (!el) return;
        document.getElementById('btn-editar-texto').style.display = 'none';

        // Preenche o modal com os dados do elemento
        document.getElementById('texto-input').value = el.textContent;
        const tam = parseInt(el.getAttribute('font-size')) || 32;
        document.getElementById('texto-tamanho').value = tam;
        document.getElementById('texto-tam-val').textContent = tam;

        // Cor (só se não for degradê)
        const corSalva = el.getAttribute('data-cor') || '#000000';
        document.getElementById('texto-cor').value = corSalva;

        // Fonte
        const fonte = el.getAttribute('data-fonte') || 'sans-serif';
        document.getElementById('fonte-select').value = fonte;
        document.getElementById('fonte-preview').style.fontFamily = fonte;
        document.getElementById('fonte-preview').textContent = el.textContent || 'Abc 123';
        textoFonte = fonte;

        // Bold / Italic
        textoBold   = el.getAttribute('data-bold')   === '1';
        textoItalic = el.getAttribute('data-italic') === '1';
        const boldEl   = document.getElementById('txt-bold');
        const italicEl = document.getElementById('txt-italic');
        boldEl.style.color         = textoBold   ? '#03dac6' : '#aaa';
        boldEl.style.borderColor   = textoBold   ? '#03dac6' : '#333';
        italicEl.style.color       = textoItalic ? '#03dac6' : '#aaa';
        italicEl.style.borderColor = textoItalic ? '#03dac6' : '#333';

        // Degradê
        const degId  = el.getAttribute('data-deg-id')   || '';
        const degTipo = el.getAttribute('data-deg-tipo') || 'linear';
        const degC1  = el.getAttribute('data-deg-c1')   || '#ff00ff';
        const degC2  = el.getAttribute('data-deg-c2')   || '#00cfff';
        const temDeg = !!degId;
        document.getElementById('txt-degrade-ativo').checked = temDeg;
        document.getElementById('txt-degrade-wrap').style.display = temDeg ? 'flex' : 'none';
        if (temDeg) {
            document.getElementById('txt-deg-cor1').value = degC1;
            document.getElementById('txt-deg-cor2').value = degC2;
            txtDegradeTipo = degTipo;
            document.getElementById('txt-deg-linear').style.cssText =
                `flex:1;padding:5px;border-radius:7px;border:${degTipo==='linear'?'2px solid #03dac6;background:#1e2e2e;color:#03dac6':'1px solid #333;background:#2a2a2a;color:#888'};font-size:9px;font-weight:bold;text-align:center;`;
            document.getElementById('txt-deg-radial').style.cssText =
                `flex:1;padding:5px;border-radius:7px;border:${degTipo==='radial'?'2px solid #03dac6;background:#1e2e2e;color:#03dac6':'1px solid #333;background:#2a2a2a;color:#888'};font-size:9px;font-weight:bold;text-align:center;`;
        }

        // Contorno
        const cCor = el.getAttribute('data-contorno-cor') || '#000000';
        const cEsp = parseFloat(el.getAttribute('data-contorno-esp')) || 0;
        const temContorno = cEsp > 0;
        document.getElementById('txt-contorno-ativo').checked = temContorno;
        document.getElementById('txt-contorno-wrap').style.display = temContorno ? 'flex' : 'none';
        if (temContorno) {
            document.getElementById('txt-contorno-cor').value = cCor;
            document.getElementById('txt-contorno-esp').value = cEsp;
            document.getElementById('txt-contorno-esp-val').textContent = cEsp + 'px';
        }

        // Guarda posição atual do texto para reusar
        textoPosX = parseFloat(el.getAttribute('x')) || textoPosX;
        textoPosY = parseFloat(el.getAttribute('y')) || textoPosY;

        document.getElementById('modal-texto').classList.add('aberto');
        setTimeout(() => document.getElementById('texto-input').focus(), 100);
    }

    // Listener do botão circular de edição
    document.getElementById('btn-editar-texto').addEventListener('touchstart', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (!_textoEditando) return;
        // Remove o elemento antigo antes de abrir o modal (será recriado ao confirmar)
        _textoEditando._substituir = true;
        _abrirEdicaoTexto();
    }, {passive:false});

    window.ativarModoTexto = () => {
        const btn = document.getElementById('btnTexto');
        const ativo = btn.style.background === 'rgb(3, 218, 198)';
        btn.style.background = ativo ? '#333' : '#03dac6';
        btn.style.color = ativo ? 'white' : '#000';
        if (!ativo) mostrarNotificacao('T Toque na tela onde quer inserir o texto');
    };

    window.abrirModalTexto = () => {
        document.getElementById('modal-texto').classList.add('aberto');
        // Atualiza preview com fonte atual
        const sel = document.getElementById('fonte-select');
        const prev = document.getElementById('fonte-preview');
        prev.style.fontFamily = sel.value;
        setTimeout(()=>document.getElementById('texto-input').focus(),100);
    };

    document.getElementById('btn-cancelar-texto').addEventListener('touchstart',(e)=>{
        e.stopPropagation();
        document.getElementById('modal-texto').classList.remove('aberto');
        // Se estava editando um texto existente, garante que não foi removido
        if (_textoEditando && _textoEditando._substituir) {
            _textoEditando._substituir = false; // cancela a substituição
        }
        _textoEditando = null;
        // Reseta toggles para próxima abertura
        document.getElementById('txt-degrade-ativo').checked=false;
        document.getElementById('txt-degrade-wrap').style.display='none';
        document.getElementById('txt-contorno-ativo').checked=false;
        document.getElementById('txt-contorno-wrap').style.display='none';
    },{passive:true});

    document.getElementById('btn-inserir-texto').addEventListener('touchend',(e)=>{
        e.stopPropagation(); e.preventDefault(); inserirTexto();
    },{passive:false});
    document.getElementById('btn-inserir-texto').addEventListener('click',(e)=>{
        e.stopPropagation(); inserirTexto();
    });

    document.getElementById('texto-tamanho').addEventListener('input',(e)=>{
        document.getElementById('texto-tam-val').textContent=e.target.value;
    });

    // Select de fontes com preview
    const fonteSelectEl = document.getElementById('fonte-select');
    function onFonteChange() {
        textoFonte = fonteSelectEl.value;
        const prev = document.getElementById('fonte-preview');
        prev.style.fontFamily = textoFonte;
        const txt = document.getElementById('texto-input').value || 'Abc 123';
        prev.textContent = txt;
    }
    fonteSelectEl.addEventListener('change', onFonteChange);
    fonteSelectEl.addEventListener('input', onFonteChange);
    // Atualiza preview ao digitar
    document.getElementById('texto-input').addEventListener('input',(e)=>{
        const prev = document.getElementById('fonte-preview');
        prev.textContent = e.target.value || 'Abc 123';
    });
    // Fonte personalizada
    document.getElementById('btn-fonte-custom').addEventListener('touchstart',(e)=>{
        e.stopPropagation();
        const nome = document.getElementById('fonte-custom').value.trim();
        if (!nome) return;
        textoFonte = nome;
        const prev = document.getElementById('fonte-preview');
        prev.style.fontFamily = nome;
        mostrarNotificacao('Fonte "'+nome+'" aplicada!');
    },{passive:true});

    document.getElementById('txt-bold').addEventListener('touchstart',(e)=>{
        e.stopPropagation(); textoBold=!textoBold;
        const el=document.getElementById('txt-bold');
        el.style.color=textoBold?'#03dac6':'#aaa'; el.style.borderColor=textoBold?'#03dac6':'#333';
    },{passive:true});

    document.getElementById('txt-italic').addEventListener('touchstart',(e)=>{
        e.stopPropagation(); textoItalic=!textoItalic;
        const el=document.getElementById('txt-italic');
        el.style.color=textoItalic?'#03dac6':'#aaa'; el.style.borderColor=textoItalic?'#03dac6':'#333';
    },{passive:true});

    // Toggle degradê no texto
    let txtDegradeTipo = 'linear';
    document.getElementById('txt-degrade-ativo').addEventListener('change',(e)=>{
        document.getElementById('txt-degrade-wrap').style.display = e.target.checked ? 'flex' : 'none';
    });
    // Toggle contorno no texto
    document.getElementById('txt-contorno-ativo').addEventListener('change',(e)=>{
        document.getElementById('txt-contorno-wrap').style.display = e.target.checked ? 'flex' : 'none';
    });
    document.getElementById('txt-contorno-esp').addEventListener('input',(e)=>{
        document.getElementById('txt-contorno-esp-val').textContent = e.target.value + 'px';
    });
    document.getElementById('txt-deg-linear').addEventListener('touchstart',(e)=>{
        e.stopPropagation(); txtDegradeTipo='linear';
        document.getElementById('txt-deg-linear').style.cssText='flex:1;padding:6px;border-radius:8px;border:2px solid #03dac6;background:#1e2e2e;color:#03dac6;font-size:10px;font-weight:bold;text-align:center;';
        document.getElementById('txt-deg-radial').style.cssText='flex:1;padding:6px;border-radius:8px;border:1px solid #333;background:#2a2a2a;color:#888;font-size:10px;font-weight:bold;text-align:center;';
    },{passive:true});
    document.getElementById('txt-deg-radial').addEventListener('touchstart',(e)=>{
        e.stopPropagation(); txtDegradeTipo='radial';
        document.getElementById('txt-deg-radial').style.cssText='flex:1;padding:6px;border-radius:8px;border:2px solid #03dac6;background:#1e2e2e;color:#03dac6;font-size:10px;font-weight:bold;text-align:center;';
        document.getElementById('txt-deg-linear').style.cssText='flex:1;padding:6px;border-radius:8px;border:1px solid #333;background:#2a2a2a;color:#888;font-size:10px;font-weight:bold;text-align:center;';
    },{passive:true});

    function inserirTexto() {
        const txt = document.getElementById('texto-input').value.trim();
        if (!txt) return;
        const tam = parseInt(document.getElementById('texto-tamanho').value)||32;
        const cor = document.getElementById('texto-cor').value;
        const usaDeg = document.getElementById('txt-degrade-ativo').checked;
        const usaContorno = document.getElementById('txt-contorno-ativo').checked;
        const contornoCor = document.getElementById('txt-contorno-cor').value;
        const contornoEsp = parseFloat(document.getElementById('txt-contorno-esp').value)||2;
        const fonteCustom = document.getElementById('fonte-custom').value.trim();
        const fonteFinal = fonteCustom || document.getElementById('fonte-select').value || 'sans-serif';
        const c1 = document.getElementById('txt-deg-cor1').value;
        const c2 = document.getElementById('txt-deg-cor2').value;
        salvarHistorico();

        const texLayer = document.getElementById('texto-layer');
        const degId = usaDeg ? 'txt-deg-' + Date.now() : null;

        if (usaDeg) {
            let defs = texLayer.querySelector('defs');
            if (!defs) { defs=document.createElementNS(NS,'defs'); texLayer.prepend(defs); }
            let grad;
            if (txtDegradeTipo === 'radial') {
                grad = document.createElementNS(NS,'radialGradient');
                grad.setAttribute('gradientUnits','userSpaceOnUse');
                grad.setAttribute('cx', textoPosX); grad.setAttribute('cy', textoPosY);
                grad.setAttribute('r', tam * 2);
                grad.setAttribute('fx', textoPosX); grad.setAttribute('fy', textoPosY);
            } else {
                grad = document.createElementNS(NS,'linearGradient');
                grad.setAttribute('gradientUnits','userSpaceOnUse');
                grad.setAttribute('x1', textoPosX - tam*2); grad.setAttribute('y1', textoPosY);
                grad.setAttribute('x2', textoPosX + tam*2); grad.setAttribute('y2', textoPosY);
            }
            grad.setAttribute('id', degId);
            const s1=document.createElementNS(NS,'stop');
            s1.setAttribute('offset','0%'); s1.setAttribute('stop-color',c1);
            const s2=document.createElementNS(NS,'stop');
            s2.setAttribute('offset','100%'); s2.setAttribute('stop-color',c2);
            grad.appendChild(s1); grad.appendChild(s2);
            defs.appendChild(grad);
        }

        const el = document.createElementNS(NS,'text');
        el.setAttribute('x',textoPosX); el.setAttribute('y',textoPosY);
        el.setAttribute('fill', usaDeg ? `url(#${degId})` : cor);
        el.setAttribute('font-size',tam);
        el.setAttribute('font-family', fonteFinal);
        el.style.fontFamily = fonteFinal;
        el.setAttribute('font-weight',textoBold?'bold':'normal');
        el.setAttribute('font-style',textoItalic?'italic':'normal');
        el.setAttribute('dominant-baseline','middle');
        el.setAttribute('text-anchor','middle');
        if (usaContorno) {
            el.setAttribute('stroke', contornoCor);
            el.setAttribute('stroke-width', contornoEsp);
            el.style.paintOrder = 'stroke fill';
        }
        // Guarda metadados para edição posterior
        el.setAttribute('data-cor', cor);
        el.setAttribute('data-tam', tam);
        el.setAttribute('data-fonte', fonteFinal);
        el.setAttribute('data-bold', textoBold ? '1' : '0');
        el.setAttribute('data-italic', textoItalic ? '1' : '0');
        el.setAttribute('data-contorno-cor', usaContorno ? contornoCor : '');
        el.setAttribute('data-contorno-esp', usaContorno ? contornoEsp : '0');
        el.setAttribute('data-deg-id', degId || '');
        el.setAttribute('data-deg-tipo', usaDeg ? txtDegradeTipo : '');
        el.setAttribute('data-deg-c1', usaDeg ? c1 : '');
        el.setAttribute('data-deg-c2', usaDeg ? c2 : '');
        el.textContent=txt;
        // Se estiver editando um texto existente, remove o antigo
        if (_textoEditando && _textoEditando._substituir) {
            // Remove o gradiente antigo se tinha
            const oldDegId = _textoEditando.getAttribute('data-deg-id');
            if (oldDegId) {
                const oldGrad = document.getElementById(oldDegId);
                if (oldGrad) oldGrad.remove();
            }
            texLayer.insertBefore(el, _textoEditando);
            _textoEditando.remove();
            _textoEditando = null;
        } else {
            texLayer.appendChild(el);
        }
        document.getElementById('modal-texto').classList.remove('aberto');
        document.getElementById('texto-input').value='';
        document.getElementById('txt-degrade-ativo').checked=false;
        document.getElementById('txt-degrade-wrap').style.display='none';
        document.getElementById('txt-contorno-ativo').checked=false;
        document.getElementById('txt-contorno-wrap').style.display='none';

        if (usaDeg) {
            // Garante que degradê normal está desativado
            _esconderBolinhasDegrade();
            modoDegrade = false; degradeStart = null;
            _dgPrevReset();
            // Ativa bolinhas para ajuste do degradê do texto
            if (txtDegradeTipo === 'radial') {
                _txtDgAjuste = { tipo:'radial', degId, el,
                    x1: textoPosX, y1: textoPosY,
                    x2: textoPosX + tam*2, y2: textoPosY,
                    c1, c2 };
            } else {
                _txtDgAjuste = { tipo:'linear', degId, el,
                    x1: textoPosX - tam*2, y1: textoPosY,
                    x2: textoPosX + tam*2, y2: textoPosY,
                    c1, c2 };
            }
            _atualizarBolinhasTxtDg();
            mostrarNotificacao('🎨 Arraste as bolinhas para ajustar o degradê');
        } else {
            mostrarNotificacao('✓ Texto inserido!');
        }
    }

    // ── 3. RÉGUA E GUIAS ─────────────────────────────────────────────────
    let reguaAtiva = false;
    let guias = [];

    window.toggleRegua = () => {
        reguaAtiva=!reguaAtiva;
        const btn=document.getElementById('btnRegua');
        btn.style.background=reguaAtiva?'#03dac6':'#333';
        btn.style.color=reguaAtiva?'#000':'white';
        document.getElementById('regua-h').style.display=reguaAtiva?'block':'none';
        document.getElementById('regua-v').style.display=reguaAtiva?'block':'none';
        document.getElementById('guias-layer').style.display=reguaAtiva?'block':'none';
        // Atualiza régua quando zoom muda
        if (reguaAtiva) update();
        if(reguaAtiva) {
            desenharReguas();
            mostrarNotificacao('📐 Arraste das réguas para criar guias');
        }
    };

    function desenharReguas() {
        const rh = document.getElementById('regua-h');
        const rv = document.getElementById('regua-v');
        // Régua horizontal fixa no topo da tela
        rh.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:18px;background:rgba(20,20,20,0.9);z-index:25;pointer-events:all;overflow:hidden;box-sizing:border-box;display:block;';
        rh.innerHTML = '';
        const step = Math.max(20, Math.round(40/scale));
        // Coordenada do canvas visível na tela
        const canvasLeft = -posX/scale;
        const W = window.innerWidth/scale;
        for(let x=Math.floor(canvasLeft/step)*step; x<canvasLeft+W; x+=step){
            const screenX = (x - canvasLeft) * scale;
            const d = document.createElement('span');
            d.style.cssText = `position:absolute;left:${screenX}px;top:1px;font-size:7px;color:#888;white-space:nowrap;`;
            d.textContent = Math.round(x);
            rh.appendChild(d);
            const tick = document.createElement('div');
            tick.style.cssText = `position:absolute;left:${screenX}px;bottom:0;width:1px;height:5px;background:#555;`;
            rh.appendChild(tick);
        }
        // Régua vertical fixa na esquerda
        rv.style.cssText = 'position:fixed;top:18px;left:0;width:18px;height:calc(100% - 18px);background:rgba(20,20,20,0.9);z-index:25;pointer-events:all;overflow:hidden;display:block;';
        rv.innerHTML = '';
        const canvasTop = -posY/scale;
        const H = window.innerHeight/scale;
        for(let y=Math.floor(canvasTop/step)*step; y<canvasTop+H; y+=step){
            const screenY = (y - canvasTop) * scale;
            const d = document.createElement('span');
            d.style.cssText = `position:absolute;top:${screenY}px;left:0;font-size:7px;color:#888;writing-mode:vertical-lr;white-space:nowrap;`;
            d.textContent = Math.round(y);
            rv.appendChild(d);
        }
        renderizarGuias();
    }

    function renderizarGuias() {
        const gl=document.getElementById('guias-layer');
        gl.innerHTML='';
        guias.forEach(g=>{
            const div=document.createElement('div');
            div.className=g.tipo==='h'?'guia-h':'guia-v';
            if(g.tipo==='h') div.style.top=g.pos+'px';
            else div.style.left=g.pos+'px';
            gl.appendChild(div);
        });
    }

    document.getElementById('regua-h').addEventListener('touchstart',(e)=>{
        if(!reguaAtiva) return;
        const {y} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
        guias.push({tipo:'h',pos:Math.max(0,y)});
        renderizarGuias();
    },{passive:true});

    document.getElementById('regua-v').addEventListener('touchstart',(e)=>{
        if(!reguaAtiva) return;
        const {x} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
        guias.push({tipo:'v',pos:Math.max(0,x)});
        renderizarGuias();
    },{passive:true});

    // ── 4. CONTA-GOTAS ───────────────────────────────────────────────────
    let modoContaGotas = false;

    window.toggleContaGotas = () => {
        modoContaGotas=!modoContaGotas;
        const btn=document.getElementById('btnContaGotas');
        btn.style.background=modoContaGotas?'#f39c12':'#333';
        const cur=document.getElementById('conta-gotas-cursor');
        cur.style.display=modoContaGotas?'block':'none';
        if(modoContaGotas) {
            modoPen=false; modoLivre=false; modoBorracha=false;
            mostrarNotificacao('💧 Toque em qualquer cor para capturá-la');
        }
    };

    function capturarCor(clientX, clientY) {
        const {x: px, y: py} = clientParaCanvas(clientX, clientY);
        const W=workSurface.offsetWidth, H=workSurface.offsetHeight;
        const c=document.createElement('canvas');
        c.width=W; c.height=H;
        const ctx=c.getContext('2d');
        ctx.fillStyle=modoInfinito?'#1a1a1a':'white';
        ctx.fillRect(0,0,W,H);
        // Serializa todos os SVGs visíveis num único SVG e converte para img
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
            ${drawLayer.innerHTML}${livreLayer.innerHTML}
            ${document.getElementById('texto-layer').innerHTML}
        </svg>`;
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img,0,0);
            URL.revokeObjectURL(img.src);
            const d=ctx.getImageData(Math.round(px),Math.round(py),1,1).data;
            const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
            document.getElementById('col-main').value=hex;
            document.getElementById('conta-gotas-cursor').style.background=hex;
            modoContaGotas=false;
            document.getElementById('btnContaGotas').style.background='#333';
            document.getElementById('conta-gotas-cursor').style.display='none';
            mostrarNotificacao('💧 Cor capturada: '+hex);
        };
        img.onerror = () => URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'}));
    }

    // ── 5. ESPELHO ───────────────────────────────────────────────────────
    let modoEspelho = false;

    window.toggleEspelho = () => {
        modoEspelho=!modoEspelho;
        document.getElementById('btnEspelho').style.background=modoEspelho?'#9b59b6':'#333';
        document.getElementById('espelho-line').style.display = modoEspelho ? 'block' : 'none';
        if(modoEspelho) mostrarNotificacao('⟺ Espelho ativo — o que desenhar à esquerda reflete à direita!');
    };

    // Chamado ao finalizar um traço do pincel livre
    function aplicarEspelho(grupo) {
        if(!modoEspelho||!grupo) return;
        // Eixo de espelho = centro da tela atual em coordenadas do canvas
        const eixoX = (-posX + window.innerWidth/2) / scale;
        const mirror=grupo.cloneNode(true);
        // Reflete em relação ao eixo central
        mirror.setAttribute('transform',`translate(${eixoX*2},0) scale(-1,1)`);
        livreLayer.appendChild(mirror);
    }

    // ── 6. HISTÓRICO VISÍVEL ─────────────────────────────────────────────
    let painelHistoricoAberto=false;

    window.toggleHistorico=()=>{
        painelHistoricoAberto=!painelHistoricoAberto;
        document.getElementById('painel-historico').classList.toggle('aberto',painelHistoricoAberto);
        const btn=document.getElementById('btnHistorico');
        btn.style.background=painelHistoricoAberto?'#03dac6':'#333';
        btn.style.color=painelHistoricoAberto?'#000':'white';
        if(painelHistoricoAberto) atualizarListaHistorico();
    };

    function atualizarListaHistorico() {
        const lista=document.getElementById('hist-lista');
        lista.innerHTML='';
        if(historico.length===0){
            lista.innerHTML='<div style="color:#555;font-size:11px;text-align:center;padding:20px;">Nenhuma ação ainda</div>';
            return;
        }
        // Estado atual no topo
        const cur=document.createElement('div');
        cur.className='hist-item atual'; cur.textContent='● Estado atual';
        lista.appendChild(cur);
        // Lista do mais recente ao mais antigo
        [...historico].reverse().forEach((snap, i)=>{
            const div=document.createElement('div');
            div.className='hist-item';
            div.textContent=`Ação ${historico.length-i}`;
            div.addEventListener('touchstart',(e)=>{
                e.stopPropagation();
                // Restaura snapshot diretamente sem destruir o histórico
                const snapObj = JSON.parse(snap);
                if (snapObj.camadas !== undefined) {
                    camadas = snapObj.camadas;
                } else {
                    camadas = snapObj;
                }
                caminhoAtivo=-1; pontosPen=[]; pathFechado=false;
                penLayer.innerHTML='';
                document.getElementById('btn-confirmar-pen').style.display='none';
                renderizarTodos();
                if(painelAberto) renderizarPainel();
                atualizarListaHistorico();
            },{passive:true});
            lista.appendChild(div);
        });
    }

    function update() {
        workSurface.style.transform = `translate(${posX}px, ${posY}px) scale(${scale}) rotate(${rotacao}deg)`;
        if (_dgAjuste) _atualizarBolinhasDegrade();
    }

    // Clamp posX/posY para manter pelo menos `margem` px da folha sempre visível.
    // Usa os 4 cantos reais da folha rotacionada (via canvasParaClient) para calcular
    // o bounding box correto na tela, independente do ângulo de rotação.
    function _clampPos() {
        const cW = workSurface.offsetWidth, cH = workSurface.offsetHeight;
        const rad = rotacao * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);

        // Bounding box dos 4 cantos da folha rotacionada projetados na tela
        const cantos = [{x:0,y:0},{x:cW,y:0},{x:cW,y:cH},{x:0,y:cH}];
        const tela = cantos.map(p => ({
            x: posX + (p.x * scale) * cos - (p.y * scale) * sin,
            y: posY + (p.x * scale) * sin + (p.y * scale) * cos
        }));
        const minX = Math.min(...tela.map(p=>p.x));
        const maxX = Math.max(...tela.map(p=>p.x));
        const minY = Math.min(...tela.map(p=>p.y));
        const maxY = Math.max(...tela.map(p=>p.y));

        const sw = window.innerWidth, sh = window.innerHeight;
        // Mínimo de 120px da folha visível em cada lado
        const margem = 120;
        if (maxX < margem)      posX += margem - maxX;
        if (minX > sw - margem) posX -= minX - (sw - margem);
        if (maxY < margem)      posY += margem - maxY;
        if (minY > sh - margem) posY -= minY - (sh - margem);
    }

    // Converte coordenadas de tela (clientX/Y) para coordenadas do canvas (SVG),
    // levando em conta translação, escala E rotação da folha.
    function clientParaCanvas(clientX, clientY) {
        // Centro geométrico da folha na tela (antes da rotação CSS, que usa transform-origin: 0 0)
        // O pivot do CSS é (posX, posY) no espaço da tela
        const rad = rotacao * Math.PI / 180;
        const cos = Math.cos(-rad), sin = Math.sin(-rad);
        // Posição relativa ao ponto de origem do transform
        const dx = clientX - posX;
        const dy = clientY - posY;
        // Desfaz a rotação
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        // Divide pela escala para chegar nas coordenadas do SVG
        return { x: rx / scale, y: ry / scale };
    }

    // _clampPos já definida acima (versão correta com suporte a rotação)
    function canvasParaClient(canvasX, canvasY) {
        const rad = rotacao * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const rx = canvasX * scale, ry = canvasY * scale;
        return {
            x: posX + rx * cos - ry * sin,
            y: posY + rx * sin + ry * cos
        };
    }

    let _indicadorRotTimer = null;
    function _atualizarIndicadorRotacao() {
        const el = document.getElementById('indicador-rotacao');
        if (!el) return;
        // Normaliza para 0–359
        const graus = ((Math.round(rotacao) % 360) + 360) % 360;
        el.textContent = `↻ ${graus}°`;
        el.style.display = 'block';
        // Esconde após 1.5s de inatividade
        if (_indicadorRotTimer) clearTimeout(_indicadorRotTimer);
        _indicadorRotTimer = setTimeout(() => { el.style.display = 'none'; }, 1500);
    }

    // ── CATMULL-ROM ───────────────────────────────────────────────────────────
    function catmullRomSegmento(p0, p1, p2, p3) {
        const cp1x = p1.x + (p2.x - p0.x) / 3, cp1y = p1.y + (p2.y - p0.y) / 3;
        const cp2x = p2.x - (p3.x - p1.x) / 3, cp2y = p2.y - (p3.y - p1.y) / 3;
        return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    function buildPathD(pts, fechado) {
        const n = pts.length;
        if (n === 0) return '';
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < n - 1; i++) {
            const curr = pts[i], next = pts[i+1];
            if (curr.tipo === 'curva' || next.tipo === 'curva') {
                // Tangente em ponto ROSA (ancora) deve ser zero (canto nítido):
                //   para zerar tangente em curr rosa: prev == next  (força tangente = 0)
                //   para zerar tangente em next rosa: far  == curr  (força tangente = 0)
                // Tangente em ponto AZUL (curva) usa vizinhos reais para curva suave.
                // FIX: quando curr é azul e next também é azul (ou vice-versa),
                //      ambos usam seus vizinhos reais → curva simétrica nos dois lados.
                const prev = curr.tipo === 'ancora'
                    ? next                                          // zero tangente no rosa
                    : (i > 0 ? pts[i-1] : curr);                  // vizinho real do azul
                const far = next.tipo === 'ancora'
                    ? curr                                          // zero tangente no rosa
                    : (i+2 < n ? pts[i+2] : next);                // vizinho real do azul
                d += ' ' + catmullRomSegmento(prev, curr, next, far);
            } else { d += ` L ${next.x} ${next.y}`; }
        }
        if (fechado && n >= 3) {
            const last = pts[n-1], first = pts[0];
            if (last.tipo === 'curva' || first.tipo === 'curva') {
                const prev = last.tipo  === 'ancora' ? first  : pts[n-2];
                const far  = first.tipo === 'ancora' ? last   : (pts[1] || first);
                d += ' ' + catmullRomSegmento(prev, last, first, far);
            } else { d += ' Z'; }
        }
        return d;
    }

    // Pincéis compatíveis com Pen Tool (path único suavizado)
    const PINCEIS_PEN = new Set(['normal','marcador','tracejado','caligrafia','oleo','neon','lasso','duplo']);

    function aplicarEstiloPath(pathEl, cam, opacidadeExtra) {
        const pincel = cam ? (cam.pincel||'normal') : pincelAtual;
        const cor    = cam ? cam.stroke  : document.getElementById('col-main').value;
        const tam    = cam ? parseFloat(cam.width)   : getTam();
        const op     = cam ? parseFloat(cam.opacity) * (opacidadeExtra??1)
                           : getOpac() * (opacidadeExtra??1);

        // Reset
        pathEl.setAttribute('fill','none');
        pathEl.setAttribute('stroke-linecap','round');
        pathEl.setAttribute('stroke-linejoin','round');
        pathEl.setAttribute('stroke-dasharray','');
        pathEl.removeAttribute('filter');

        // Aplica estilo conforme pincel
        switch(pincel) {
            case 'marcador':
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', tam*1.8);
                pathEl.setAttribute('stroke-opacity', 1);
                pathEl.setAttribute('stroke-linecap','square');
                pathEl.setAttribute('stroke-linejoin','miter');
                break;
            case 'tracejado':
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', tam);
                pathEl.setAttribute('stroke-opacity', op);
                pathEl.setAttribute('stroke-dasharray', `${tam*2} ${tam*1.5}`);
                break;
            case 'neon':
                // Neon: adiciona camadas extras como elementos irmãos se ainda não existem
                pathEl.setAttribute('stroke', corMais(cor, 120));
                pathEl.setAttribute('stroke-width', tam*0.35);
                pathEl.setAttribute('stroke-opacity', 1);
                // As camadas de glow são adicionadas em renderizarPathComPincel
                break;
            case 'oleo':
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', tam);
                pathEl.setAttribute('stroke-opacity', op*0.9);
                break;
            case 'lasso':
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', tam*0.55);
                pathEl.setAttribute('stroke-opacity', op*0.95);
                pathEl.setAttribute('stroke-dasharray', `${tam} ${tam*0.4}`);
                break;
            case 'duplo':
                // Duplo é tratado especialmente em renderizarPathComPincel
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', Math.max(0.5,tam*0.35));
                pathEl.setAttribute('stroke-opacity', op);
                break;
            case 'caligrafia':
                // Caligrafia varia por segmento — usa normal como fallback no preview
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', tam);
                pathEl.setAttribute('stroke-opacity', op);
                break;
            default: // normal
                pathEl.setAttribute('stroke', cor);
                pathEl.setAttribute('stroke-width', tam);
                pathEl.setAttribute('stroke-opacity', op);
        }
    }

    // Renderiza um caminho da pen tool com o pincel correto num <g> pai
    function renderizarPathComPincel(d, cam, opExtra) {
        const pincel = cam ? (cam.pincel||'normal') : pincelAtual;
        const cor    = cam ? cam.stroke : document.getElementById('col-main').value;
        const tam    = cam ? parseFloat(cam.width) : getTam();
        const op     = cam ? parseFloat(cam.opacity)*(opExtra??1) : getOpac()*(opExtra??1);
        const g = mkEl('g',{});

        if (pincel === 'neon') {
            const g1 = svgPath(d,cor,tam*7,op*0.04,'round');
            const g2 = svgPath(d,cor,tam*4,op*0.09,'round');
            const g3 = svgPath(d,cor,tam*2,op*0.22,'round');
            const g4 = svgPath(d,cor,tam*1,op*0.55,'round');
            const g5 = svgPath(d,corMais(cor,120),tam*0.35,1,'round');
            [g1,g2,g3,g4,g5].forEach(el=>g.appendChild(el));
        } else if (pincel === 'duplo') {
            // Dois paths paralelos baseados nos pontos
            const pts = cam ? cam.pontos : pontosPen;
            let d1=`M${pts[0].x} ${pts[0].y}`, d2=`M${pts[0].x} ${pts[0].y}`;
            for (let i=1;i<pts.length;i++) {
                const dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y;
                const len=Math.hypot(dx,dy)||1;
                const nx=-dy/len*tam*0.65, ny=dx/len*tam*0.65;
                d1+=` L${pts[i].x+nx} ${pts[i].y+ny}`;
                d2+=` L${pts[i].x-nx} ${pts[i].y-ny}`;
            }
            g.appendChild(svgPath(d1,cor,Math.max(0.5,tam*0.35),op,'round'));
            g.appendChild(svgPath(d2,cor,Math.max(0.5,tam*0.35),op,'round'));
        } else if (pincel === 'oleo') {
            g.appendChild(svgPath(d,cor,tam,op*0.9,'round'));
            g.appendChild(svgPath(d,corMais(cor,70),tam*0.28,op*0.2,'round'));
        } else if (pincel === 'lasso') {
            // Na pen tool, lasso preenche a área fechada
            const f = mkEl('path',{d:d+' Z', fill:cor, 'fill-opacity':op, stroke:'none'});
            g.appendChild(f);
        } else {
            const p = document.createElementNS(NS,'path');
            p.setAttribute('d',d);
            aplicarEstiloPath(p,cam,opExtra);
            g.appendChild(p);
        }
        return g;
    }

    // ── RENDERIZAR pen-layer (caminho em edição) ──────────────────────────────
    function renderizarPen() {
        penLayer.innerHTML = '';
        const btn = document.getElementById('btn-confirmar-pen');
        if (pontosPen.length === 0) { btn.style.display = 'none'; return; }
        const d = buildPathD(pontosPen, pathFechado);
        // Preview com o pincel atual
        const g = renderizarPathComPincel(d, null, 1);
        penLayer.appendChild(g);
        pontosPen.forEach(p => {
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
            c.setAttribute('r', 12/scale);
            c.setAttribute('fill', p.tipo === 'curva' ? '#03dac6' : '#ff00ff');
            penLayer.appendChild(c);
        });
        // Posiciona botão ✓ no último ponto do traço
        if (pontosPen.length >= 2) {
            const ultimo = pontosPen[pontosPen.length - 1];
            // Converte coordenadas SVG → posição relativa ao work-surface
            const px = ultimo.x * scale;
            const py = ultimo.y * scale;
            // Offset para não sobrepor o ponto âncora
            const offX = 30, offY = -30;
            btn.style.left = (px + offX) + 'px';
            btn.style.top  = (py + offY) + 'px';
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    }

    // ── RENDERIZAR draw-layer (todos os caminhos salvos de todas as camadas) ──
    let _renderRAF = null;
    function renderizarTodos() {
        if (_renderRAF) return; // já tem render agendado
        _renderRAF = requestAnimationFrame(() => {
            _renderRAF = null;
            _renderizarTodosImediato();
        });
    }
    function _renderizarCamadaDesenho(cam) {
        if (!cam.visivel) return;
        if (cam.livreHTML) {
            const tmpSVG = document.createElementNS('http://www.w3.org/2000/svg','svg');
            tmpSVG.innerHTML = cam.livreHTML;
            const g = document.createElementNS('http://www.w3.org/2000/svg','g');
            g.style.opacity = cam.opacidade;
            [...tmpSVG.children].forEach(child => {
                if (child.tagName.toLowerCase() === 'defs') {
                    livreLayer.appendChild(child.cloneNode(true));
                } else {
                    g.appendChild(child.cloneNode(true));
                }
            });
            livreLayer.appendChild(g);
        }
        cam.caminhos.forEach((c, ci) => {
            const globalIdx = camadas.indexOf(cam);
            const isAtivo   = (globalIdx === camadaAtiva && ci === caminhoAtivo);
            if (isAtivo) return;
            const d = buildPathD(c.pontos, c.fechado);
            if (!d) return;
            const opExtra = caminhoAtivo >= 0 ? 0.25 : cam.opacidade;
            const g = renderizarPathComPincel(d, c, opExtra);
            drawLayer.appendChild(g);
        });
    }

    function _renderizarTodosImediato() {
        drawLayer.innerHTML = '';
        livreLayer.innerHTML = '';

        // Constrói a lista de renderização respeitando fotoOrdem
        // fotoOrdem = -1 → foto embaixo de tudo (padrão)
        // fotoOrdem = 0  → foto acima de tudo
        // fotoOrdem = N  → foto entre camada[N-1] e camada[N]
        // A lista interna é [0]=topo ... [N-1]=fundo
        // Na renderização, desenhamos de baixo pra cima (reverse)

        const totalCamadas = camadas.length;
        // Normaliza fotoOrdem: -1 e >= totalCamadas = fundo (after last)
        const fotoPos = (fotoOrdem < 0 || fotoOrdem >= totalCamadas) ? totalCamadas : fotoOrdem;

        // Renderiza de baixo pra cima:
        // índices altos do array = fundo visual (renderizados primeiro)
        // índice 0 = topo visual (renderizado por último)
        // fotoPos 0 = foto no topo, fotoPos=totalCamadas = foto no fundo

        // Desenha camadas abaixo da foto (índices >= fotoPos, renderizados primeiro = fundo)
        for (let i = totalCamadas - 1; i >= fotoPos; i--) {
            _renderizarCamadaDesenho(camadas[i]);
        }

        // Desenha a foto na sua posição
        svgArea.style.opacity = camadaFoto.visivel ? camadaFoto.opacidade : 0;
        // Move svgArea para a posição correta no DOM do work-surface
        // A ordem visual é controlada por z-index do svgArea via posicionamento no DOM
        // Como svgArea é position:absolute, usamos um wrapper que reposicionamos
        _reposicionarSvgArea(fotoPos, totalCamadas);

        // Desenha camadas acima da foto (índices < fotoPos, renderizados depois = frente)
        for (let i = fotoPos - 1; i >= 0; i--) {
            _renderizarCamadaDesenho(camadas[i]);
        }
    }

    // Reposiciona svgArea no z-index correto via elemento irmão
    function _reposicionarSvgArea(fotoPos, totalCamadas) {
        // fotoPos=totalCamadas → foto no fundo (z-index baixo: atrás de draw e livre layers)
        // fotoPos=0 → foto no topo (z-index alto: na frente de draw e livre layers)
        // Implementamos movendo o svgArea para antes/depois dos outros layers no DOM
        const ws = workSurface;
        const drawL = document.getElementById('draw-layer');
        const livreL = document.getElementById('livre-layer');

        if (fotoPos >= totalCamadas) {
            // Foto no fundo: svgArea antes dos layers de desenho
            if (svgArea.nextSibling !== drawL) {
                ws.insertBefore(svgArea, drawL);
            }
        } else if (fotoPos === 0) {
            // Foto no topo: svgArea depois dos layers de desenho
            const textoL = document.getElementById('texto-layer');
            if (svgArea.nextSibling !== textoL && textoL) {
                ws.insertBefore(svgArea, textoL);
            } else if (!textoL && svgArea !== ws.lastElementChild) {
                ws.appendChild(svgArea);
            }
        } else {
            // Foto no meio: coloca entre draw e livre layers
            // Como só temos 2 layers SVG de conteúdo (draw e livre),
            // a posição "meio" fica logo antes do livre-layer
            if (svgArea.nextSibling !== livreL) {
                ws.insertBefore(svgArea, livreL);
            }
        }
    }

    // ── SALVAR caminho ativo ──────────────────────────────────────────────────
    function salvarCaminhoAtivo() {
        if (caminhoAtivo < 0 || pontosPen.length < 2) return;
        getCaminhos()[caminhoAtivo] = {
            pontos:  [...pontosPen], fechado: pathFechado,
            stroke:  document.getElementById('col-main').value,
            width:   document.getElementById('brush-size').value,
            opacity: document.getElementById('brush-opacity').value,
            tipo:    document.getElementById('pincel-tipo').value,
            pincel:  pincelAtual, // salva o pincel atual
        };
    }

    function mostrarDicaEditar(mostrar) {
        document.getElementById('dica-editar').style.display = mostrar ? 'block' : 'none';
    }

    function encerrarEdicao() {
        salvarHistorico(); // snapshot antes de encerrar
        salvarCaminhoAtivo();
        caminhoAtivo = -1; pontosPen = []; pathFechado = false;
        penLayer.innerHTML = '';
        document.getElementById('btn-confirmar-pen').style.display = 'none';
        document.getElementById('btnFechar').style.background = '#333';
        renderizarTodos();
    }



    document.getElementById('btn-confirmar-pen').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
        confirmarPen();
    }, {passive: false});

    // Botão ✓ — confirma e salva o caminho atual, inicia um novo (pen) ou encerra (editar)
    window.confirmarPen = () => {
        if (pontosPen.length < 2) return;
        salvarHistorico();
        salvarCaminhoAtivo();
        if (modoEditar) {
            // No modo editar: apenas salva e limpa a seleção
            caminhoAtivo = -1; pontosPen = []; pathFechado = false;
            penLayer.innerHTML = '';
            document.getElementById('btn-confirmar-pen').style.display = 'none';
            document.getElementById('btnFechar').style.background = '#333';
            renderizarTodos();
            mostrarNotificacao('✅ Caminho salvo!');
            return;
        }
        // Na Pen Tool: inicia novo caminho vazio na mesma camada
        const caminhos = getCaminhos();
        caminhoAtivo = caminhos.length;
        caminhos.push({
            pontos: [], fechado: false,
            stroke:  document.getElementById('col-main').value,
            width:   document.getElementById('brush-size').value,
            opacity: document.getElementById('brush-opacity').value,
            tipo:    document.getElementById('pincel-tipo').value
        });
        pontosPen   = caminhos[caminhoAtivo].pontos;
        pathFechado = false;
        document.getElementById('btnFechar').style.background = '#333';
        document.getElementById('btn-confirmar-pen').style.display = 'none';
        penLayer.innerHTML = '';
        renderizarTodos();
    };

    // ── PAINEL DE CAMADAS UI ──────────────────────────────────────────────────
    let painelAberto = false;

    window.togglePainel = () => {
        painelAberto = !painelAberto;
        document.getElementById('painel-camadas').classList.toggle('aberto', painelAberto);
        document.getElementById('btnCamadas').style.background = painelAberto ? '#03dac6' : '#333';
        if (painelAberto) renderizarPainel();
    };

    function renderizarPainel() {
        const lista = document.getElementById('lista-camadas');
        lista.innerHTML = '';

        // Constrói lista unificada: camadas de desenho + camada foto na posição fotoOrdem
        // fotoOrdem -1 ou >= camadas.length = fundo (aparece no fim da lista visual)
        const totalCamadas = camadas.length;
        const fotoPos = (fotoOrdem < 0 || fotoOrdem >= totalCamadas) ? totalCamadas : fotoOrdem;

        // Lista visual: índice 0 = topo (primeira posição), índice N = fundo (última)
        // Cria array de "slots" onde cada slot é {tipo:'desenho',idx} ou {tipo:'foto'}
        const slots = [];
        for (let i = 0; i < totalCamadas; i++) slots.push({tipo:'desenho', idx:i});
        slots.splice(fotoPos, 0, {tipo:'foto'});

        // Renderiza cada slot
        slots.forEach((slot, slotIdx) => {
            if (slot.tipo === 'foto') {
                // ── Camada FOTO (movível) ──
                const fotoDiv = document.createElement('div');
                fotoDiv.className = 'camada-item';
                fotoDiv.setAttribute('data-slot', slotIdx);
                fotoDiv.setAttribute('data-tipo', 'foto');
                fotoDiv.style.borderColor = '#555';
                fotoDiv.style.opacity = camadaFoto.svgHTML ? '1' : '0.4';
                fotoDiv.innerHTML = `
                    <div class="camada-row1">
                        <div style="font-size:20px;flex-shrink:0;">📷</div>
                        <span style="flex:1;font-size:11px;color:#aaa;padding:2px 4px;">Foto vetorizada</span>
                        <span class="tag-foto-layer">FOTO</span>
                        <div class="camada-btns">
                            <button class="camada-btn foto-vis-btn"
                                style="background:${camadaFoto.visivel?'#03dac6':'#444'}">
                                ${camadaFoto.visivel ? '👁' : '🚫'}
                            </button>
                        </div>
                    </div>
                    <div class="camada-row2">
                        <label>OPAC</label>
                        <input type="range" min="0" max="1" step="0.05"
                            value="${camadaFoto.opacidade}"
                            onclick="event.stopPropagation()">
                    </div>`;

                fotoDiv.querySelector('.foto-vis-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleVisibilidadeFoto(e.currentTarget);
                });
                fotoDiv.querySelector('input[type=range]').addEventListener('input', (e) => {
                    setOpacidadeFoto(e.target.value);
                });

                // Drag para reordenar (igual às camadas normais)
                _adicionarDragCamada(fotoDiv, slotIdx, slots);
                lista.appendChild(fotoDiv);

            } else {
                // ── Camada de desenho ──
                const idx = slot.idx;
                const cam = camadas[idx];
                const div = document.createElement('div');
                div.className = 'camada-item' + (idx === camadaAtiva ? ' ativa' : '');
                const thumb = gerarThumbnail(cam);
                div.setAttribute('data-idx', idx);
                div.setAttribute('data-slot', slotIdx);
                div.setAttribute('data-tipo', 'desenho');
                div.setAttribute('draggable', false);
                div.innerHTML = `
                    <div class="camada-row1">
                        <img class="camada-thumb" src="${thumb}">
                        <input class="camada-nome" value="${cam.nome}"
                            onclick="event.stopPropagation()">
                        <div class="camada-btns">
                            <button class="camada-btn camada-btn-vis"
                                style="background:${cam.visivel?'#03dac6':'#444'}">
                                ${cam.visivel ? '👁' : '🚫'}
                            </button>
                            <button class="camada-btn camada-btn-dup" style="background:#555;">⧉</button>
                            <button class="camada-btn del camada-btn-del">✕</button>
                        </div>
                    </div>
                    <div class="camada-row2">
                        <label>OPAC</label>
                        <input type="range" min="0" max="1" step="0.05"
                            value="${cam.opacidade}"
                            onclick="event.stopPropagation()">
                    </div>`;

                const capturedIdx = idx;

                div.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                    if (caminhoAtivo >= 0 && pontosPen.length >= 2) salvarCaminhoAtivo();
                    caminhoAtivo = -1; pontosPen = []; pathFechado = false;
                    penLayer.innerHTML = '';
                    document.getElementById('btn-confirmar-pen').style.display = 'none';
                    document.getElementById('btnFechar').style.background = '#333';
                    camadaAtiva = capturedIdx;
                    if (modoPen) {
                        const caminhos = getCaminhos();
                        caminhoAtivo = caminhos.length;
                        caminhos.push({
                            pontos: [], fechado: false,
                            stroke:  document.getElementById('col-main').value,
                            width:   document.getElementById('brush-size').value,
                            opacity: document.getElementById('brush-opacity').value,
                            tipo:    document.getElementById('pincel-tipo').value,
                            pincel:  pincelAtual,
                        });
                        pontosPen = caminhos[caminhoAtivo].pontos;
                    }
                    renderizarTodos();
                    renderizarPainel();
                });

                div.querySelector('.camada-btn-vis').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleVisibilidade(capturedIdx, e.currentTarget);
                });
                div.querySelector('.camada-btn-dup').addEventListener('click', (e) => {
                    e.stopPropagation();
                    duplicarCamada(capturedIdx);
                });
                div.querySelector('.camada-btn-del').addEventListener('click', (e) => {
                    e.stopPropagation();
                    deletarCamada(capturedIdx);
                });
                div.querySelector('.camada-nome').addEventListener('change', (e) => {
                    renomearCamada(capturedIdx, e.target.value);
                });
                div.querySelector('input[type=range]').addEventListener('input', (e) => {
                    setOpacidadeCamada(capturedIdx, e.target.value);
                });

                _adicionarDragCamada(div, slotIdx, slots);
                lista.appendChild(div);
            }
        });
    }

    // Adiciona lógica de drag-to-reorder unificada (funciona para foto e desenho)
    function _adicionarDragCamada(div, slotIdx, slots) {
        let dragSlot = -1, dragStartY = 0, dragAtivo = false;
        div.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            dragSlot   = slotIdx;
            dragStartY = e.touches[0].clientY;
            dragAtivo  = false;
        }, {passive: true});
        div.addEventListener('touchmove', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            if (dragSlot < 0) return;
            const dy = Math.abs(e.touches[0].clientY - dragStartY);
            if (dy > 8) dragAtivo = true;
            if (!dragAtivo) return;
            e.stopPropagation(); e.preventDefault();
            div.classList.add('arrastando');
            const y = e.touches[0].clientY;
            document.querySelectorAll('.camada-item').forEach(el => el.classList.remove('drag-over'));
            for (const el of [...document.querySelectorAll('.camada-item')]) {
                const r = el.getBoundingClientRect();
                if (y >= r.top && y <= r.bottom && el !== div) { el.classList.add('drag-over'); break; }
            }
        }, {passive: false});
        div.addEventListener('touchend', (e) => {
            if (!dragAtivo) { div.classList.remove('arrastando'); dragSlot=-1; return; }
            div.classList.remove('arrastando');
            const allDivs = [...document.querySelectorAll('.camada-item')];
            let targetSlot = -1;
            allDivs.forEach(el => {
                el.classList.remove('drag-over');
                const ts  = parseInt(el.getAttribute('data-slot'));
                const r   = el.getBoundingClientRect();
                const y   = e.changedTouches[0].clientY;
                if (y >= r.top && y <= r.bottom && ts !== dragSlot) targetSlot = ts;
            });
            if (targetSlot >= 0 && targetSlot !== dragSlot) {
                _reordenarSlots(dragSlot, targetSlot, slots);
            }
            dragSlot = -1; dragAtivo = false;
        }, {passive: true});
    }

    // Reordena a pilha de camadas quando o usuário faz drag
    function _reordenarSlots(fromSlot, toSlot, slots) {
        // fromSlot/toSlot são posições no array slots[]
        // Precisa recalcular fotoOrdem e reordenar camadas[]
        const from = slots[fromSlot];
        const to   = slots[toSlot];

        if (from.tipo === 'foto') {
            // Movendo a camada foto: só atualiza fotoOrdem
            // toSlot no array de slots, mas fotoOrdem é posição em relação a camadas[]
            // Conta quantas camadas de desenho existem antes de toSlot
            let newFotoOrdem = 0;
            for (let i = 0; i < toSlot && i < slots.length; i++) {
                if (slots[i].tipo === 'desenho') newFotoOrdem++;
            }
            fotoOrdem = newFotoOrdem;
        } else {
            // Movendo uma camada de desenho
            const fromIdx = from.idx;
            let toIdx = to.idx !== undefined ? to.idx : (to.tipo === 'foto' ? -1 : 0);

            if (to.tipo === 'foto') {
                // Soltou na foto: insere logo abaixo da foto na ordem visual
                // Calcula fotoPos atual
                const totalCamadas = camadas.length;
                const fotoPos = (fotoOrdem < 0 || fotoOrdem >= totalCamadas) ? totalCamadas : fotoOrdem;
                toIdx = fromSlot < toSlot ? Math.min(fotoPos, totalCamadas-1) : Math.max(0, fotoPos-1);
            }

            if (toIdx < 0) toIdx = 0;
            if (toIdx >= camadas.length) toIdx = camadas.length - 1;

            if (fromIdx !== toIdx) {
                const item = camadas.splice(fromIdx, 1)[0];
                camadas.splice(toIdx, 0, item);
                if      (camadaAtiva === fromIdx) camadaAtiva = toIdx;
                else if (camadaAtiva === toIdx)   camadaAtiva = fromIdx;
                // Ajusta fotoOrdem se necessário
                if (fotoOrdem >= 0) {
                    if (fromIdx < fotoOrdem && toIdx >= fotoOrdem) fotoOrdem--;
                    else if (fromIdx > fotoOrdem && toIdx <= fotoOrdem) fotoOrdem++;
                }
            }
        }
        renderizarPainel();
        renderizarTodos();
    }

    // Gera thumbnail SVG de uma camada como data URL
    function gerarThumbnail(cam) {
        const tc = document.getElementById('thumb-canvas');
        const ctx = tc.getContext('2d');
        ctx.clearRect(0, 0, tc.width, tc.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, tc.width, tc.height);
        if (cam.caminhos.length === 0) return tc.toDataURL();
        // Escala os caminhos para caber no thumb
        const W = workSurface.offsetWidth  || 800;
        const H = workSurface.offsetHeight || 1000;
        const sx = tc.width  / W;
        const sy = tc.height / H;
        const s  = Math.min(sx, sy);
        cam.caminhos.forEach(c => {
            if (c.pontos.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = c.stroke || '#000';
            ctx.lineWidth   = Math.max(1, c.width * s);
            ctx.globalAlpha = (parseFloat(c.opacity) ?? 1);
            ctx.moveTo(c.pontos[0].x * s, c.pontos[0].y * s);
            c.pontos.forEach(p => ctx.lineTo(p.x * s, p.y * s));
            if (c.fechado) ctx.closePath();
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
        return tc.toDataURL();
    }

    window.novaCamada = () => {
        camadas.unshift(criarCamada(`Camada ${camadas.length + 1}`));
        camadaAtiva = 0;
        renderizarPainel();
        renderizarTodos();
    };

    // ── DUPLICAR CAMADA com opção de trocar pincel ──────────────────────────
    let _duplicarSrcIdx = -1; // índice da camada sendo duplicada

    window.duplicarCamada = (idx) => {
        _duplicarSrcIdx = idx;
        const cam = camadas[idx];
        if (!cam) return;
        // Preenche o modal com o pincel atual da camada (primeiro caminho)
        const pincelAtualCam = cam.caminhos.length > 0 ? (cam.caminhos[0].pincel || 'normal') : 'normal';
        // Marca o pincel atual no modal
        document.querySelectorAll('.dup-pincel-btn').forEach(b => {
            b.classList.toggle('ativo', b.dataset.pincel === pincelAtualCam);
        });
        document.getElementById('modal-duplicar').classList.add('aberto');
    };

    window.confirmarDuplicar = (trocarPincel) => {
        const modal = document.getElementById('modal-duplicar');
        modal.classList.remove('aberto');
        if (_duplicarSrcIdx < 0) return;
        const src = camadas[_duplicarSrcIdx];
        if (!src) return;

        // Deep clone da camada
        const novaCam = JSON.parse(JSON.stringify(src));
        novaCam.id = idCounter++;
        novaCam.nome = src.nome + ' (cópia)';

        if (trocarPincel) {
            // Pega o pincel escolhido no modal
            const btnAtivo = document.querySelector('.dup-pincel-btn.ativo');
            const novoPincel = btnAtivo ? btnAtivo.dataset.pincel : 'normal';
            // Aplica novo pincel a todos os caminhos da camada duplicada
            novaCam.caminhos.forEach(c => { c.pincel = novoPincel; });
        }

        // Insere logo acima da camada original
        camadas.splice(_duplicarSrcIdx, 0, novaCam);
        camadaAtiva = _duplicarSrcIdx;
        _duplicarSrcIdx = -1;
        salvarHistorico();
        renderizarPainel();
        renderizarTodos();
        mostrarNotificacao('⧉ Camada duplicada!');
    };

    window.fecharModalDuplicar = () => {
        document.getElementById('modal-duplicar').classList.remove('aberto');
        _duplicarSrcIdx = -1;
    };

    // Seleciona pincel no modal de duplicar
    window.selecionarPincelDup = (pincel, el) => {
        document.querySelectorAll('.dup-pincel-btn').forEach(b => b.classList.remove('ativo'));
        el.classList.add('ativo');
    };

    window.renomearCamada = (idx, nome) => { camadas[idx].nome = nome; };



    window.toggleVisibilidade = (idx, btn) => {
        camadas[idx].visivel = !camadas[idx].visivel;
        btn.style.background = camadas[idx].visivel ? '#03dac6' : '#444';
        btn.textContent      = camadas[idx].visivel ? '👁' : '🚫';
        renderizarTodos();
    };

    window.toggleVisibilidadeFoto = (btn) => {
        camadaFoto.visivel   = !camadaFoto.visivel;
        btn.style.background = camadaFoto.visivel ? '#03dac6' : '#444';
        btn.textContent      = camadaFoto.visivel ? '👁' : '🚫';
        renderizarTodos();
    };

    window.setOpacidadeCamada = (idx, val) => {
        camadas[idx].opacidade = parseFloat(val);
        renderizarTodos();
    };

    window.setOpacidadeFoto = (val) => {
        camadaFoto.opacidade = parseFloat(val);
        renderizarTodos();
    };

    window.deletarCamada = (idx) => {
        if (camadas.length === 1) { alert('Precisa ter ao menos 1 camada.'); return; }
        camadas.splice(idx, 1);
        if (camadaAtiva >= camadas.length) camadaAtiva = camadas.length - 1;
        caminhoAtivo = -1; pontosPen = []; penLayer.innerHTML = '';
        renderizarPainel();
        renderizarTodos();
    };

    // ── FOTO E VETORIZAÇÃO ────────────────────────────────────────────────────
    document.getElementById('f').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                workSurface.style.width  = img.width  + 'px';
                workSurface.style.height = img.height + 'px';
                hCanvas.width = img.width; hCanvas.height = img.height;
                hCtx.drawImage(img, 0, 0);
                // Avisa se OpenCV ainda não terminou de carregar (modo simplificado ativo)
                if (!window._cvReady) {
                    mostrarNotificacao('⏳ OpenCV ainda carregando — vetorização simplificada por enquanto.', 'aviso');
                }
                document.getElementById('modal').style.display = 'flex';
                window.imgParaVetor = img;
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ════════════════════════════════════════════════════════════
    // FEATURE 1: Preview e pré-tratamento de imagem
    // ════════════════════════════════════════════════════════════
    const previewCanvas = document.getElementById('preview-canvas');
    const previewCtx    = previewCanvas ? previewCanvas.getContext('2d') : null;

    // Atualiza sliders do modal e preview
    ['pre-contraste','pre-brilho','pre-blur','pre-pathomit'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const valEl = document.getElementById(id+'-val');
            if (id === 'pre-contraste') valEl.textContent = el.value + '%';
            else if (id === 'pre-brilho') valEl.textContent = el.value + '%';
            else if (id === 'pre-blur') valEl.textContent = el.value + 'px';
            else valEl.textContent = el.value;
            atualizarPreviewVetor();
        });
    });

    window.atualizarPreviewVetor = () => {
        if (!window.imgParaVetor || !previewCanvas || !previewCtx) return;
        const contraste = document.getElementById('pre-contraste')?.value || 150;
        const brilho    = document.getElementById('pre-brilho')?.value || 100;
        const blur      = document.getElementById('pre-blur')?.value || 1;
        previewCanvas.width  = window.imgParaVetor.width;
        previewCanvas.height = window.imgParaVetor.height;
        previewCtx.filter = `contrast(${contraste}%) brightness(${brilho}%) blur(${blur}px)`;
        previewCtx.drawImage(window.imgParaVetor, 0, 0);
        previewCtx.filter = 'none';
    };

    // ════════════════════════════════════════════════════════════
    // MÓDULO: INTELIGÊNCIA AUTOMÁTICA v1.0
    // ════════════════════════════════════════════════════════════

    // ── Utilitário: debounce ─────────────────────────────────────────────────
    // Evita reprocessamentos desnecessários em sliders (chama só após parar)
    function debounce(fn, delay) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
    }

    // ── Loader: mostrar/esconder overlay de processamento ────────────────────
    const tmLoader    = document.getElementById('tm-loader');
    const tmLoaderMsg = document.getElementById('tm-loader-msg');
    const tmLoaderBar = document.getElementById('tm-loader-bar');

    function mostrarLoader(msg = 'Processando...') {
        if (!tmLoader) return;
        tmLoaderMsg.textContent = msg;
        tmLoaderBar.style.width = '0%';
        tmLoader.classList.add('ativo');
        // Barra de progresso simulada — avança suavemente
        let p = 0;
        const tick = setInterval(() => {
            p = Math.min(p + Math.random() * 8, 88);
            tmLoaderBar.style.width = p + '%';
            if (p >= 88) clearInterval(tick);
        }, 150);
        tmLoader._tick = tick;
    }

    function esconderLoader() {
        if (!tmLoader) return;
        clearInterval(tmLoader._tick);
        tmLoaderBar.style.width = '100%';
        setTimeout(() => tmLoader.classList.remove('ativo'), 300);
    }

    // ── Sugestão inteligente ─────────────────────────────────────────────────
    // Exibe um card de sugestão contextual com callback de confirmação
    let _sugCallback = null, _sugTimer = null;

    function mostrarSugestao(titulo, texto, onSim) {
        const el  = document.getElementById('tm-sugestao');
        const tit = document.getElementById('tm-sug-titulo');
        const txt = document.getElementById('tm-sug-texto');
        if (!el) return;
        clearTimeout(_sugTimer);
        tit.textContent = '💡 ' + titulo;
        txt.textContent = texto;
        _sugCallback = onSim;
        el.classList.add('visivel');
        // Auto-esconder após 8 segundos
        _sugTimer = setTimeout(() => el.classList.remove('visivel'), 8000);
    }

    document.getElementById('tm-sug-sim')?.addEventListener('click', () => {
        document.getElementById('tm-sugestao')?.classList.remove('visivel');
        if (_sugCallback) { _sugCallback(); _sugCallback = null; }
    });
    document.getElementById('tm-sug-nao')?.addEventListener('click', () => {
        document.getElementById('tm-sugestao')?.classList.remove('visivel');
        _sugCallback = null;
    });

    // ── Ripple effect nos botões ─────────────────────────────────────────────
    // Adiciona efeito de onda ao clicar/tocar em qualquer botão
    document.addEventListener('touchstart', (e) => {
        const btn = e.target.closest('button');
        if (!btn || btn.style.overflow === 'visible') return;
        const r = document.createElement('span');
        r.className = 'tm-ripple';
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        r.style.cssText = `width:${size}px;height:${size}px;left:${e.touches[0].clientX-rect.left-size/2}px;top:${e.touches[0].clientY-rect.top-size/2}px;`;
        btn.appendChild(r);
        setTimeout(() => r.remove(), 500);
    }, { passive: true });

    // ── analisarImagem: detecta tipo e características ───────────────────────
    // Analisa pixels da imagem e retorna um objeto com métricas para auto-config
    //
    //  Retorna: {
    //    tipo:       'foto' | 'desenho' | 'lineart'
    //    contraste:  0–1  (desvio padrão normalizado da luminosidade)
    //    bordas:     0–1  (densidade de bordas detectadas por Sobel simples)
    //    saturacao:  0–1  (saturação média dos pixels)
    //    coresDom:   [ '#hex', ... ]  — até 5 cores dominantes
    //  }
    function analisarImagem(img) {
        // Renderiza a imagem num canvas temporário pequeno (128px) para ser rápido
        const TAMANHO = 128;
        const c = document.createElement('canvas');
        c.width = c.height = TAMANHO;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, TAMANHO, TAMANHO);
        const raw = ctx.getImageData(0, 0, TAMANHO, TAMANHO).data;
        const N = TAMANHO * TAMANHO;

        let somaBrilho = 0, somaR = 0, somaG = 0, somaB = 0;
        const brilhos = [];

        // Passo 1: calcular médias e brilho por pixel
        for (let i = 0; i < raw.length; i += 4) {
            const r = raw[i], g = raw[i+1], b = raw[i+2];
            // Luminância perceptual (BT.601)
            const lum = 0.299*r + 0.587*g + 0.114*b;
            brilhos.push(lum);
            somaBrilho += lum;
            somaR += r; somaG += g; somaB += b;
        }
        const mediaBrilho = somaBrilho / N;
        const mediaR = somaR/N, mediaG = somaG/N, mediaB = somaB/N;

        // Passo 2: desvio padrão = contraste percebido
        let somaVar = 0;
        for (const l of brilhos) somaVar += (l - mediaBrilho) ** 2;
        const stdBrilho = Math.sqrt(somaVar / N) / 128; // 0–1

        // Passo 3: saturação média (HSL simplificado)
        let somaSat = 0;
        for (let i = 0; i < raw.length; i += 4) {
            const r = raw[i]/255, g = raw[i+1]/255, b = raw[i+2]/255;
            const max = Math.max(r,g,b), min = Math.min(r,g,b);
            somaSat += (max === 0) ? 0 : (max-min)/max;
        }
        const saturacaoMedia = somaSat / N;

        // Passo 4: detecção de bordas Sobel simplificado (opera em luminância)
        // Conta pixels com gradiente alto — indica lineart/desenho vs foto suave
        let totalBorda = 0;
        for (let y = 1; y < TAMANHO-1; y++) {
            for (let x = 1; x < TAMANHO-1; x++) {
                const idx = (y*TAMANHO + x);
                const gx = brilhos[idx+1] - brilhos[idx-1];
                const gy = brilhos[(y+1)*TAMANHO+x] - brilhos[(y-1)*TAMANHO+x];
                if (Math.sqrt(gx*gx + gy*gy) > 40) totalBorda++;
            }
        }
        const densidadeBordas = totalBorda / N; // 0–1

        // Passo 5: classificação do tipo
        // Lineart: alto contraste, alta borda, baixa saturação
        // Desenho: alto contraste, bordas medianas, saturação variável
        // Foto:    contraste moderado, bordas baixas, alta saturação
        let tipo;
        if (densidadeBordas > 0.15 && saturacaoMedia < 0.25 && stdBrilho > 0.25) {
            tipo = 'lineart';
        } else if (stdBrilho > 0.2 && densidadeBordas > 0.08) {
            tipo = 'desenho';
        } else {
            tipo = 'foto';
        }

        // Passo 6: extrair cores dominantes — passa saturação para fusão adaptativa
        const coresDom = extrairCoresDominantes(raw, 16, saturacaoMedia);

        return { tipo, contraste: stdBrilho, bordas: densidadeBordas, saturacao: saturacaoMedia, coresDom };
    }

    // ── extrairCoresDominantes: quantização fina + fusão adaptativa de clusters ──
    // Usa passo=16 (4 bits/canal) para capturar mais cores.
    // Distância de fusão ADAPTATIVA baseada na saturação da imagem:
    //   - Baixa saturação  (lineart/P&B):  55 — agrupa tons similares
    //   - Média saturação  (desenho):       38 — equilíbrio
    //   - Alta saturação   (fotos/frutas):  24 — preserva cores distintas (vermelho ≠ laranja)
    // Exclui preto/quase-preto (sombras) assim como exclui branco (fundo).
    // maxCores aumenta automaticamente para imagens muito coloridas.
    function extrairCoresDominantes(raw, maxCores = 16, saturacao = 0) {
        const freq = {};
        let totalPixels = 0;

        for (let i = 0; i < raw.length; i += 4) {
            if (raw[i+3] < 100) continue; // ignora transparente/semi-transparente
            const r = Math.round(raw[i]   / 16) * 16;
            const g = Math.round(raw[i+1] / 16) * 16;
            const b = Math.round(raw[i+2] / 16) * 16;
            // Ignora branco de fundo (quase-branco ≥ 230 nos 3 canais)
            if (r >= 230 && g >= 230 && b >= 230) continue;
            // Ignora preto/sombra escura (≤ 30 nos 3 canais) — sombras não são cores reais
            if (r <= 30 && g <= 30 && b <= 30) continue;
            const chave = `${r},${g},${b}`;
            freq[chave] = (freq[chave] || 0) + 1;
            totalPixels++;
        }

        if (totalPixels === 0) return ['#000000'];

        // Distância de fusão adaptativa: imagens mais saturadas precisam de menos fusão
        // para preservar diferenças entre vermelho, laranja, amarelo, verde, etc.
        let distFusao;
        if (saturacao > 0.5)      distFusao = 24; // ex: foto de frutas coloridas
        else if (saturacao > 0.2) distFusao = 38; // ex: desenho com alguma cor
        else                      distFusao = 55; // ex: lineart ou P&B

        // Limite de cores sobe para imagens muito saturadas (frutas podem ter 20+ cores)
        const limiteCores = saturacao > 0.45 ? Math.max(maxCores, 24) : maxCores;

        // Ordena por frequência decrescente
        const entradas = Object.entries(freq)
            .map(([rgb, count]) => {
                const [r,g,b] = rgb.split(',').map(Number);
                return { r, g, b, count };
            })
            .sort((a, b) => b.count - a.count);

        // Fusão de clusters próximos com distância adaptativa
        const clusters = [];
        for (const entry of entradas) {
            let merged = false;
            for (const cl of clusters) {
                const dr = entry.r - cl.r, dg = entry.g - cl.g, db = entry.b - cl.b;
                if (Math.sqrt(dr*dr + dg*dg + db*db) < distFusao) {
                    const total = cl.count + entry.count;
                    cl.r = Math.round((cl.r * cl.count + entry.r * entry.count) / total);
                    cl.g = Math.round((cl.g * cl.count + entry.g * entry.count) / total);
                    cl.b = Math.round((cl.b * cl.count + entry.b * entry.count) / total);
                    cl.count = total;
                    merged = true;
                    break;
                }
            }
            if (!merged) clusters.push({ ...entry });
        }

        // Mantém apenas cores com ≥ 0,3% dos pixels (ligeiramente mais sensível que antes)
        const LIMIAR = totalPixels * 0.003;
        return clusters
            .filter(c => c.count >= LIMIAR)
            .sort((a, b) => b.count - a.count)
            .slice(0, limiteCores)
            .map(c => {
                const clamp = v => Math.min(255, Math.max(0, v));
                return '#' + [c.r, c.g, c.b].map(v => clamp(v).toString(16).padStart(2,'0')).join('');
            });
    }

    // ── autoVetorizar: configura e dispara vetorização inteligente ─────────
    // Analisa a imagem, ajusta todos os parâmetros do modal e inicia vetorização
    window.autoVetorizar = () => {
        const img = window.imgParaVetor;
        if (!img) { mostrarNotificacao('⚠️ Carregue uma foto primeiro!'); return; }

        mostrarLoader('🔍 Analisando imagem...');

        // Usa setTimeout para liberar o frame e mostrar o loader antes de processar
        setTimeout(() => {
            try {
                const analise = analisarImagem(img);
                esconderLoader();

                // Atualiza tag de tipo visual no modal
                const tagEl = document.getElementById('tm-tipo-img-tag');
                if (tagEl) {
                    const mapaTipo = {
                        foto:    { cls: 'tm-tag-foto',    txt: '📷 Foto'    },
                        desenho: { cls: 'tm-tag-desenho', txt: '🖼 Desenho' },
                        lineart: { cls: 'tm-tag-lineart', txt: '✏️ Lineart' },
                    };
                    const info = mapaTipo[analise.tipo];
                    tagEl.className = 'tm-tag-tipo-img ' + info.cls;
                    tagEl.textContent = info.txt;
                    tagEl.style.display = 'inline-block';
                }

                // Mostra paleta de cores detectadas
                _mostrarPaletaModal(analise.coresDom);

                // ────────────────────────────────────────────────────────────
                // Decisões de configuração baseadas no tipo detectado:
                //
                //  LINEART  → alto contraste, sem blur, ruído baixo, 1 cor
                //  DESENHO  → contraste médio, blur leve, 2–3 cores
                //  FOTO     → contraste alto, blur moderado, 3 cores
                // ────────────────────────────────────────────────────────────
                let contraste, brilho, blur, pathomit;

                if (analise.tipo === 'lineart') {
                    contraste = 250; brilho = 110; blur = 0; pathomit = 8;
                } else if (analise.tipo === 'desenho') {
                    contraste = 180; brilho = 100; blur = 1; pathomit = 12;
                } else {
                    // foto: reforça contraste para separar silhueta do fundo
                    contraste = 200; brilho = 95; blur = 1.5; pathomit = 20;
                }

                // Aplica valores nos sliders
                _setSlider('pre-contraste', contraste, '%');
                _setSlider('pre-brilho',    brilho,    '%');
                _setSlider('pre-blur',      blur,      'px');
                _setSlider('pre-pathomit',  pathomit,  '');

                // ── Paleta completa auto-detectada ──────────────────────────
                // _mostrarPaletaModal já define window._paletaDetectada com todas as cores
                const nCores = analise.coresDom.length;
                const countEl = document.getElementById('tm-cores-auto-count');
                if (countEl) {
                    countEl.textContent = '✅ ' + nCores + ' cor' + (nCores !== 1 ? 'es' : '') +
                        ' selecionada' + (nCores !== 1 ? 's' : '') + ' automaticamente';
                    countEl.style.color = '#03dac6';
                }

                // Compat: preenche inputs ocultos até 3 para o fallback manual
                if (analise.coresDom.length > 0) {
                    const ids = ['modal-color','modal-color2','modal-color3'];
                    analise.coresDom.slice(0, 3).forEach((c, i) => {
                        const el = document.getElementById(ids[i]);
                        if (el) el.value = c;
                    });
                }

                // Atualiza preview
                atualizarPreviewVetor();

                // Sugestão contextual pós-análise
                const msgsSug = {
                    lineart: { t: 'Lineart detectada',  m: `Configuramos para traço com ${nCores} cor${nCores!==1?'es':''}. Deseja vetorizar agora?` },
                    desenho: { t: 'Desenho detectado',  m: `Detectamos ${nCores} cor${nCores!==1?'es':''} no desenho. Vetorizar agora?` },
                    foto:    { t: 'Foto detectada',      m: `Detectamos ${nCores} cor${nCores!==1?'es':''} na imagem. Vetorize ou ajuste se necessário.` },
                };
                const sug = msgsSug[analise.tipo];
                mostrarSugestao(sug.t, sug.m, () => confirmarCor());

            } catch(err) {
                esconderLoader();
                console.error('Erro na análise:', err);
                mostrarNotificacao('❌ Erro na análise automática');
            }
        }, 80);
    };

    // ── Aux: atualiza slider + label ─────────────────────────────────────
    function _setSlider(id, val, sufixo) {
        const el = document.getElementById(id);
        const lb = document.getElementById(id + '-val');
        if (el) el.value = val;
        if (lb) lb.textContent = val + sufixo;
    }

    // ── Aux: mostra swatches da paleta no modal ──────────────────────────
    // Todos os swatches começam SELECIONADOS (serão todos usados na vetorização).
    // Clicar num swatch ALTERNA sua inclusão na paleta: desseleciona/inclui de volta.
    function _mostrarPaletaModal(cores) {
        const wrap    = document.getElementById('tm-paleta-wrap');
        const coresEl = document.getElementById('tm-paleta-cores');
        if (!wrap || !coresEl || !cores.length) return;
        coresEl.innerHTML = '';

        // Reinicia a paleta detectada com todas as cores
        window._paletaDetectada = [...cores];

        cores.forEach((hex) => {
            const sw = document.createElement('div');
            sw.className = 'tm-cor-swatch ativa'; // começa selecionado
            sw.style.background = hex;
            sw.title = hex + ' — clique para remover/adicionar';
            sw.dataset.cor = hex;

            sw.addEventListener('click', () => {
                const ativo = sw.classList.toggle('ativa');
                // Recalcula _paletaDetectada com apenas os swatches ativos
                window._paletaDetectada = Array.from(
                    document.querySelectorAll('.tm-cor-swatch.ativa')
                ).map(s => s.dataset.cor);

                // Atualiza o contador
                const n = window._paletaDetectada.length;
                const countEl = document.getElementById('tm-cores-auto-count');
                if (countEl) {
                    countEl.textContent = n > 0
                        ? '✅ ' + n + ' cor' + (n !== 1 ? 'es' : '') + ' selecionada' + (n !== 1 ? 's' : '')
                        : '⚠️ Nenhuma cor selecionada';
                    countEl.style.color = n > 0 ? '#03dac6' : '#ff5252';
                }
                atualizarPreviewVetor();
            });

            coresEl.appendChild(sw);
        });
        wrap.style.display = 'flex';
    }

    // ── autoClean: limpeza de ruído pré-vetorização ─────────────────────
    // Aplica filtros no canvas de processamento para melhorar contornos
    // antes de passar para o ImageTracer / OpenCV
    function autoClean(ctx, canvas) {
        try {
            // Se OpenCV disponível: morfologia (erosão + dilatação = opening)
            // Remove pontos isolados e ruído sem apagar bordas finas
            if (window._cvReady && window.cv && window.cv.Mat) {
                const cv  = window.cv;
                const src = cv.imread(canvas);
                const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
                // Opening = erosão seguida de dilatação — remove ruído pequeno
                cv.morphologyEx(src, src, cv.MORPH_OPEN, kernel);
                // Closing = dilatação seguida de erosão — fecha buracos nos traços
                cv.morphologyEx(src, src, cv.MORPH_CLOSE, kernel);
                cv.imshow(canvas, src);
                src.delete(); kernel.delete();
                return true;
            }
        } catch(e) {
            console.warn('autoClean OpenCV falhou, usando CSS filter:', e);
        }
        // Fallback Canvas API: blur leve + contraste para remover ruído suave
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        // Limiar: pixels muito claros → branco, muito escuros → preto (binarização leve)
        for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
            if (lum > 200) { data[i]=data[i+1]=data[i+2]=255; }
            else if (lum < 55) { data[i]=data[i+1]=data[i+2]=0; }
        }
        ctx.putImageData(imageData, 0, 0);
        return false;
    }

    // Listener botão vetorizar do novo modal
    const btnVetModal = document.getElementById('btn-vetorizar-modal');
    if (btnVetModal) {
        btnVetModal.addEventListener('touchend', (e) => {
            e.preventDefault(); e.stopPropagation(); confirmarCor();
        }, {passive:false});
        btnVetModal.addEventListener('click', () => confirmarCor());
    }

    // Abre modal e mostra preview

    const fileInput = document.getElementById('f');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            // preview já é mostrado pelo código existente ao carregar imagem
            setTimeout(atualizarPreviewVetor, 200);
        });
    }

    // ════════════════════════════════════════════════════════════
    // FEATURE 2: Snap magnético (atrai pontos a eixos H/V)
    // ════════════════════════════════════════════════════════════
    let snapAtivo = false;
    const SNAP_DIST = 10; // pixels no canvas

    window.toggleSnap = () => {
        snapAtivo = !snapAtivo;
        const btn = document.getElementById('btnSnap');
        if (btn) {
            btn.style.background = snapAtivo ? '#ff9800' : '#333';
            btn.textContent = snapAtivo ? '🧲 ON' : '🧲';
        }
    };

    function aplicarSnap(x, y) {
        if (!snapAtivo || !pontosPen.length) return {x, y};
        // Snap a eixos de outros pontos
        for (const p of pontosPen) {
            if (Math.abs(p.x - x) < SNAP_DIST / scale) x = p.x;
            if (Math.abs(p.y - y) < SNAP_DIST / scale) y = p.y;
        }
        return {x, y};
    }

    // ════════════════════════════════════════════════════════════
    // FEATURE 3A: Lupa de precisão no modo edição
    // ════════════════════════════════════════════════════════════
    const lupaEl     = document.getElementById('lupa');
    const lupaCanvas = document.getElementById('lupa-canvas');
    const lupaCtx    = lupaCanvas ? lupaCanvas.getContext('2d') : null;
    const LUPA_ZOOM  = 3;
    const LUPA_SIZE  = 90;

    function mostrarLupa(clientX, clientY) {
        if (!lupaEl || !lupaCtx || !modoEditar) return;
        const {x: sx, y: sy} = clientParaCanvas(clientX, clientY);
        const half = LUPA_SIZE / (2 * LUPA_ZOOM);

        lupaCtx.clearRect(0, 0, LUPA_SIZE, LUPA_SIZE);
        lupaCtx.save();
        lupaCtx.scale(LUPA_ZOOM, LUPA_ZOOM);
        lupaCtx.fillStyle = 'white';
        lupaCtx.fillRect(0, 0, half*2, half*2);

        // Serializa os layers SVG para imagem e desenha na lupa
        const W = workSurface.offsetWidth, H = workSurface.offsetHeight;
        const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
            ${drawLayer.innerHTML}${livreLayer.innerHTML}
        </svg>`;
        const blob = new Blob([svgWrapper], {type:'image/svg+xml'});
        const url  = URL.createObjectURL(blob);
        const img  = new Image();
        img.onload = () => {
            lupaCtx.drawImage(img, sx - half, sy - half, half*2, half*2, 0, 0, half*2, half*2);
            URL.revokeObjectURL(url);
            lupaCtx.restore();
            // Mira central
            lupaCtx.strokeStyle = 'rgba(3,218,198,0.8)';
            lupaCtx.lineWidth = 1;
            lupaCtx.beginPath();
            lupaCtx.moveTo(LUPA_SIZE/2, LUPA_SIZE/2 - 8);
            lupaCtx.lineTo(LUPA_SIZE/2, LUPA_SIZE/2 + 8);
            lupaCtx.moveTo(LUPA_SIZE/2 - 8, LUPA_SIZE/2);
            lupaCtx.lineTo(LUPA_SIZE/2 + 8, LUPA_SIZE/2);
            lupaCtx.stroke();
        };
        img.onerror = () => { lupaCtx.restore(); URL.revokeObjectURL(url); };
        img.src = url;

        lupaEl.style.display = 'block';
        const lupaX = clientX > window.innerWidth/2 ? 20 : window.innerWidth - 110;
        lupaEl.style.left = lupaX + 'px';
        lupaEl.style.top  = '70px';
    }

    function esconderLupa() {
        if (lupaEl) lupaEl.style.display = 'none';
    }

    // ════════════════════════════════════════════════════════════
    // FEATURE 3B: Modo Outline (contorno sobre foto original)
    // ════════════════════════════════════════════════════════════
    let modoOutline = false;

    window.toggleOutline = () => {
        modoOutline = !modoOutline;
        const btn = document.getElementById('btnOutline');
        const overlay = document.getElementById('outline-overlay');
        if (btn) { btn.style.background = modoOutline ? '#03dac6' : '#333'; }
        if (overlay) overlay.style.display = modoOutline ? 'block' : 'none';
        if (modoOutline) renderizarOutline();
    };

    function renderizarOutline() {
        const overlay = document.getElementById('outline-overlay');
        if (!overlay) return;
        overlay.width  = workSurface.offsetWidth;
        overlay.height = workSurface.offsetHeight;
        const ctx2 = overlay.getContext('2d');
        ctx2.clearRect(0, 0, overlay.width, overlay.height);
        // Foto original com transparência
        if (window.imgParaVetor) {
            ctx2.globalAlpha = 0.35;
            ctx2.drawImage(window.imgParaVetor, 0, 0, overlay.width, overlay.height);
            ctx2.globalAlpha = 1;
        }
        // Contorno dos caminhos SVG
        const paths = drawLayer.querySelectorAll('path,ellipse,rect,polygon,line');
        paths.forEach(p => {
            const d = p.getAttribute('d') || '';
            ctx2.strokeStyle = '#03dac6';
            ctx2.lineWidth = 1.5;
            ctx2.setLineDash([4, 3]);
            // Desenha bounding box como indicador
            try {
                const bb = p.getBBox();
                ctx2.strokeRect(bb.x, bb.y, bb.width, bb.height);
            } catch(e) {}
        });
    }

    // ════════════════════════════════════════════════════════════
    // FEATURE 4: Vetorização por cor + agrupamento
    // ════════════════════════════════════════════════════════════
    // Vetorização por cor: extrai pixels de uma cor específica e vetoriza só eles
    window.vetorizarPorCor = (corAlvo) => {
        if (!window.imgParaVetor) return;
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width  = hCanvas.width;
        tmpCanvas.height = hCanvas.height;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(window.imgParaVetor, 0, 0);
        const imgData = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
        const data    = imgData.data;

        // Converte cor hex para RGB
        const r2 = parseInt(corAlvo.slice(1,3),16);
        const g2 = parseInt(corAlvo.slice(3,5),16);
        const b2 = parseInt(corAlvo.slice(5,7),16);
        const tolerancia = 60;

        // Mantém só pixels próximos à cor alvo, resto vira branco
        for (let i = 0; i < data.length; i += 4) {
            const dr = Math.abs(data[i]   - r2);
            const dg = Math.abs(data[i+1] - g2);
            const db = Math.abs(data[i+2] - b2);
            if (dr + dg + db > tolerancia * 3) {
                data[i] = data[i+1] = data[i+2] = 255; // branco
            } else {
                data[i] = data[i+1] = data[i+2] = 0; // preto
            }
        }
        tmpCtx.putImageData(imgData, 0, 0);

        mostrarNotificacao('⏳ Vetorizando por cor...');
        setTimeout(() => {
            const corTraco = document.getElementById('modal-color')?.value || corAlvo;
            let svgString = ImageTracer.imagedataToSVG(imgData, {
                ltres: Math.max(0.1, sensibilidade/200),
                qtres: Math.max(0.1, sensibilidade/200),
                pathomit: 16, blurradius: 1, blurdelta: 20,
                colorsampling: 0, numberofcolors: 1,
                mincolorratio: 0.02,
            });
                // Forçar modo contorno: fill=none, stroke na cor
                svgString = svgString
                    .replace(/fill="[^"]*"/g, 'fill="none"')
                    .replace(/stroke="none"/g, 'stroke="black"')
                    .replace(/<path /g, '<path stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" ');
            svgString = svgString.replace(/fill="rgb\(0,0,0\)"/g, `fill="${corTraco}"`);
            svgString = svgString.replace(/fill="rgb\(255,255,255\)"/g, 'fill="none"');
            // Cria nova camada para essa cor
            novaCamada('Cor ' + corAlvo);
            svgArea.innerHTML = svgString;
            camadaFoto.svgHTML = svgArea.innerHTML;
            renderizarTodos();
            mostrarNotificacao('✅ Camada de cor criada!');
        }, 100);
    };

    // Agrupamento: seleciona múltiplos caminhos e agrupa em <g>
    let caminhosSelecionados = [];
    window.agruparSelecionados = () => {
        if (caminhosSelecionados.length < 2) {
            mostrarNotificacao('Selecione pelo menos 2 elementos'); return;
        }
        const caminhos = getCaminhos();
        const grupo = { isGrupo: true, filhos: [] };
        caminhosSelecionados.forEach(idx => {
            grupo.filhos.push({...caminhos[idx]});
        });
        // Remove originais e adiciona grupo
        caminhosSelecionados.sort((a,b)=>b-a).forEach(idx => caminhos.splice(idx,1));
        caminhos.push(grupo);
        caminhosSelecionados = [];
        salvarHistorico();
        renderizarTodos();
        mostrarNotificacao('✅ Elementos agrupados!');
    };

    let nrCoresSelecionadas = 1;

    window.setNrCores = (n) => {
        nrCoresSelecionadas = n;
        [1,2,3].forEach(i => {
            const btn = document.getElementById('nc-'+i);
            if (btn) {
                btn.style.border = i===n ? '2px solid #03dac6' : '1px solid #444';
                btn.style.background = i===n ? 'rgba(3,218,198,0.1)' : '#2a2a2a';
                btn.style.color = i===n ? '#03dac6' : '#888';
            }
            const col = document.getElementById('modal-color'+(i>1?i:''));
            if (col) col.style.display = i <= n ? '' : 'none';
        });
        // Label da cor 1
        const label = document.querySelector('#modal .modal-box span');
    };

    // Vetorização com OpenCV — detecção de bordas Canny
    function vetorizarContornos(img, corTraco, larguraTraco = 2) {
        return new Promise((resolve, reject) => {
            try {
                let src = cv.imread(img);
                let gray = new cv.Mat();
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                let blurred = new cv.Mat();
                cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.5);

                let edges = new cv.Mat();
                cv.Canny(blurred, edges, 50, 150);

                let contours = new cv.MatVector();
                let hierarchy = new cv.Mat();
                cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                const ns = 'http://www.w3.org/2000/svg';
                const svgEl = document.createElementNS(ns, 'svg');
                svgEl.setAttribute('width', img.width);
                svgEl.setAttribute('height', img.height);
                svgEl.setAttribute('viewBox', `0 0 ${img.width} ${img.height}`);

                for (let i = 0; i < contours.size(); i++) {
                    let contour = contours.get(i);
                    let points = [];
                    for (let j = 0; j < contour.data32S.length; j += 2) {
                        points.push({ x: contour.data32S[j], y: contour.data32S[j+1] });
                    }
                    if (points.length < 3) continue;

                    let d = `M ${points[0].x} ${points[0].y}`;
                    for (let k = 1; k < points.length; k++) {
                        d += ` L ${points[k].x} ${points[k].y}`;
                    }
                    d += ' Z';

                    let path = document.createElementNS(ns, 'path');
                    path.setAttribute('d', d);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', corTraco);
                    path.setAttribute('stroke-width', larguraTraco);
                    path.setAttribute('stroke-linecap', 'round');
                    path.setAttribute('stroke-linejoin', 'round');
                    svgEl.appendChild(path);
                }

                src.delete(); gray.delete(); blurred.delete();
                edges.delete(); contours.delete(); hierarchy.delete();

                resolve(svgEl);
            } catch(e) { reject(e); }
        });
    }

    window.confirmarCor = () => {
        const cor1 = document.getElementById('modal-color').value;
        const paletaAuto = (window._paletaDetectada && window._paletaDetectada.length > 0)
            ? window._paletaDetectada : null;
        const usarMultiCor = paletaAuto && paletaAuto.length > 1;

        // OpenCV Canny: ótimo para lineart (1 cor), mas perde cores em imagens coloridas.
        // Se a paleta auto-detectada tem >1 cor → força ImageTracer para preservar todas as cores.
        if (window._cvReady && window.cv && !usarMultiCor) {
            document.getElementById('modal').style.display = 'none';
            mostrarNotificacao('🚀 Detectando contornos com OpenCV...');
            const largura = parseFloat(document.getElementById('brush-size')?.value) || 2;
            vetorizarContornos(window.imgParaVetor, cor1, largura).then(svgEl => {
                svgArea.innerHTML = svgEl.outerHTML;
                camadaFoto.svgHTML = svgArea.innerHTML;
                renderizarTodos();
                if (painelAberto) renderizarPainel();
                mostrarNotificacao('✅ Contornos gerados!');
            }).catch(err => {
                console.error(err);
                mostrarNotificacao('❌ Erro OpenCV: ' + err.message);
            });
            return;
        }
        // Fallback: ImageTracer (sempre usado para imagens coloridas)
        const cor2 = document.getElementById('modal-color2')?.value || '#888888';
        const cor3 = document.getElementById('modal-color3')?.value || '#444444';
        const sensibilidade = parseFloat(document.getElementById('thresh').value);
        // Usa paleta auto-detectada completa; caso não exista, usa seleção manual
        const coresUsuarioFinal = paletaAuto
            ? paletaAuto
            : (nrCoresSelecionadas === 1 ? [cor1] : nrCoresSelecionadas === 2 ? [cor1, cor2] : [cor1, cor2, cor3]);
        const nCores = coresUsuarioFinal.length;

        document.getElementById('modal').style.display = 'none';
        mostrarNotificacao('🚀 Processando traço profissional...');

        setTimeout(() => {
            try {
                // PASSO 1: Pré-processamento com OpenCV (se disponível) ou canvas
                hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
                const contraste  = document.getElementById('pre-contraste')?.value || 150;
                const brilho     = document.getElementById('pre-brilho')?.value    || 100;
                const blurPre    = document.getElementById('pre-blur')?.value      || 1;
                hCtx.filter = `blur(${blurPre}px) contrast(${contraste}%) brightness(${brilho}%)`;
                hCtx.drawImage(window.imgParaVetor, 0, 0, hCanvas.width, hCanvas.height);
                hCtx.filter = 'none';

                let imgData;
                // adaptiveThreshold: SOMENTE para modo 1 cor (lineart/preto-e-branco).
                // Modo multicor PRECISA preservar os pixels coloridos originais para o
                // ImageTracer conseguir mapear cada região à cor correta da paleta.
                // Aplicar adaptiveThreshold em multicor converte tudo para P&B → canvas preto.
                if (!usarMultiCor && window._cvReady && window.cv && window.cv.imread) {
                    try {
                        const cv = window.cv;
                        const src  = cv.imread(hCanvas);
                        const gray = new cv.Mat();
                        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                        cv.adaptiveThreshold(gray, gray, 255,
                            cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 10);
                        cv.imshow(hCanvas, gray);
                        src.delete(); gray.delete();
                    } catch(cvErr) {
                        console.warn('OpenCV adaptiveThreshold falhou, usando canvas:', cvErr);
                    }
                }
                // limparFundo: remove branco antes de vetorizar
                {
                    const _fd = hCtx.getImageData(0, 0, hCanvas.width, hCanvas.height);
                    const _pd = _fd.data;
                    for (let _i = 0; _i < _pd.length; _i += 4) {
                        if (_pd[_i] > 240 && _pd[_i+1] > 240 && _pd[_i+2] > 240) _pd[_i+3] = 0;
                    }
                    hCtx.putImageData(_fd, 0, 0);
                }
                imgData = hCtx.getImageData(0, 0, hCanvas.width, hCanvas.height);
                const pathomit = parseInt(document.getElementById('pre-pathomit')?.value || 16);

                // PASSO 2: Paleta e opções baseadas nas cores auto-detectadas
                const hex2rgb = h => ({ r:parseInt(h.slice(1,3),16), g:parseInt(h.slice(3,5),16), b:parseInt(h.slice(5,7),16), a:255 });
                const coresUsuario = coresUsuarioFinal; // paleta completa vinda de _paletaDetectada ou fallback manual

                // Helper: distância euclidiana entre duas cores RGB
                function corDist(c1, c2) {
                    return Math.sqrt((c1.r-c2.r)**2 + (c1.g-c2.g)**2 + (c1.b-c2.b)**2);
                }
                // Helper: extrair RGB de string fill="rgb(r,g,b)" ou hex
                function parseFillRgb(fillStr) {
                    if (!fillStr) return null;
                    const m = fillStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    if (m) return {r:+m[1],g:+m[2],b:+m[3]};
                    if (fillStr.startsWith('#') && fillStr.length === 7) return hex2rgb(fillStr);
                    return null;
                }
                // Paleta para ImageTracer: cores selecionadas + branco transparente (fundo)
                const palCores = coresUsuario.map(hex2rgb);
                // Distribui as cores em bandas de luminosidade para separar regiões
                const pathomitVal = parseInt(document.getElementById('pre-pathomit')?.value || 16);

                let svgString, opcoes;
                if (nCores === 1) {
                    // Modo 1 cor: paleta binária clássica
                    opcoes = {
                        colorsampling: 0, numberofcolors: 2, colorquantcycles: 1,
                        pal: [{r:0,g:0,b:0,a:255},{r:255,g:255,b:255,a:0}],
                        ltres:1, qtres:1, pathomit:pathomitVal, blurradius:0,
                        mincolorratio:0, linefilter:true, strokewidth:0, viewbox:true, scale:1
                    };
                    svgString = ImageTracer.imagedataToSVG(imgData, opcoes);
                } else {
                    // Modo multicor: usa as cores selecionadas diretamente na paleta do ImageTracer
                    const palIT = coresUsuario.map(hex2rgb);
                    palIT.push({r:255,g:255,b:255,a:0}); // fundo transparente
                    opcoes = {
                        colorsampling: 0,
                        numberofcolors: palIT.length,
                        colorquantcycles: 3,
                        pal: palIT,
                        ltres: 1, qtres: 1,
                        pathomit: pathomitVal,
                        blurradius: 0,
                        mincolorratio: 0,
                        linefilter: false,
                        strokewidth: 0,
                        viewbox: true,
                        scale: 1
                    };
                    svgString = ImageTracer.imagedataToSVG(imgData, opcoes);
                }

                // PASSO 3: Processa paths — remove fundo, aplica cores corretas
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
                const caminhos = Array.from(svgDoc.querySelectorAll('path'));

                // Insere no DOM temporariamente para getBBox funcionar
                const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
                tmpSvg.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;';
                document.body.appendChild(tmpSvg);

                const larguraTraco = parseFloat(document.getElementById('brush-size')?.value) || 2;
                caminhos.forEach(path => {
                    const clone = path.cloneNode(true);
                    tmpSvg.appendChild(clone);
                    let eFundo = false;
                    try {
                        const bb = clone.getBBox();
                        eFundo = bb.width > 0 && bb.height > 0 &&
                                 Math.abs(bb.width  - hCanvas.width)  < 10 &&
                                 Math.abs(bb.height - hCanvas.height) < 10;
                    } catch(e) {
                        const fill = (path.getAttribute('fill')||'').toLowerCase();
                        eFundo = fill.includes('255,255,255') || fill === '#ffffff' || fill === 'white';
                    }
                    tmpSvg.removeChild(clone);
                    if (eFundo) { path.remove(); return; }

                    const fillAtual = path.getAttribute('fill') || '';
                    const eBranco = fillAtual.toLowerCase().includes('255,255,255') ||
                                    fillAtual.toLowerCase() === '#ffffff' ||
                                    fillAtual.toLowerCase() === 'white';
                    if (eBranco) { path.remove(); return; }

                    if (nCores === 1) {
                        // Modo 1 cor: tudo stroke com cor1
                        path.setAttribute('fill', 'none');
                        path.setAttribute('stroke', cor1);
                        path.setAttribute('stroke-width', larguraTraco);
                        path.setAttribute('stroke-linecap', 'round');
                        path.setAttribute('stroke-linejoin', 'round');
                        path.removeAttribute('opacity');
                    } else {
                        // Modo multicor: identifica qual cor do usuário melhor corresponde ao fill gerado
                        const fillRgb = parseFillRgb(fillAtual);
                        if (fillRgb) {
                            // Encontra a cor mais próxima na paleta do usuário
                            let melhorCor = coresUsuario[0];
                            let melhorDist = Infinity;
                            coresUsuario.forEach(hex => {
                                const rgb = hex2rgb(hex);
                                const d = corDist(fillRgb, rgb);
                                if (d < melhorDist) { melhorDist = d; melhorCor = hex; }
                            });
                            // Aplica fill sólido com a cor identificada (mantém a área colorida)
                            path.setAttribute('fill', melhorCor);
                            path.setAttribute('stroke', melhorCor);
                            path.setAttribute('stroke-width', Math.max(0.5, larguraTraco * 0.3));
                            path.setAttribute('stroke-linejoin', 'round');
                            path.removeAttribute('opacity');
                        } else {
                            // Fallback: usa cor1
                            path.setAttribute('fill', cor1);
                            path.setAttribute('stroke', cor1);
                            path.setAttribute('stroke-width', Math.max(0.5, larguraTraco * 0.3));
                            path.removeAttribute('opacity');
                        }
                    }
                });

                document.body.removeChild(tmpSvg);
                const svgFinal = new XMLSerializer().serializeToString(svgDoc);
                svgArea.innerHTML = svgFinal;
                camadaFoto.svgHTML = svgArea.innerHTML;

                renderizarTodos();
                if (painelAberto) renderizarPainel();
                mostrarNotificacao('✅ Vetorização concluída!');
            } catch (e) {
                console.error('Erro na vetorização:', e);
                mostrarNotificacao('❌ Erro ao processar imagem');
            }
        }, 100);
    };

    // ════════════════════════════════════════════════════════════
    // MÓDULO INTELIGÊNCIA: hooks de integração
    // (rodam APÓS confirmarCor original estar definida)
    // ════════════════════════════════════════════════════════════

    // ── Debounce nos sliders do modal de vetorização ─────────────────────
    const atualizarPreviewDebounced = debounce(atualizarPreviewVetor, 120);
    ['pre-contraste','pre-brilho','pre-blur'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeAttribute('oninput');
        el.addEventListener('input', () => {
            const valEl = document.getElementById(id+'-val');
            if (id === 'pre-contraste' && valEl) valEl.textContent = el.value + '%';
            else if (id === 'pre-brilho' && valEl) valEl.textContent = el.value + '%';
            else if (id === 'pre-blur'   && valEl) valEl.textContent = el.value + 'px';
            atualizarPreviewDebounced();
        });
    });

    // ── Análise automática ao carregar imagem ────────────────────────────
    {
        const _origOnChange = document.getElementById('f').onchange;
        document.getElementById('f').onchange = (e) => {
            if (_origOnChange) _origOnChange.call(document.getElementById('f'), e);
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const imgAnl = new Image();
                imgAnl.onload = () => {
                    setTimeout(() => {
                        window.imgParaVetor = imgAnl;
                        atualizarPreviewVetor();
                        const _analisar = () => {
                            try {
                                const a = analisarImagem(imgAnl);
                                const tagEl = document.getElementById('tm-tipo-img-tag');
                                const mapaTipo = {
                                    foto:    { cls: 'tm-tag-foto',    txt: '📷 Foto'    },
                                    desenho: { cls: 'tm-tag-desenho', txt: '🖼 Desenho' },
                                    lineart: { cls: 'tm-tag-lineart', txt: '✏️ Lineart' },
                                };
                                if (tagEl) {
                                    const info = mapaTipo[a.tipo];
                                    tagEl.className = 'tm-tag-tipo-img ' + info.cls;
                                    tagEl.textContent = info.txt;
                                    tagEl.style.display = 'inline-block';
                                }
                                _mostrarPaletaModal(a.coresDom);
                                window._paletaDetectada = a.coresDom;
                                const countEl2 = document.getElementById('tm-cores-auto-count');
                                if (countEl2) countEl2.textContent = a.coresDom.length + ' cor' + (a.coresDom.length !== 1 ? 'es' : '') + ' (auto)';
                                const msgs = {
                                    lineart: 'Detectamos um lineart! "Auto Vetorizar" vai configurar tudo automaticamente.',
                                    desenho: 'Detectamos um desenho. Deseja aplicar configuração automática?',
                                    foto:    'Imagem fotográfica detectada. "Auto Vetorizar" ajusta tudo pra você!',
                                };
                                mostrarSugestao('Imagem analisada!', msgs[a.tipo], () => autoVetorizar());
                            } catch(_) {}
                        };
                        if (window.requestIdleCallback) requestIdleCallback(_analisar);
                        else setTimeout(_analisar, 300);
                    }, 250);
                };
                imgAnl.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        };
    }

    // ── Override confirmarCor: adiciona loader e autoClean ───────────────
    {
        const _confirmarCorOrig = window.confirmarCor;
        window.confirmarCor = () => {
            mostrarLoader('🚀 Vetorizando...');
            setTimeout(() => {
                try { if (hCanvas && hCtx) autoClean(hCtx, hCanvas); } catch(_) {}
                _confirmarCorOrig();
                setTimeout(esconderLoader, 1500);
            }, 80);
        };
    }

    // ── Override mostrarNotificacao: anima saída ─────────────────────────
    {
        const _notifOrig = window.mostrarNotificacao;
        // tipos suportados: '' (padrão), 'erro', 'aviso'
        window.mostrarNotificacao = (msg, tipo) => {
            const el = document.getElementById('notificacao');
            if (el) {
                el.classList.remove('saindo');
                el.style.display = 'block';
                el.style.opacity = '1';
                el.textContent = msg;
                // Cor de fundo por tipo
                const cores = { erro: '#c62828', aviso: '#e65100', '': '' };
                el.style.background = cores[tipo || ''] || '';
                clearTimeout(el._tmTimer);
                const duracao = (tipo === 'erro' || tipo === 'aviso') ? 4000 : 2300;
                el._tmTimer = setTimeout(() => {
                    el.classList.add('saindo');
                    setTimeout(() => {
                        el.style.display = 'none';
                        el.classList.remove('saindo');
                        el.style.background = ''; // reset para próxima notificação
                    }, 320);
                }, duracao);
            } else if (_notifOrig) { _notifOrig(msg); }
        };
    }
    // ════════════════════════════════════════════════════════════
    // FIM MÓDULO INTELIGÊNCIA: hooks de integração
    // ════════════════════════════════════════════════════════════
    function hitTestCaminhos(x, y) {
        const caminhos = getCaminhos();
        const limiar = 20 / scale;
        for (let ci = caminhos.length - 1; ci >= 0; ci--) {
            const cam = caminhos[ci];
            const pts = cam.pontos;
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const dx = b.x-a.x, dy = b.y-a.y, lenSq = dx*dx+dy*dy;
                let t = lenSq > 0 ? ((x-a.x)*dx+(y-a.y)*dy)/lenSq : 0;
                t = Math.max(0, Math.min(1, t));
                if (Math.hypot(x-(a.x+t*dx), y-(a.y+t*dy)) < limiar) return ci;
            }
            if (cam.fechado && pts.length >= 2) {
                const a = pts[pts.length-1], b = pts[0];
                const dx = b.x-a.x, dy = b.y-a.y, lenSq = dx*dx+dy*dy;
                let t = lenSq > 0 ? ((x-a.x)*dx+(y-a.y)*dy)/lenSq : 0;
                t = Math.max(0, Math.min(1, t));
                if (Math.hypot(x-(a.x+t*dx), y-(a.y+t*dy)) < limiar) return ci;
            }
        }
        return -1;
    }

    // ── TOUCH START ───────────────────────────────────────────────────────────
    vp.addEventListener('touchstart', (e) => {
        e.preventDefault();

        // 2 DEDOS → pinch zoom/pan (sempre, independente de ferramenta ativa)
        if (e.touches.length >= 2) {
            // Se estava arrastando um texto com 1 dedo e o 2º chegou,
            // verificar se os dedos estão sobre um texto — se sim, cancela o pinch
            const texLayer2 = document.getElementById('texto-layer');
            const t0 = e.touches[0], t1 = e.touches[1];
            const p0 = clientParaCanvas(t0.clientX, t0.clientY);
            const p1 = clientParaCanvas(t1.clientX, t1.clientY);
            let dedosSobreTexto = false;
            for (const elT of [...texLayer2.querySelectorAll('text')]) {
                try {
                    const bb = elT.getBBox();
                    const margem = 30 / scale;
                    const emCima = (px, py) =>
                        px >= bb.x - margem && px <= bb.x + bb.width + margem &&
                        py >= bb.y - margem && py <= bb.y + bb.height + margem;
                    if (emCima(p0.x, p0.y) || emCima(p1.x, p1.y)) {
                        dedosSobreTexto = true; break;
                    }
                } catch(e2) {}
            }
            if (dedosSobreTexto) {
                // Ignora o pinch — não rotaciona nem zooma a folha
                pinching = false; isDragging = false; _txtDrag = null;
                return;
            }
            // Se pen/editar criou um ponto no primeiro dedo, desfaz agora
            if ((modoPen || modoEditar) && _penPontosCriados > 0) {
                // Usa splice com índice guardado para desfazer corretamente mesmo inserções no meio
                if (_penUndoIdx >= 0 && _penUndoIdx < pontosPen.length) {
                    pontosPen.splice(_penUndoIdx, 1);
                } else {
                    pontosPen.pop(); // fallback
                }
                _penPontosCriados = 0; _penUndoIdx = -1;
                noArrastado = null; isNewPoint = false;
                renderizarPen();
            }
            // Cancela drag de texto se estava em andamento
            if (_txtDrag) { _txtDrag = null; _textoEditando = null; }
            pinchDistIni  = Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY);
            pinchCxIni    = (t0.clientX + t1.clientX) / 2;
            pinchCyIni    = (t0.clientY + t1.clientY) / 2;
            pinchScaleIni = scale;
            pinchPosXIni  = posX;
            pinchPosYIni  = posY;
            pinchAnguloIni  = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
            pinchRotacaoIni = rotacao;
            pinching  = true;
            isDragging = false;
            // Cancela qualquer ação de pen/editar em andamento
            noArrastado = null;
            isNewPoint  = false;
            return;
        }

        // 1 DEDO → ferramentas
        // (handles de resize/rotação são divs HTML com listeners próprios)
        isDragging = true; hasMovedTap = false; isNewPoint = false;
        tapStartX = e.touches[0].clientX; tapStartY = e.touches[0].clientY;
        lastX = e.touches[0].clientX;     lastY = e.touches[0].clientY;

        const {x, y} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);

        if (document.getElementById('btnTexto').style.background === 'rgb(3, 218, 198)') {
            textoPosX=x; textoPosY=y;
            document.getElementById('btnTexto').style.background='#333';
            document.getElementById('btnTexto').style.color='white';
            abrirModalTexto(); isDragging=false; return;
        }
        // BOLINHAS DEGRADÊ — agora têm listeners próprios, viewport ignora

        // DETECÇÃO DE TOQUE EM TEXTO — arrasto com 1 dedo ou mostra botão de edição
        if (!modoSelecao && !modoLivre && !modoBorracha && !modoDegrade &&
            !modoFormas && !modoPen && !modoEditar && !modoContaGotas) {
            const texLayer2 = document.getElementById('texto-layer');
            const elsTxt = [...texLayer2.querySelectorAll('text')].reverse();
            for (const elT of elsTxt) {
                try {
                    const bb = elT.getBBox();
                    const margem = 20 / scale;
                    if (x >= bb.x - margem && x <= bb.x + bb.width + margem &&
                        y >= bb.y - margem && y <= bb.y + bb.height + margem) {
                        // Iniciou toque num texto — prepara drag
                        _textoEditando = elT;
                        _txtDrag = {
                            el: elT,
                            offX: x - parseFloat(elT.getAttribute('x')||0),
                            offY: y - parseFloat(elT.getAttribute('y')||0),
                            moved: false
                        };
                        isDragging = false; // não pan
                        return;
                    }
                } catch(e2) {}
            }
            // Toque fora de qualquer texto — esconde botão
            document.getElementById('btn-editar-texto').style.display = 'none';
            _textoEditando = null;
            _txtDrag = null;
        } else {
            // Ferramenta ativa — esconde botão de edição de texto
            document.getElementById('btn-editar-texto').style.display = 'none';
            _textoEditando = null;
            _txtDrag = null;
        }

        if (modoSelecao) {
            tentarSelecionar(x, y);
            selecaoOffX = x; selecaoOffY = y;
            return;
        }

        if (modoLivre)    { iniciarPincel(x, y); return; }
        if (modoBorracha) {
            const agora = Date.now(), intervalo = agora-(window._ultimoToqueBorracha||0);
            window._ultimoToqueBorracha = agora;
            if (intervalo<400 && pontosBorracha.length>=2) { aplicarBorracha(); return; }
            pontosBorracha.push({x,y}); renderizarBorracha(); return;
        }
        if (modoDegrade)  { degradeStart={x,y}; atualizarPreviewDegradeLayer(x,y,x,y); return; }
        if (modoFormas)   { formaStart={x,y}; return; }
        if (modoEditar) {
            _penPontosCriados = 0; _penUndoIdx = -1;
            if (caminhoAtivo >= 0) {
                noArrastado = null;
                for (let i=0;i<pontosPen.length;i++) {
                    if (Math.hypot(pontosPen[i].x-x,pontosPen[i].y-y)<30/scale){noArrastado=i;break;}
                }
                if (noArrastado!==null) return;
                if (pontosPen.length>=2) {
                    const limiar=20/scale; let mD=Infinity,mI=-1;
                    for (let i=0;i<pontosPen.length-1;i++) {
                        const a=pontosPen[i],b=pontosPen[i+1];
                        const ddx=b.x-a.x,ddy=b.y-a.y,lq=ddx*ddx+ddy*ddy;
                        let t=lq>0?((x-a.x)*ddx+(y-a.y)*ddy)/lq:0;
                        t=Math.max(0,Math.min(1,t));
                        const dd=Math.hypot(x-(a.x+t*ddx),y-(a.y+t*ddy));
                        if(dd<limiar&&dd<mD){mD=dd;mI=i;}
                    }
                    if(mI>=0){const a=pontosPen[mI],b=pontosPen[mI+1];pontosPen.splice(mI+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,tipo:'curva'});noArrastado=mI+1;isNewPoint=true;_penPontosCriados=1;_penUndoIdx=mI+1;renderizarPen();return;}
                }
                const idxOutro = hitTestCaminhos(x, y);
                if (idxOutro >= 0 && idxOutro !== caminhoAtivo) { _editarCaminho(idxOutro); return; }
            } else {
                const caminhos = getCaminhos();
                let melhorIdx = -1, melhorDist = Infinity;
                caminhos.forEach((cam, ci) => {
                    if (!cam.pontos || cam.pontos.length < 2) return;
                    const xs = cam.pontos.map(p=>p.x), ys = cam.pontos.map(p=>p.y);
                    const cx = xs.reduce((a,b)=>a+b,0)/xs.length;
                    const cy = ys.reduce((a,b)=>a+b,0)/ys.length;
                    const d = Math.hypot(x-cx, y-cy);
                    let dSeg = Infinity;
                    for (let i=0;i<cam.pontos.length-1;i++) {
                        const a=cam.pontos[i],b=cam.pontos[i+1];
                        const ddx=b.x-a.x,ddy=b.y-a.y,lq=ddx*ddx+ddy*ddy;
                        let t=lq>0?((x-a.x)*ddx+(y-a.y)*ddy)/lq:0;
                        t=Math.max(0,Math.min(1,t));
                        dSeg=Math.min(dSeg,Math.hypot(x-(a.x+t*ddx),y-(a.y+t*ddy)));
                    }
                    const dist = Math.min(d, dSeg);
                    if (dist < melhorDist) { melhorDist = dist; melhorIdx = ci; }
                });
                if (melhorIdx >= 0 && melhorDist < 60/scale) { _editarCaminho(melhorIdx); }
            }
            return;
        }
        if (modoPen) {
            _penPontosCriados = 0; _penUndoIdx = -1;
            noArrastado=null;
            for(let i=0;i<pontosPen.length;i++){if(Math.hypot(pontosPen[i].x-x,pontosPen[i].y-y)<30/scale){noArrastado=i;break;}}
            if(noArrastado===null&&pontosPen.length>=2){const limiar=20/scale;let mD=Infinity,mI=-1;for(let i=0;i<pontosPen.length-1;i++){const a=pontosPen[i],b=pontosPen[i+1];const ddx=b.x-a.x,ddy=b.y-a.y,lq=ddx*ddx+ddy*ddy;let t=lq>0?((x-a.x)*ddx+(y-a.y)*ddy)/lq:0;t=Math.max(0,Math.min(1,t));const dd=Math.hypot(x-(a.x+t*ddx),y-(a.y+t*ddy));if(dd<limiar&&dd<mD){mD=dd;mI=i;}}if(mI>=0){const a=pontosPen[mI],b=pontosPen[mI+1];pontosPen.splice(mI+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,tipo:'curva'});noArrastado=mI+1;isNewPoint=true;_penPontosCriados=1;_penUndoIdx=mI+1;}}
            if(noArrastado===null){const snapped=aplicarSnap(x,y);pontosPen.push({x:snapped.x,y:snapped.y,tipo:'ancora'});noArrastado=pontosPen.length-1;isNewPoint=true;_penPontosCriados=1;_penUndoIdx=pontosPen.length-1;}
            renderizarPen();
        }
    }, {passive: false});

    // ── HELPER: aplica rotação de seleção dado um ângulo em graus ────────────
    function _aplicarRotacao(angleDeg) {
        if (selecaoCaminhoInfo) {
            // Rotação dos pontos da Pen Tool em torno do centro
            const cam = camadas[selecaoCaminhoInfo.camadaIdx];
            const c = cam.caminhos[selecaoCaminhoInfo.caminhoIdx];
            if (!c._origPontos) c._origPontos = c.pontos.map(p=>({...p}));
            const xs0=c._origPontos.map(p=>p.x), ys0=c._origPontos.map(p=>p.y);
            const ocx=(Math.min(...xs0)+Math.max(...xs0))/2;
            const ocy=(Math.min(...ys0)+Math.max(...ys0))/2;
            // Rotação relativa ao ângulo original (que estava em _selRotOrigAngle)
            const rad = (angleDeg - _selRotOrigAngle) * Math.PI / 180;
            const cos = Math.cos(rad), sin = Math.sin(rad);
            c.pontos = c._origPontos.map(p => {
                const dx = p.x - ocx, dy = p.y - ocy;
                return {...p, x: ocx + dx*cos - dy*sin, y: ocy + dx*sin + dy*cos};
            });
            renderizarTodos();
            const xs=c.pontos.map(p=>p.x), ys=c.pontos.map(p=>p.y);
            const minX=Math.min(...xs), maxX=Math.max(...xs);
            const minY=Math.min(...ys), maxY=Math.max(...ys);
            desenharHandlesSelecao(null, {x:minX, y:minY, width:maxX-minX, height:maxY-minY});
        } else if (_selRealEl && _selBBox) {
            const cx = _selBBox.x + _selBBox.w/2 + selecaoTransX;
            const cy = _selBBox.y + _selBBox.h/2 + selecaoTransY;
            // Constrói transform: translate ao centro, rotaciona, translate de volta, aplica escala atual
            _selRealEl.setAttribute('transform',
                `translate(${cx},${cy}) rotate(${angleDeg}) scale(${_selCurrentScale}) translate(${-(_selBBox.x+_selBBox.w/2)},${-(_selBBox.y+_selBBox.h/2)})`
            );
            // Atualiza handles na posição rotacionada
            const hw = (_selBBox.w * _selCurrentScale) / 2;
            const hh = (_selBBox.h * _selCurrentScale) / 2;
            desenharHandlesSelecao(_selRealEl, {x: cx-hw, y: cy-hh, width: hw*2, height: hh*2});
        }
    }

    // ── HELPER: aplica resize de seleção dado um fator de escala ──────────────
    // Centraliza a lógica duplicada que existia nos dois blocos do touchmove.
    function _aplicarResize(fator) {
        _selCurrentScale = fator;
        const {x:bx, y:by, w:bw, h:bh} = _selBBox;
        if (selecaoCaminhoInfo) {
            const cam = camadas[selecaoCaminhoInfo.camadaIdx];
            const c = cam.caminhos[selecaoCaminhoInfo.caminhoIdx];
            const xs0=c._origPontos.map(p=>p.x), ys0=c._origPontos.map(p=>p.y);
            const ocx=(Math.min(...xs0)+Math.max(...xs0))/2;
            const ocy=(Math.min(...ys0)+Math.max(...ys0))/2;
            c.pontos = c._origPontos.map(p => ({
                ...p,
                x: ocx + (p.x - ocx) * fator,
                y: ocy + (p.y - ocy) * fator
            }));
            renderizarTodos();
            const xs=c.pontos.map(p=>p.x), ys=c.pontos.map(p=>p.y);
            const minX=Math.min(...xs), maxX=Math.max(...xs);
            const minY=Math.min(...ys), maxY=Math.max(...ys);
            desenharHandlesSelecao(null, {x:minX,y:minY,width:maxX-minX,height:maxY-minY});
        } else if (_selRealEl) {
            const cx = bx + bw/2 + selecaoTransX;
            const cy = by + bh/2 + selecaoTransY;
            _selRealEl.setAttribute('transform',
                `translate(${cx},${cy}) scale(${fator}) translate(${-(bx+bw/2)},${-(by+bh/2)})`);
            desenharHandlesSelecao(_selRealEl, {
                x: cx-(bw/2)*fator, y: cy-(bh/2)*fator,
                width: bw*fator, height: bh*fator
            });
        }
    }

    // ── TOUCH MOVE ────────────────────────────────────────────────────────────
    vp.addEventListener('touchmove', (e) => {
        e.preventDefault();

        // 2 DEDOS → zoom + rotação + pan
        if (e.touches.length >= 2 && pinching) {
            const t0 = e.touches[0], t1 = e.touches[1];
            const d  = Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY);
            const cx = (t0.clientX + t1.clientX) / 2;
            const cy = (t0.clientY + t1.clientY) / 2;

            // Zoom
            const novaEscala = Math.min(Math.max(pinchScaleIni * (d / pinchDistIni), 0.05), 8);

            // Rotação — delta acumulado desde o início do gesto (NÃO re-ancora ângulo)
            const anguloAtual = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
            const deltaAngulo = (anguloAtual - pinchAnguloIni) * (180 / Math.PI);
            let novaRotacao = pinchRotacaoIni + deltaAngulo;

            // Snap para 0°/90°/180°/270° quando perto (±8°)
            const arredondado = Math.round(novaRotacao / 90) * 90;
            if (Math.abs(novaRotacao - arredondado) < 8) novaRotacao = arredondado;

            // Âncora em coords de canvas (desfaz rotação inicial)
            const rIni = pinchRotacaoIni * Math.PI / 180;
            const dx0 = pinchCxIni - pinchPosXIni, dy0 = pinchCyIni - pinchPosYIni;
            const ancX = ( dx0 * Math.cos(-rIni) - dy0 * Math.sin(-rIni)) / pinchScaleIni;
            const ancY = ( dx0 * Math.sin(-rIni) + dy0 * Math.cos(-rIni)) / pinchScaleIni;

            // Projeta âncora com nova rotação/escala
            const rNov = novaRotacao * Math.PI / 180;
            scale   = novaEscala;
            rotacao = novaRotacao;
            posX    = cx - (ancX * novaEscala * Math.cos(rNov) - ancY * novaEscala * Math.sin(rNov));
            posY    = cy - (ancX * novaEscala * Math.sin(rNov) + ancY * novaEscala * Math.cos(rNov));

            // Aplica clamp — se moveu posX/posY, re-ancora só a posição (não o ângulo)
            const posXantes = posX, posYantes = posY;
            _clampPos();
            if (posX !== posXantes || posY !== posYantes) {
                // Atualiza âncora de posição para o frame seguinte não desfazer o clamp
                pinchPosXIni = posX;
                pinchPosYIni = posY;
                pinchCxIni   = cx;
                pinchCyIni   = cy;
                pinchScaleIni = scale;
                // ângulo e rotação NÃO são re-ancorados — rotação continua funcionando
            }

            update();
            _atualizarIndicadorRotacao();
            return;
        }

        // BOLINHAS DEGRADÊ — arrastar bolinha A ou B
        if (_dgBolhaDrag && _dgAjuste) {
            const {x: cx, y: cy} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
            if (_dgBolhaDrag === 'a') { _dgAjuste.x1=cx; _dgAjuste.y1=cy; }
            else                      { _dgAjuste.x2=cx; _dgAjuste.y2=cy; }
            _reconstruirDegrade();
            _atualizarBolinhasDegrade();
            return;
        }

        // DRAG DE TEXTO — move o elemento text no SVG
        if (_txtDrag) {
            const {x: tx, y: ty} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
            const nx = tx - _txtDrag.offX;
            const ny = ty - _txtDrag.offY;
            _txtDrag.el.setAttribute('x', nx);
            _txtDrag.el.setAttribute('y', ny);
            _txtDrag.moved = true;
            // Atualiza também degradê de texto se existir
            const degId = _txtDrag.el.getAttribute('data-deg-id');
            if (degId) {
                const grad = document.getElementById(degId);
                if (grad) {
                    const tam2 = parseFloat(_txtDrag.el.getAttribute('font-size')||32);
                    if (grad.tagName === 'linearGradient') {
                        grad.setAttribute('x1', nx - tam2*2); grad.setAttribute('y1', ny);
                        grad.setAttribute('x2', nx + tam2*2); grad.setAttribute('y2', ny);
                    } else {
                        grad.setAttribute('cx', nx); grad.setAttribute('cy', ny);
                        grad.setAttribute('fx', nx); grad.setAttribute('fy', ny);
                    }
                }
            }
            // Esconde botão de edição durante o drag
            document.getElementById('btn-editar-texto').style.display = 'none';
            return;
        }

        // 1 DEDO → ferramentas e pan
        // (rotação e resize são tratados pelos listeners dos divs HTML dos handles)

        if (!isDragging) return;
        const ddx = e.touches[0].clientX-tapStartX, ddy = e.touches[0].clientY-tapStartY;
        if (Math.hypot(ddx,ddy) > 10) hasMovedTap = true;
        const {x, y} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);

        if (modoLivre)  { continuarPincel(x,y); return; }
        if (modoDegrade && degradeStart) {
            atualizarPreviewDegradeLayer(degradeStart.x,degradeStart.y,x,y);
            // Mostra bolinhas em tempo real durante o arrasto
            const {x: _sx1Live, y: _sy1Live} = canvasParaClient(degradeStart.x, degradeStart.y);
            const {x: _sx2Live, y: _sy2Live} = canvasParaClient(x, y);
            const bALive = document.getElementById('dg-bolinha-a');
            const bBLive = document.getElementById('dg-bolinha-b');
            const coresDgLive = getDegradeCores();
            bALive.style.background = coresDgLive[0] || '#03dac6';
            bALive.style.boxShadow  = `0 0 0 2px ${coresDgLive[0]||'#03dac6'},0 3px 10px rgba(0,0,0,0.6)`;
            bBLive.style.background = coresDgLive[coresDgLive.length-1] || '#ff00ff';
            bBLive.style.boxShadow  = `0 0 0 2px ${coresDgLive[coresDgLive.length-1]||'#ff00ff'},0 3px 10px rgba(0,0,0,0.6)`;
            bALive.style.left = (_sx1Live - 26)+'px'; bALive.style.top = (_sy1Live - 26)+'px'; bALive.style.display='flex';
            bBLive.style.left = (_sx2Live - 26)+'px'; bBLive.style.top = (_sy2Live - 26)+'px'; bBLive.style.display='flex';
            // Botão flutuante já aparece durante o arrasto
            document.getElementById('btn-confirmar-degrade').style.display='block';
            return;
        }
        // RESIZE e ROTAÇÃO são tratados pelos listeners dos divs HTML — não processar aqui

        if (modoSelecao && selecaoEl && hasMovedTap && !_selResizing && !_selRotating) {
            const dx=x-selecaoOffX, dy=y-selecaoOffY;
            if (selecaoCaminhoInfo) {
                // Move caminho da Pen Tool — atualiza os pontos diretamente
                const cam = camadas[selecaoCaminhoInfo.camadaIdx];
                const c = cam.caminhos[selecaoCaminhoInfo.caminhoIdx];
                c.pontos.forEach(p => { p.x+=dx; p.y+=dy; });
                if (c._origPontos) c._origPontos.forEach(p => { p.x+=dx; p.y+=dy; });
                renderizarTodos();
                // Atualiza bounding box visual
                const xs=c.pontos.map(p=>p.x), ys=c.pontos.map(p=>p.y);
                const minX=Math.min(...xs), maxX=Math.max(...xs);
                const minY=Math.min(...ys), maxY=Math.max(...ys);
                desenharHandlesSelecao(null, {x:minX,y:minY,width:maxX-minX,height:maxY-minY});
                selecaoEl = document.getElementById('selecao-layer').querySelector('rect');
            } else if (_selRealEl) {
                selecaoTransX+=dx; selecaoTransY+=dy;
                // Mantém scale atual ao mover
                const cur = _selRealEl.getAttribute('transform')||'';
                const hasScale = cur.includes('scale(');
                if (hasScale) {
                    // Rebuild transform preservando escala
                    const bx2 = _selBBox ? _selBBox.x+_selBBox.w/2 : 0;
                    const by2 = _selBBox ? _selBBox.y+_selBBox.h/2 : 0;
                    const bw2 = _selBBox ? _selBBox.w : 0;
                    const bh2 = _selBBox ? _selBBox.h : 0;
                    _selRealEl.setAttribute('transform',
                        `translate(${bx2+dx},${by2+dy}) scale(${_selCurrentScale}) translate(${-bx2},${-by2})`);
                } else {
                    _selRealEl.setAttribute('transform',`translate(${selecaoTransX},${selecaoTransY})`);
                }
                desenharHandlesSelecao(_selRealEl);
            }
            selecaoOffX=x; selecaoOffY=y; return;
        }
        if (modoContaGotas) { const cur=document.getElementById('conta-gotas-cursor'); cur.style.left=e.touches[0].clientX+'px'; cur.style.top=e.touches[0].clientY+'px'; return; }
        if (modoFormas && formaStart) { atualizarPreviewForma(x,y); }
        if (modoBorracha) return;
        if ((modoPen||modoEditar) && noArrastado!==null && hasMovedTap && !pinching) {
                mostrarLupa(e.touches[0].clientX, e.touches[0].clientY);
            const {x: px2, y: py2} = clientParaCanvas(e.touches[0].clientX, e.touches[0].clientY);
            pontosPen[noArrastado].x = px2;
            pontosPen[noArrastado].y = py2;
            renderizarPen();
        } else if (!modoPen&&!modoEditar&&!modoFormas&&!modoLivre&&!modoBorracha&&!modoDegrade&&!modoContaGotas) {
            if (hasMovedTap&&!folhaTravada) {
                posX += e.touches[0].clientX - lastX;
                posY += e.touches[0].clientY - lastY;
                _clampPos();
                update();
            }
        }
        lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    }, {passive: false});

    // ── TOUCH END ─────────────────────────────────────────────────────────────
    vp.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) pinching = false;

        // Finaliza drag de texto
        if (_txtDrag) {
            if (!_txtDrag.moved) {
                // Toque sem mover — mostra botão de edição
                const elT = _txtDrag.el;
                try {
                    const bb = elT.getBBox();
                    // Converte centro do texto (canvas) → tela, levando em conta rotação
                    const rad = rotacao * Math.PI / 180;
                    const cos = Math.cos(rad), sin = Math.sin(rad);
                    const cx = bb.x + bb.width/2, cy = bb.y + bb.height/2;
                    const screenX = posX + (cx * cos - cy * sin) * scale;
                    const screenY = posY + (cx * sin + cy * cos) * scale;
                    const btnEl = document.getElementById('btn-editar-texto');
                    btnEl.style.left = '8px';
                    btnEl.style.top  = Math.max(60, Math.min(screenY - 19, window.innerHeight - 100)) + 'px';
                    btnEl.style.display = 'flex';
                } catch(e2) {}
            } else {
                // Moveu — salva histórico
                salvarHistorico();
                document.getElementById('btn-editar-texto').style.display = 'none';
                _textoEditando = null;
            }
            _txtDrag = null;
            return;
        }

        // Solta bolinha degradê
        if (_dgBolhaDrag) { _dgBolhaDrag = null; return; }

        if ((modoPen||modoEditar) && noArrastado!==null) {
            if (hasMovedTap) {
                const p=pontosPen[noArrastado],ultimo=pontosPen.length-1; let tratado=false;
                for(let i=0;i<pontosPen.length;i++){
                    if(i===noArrastado) continue;
                    if(Math.hypot(pontosPen[i].x-p.x,pontosPen[i].y-p.y)<40/scale){
                        const eInicio=(noArrastado===0&&i===ultimo)||(noArrastado===ultimo&&i===0);
                        if(!pathFechado&&eInicio&&pontosPen.length>=3){pathFechado=true;document.getElementById('btnFechar').style.background='#03dac6';}
                        else{pontosPen.splice(noArrastado,1);if(pontosPen.length<3){pathFechado=false;document.getElementById('btnFechar').style.background='#333';}}
                        renderizarPen();tratado=true;break;
                    }
                }
                if(tratado){isDragging=false;noArrastado=null;isNewPoint=false;return;}
            } else if(!isNewPoint&&!hasMovedTap){
                pontosPen[noArrastado].tipo=pontosPen[noArrastado].tipo==='ancora'?'curva':'ancora';
                renderizarPen();
            }
        }
        if (modoLivre)    { finalizarPincel(); if(modoEspelho&&pincelGrupoAtual) aplicarEspelho(pincelGrupoAtual); return; }
        if (modoBorracha) { isDragging=false; return; }
        if (modoContaGotas && !hasMovedTap) {
            capturarCor(e.changedTouches[0].clientX, e.changedTouches[0].clientY); return;
        }
        if (modoDegrade && degradeStart) {
            const {x: x2, y: y2} = clientParaCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
            const dist=Math.hypot(x2-degradeStart.x,y2-degradeStart.y);
            if(dist>5){
                salvarHistorico();
                let el;
                if(degradeTipo==='linear'){el=criarDegradeLinear(degradeStart.x,degradeStart.y,x2,y2,degradeFill);}
                else{el=criarDegradeRadialSVG(degradeStart.x,degradeStart.y,dist,degradeFill);}
                // Insere logo após os <defs> (que devem ficar primeiro), antes dos demais filhos
                let refNode = null;
                for (const child of livreLayer.children) {
                    if (child.tagName.toLowerCase() !== 'defs') { refNode = child; break; }
                }
                if (refNode) livreLayer.insertBefore(el, refNode);
                else livreLayer.appendChild(el);
                // Atualiza (ou cria) bolinhas de ajuste — modoDegrade permanece ativo
                _dgAjuste = {
                    el: el,
                    x1: degradeStart.x, y1: degradeStart.y,
                    x2: x2, y2: y2,
                    tipo: degradeTipo, fill: degradeFill
                };
                _atualizarBolinhasDegrade();
                // Botão flutuante persiste até o usuário apertar ✓
                document.getElementById('btn-confirmar-degrade').style.display='block';
            }
            document.getElementById('degrade-preview-layer').innerHTML='';
            // Esconde bolinhas de preview (do drag), mantém as de ajuste
            document.getElementById('dg-bolinha-a').style.display = _dgAjuste ? 'flex' : 'none';
            document.getElementById('dg-bolinha-b').style.display = _dgAjuste ? 'flex' : 'none';
            degradeStart=null; isDragging=false; noArrastado=null; isNewPoint=false; return;
        }
        if (modoFormas && formaStart) {
            const {x: x2, y: y2} = clientParaCanvas(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
            if(Math.hypot(x2-formaStart.x,y2-formaStart.y)>5) desenharForma(formaStart.x,formaStart.y,x2,y2);
            formaStart=null;
        }
        isDragging=false; noArrastado=null; isNewPoint=false; _penPontosCriados=0; _penUndoIdx=-1;
        esconderLupa();
    }, {passive: false});



    // ── CONTROLES ─────────────────────────────────────────────────────────────
    window.togglePenMode = () => {
        if (modoPen) {
            // Já está ativa — desseleciona
            modoPen = false;
            ferramentaAtiva = '';
            // Salva caminho em andamento se tiver pontos suficientes
            if (pontosPen.length >= 2) salvarCaminhoAtivo();
            else if (caminhoAtivo >= 0) getCaminhos().splice(caminhoAtivo, 1);
            caminhoAtivo = -1; pontosPen = []; pathFechado = false;
            penLayer.innerHTML = '';
            renderizarTodos();
            const _ficEl = document.getElementById('ferr-icon');
            const _flbEl = document.getElementById('ferr-label');
            if (_ficEl) _ficEl.textContent = '🖊';
            if (_flbEl) _flbEl.textContent = 'PEN';
            document.getElementById('fBtn-pen').style.background = '#333';
            document.getElementById('menu-ferramentas').style.display = 'none';
            menuFerraberto = false;
        } else {
            selecionarFerramenta('pen');
        }
    };

    window.toggleEditarMode = () => {
        // Encerra ferramentas ativas
        if (modoPen || modoLivre || modoBorracha) {
            modoPen = false; modoLivre = false; modoBorracha = false;
            const bFerr = document.getElementById('btnFerramentas');
            if (bFerr) { bFerr.textContent = '🖊 PEN ▾'; bFerr.style.background = '#ff00ff'; }
            if (pontosPen.length >= 2) salvarCaminhoAtivo();
            else if (caminhoAtivo >= 0) getCaminhos().splice(caminhoAtivo, 1);
            caminhoAtivo = -1; pontosPen = []; pathFechado = false;
            penLayer.innerHTML = '';
            renderizarTodos();
        }
        modoEditar = !modoEditar;
        document.getElementById('btnEditar').style.background = modoEditar ? '#ffaa00' : '#333';
        if (modoEditar) {
            const caminhos = getCaminhos();
            if (caminhos.length === 0) {
                mostrarNotificacao('⚠️ Nenhum caminho na camada ativa');
                modoEditar = false;
                document.getElementById('btnEditar').style.background = '#333';
                return;
            }
            // Se há só 1 caminho, entra direto nele
            if (caminhos.length === 1) {
                _editarCaminho(0);
            } else {
                // Destaca todos os caminhos para o usuário tocar no que quer editar
                mostrarDicaEditar(true);
                _renderizarTodosEditaveis();
            }
        } else {
            mostrarDicaEditar(false);
            encerrarEdicao();
        }
    };

    // Renderiza todos os caminhos com destaque para escolha no modo editar
    function _renderizarTodosEditaveis() {
        penLayer.innerHTML = '';
        const caminhos = getCaminhos();
        caminhos.forEach((cam, ci) => {
            if (!cam.pontos || cam.pontos.length < 2) return;
            const d = buildPathD(cam.pontos, cam.fechado);
            // Contorno de seleção
            const sel = document.createElementNS(NS, 'path');
            sel.setAttribute('d', d);
            sel.setAttribute('fill', 'none');
            sel.setAttribute('stroke', '#ffaa00');
            sel.setAttribute('stroke-width', 8/scale);
            sel.setAttribute('stroke-opacity', '0.4');
            sel.setAttribute('stroke-linecap', 'round');
            penLayer.appendChild(sel);
            // Ponto central para toque
            const xs = cam.pontos.map(p=>p.x), ys = cam.pontos.map(p=>p.y);
            const cx = xs.reduce((a,b)=>a+b,0)/xs.length;
            const cy = ys.reduce((a,b)=>a+b,0)/ys.length;
            const dot = document.createElementNS(NS, 'circle');
            dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
            dot.setAttribute('r', 16/scale);
            dot.setAttribute('fill', '#ffaa00');
            dot.setAttribute('stroke', 'white');
            dot.setAttribute('stroke-width', 2/scale);
            penLayer.appendChild(dot);
            // Número do caminho
            const txt = document.createElementNS(NS, 'text');
            txt.setAttribute('x', cx); txt.setAttribute('y', cy);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'middle');
            txt.setAttribute('fill', '#000');
            txt.setAttribute('font-size', 12/scale);
            txt.setAttribute('font-weight', 'bold');
            txt.textContent = ci + 1;
            penLayer.appendChild(txt);
        });
    }

    // Entra em edição de um caminho específico
    function _editarCaminho(idx) {
        const caminhos = getCaminhos();
        const cam = caminhos[idx];
        if (!cam) return;
        mostrarDicaEditar(false);
        encerrarEdicao();
        caminhoAtivo = idx;
        pontosPen = cam.pontos.map(p => ({...p}));
        pathFechado = cam.fechado;
        document.getElementById('col-main').value = cam.stroke || '#000000';
        document.getElementById('brush-size').value = cam.width || 2;
        document.getElementById('brush-opacity').value = cam.opacity ?? 1;
        if (document.getElementById('pincel-tipo')) document.getElementById('pincel-tipo').value = cam.tipo || 'normal';
        document.getElementById('btnFechar').style.background = pathFechado ? '#03dac6' : '#333';
        renderizarTodos();
        renderizarPen();
        mostrarNotificacao('✏️ Arraste os pontos para editar');
    }

    // ── TELA INICIAL ─────────────────────────────────────────────────────────
    function renderizarTelaInicial() {
        const lista  = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        const el     = document.getElementById('projetos-lista-inicial');
        if (lista.length === 0) {
            el.innerHTML = '<div class="proj-sem">Nenhum projeto salvo ainda.<br>Crie um novo! ✏️</div>';
            return;
        }
        el.innerHTML = [...lista].reverse().map((p, i) => {
            const idxReal = lista.length - 1 - i;
            return `<div class="proj-item-inicial" onclick="carregarProjetoInicial(${idxReal})">
                <div style="font-size:24px">📁</div>
                <div class="proj-info">
                    <div class="proj-nome">${p.nome}</div>
                    <div class="proj-data">${p.data}</div>
                </div>
                <button class="proj-del" onclick="event.stopPropagation();deletarProjetoInicial(${idxReal})">✕</button>
            </div>`;
        }).join('');
    }

    let _editorAberto = false;

    function abrirEditor() {
        _editorAberto = true;
        centralizarFolha();
        const tela = document.getElementById('tela-inicial');
        tela.style.opacity = '0';
        tela.style.transition = 'opacity 0.4s';
        setTimeout(() => {
            tela.style.display = 'none';
            centralizarFolha();
        }, 450);
    }

    function voltarInicio() {
        _editorAberto = false;
        // Limpa o editor
        camadas = [criarCamada('Camada 1')];
        camadaAtiva = 0; caminhoAtivo = -1;
        pontosPen = []; pathFechado = false;
        penLayer.innerHTML = ''; drawLayer.innerHTML = ''; livreLayer.innerHTML = '';
        document.getElementById('texto-layer').innerHTML = '';
        svgArea.innerHTML = '';
        camadaFoto = { opacidade: 1, visivel: true, svgHTML: '' };
        fotoOrdem = -1;
        historico = []; historicoFuturo = [];
        modoPen = false; modoEditar = false; modoLivre = false; modoBorracha = false;
        // Reseta estado do degradê
        _esconderBolinhasDegrade(); _esconderBolinhasTxtDg();
        modoDegrade = false; degradeStart = null;
        _dgPrevReset();
        document.getElementById('btnDegrade').style.background = '#e74c3c';
        document.getElementById('degrade-preview-layer').innerHTML = '';
        const bFerr = document.getElementById('btnFerramentas');
        const bEdit = document.getElementById('btnEditar');
        const bFech = document.getElementById('btnFechar');
        if (bFerr) { bFerr.textContent = '🖊 PEN ▾'; bFerr.style.background = '#ff00ff'; }
        if (bEdit) bEdit.style.background = '#333';
        if (bFech) bFech.style.background = '#333';
        // Mostra tela inicial
        const tela = document.getElementById('tela-inicial');
        tela.style.display = 'flex';
        tela.style.opacity = '0';
        setTimeout(() => { tela.style.transition = 'opacity 0.4s'; tela.style.opacity = '1'; }, 10);
        renderizarTelaInicial();
    }

    // ── MODAL NOVO PROJETO ────────────────────────────────────────────────
    let tipoNovoProjeto = 'finito'; // 'finito' | 'infinito'
    let modoInfinito = false;
    let gradeAtiva = false;
    let gradeTamanho = 20;

    // ── Grade quadriculada SVG ────────────────────────────────────────────
    function renderizarGrade() {
        const layer = document.getElementById('grade-layer');
        layer.innerHTML = '';
        if (!gradeAtiva) return;

        const W = workSurface.offsetWidth  || 800;
        const H = workSurface.offsetHeight || 1000;
        const tam = gradeTamanho;
        const cor = 'rgba(0,0,0,0.08)';
        const corForte = 'rgba(0,0,0,0.15)';

        // Usa <defs><pattern> para a grade — vetorial e eficiente
        const ns = 'http://www.w3.org/2000/svg';
        const defs = document.createElementNS(ns, 'defs');
        const pat = document.createElementNS(ns, 'pattern');
        pat.setAttribute('id', 'grade-pat');
        pat.setAttribute('width', tam);
        pat.setAttribute('height', tam);
        pat.setAttribute('patternUnits', 'userSpaceOnUse');

        // Linhas secundárias (células pequenas)
        const l1 = document.createElementNS(ns, 'path');
        l1.setAttribute('d', `M ${tam} 0 L 0 0 0 ${tam}`);
        l1.setAttribute('fill', 'none');
        l1.setAttribute('stroke', cor);
        l1.setAttribute('stroke-width', '0.5');
        pat.appendChild(l1);

        defs.appendChild(pat);
        layer.appendChild(defs);

        // Rect que cobre tudo com o padrão
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', 'url(#grade-pat)');
        layer.appendChild(rect);

        // Linhas de grade maior a cada 5 células
        const patG = document.createElementNS(ns, 'pattern');
        patG.setAttribute('id', 'grade-pat-grande');
        patG.setAttribute('width', tam*5);
        patG.setAttribute('height', tam*5);
        patG.setAttribute('patternUnits', 'userSpaceOnUse');
        const l2 = document.createElementNS(ns, 'path');
        l2.setAttribute('d', `M ${tam*5} 0 L 0 0 0 ${tam*5}`);
        l2.setAttribute('fill', 'none');
        l2.setAttribute('stroke', corForte);
        l2.setAttribute('stroke-width', '0.8');
        patG.appendChild(l2);
        defs.appendChild(patG);

        const rectG = document.createElementNS(ns, 'rect');
        rectG.setAttribute('width', '100%');
        rectG.setAttribute('height', '100%');
        rectG.setAttribute('fill', 'url(#grade-pat-grande)');
        layer.appendChild(rectG);
    }

    window.abrirModalNovoProjeto = () => {
        tipoNovoProjeto = 'finito';
        gradeAtiva = false;
        gradeTamanho = 20;
        document.getElementById('card-finito').classList.add('ativo');
        document.getElementById('card-infinito').classList.remove('ativo');
        document.getElementById('chk-grade').checked = false;
        document.getElementById('grade-size-wrap').style.display = 'none';
        // Reset tamanho ativo
        ['20','40','80','100'].forEach(s => {
            document.getElementById('gs-'+s).classList.toggle('ativo', s==='20');
        });
        document.getElementById('modal-novo-projeto').classList.add('aberto');
    };

    // Toggle grade
    document.getElementById('chk-grade').addEventListener('change', (e) => {
        gradeAtiva = e.target.checked;
        document.getElementById('grade-size-wrap').style.display = gradeAtiva ? 'block' : 'none';
    });

    // Tamanho da grade
    ['20','40','80','100'].forEach(s => {
        document.getElementById('gs-'+s).addEventListener('touchstart', (e) => {
            e.stopPropagation();
            gradeTamanho = parseInt(s);
            ['20','40','80','100'].forEach(x =>
                document.getElementById('gs-'+x).classList.toggle('ativo', x===s));
        }, {passive:true});
    });

    function fecharModalNovoProjeto() {
        document.getElementById('modal-novo-projeto').classList.remove('aberto');
    }

    document.getElementById('card-finito').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        tipoNovoProjeto = 'finito';
        document.getElementById('card-finito').classList.add('ativo');
        document.getElementById('card-infinito').classList.remove('ativo');
    }, {passive:true});

    document.getElementById('card-infinito').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        tipoNovoProjeto = 'infinito';
        document.getElementById('card-infinito').classList.add('ativo');
        document.getElementById('card-finito').classList.remove('ativo');
    }, {passive:true});

    document.getElementById('btn-confirmar-novo-proj').addEventListener('touchstart', (e) => {
        e.stopPropagation(); e.preventDefault();
        fecharModalNovoProjeto();
        novoProjeto(tipoNovoProjeto);
    }, {passive:false});

    document.getElementById('btn-cancelar-novo-proj').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        fecharModalNovoProjeto();
    }, {passive:true});

    window.novoProjeto = (tipo = 'finito') => {
        modoInfinito = (tipo === 'infinito');

        // Reseta estado
        camadas = [criarCamada('Camada 1')];
        camadaAtiva = 0; caminhoAtivo = -1;
        pontosPen = []; pathFechado = false;
        penLayer.innerHTML = ''; drawLayer.innerHTML = '';
        svgArea.innerHTML = ''; livreLayer.innerHTML = '';
        document.getElementById('texto-layer').innerHTML = '';
        camadaFoto = { opacidade: 1, visivel: true, svgHTML: '' };
        fotoOrdem = -1;
        historico = []; historicoFuturo = [];
        modoPen = false; modoEditar = false; modoLivre = false; modoBorracha = false;
        // Reseta estado do degradê
        _esconderBolinhasDegrade(); _esconderBolinhasTxtDg();
        modoDegrade = false; degradeStart = null;
        _dgPrevReset();
        document.getElementById('btnDegrade').style.background = '#e74c3c';
        document.getElementById('degrade-preview-layer').innerHTML = '';
        const bFerr = document.getElementById('btnFerramentas');
        const bEdit = document.getElementById('btnEditar');
        const bFech = document.getElementById('btnFechar');
        if (bFerr) { bFerr.textContent = '🖊 PEN ▾'; bFerr.style.background = '#ff00ff'; }
        if (bEdit) bEdit.style.background = '#333';
        if (bFech) bFech.style.background = '#333';

        aplicarModoInfinito(modoInfinito);
        renderizarGrade();
        abrirEditor();
    };

    // ══════════════════════════════════════════════════════════════════
    // MODO INFINITO — reescrito do zero
    // Canvas fixo 50000×50000px. Sem expansão dinâmica.
    // posX/posY nunca são modificados por código de background.
    // ══════════════════════════════════════════════════════════════════
    const INF_SIZE = 50000; // tamanho do canvas infinito

    function aplicarModoInfinito(ativo) {
        const vp  = document.getElementById('viewport');
        const ws  = workSurface;
        const ind = document.getElementById('indicador-infinito');

        if (ativo) {
            // Canvas grande fixo
            ws.style.width      = INF_SIZE + 'px';
            ws.style.height     = INF_SIZE + 'px';
            ws.style.background = 'white';
            ws.style.boxShadow  = 'none';
            vp.classList.add('infinito');
            ind.style.display   = 'block';

            // Posiciona para mostrar o canto (0,0) do canvas no canto superior esquerdo da tela
            // com uma pequena margem — igual à folha normal
            scale = 0.8;
            posX  = 20;
            posY  = 80;
        } else {
            ws.style.background = 'white';
            ws.style.boxShadow  = '0 0 20px rgba(0,0,0,0.5)';
            vp.classList.remove('infinito');
            ind.style.display   = 'none';
            const folha = (configUsuario?.folha || '800x1000').split('x');
            ws.style.width  = folha[0] + 'px';
            ws.style.height = folha[1] + 'px';
            scale = 0.8; posX = 20; posY = 80;
        }
        update();
    }

    function centralizarFolha() {
        scale = 0.8;
        if (modoInfinito) {
            // Scale maior para traços ficarem visíveis
            // Ponto (0,0) do canvas no centro da tela
            scale = 1.0;
            // Mostra o ponto (2000,2000) do canvas no centro da tela
            // assim tem espaço para desenhar em todas as direções
            posX = window.innerWidth  / 2 - 2000 * scale;
            posY = window.innerHeight / 2 - 2000 * scale;
        } else {
            const wsW = workSurface.offsetWidth  || 800;
            const wsH = workSurface.offsetHeight || 1000;
            posX = window.innerWidth  / 2 - (wsW / 2) * scale;
            posY = window.innerHeight / 2 - (wsH / 2) * scale;
        }
        update();
    }

    // Stubs — mantidos para compatibilidade com código que os chama
    let expansaoInterval = null;
    function iniciarExpansaoInfinita() {}
    function pararExpansaoInfinita() {
        if (expansaoInterval) { clearInterval(expansaoInterval); expansaoInterval = null; }
    }

   window.carregarProjetoInicial = (idx) => {
        const lista = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        const p = lista[idx];
        if (!p) return;
        camadas = p.camadas; camadaFoto = p.camadaFoto;
        fotoOrdem = (p.fotoOrdem !== undefined) ? p.fotoOrdem : -1;
        camadaAtiva = 0; caminhoAtivo = -1; pontosPen = []; pathFechado = false;
        penLayer.innerHTML = '';
        if (p.workW) workSurface.style.width  = p.workW + 'px';
        if (p.workH) workSurface.style.height = p.workH + 'px';
        rotacao = p.rotacao || 0;
        svgArea.innerHTML = camadaFoto.svgHTML || '';
        document.getElementById('texto-layer').innerHTML = p.textoHTML || '';
        historico = []; historicoFuturo = [];
        modoInfinito   = p.modoInfinito   || false;
        gradeAtiva     = p.gradeAtiva     || false;
        gradeTamanho   = p.gradeTamanho   || 20;
        _esconderBolinhasDegrade(); _esconderBolinhasTxtDg();
        modoDegrade = false; degradeStart = null; _dgPrevReset();
        document.getElementById('btnDegrade').style.background = '#e74c3c';
        document.getElementById('degrade-preview-layer').innerHTML = '';
        aplicarModoInfinito(modoInfinito);
        renderizarTodos();
        abrirEditor();
    };

    window.deletarProjetoInicial = (idx) => {
        const lista = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        lista.splice(idx, 1);
        localStorage.setItem('tm_projetos', JSON.stringify(lista));
        renderizarTelaInicial();
    };

    // ── HISTÓRICO DESFAZER/REFAZER ────────────────────────────────────────────
    // ── AUTO-SAVE ─────────────────────────────────────────────────────────────
    let _autoSaveTimer = null;
    function _autoSave() {
        if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(() => {
            try {
                if (camadas[camadaAtiva]) {
                    camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
                }
                const rascunho = {
                    ts: Date.now(),
                    camadas: camadas.map(c => ({
                        ...c, caminhos: c.caminhos.map(p => ({...p, pontos: [...p.pontos]}))
                    })),
                    camadaFoto,
                    fotoOrdem,
                    textoHTML: document.getElementById('texto-layer').innerHTML,
                    workW: workSurface.offsetWidth,
                    workH: workSurface.offsetHeight,
                    modoInfinito, gradeAtiva, gradeTamanho, rotacao,
                };
                localStorage.setItem('tm_rascunho', JSON.stringify(rascunho));
                // Mostra indicador sutil
                const n = document.getElementById('notificacao');
                if (n) { n.textContent = '💾 Rascunho salvo'; n.style.display='block'; setTimeout(()=>n.style.display='none', 1200); }
            } catch(e) {
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.warn('TraceMaster: localStorage cheio — autosave pausado. Salve o projeto e exporte como SVG.');
                } else {
                    console.warn('Auto-save falhou:', e);
                }
            }
        }, 2000); // salva 2s após última ação
    }

    let _histTimer = null;
    function salvarHistorico() {
        // Cancela timer anterior — evita múltiplos JSON.stringify seguidos
        if (_histTimer) { clearTimeout(_histTimer); _histTimer = null; }

        // ── SYNC IMEDIATO: garante que livreHTML da camada ativa está atualizado ──
        // Isso evita o bug onde o pincel livre some ao desfazer
        if (camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
        }

        _histTimer = setTimeout(() => {
            _histTimer = null;
            // Sync novamente no momento do save (caso algo tenha mudado nos 80ms)
            if (camadas[camadaAtiva]) {
                camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
            }
            historico.push(JSON.stringify({
                camadas: camadas.map(c => ({
                    ...c, caminhos: c.caminhos.map(p => ({...p, pontos: [...p.pontos]}))
                })),
                camadaAtivaIdx: camadaAtiva,
                fotoOrdem,
                texto: document.getElementById('texto-layer').innerHTML
            }));
            historicoFuturo = [];
            if (historico.length > 30) historico.shift(); // limite menor = menos memória
            _autoSave();
        }, 80);
    }

    window.desfazerPen = () => {
        // BORRACHA: remove último ponto dela
        if (modoBorracha && pontosBorracha.length > 0) {
            pontosBorracha.pop();
            renderizarBorracha();
            return;
        }
        // PEN ATIVO: remove só o último ponto, mas salva no futuro para refazer
        if ((modoPen || modoEditar) && pontosPen.length > 0) {
            // Salva estado atual no futuro antes de remover
            historicoFuturo.push(JSON.stringify({
                pontos: [...pontosPen.map(p => ({...p}))],
                fechado: pathFechado
            }));
            pontosPen.pop();
            if (pathFechado) {
                pathFechado = false;
                document.getElementById('btnFechar').style.background = '#333';
            }
            renderizarPen();
            return;
        }
        // FORA DO PEN: usa histórico completo
        if (historico.length === 0) return;

        // Sync estado atual da camada ativa antes de salvar no futuro
        if (camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
        }
        // Salva estado atual no futuro
        historicoFuturo.push(JSON.stringify({
            camadas: camadas.map(c => ({
                ...c, caminhos: c.caminhos.map(p => ({...p, pontos: [...p.pontos]}))
            })),
            camadaAtivaIdx: camadaAtiva,
            texto: document.getElementById('texto-layer').innerHTML
        }));
        // Restaura snapshot anterior
        const snap = JSON.parse(historico.pop());
        camadas = snap.camadas !== undefined ? snap.camadas : snap;
        // Restaura índice da camada ativa se disponível
        if (snap.camadaAtivaIdx !== undefined) camadaAtiva = snap.camadaAtivaIdx;
        if (snap.fotoOrdem !== undefined) fotoOrdem = snap.fotoOrdem;
        // Restaura texto
        if (snap.texto !== undefined) document.getElementById('texto-layer').innerHTML = snap.texto;
        // Suporte legado: snap com campo 'livre' separado
        if (snap.livre !== undefined && camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = snap.livre;
        }
        caminhoAtivo = -1; pontosPen = []; pathFechado = false;
        penLayer.innerHTML = '';
        document.getElementById('btnFechar').style.background = '#333';
        document.getElementById('btn-confirmar-pen').style.display = 'none';
        renderizarTodos();
        if (painelAberto) renderizarPainel();
    };

    window.refazerPen = () => {
        if (historicoFuturo.length === 0) return;
        const snapshot = JSON.parse(historicoFuturo.pop());
        // Snapshot de pontos da Pen Tool ativa
        if (snapshot.pontos !== undefined) {
            pontosPen   = snapshot.pontos;
            pathFechado = snapshot.fechado;
            document.getElementById('btnFechar').style.background = pathFechado ? '#03dac6' : '#333';
            renderizarPen();
        } else {
            // Sync estado atual antes de empurrar no histórico
            if (camadas[camadaAtiva]) {
                camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
            }
            historico.push(JSON.stringify({
                camadas: camadas.map(c => ({
                    ...c, caminhos: c.caminhos.map(p => ({...p, pontos: [...p.pontos]}))
                })),
                camadaAtivaIdx: camadaAtiva,
                texto: document.getElementById('texto-layer').innerHTML
            }));
            camadas = snapshot.camadas !== undefined ? snapshot.camadas : snapshot;
            if (snapshot.camadaAtivaIdx !== undefined) camadaAtiva = snapshot.camadaAtivaIdx;
            if (snapshot.fotoOrdem !== undefined) fotoOrdem = snapshot.fotoOrdem;
            if (snapshot.texto !== undefined) document.getElementById('texto-layer').innerHTML = snapshot.texto;
            // Suporte legado
            if (snapshot.livre !== undefined && camadas[camadaAtiva]) {
                camadas[camadaAtiva].livreHTML = snapshot.livre;
            }
            caminhoAtivo = -1; pontosPen = []; pathFechado = false;
            penLayer.innerHTML = '';
            document.getElementById('btnFechar').style.background = '#333';
            document.getElementById('btn-confirmar-pen').style.display = 'none';
            renderizarTodos();
            if (painelAberto) renderizarPainel();
        }
    };

    window.resetView = () => {
        scale = 0.8; posX = 20; posY = 80; rotacao = 0;
        update();
        _atualizarIndicadorRotacao();
    };

    const nomesFerr = { pen: '🖊 PEN ▾', livre: '✏️ LIVRE ▾', borracha: '🧹 BORR ▾' };
    const coresFerr = { pen: '#ff00ff', livre: '#03dac6', borracha: '#ff6600' };

    window.toggleMenuFerramentas = () => {
        menuFerraberto = !menuFerraberto;
        document.getElementById('menu-ferramentas').style.display = menuFerraberto ? 'flex' : 'none';
        if (menuFerraberto && menuPinceisAberto) fecharMenuPinceis();
    };

    window.selecionarFerramenta = (f) => {
        ferramentaAtiva = f;
        menuFerraberto  = false;
        document.getElementById('menu-ferramentas').style.display = 'none';
        // Atualiza visual do botão — usa ferr-icon/ferr-label para não destruir o HTML interno
        const _ficEl = document.getElementById('ferr-icon');
        const _flbEl = document.getElementById('ferr-label');
        if (_ficEl) _ficEl.textContent = nomesFerr[f] ? nomesFerr[f].split(' ')[0] : '🖊';
        if (_flbEl) _flbEl.textContent = { pen:'PEN', livre:'LIVRE', borracha:'BORR' }[f] || 'DRAW';
        // Atualiza destaque dentro do menu
        ['pen','livre','borracha'].forEach(n => {
            document.getElementById('fBtn-' + n).style.background =
                n === f ? coresFerr[f] : '#333';
        });
        // Desativa modos anteriores
        modoPen = false; modoLivre = false; modoBorracha = false;
        penLayer.innerHTML = '';
        pontosBorracha = [];
        borrachaLayer.innerHTML = '';
        // Ativa o modo correto
        if (f === 'pen') {
            modoPen = true;
            // Inicia novo caminho
            encerrarEdicao();
            const caminhos = getCaminhos();
            caminhoAtivo = caminhos.length;
            caminhos.push({pontos:[], fechado:false,
                stroke:  document.getElementById('col-main').value,
                width:   document.getElementById('brush-size').value,
                opacity: document.getElementById('brush-opacity').value,
                tipo:    document.getElementById('pincel-tipo').value,
                pincel:  pincelAtual});
            pontosPen   = caminhos[caminhoAtivo].pontos;
            pathFechado = false;
        } else if (f === 'livre') {
            modoLivre = true;
        } else if (f === 'borracha') {
            modoBorracha = true;
        }
    };

    window.toggleMover = () => {
        folhaTravada = !folhaTravada;
        document.getElementById('btnMover').textContent =
            folhaTravada ? '🔒 MOVER' : '🔓 MOVER';
        document.getElementById('btnMover').style.background =
            folhaTravada ? '#ff6600' : '#333';
    };

    window.toggleModo = () => {
        modoPen=false; modoEditar=false; modoLivre=false; modoBorracha=false;
        const bFerr = document.getElementById('btnFerramentas');
        if (bFerr) { bFerr.textContent = '🖊 PEN ▾'; bFerr.style.background = '#ff00ff'; }
        document.getElementById('btnEditar').style.background='#333';
        encerrarEdicao();
    };

    window.fecharCaminho = () => {
        if (pontosPen.length < 3) return;
        pathFechado = !pathFechado;
        document.getElementById('btnFechar').style.background = pathFechado ? '#03dac6' : '#333';
        renderizarPen();
    };



    // ── MODAL SALVAR ─────────────────────────────────────────────────────────
    window.abrirModalSalvar = () => {
        document.getElementById('modal-salvar').classList.add('aberto');
    };
    // Listeners do modal degradê — via JS para garantir funcionamento
    document.getElementById('modal-degrade').addEventListener('touchstart', (e) => {
        if (e.target === document.getElementById('modal-degrade')) fecharModalDegrade();
    }, {passive:true});

    document.getElementById('dg-n2').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setNCores(2);
    }, {passive:true});
    document.getElementById('dg-n3').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setNCores(3);
    }, {passive:true});
    document.getElementById('dg-n4').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setNCores(4);
    }, {passive:true});
    // Atualizar preview ao mudar qualquer cor
    ['dg-c0','dg-c1','dg-c2','dg-c3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', atualizarPreviewDegrade);
    });

    // Listeners dos botões da barra que antes usavam onclick
    document.getElementById('btnSelecao').addEventListener('touchstart', (e) => {
        e.stopPropagation(); toggleSelecao();
    }, {passive:true});
    document.getElementById('btnTexto').addEventListener('touchstart', (e) => {
        e.stopPropagation(); ativarModoTexto();
    }, {passive:true});
    document.getElementById('btnRegua').addEventListener('touchstart', (e) => {
        e.stopPropagation(); toggleRegua();
    }, {passive:true});
    document.getElementById('btnContaGotas').addEventListener('touchstart', (e) => {
        e.stopPropagation(); toggleContaGotas();
    }, {passive:true});
    document.getElementById('btnEspelho').addEventListener('touchstart', (e) => {
        e.stopPropagation(); toggleEspelho();
    }, {passive:true});

    document.getElementById('dg-btn-linear').addEventListener('touchstart'
, (e) => {
        e.stopPropagation(); setTipoDegrade('linear');
    }, {passive:true});
    document.getElementById('dg-btn-radial').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setTipoDegrade('radial');
    }, {passive:true});
    document.getElementById('dg-btn-tela').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setFillDegrade('tela');
    }, {passive:true});
    document.getElementById('dg-btn-camada').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setFillDegrade('camada');
    }, {passive:true});
    document.getElementById('dg-btn-desenhar').addEventListener('touchstart', (e) => {
        e.stopPropagation(); e.preventDefault(); confirmarDegrade();
    }, {passive:false});
    document.getElementById('dg-btn-cancelar').addEventListener('touchstart', (e) => {
        e.stopPropagation(); fecharModalDegrade();
    }, {passive:true});


    window.fecharModalSalvar = () => {
        document.getElementById('modal-salvar').classList.remove('aberto');
        document.getElementById('lista-projetos').style.display = 'none';
    };

    function mostrarNotificacao(msg) {
        const n = document.getElementById('notificacao');
        n.textContent = msg;
        n.style.display = 'block';
        setTimeout(() => n.style.display = 'none', 2500);
    }

    function montarSVGString() {
        salvarCaminhoAtivo();
        if (camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
        }
        const W = workSurface.offsetWidth, H = workSurface.offsetHeight;
        let defsHTML = '', contentHTML = '';

        // Constrói lista ordenada respeitando fotoOrdem (igual a renderizarTodos)
        const totalCamadas = camadas.length;
        const fotoPos = (fotoOrdem < 0 || fotoOrdem >= totalCamadas) ? totalCamadas : fotoOrdem;

        function exportarCamada(cam) {
            if (!cam.visivel) return;
            if (cam.livreHTML) {
                const tmpSVG = document.createElementNS('http://www.w3.org/2000/svg','svg');
                tmpSVG.innerHTML = cam.livreHTML;
                [...tmpSVG.children].forEach(child => {
                    if (child.tagName.toLowerCase() === 'defs') {
                        defsHTML += child.innerHTML;
                    } else {
                        contentHTML += child.outerHTML;
                    }
                });
            }
            cam.caminhos.forEach(c => {
                const d = buildPathD(c.pontos, c.fechado);
                if (!d) return;
                const path = document.createElementNS('http://www.w3.org/2000/svg','path');
                path.setAttribute('d', d);
                aplicarEstiloPath(path, c, cam.opacidade);
                contentHTML += path.outerHTML;
            });
        }

        // Camadas abaixo da foto (fundo → renderizadas primeiro em SVG = ficam atrás)
        for (let i = totalCamadas - 1; i >= fotoPos; i--) exportarCamada(camadas[i]);

        // Foto
        if (camadaFoto.visivel && camadaFoto.svgHTML) {
            contentHTML += `<g opacity="${camadaFoto.opacidade}">${camadaFoto.svgHTML}</g>`;
        }

        // Camadas acima da foto
        for (let i = fotoPos - 1; i >= 0; i--) exportarCamada(camadas[i]);

        // Texto vetorial
        const texLayer = document.getElementById('texto-layer');
        [...texLayer.children].forEach(child => {
            if (child.tagName.toLowerCase() === 'defs') {
                defsHTML += child.innerHTML;
            } else {
                contentHTML += child.outerHTML;
            }
        });

        const defsTag = defsHTML ? `<defs>${defsHTML}</defs>` : '';
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${defsTag}${contentHTML}</svg>`;
    }

    // ── EXPORTAR PDF ─────────────────────────────────────────────────────────
    window.baixarPDF = () => {
        fecharModalSalvar();
        const svgStr = montarSVGString();
        const W = workSurface.offsetWidth, H = workSurface.offsetHeight;
        const blob = new Blob([svgStr], {type: 'image/svg+xml'});
        const url  = URL.createObjectURL(blob);
        const img  = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const ctx = c.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0, W, H);
            URL.revokeObjectURL(url);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: W > H ? 'landscape' : 'portrait',
                unit: 'px', format: [W, H]
            });
            pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, W, H);
            pdf.save('tracemaster.pdf');
            mostrarNotificacao('✅ PDF exportado!');
        };
        img.src = url;
    };

    // ── SALVAR PROJETO NO APP (localStorage) ────────────────────────────────
    window.salvarProjeto = () => {
        salvarCaminhoAtivo();
        // Garante que livreHTML está atualizado antes de salvar
        if (camadas[camadaAtiva]) {
            camadas[camadaAtiva].livreHTML = livreLayer.innerHTML;
        }
        const nome = prompt('Nome do projeto:', 'Projeto ' + new Date().toLocaleDateString('pt-BR'));
        if (!nome) return;
        const projeto = {
            nome, versao: '2.0', data: new Date().toLocaleString('pt-BR'),
            camadas, camadaFoto,
            textoHTML: document.getElementById('texto-layer').innerHTML,
            workW: workSurface.offsetWidth,
            workH: workSurface.offsetHeight,
            modoInfinito, gradeAtiva, gradeTamanho, rotacao,
        };
        const lista = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        const existIdx = lista.findIndex(p => p.nome === nome);
        if (existIdx >= 0) lista[existIdx] = projeto;
        else lista.push(projeto);
        try {
            localStorage.setItem('tm_projetos', JSON.stringify(lista));
            fecharModalSalvar();
            setTimeout(() => voltarInicio(), 300);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                mostrarNotificacao('⚠️ Armazenamento local cheio! Exporte como SVG ou exclua projetos antigos.', 'erro');
            } else {
                mostrarNotificacao('❌ Erro ao salvar projeto: ' + e.message, 'erro');
                console.error('salvarProjeto erro:', e);
            }
        }
    };

    // ── ABRIR PROJETOS SALVOS NO APP ──────────────────────────────────────────
    window.abrirProjetos = () => {
        const listaEl = document.getElementById('lista-projetos');
        const lista   = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        if (lista.length === 0) {
            listaEl.style.display = 'block';
            listaEl.innerHTML = '<p style="color:#888;font-size:12px;text-align:center;">Nenhum projeto salvo ainda.</p>';
            return;
        }
        listaEl.style.display = 'block';
        listaEl.innerHTML = lista.map((p, i) => `
            <div style="background:#2a2a2a;border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
                <div style="flex:1;">
                    <div style="font-size:12px;font-weight:bold;">${p.nome}</div>
                    <div style="font-size:10px;color:#666;">${p.data}</div>
                </div>
                <button onclick="carregarProjeto(${i})" style="background:#2980b9;color:white;border:none;padding:5px 10px;border-radius:5px;font-size:11px;font-weight:bold;">ABRIR</button>
                <button onclick="deletarProjeto(${i})" style="background:#7b2020;color:white;border:none;padding:5px 8px;border-radius:5px;font-size:11px;">✕</button>
            </div>`).join('');
    };

    window.carregarProjeto = (idx) => {
        const lista = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        const p = lista[idx];
        if (!p) return;
        camadas = p.camadas; camadaFoto = p.camadaFoto;
        fotoOrdem = (p.fotoOrdem !== undefined) ? p.fotoOrdem : -1;
        camadaAtiva = 0; caminhoAtivo = -1; pontosPen = []; pathFechado = false;
        penLayer.innerHTML = '';
        workSurface.style.width  = p.workW + 'px';
        workSurface.style.height = p.workH + 'px';
        rotacao = p.rotacao || 0;
        svgArea.innerHTML = camadaFoto.svgHTML || '';
        document.getElementById('texto-layer').innerHTML = p.textoHTML || '';
        historico = []; historicoFuturo = [];
        _esconderBolinhasDegrade(); _esconderBolinhasTxtDg();
        modoDegrade = false; degradeStart = null; _dgPrevReset();
        document.getElementById('btnDegrade').style.background = '#e74c3c';
        document.getElementById('degrade-preview-layer').innerHTML = '';
        renderizarTodos();
        if (painelAberto) renderizarPainel();
        fecharModalSalvar();
        document.getElementById('lista-projetos').style.display = 'none';
        mostrarNotificacao('✅ "' + p.nome + '" aberto!');
    };

    window.deletarProjeto = (idx) => {
        const lista = JSON.parse(localStorage.getItem('tm_projetos') || '[]');
        const nome = lista[idx].nome;
        lista.splice(idx, 1);
        localStorage.setItem('tm_projetos', JSON.stringify(lista));
        abrirProjetos(); // atualiza lista
        mostrarNotificacao('🗑 "' + nome + '" deletado');
    };

    window.baixarSVG = () => {
        fecharModalSalvar();
        const s = montarSVGString();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([s], {type:'image/svg+xml'}));
        a.download = 'tracemaster.svg'; a.click();
        mostrarNotificacao('✅ SVG exportado!');
    };

    document.getElementById('brush-size').oninput    = renderizarPen;
    document.getElementById('brush-opacity').oninput = renderizarPen;
    document.getElementById('pincel-tipo').onchange  = renderizarPen;

    // Centraliza a folha na tela ao iniciar
    const wsW = parseFloat(workSurface.style.width)  || 800;
    const wsH = parseFloat(workSurface.style.height) || 1000;
    posX = (window.innerWidth  - wsW * scale) / 2;
    posY = (window.innerHeight - wsH * scale) / 2;
    update();

    // ══════════════════════════════════════════════════════════════════════
    // FIREBASE — Configuração
    // ⚠️ SUBSTITUA com suas credenciais do Firebase Console:
    // https://console.firebase.google.com → Configurações do projeto → Seus apps
    // ══════════════════════════════════════════════════════════════════════
    // Credenciais carregadas de firebase-config.js (não versionado)
    const firebaseConfig = window.FIREBASE_CONFIG || {};

    // Inicializa Firebase (só se as credenciais foram preenchidas)
    let auth = null, db = null, firebaseOk = false;
    try {
        if (firebaseConfig.apiKey !== 'SUA_API_KEY') {
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db   = firebase.firestore();
            firebaseOk = true;
        }
    } catch(e) { console.warn('Firebase não configurado:', e); }

    // ── Estado do usuário ─────────────────────────────────────────────────
    let usuarioAtual = null;
    let configUsuario = {
        nome:   '',
        foto:   '',
        tema:   'escuro',
        accent: '#03dac6',
        folha:  '800x1000',
        idioma: 'pt'
    };

    // ── Observador de autenticação ────────────────────────────────────────
    function iniciarAuth() {
        if (!firebaseOk) {
            // Modo demo sem Firebase — pula login direto pra tela inicial
            mostrarTelaInicial();
            return;
        }
        auth.onAuthStateChanged(user => {
            if (user) {
                usuarioAtual = user;
                carregarConfigUsuario(user.uid);
            } else {
                usuarioAtual = null;
                // Nao interrompe se o editor estiver aberto (ex: token expirou em background)
                if (!_editorAberto) mostrarTelaLogin();
            }
        });
    }

    function mostrarTelaLogin() {
        document.getElementById('tela-login').style.display = 'flex';
        document.getElementById('tela-inicial').style.display = 'none';
    }

    function mostrarTelaInicial() {
        document.getElementById('tela-login').style.display = 'none';
        // Se o editor ja estiver aberto, nao interrompe — so atualiza config
        if (_editorAberto) {
            aplicarConfig();
            return;
        }
        const tela = document.getElementById('tela-inicial');
        tela.style.display = 'flex';
        tela.style.opacity = '1';
        aplicarConfig();
        renderizarTelaInicial();
    }

    // ── Login com Google ──────────────────────────────────────────────────
    document.getElementById('btn-login-google').addEventListener('touchstart', async (e) => {
        e.preventDefault();
        if (!firebaseOk) { mostrarTelaInicial(); return; }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch(err) {
            mostrarErroLogin(err.message);
        }
    }, {passive:false});

    // ── Login com email/senha ─────────────────────────────────────────────
    document.getElementById('btn-login-email').addEventListener('touchstart', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;
        if (!email || !senha) { mostrarErroLogin('Preencha e-mail e senha.'); return; }
        if (!firebaseOk) { mostrarTelaInicial(); return; }
        try {
            await auth.signInWithEmailAndPassword(email, senha);
        } catch(err) { mostrarErroLogin(err.message); }
    }, {passive:false});

    // ── Criar conta ───────────────────────────────────────────────────────
    document.getElementById('btn-demo').addEventListener('touchstart', (e) => {
        e.preventDefault();
        mostrarTelaInicial();
    }, {passive: false});

    document.getElementById('btn-criar-conta').addEventListener('touchstart', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;
        if (!email || !senha) { mostrarErroLogin('Preencha e-mail e senha.'); return; }
        if (senha.length < 6) { mostrarErroLogin('Senha: mínimo 6 caracteres.'); return; }
        if (!firebaseOk) { mostrarTelaInicial(); return; }
        try {
            await auth.createUserWithEmailAndPassword(email, senha);
        } catch(err) { mostrarErroLogin(err.message); }
    }, {passive:false});

    function mostrarErroLogin(msg) {
        const el = document.getElementById('login-erro');
        el.textContent = msg; el.style.display = 'block';
        setTimeout(() => el.style.display='none', 4000);
    }

    // ── Logout ────────────────────────────────────────────────────────────
    document.getElementById('btn-logout').addEventListener('touchstart', async (e) => {
        e.stopPropagation();
        fecharPerfil();
        if (firebaseOk) await auth.signOut();
        else mostrarTelaLogin();
    }, {passive:true});

    // ── Carregar config do Firestore ──────────────────────────────────────
    async function carregarConfigUsuario(uid) {
        if (!db) { mostrarTelaInicial(); return; }
        try {
            const doc = await db.collection('usuarios').doc(uid).get();
            if (doc.exists) {
                const d = doc.data();
                configUsuario = { ...configUsuario, ...d };
            } else {
                // Primeiro acesso — salva config padrão
                configUsuario.nome = usuarioAtual.displayName || '';
                configUsuario.foto = usuarioAtual.photoURL    || '';
                await db.collection('usuarios').doc(uid).set(configUsuario);
            }
        } catch(e) { console.warn('Firestore erro:', e); }
        mostrarTelaInicial();
    }

    // ── Salvar config no Firestore ────────────────────────────────────────
    async function salvarConfigUsuario() {
        if (!usuarioAtual) return;
        // Lê valores dos campos
        configUsuario.nome   = document.getElementById('cfg-nome').value   || configUsuario.nome;
        configUsuario.foto   = document.getElementById('cfg-foto').value   || configUsuario.foto;
        configUsuario.accent = document.getElementById('cfg-accent').value;
        configUsuario.folha  = document.getElementById('cfg-folha').value;
        configUsuario.idioma = document.getElementById('cfg-idioma').value;
        // Salva localmente
        localStorage.setItem('tm_config', JSON.stringify(configUsuario));
        // Salva no Firestore se disponível
        if (db) {
            try { await db.collection('usuarios').doc(usuarioAtual.uid).set(configUsuario); }
            catch(e) { console.warn('Erro ao salvar:', e); }
        }
        aplicarConfig();
        fecharPerfil();
        mostrarNotificacao('✅ Configurações salvas!');
    }

    document.getElementById('btn-salvar-cfg').addEventListener('touchstart', (e) => {
        e.stopPropagation(); salvarConfigUsuario();
    }, {passive:true});

    // ── Aplicar configurações visuais ─────────────────────────────────────
    function aplicarConfig() {
        const c = configUsuario;
        // Cor de destaque
        document.documentElement.style.setProperty('--accent', c.accent||'#03dac6');
        document.querySelectorAll('.aba-pincel.ativa, #btn-nova-camada').forEach(el => {
            el.style.background = c.accent||'#03dac6';
        });
        // Tema
        if (c.tema === 'claro') {
            document.body.style.background = '#f0f0f0';
            document.body.style.color = '#111';
            document.querySelectorAll('.bar').forEach(el => el.style.background = '#ddd');
        } else {
            document.body.style.background = '#121212';
            document.body.style.color = 'white';
            document.querySelectorAll('.bar').forEach(el => el.style.background = '#1e1e1e');
        }
        // Folha de trabalho
        if (c.folha) {
            const [w,h] = c.folha.split('x').map(Number);
            if (workSurface) { workSurface.style.width=w+'px'; workSurface.style.height=h+'px'; }
        }
        // Avatar
        const avatarSrc = c.foto || (usuarioAtual?.photoURL) ||
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='40' r='22' fill='%23888'/%3E%3Ccircle cx='50' cy='90' r='35' fill='%23888'/%3E%3C/svg%3E";
        ['avatar-inicial','avatar-editor','perfil-avatar-img'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.src = avatarSrc;
        });
        // Nome
        const nome = c.nome || usuarioAtual?.displayName || 'Usuário';
        const elN = document.getElementById('perfil-nome-display');
        if (elN) elN.textContent = nome;
        const elE = document.getElementById('perfil-email-display');
        if (elE) elE.textContent = usuarioAtual?.email || '—';
    }

    // ── Abrir/fechar modal de perfil ──────────────────────────────────────
    window.abrirPerfil = () => {
        // Preenche campos com valores atuais
        document.getElementById('cfg-nome').value   = configUsuario.nome || usuarioAtual?.displayName || '';
        document.getElementById('cfg-foto').value   = configUsuario.foto || usuarioAtual?.photoURL || '';
        document.getElementById('cfg-accent').value = configUsuario.accent || '#03dac6';
        document.getElementById('cfg-folha').value  = configUsuario.folha  || '800x1000';
        document.getElementById('cfg-idioma').value = configUsuario.idioma || 'pt';
        setTema(configUsuario.tema || 'escuro', false);
        aplicarConfig();
        document.getElementById('modal-perfil').classList.add('aberto');
    };

    window.fecharPerfil = () => {
        document.getElementById('modal-perfil').classList.remove('aberto');
    };

    // Fechar ao tocar fora
    document.getElementById('modal-perfil').addEventListener('touchstart', (e) => {
        if (e.target === document.getElementById('modal-perfil')) fecharPerfil();
    }, {passive:true});

    // ── Tema ──────────────────────────────────────────────────────────────
    window.setTema = (t, salvar=true) => {
        configUsuario.tema = t;
        ['escuro','claro'].forEach(id => {
            const el = document.getElementById('tema-'+id);
            if (el) el.classList.toggle('ativo', id===t);
        });
        if (salvar) aplicarConfig();
    };

    // Listeners de tema via JS (mais confiável que ontouchstart inline)
    document.getElementById('tema-escuro').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setTema('escuro');
    }, {passive:true});
    document.getElementById('tema-claro').addEventListener('touchstart', (e) => {
        e.stopPropagation(); setTema('claro');
    }, {passive:true});

    // ── Cor de destaque — preview em tempo real ───────────────────────────
    document.getElementById('cfg-accent').addEventListener('input', (e) => {
        configUsuario.accent = e.target.value;
        aplicarConfig();
    });

    // ── Iniciar ──────────────────────────────────────────────────────────
    // Tenta carregar config local enquanto Firebase carrega
    const cfgLocal = localStorage.getItem('tm_config');
    if (cfgLocal) try { configUsuario = {...configUsuario, ...JSON.parse(cfgLocal)}; } catch(e){}


    // ── SISTEMA DE POPUP MENUS ────────────────────────────────────────────────
    const _todosPopups = ['popup-desenho','popup-pinceis-wrap','popup-vista','popup-projeto'];

    window.fecharTodosPopups = () => {
        _todosPopups.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('aberto');
        });
        document.getElementById('popup-overlay').classList.remove('ativo');
    };

    window.togglePopup = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const jaAberto = el.classList.contains('aberto');
        fecharTodosPopups();
        if (!jaAberto) {
            el.classList.add('aberto');
            document.getElementById('popup-overlay').classList.add('ativo');
        }
    };

    document.getElementById('popup-overlay').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        fecharTodosPopups();
    }, {passive: true});

    // Sincroniza cor de preview na barra com col-main
    const colMain = document.getElementById('col-main');
    const corBar = document.getElementById('cor-preview-bar');
    if (colMain && corBar) {
        colMain.addEventListener('input', () => { corBar.style.background = colMain.value; });
        corBar.style.background = colMain.value;
    }

    // Override das funções que controlam popups de ferramentas
    window.toggleMenuFerramentas = () => { togglePopup('popup-desenho'); };

    // Atualiza ícone do botão de ferramenta na barra
    const _ferrIcones = { pen:'🖊', livre:'✏️', borracha:'🧹' };
    const _ferrLabels = { pen:'PEN', livre:'LIVRE', borracha:'BORR' };
    const _origSelecionarFerramenta = window.selecionarFerramenta;
    window.selecionarFerramenta = (f) => {
        // Verifica se o MODO correspondente já está ativo (não ferramentaAtiva que inicia como 'pen')
        const modoJaAtivo = (f==='pen' && modoPen) || (f==='livre' && modoLivre) || (f==='borracha' && modoBorracha);
        if (modoJaAtivo) {
            // Desativa direto sem chamar toggles (evita recursão infinita)
            if (f === 'pen') {
                modoPen = false; ferramentaAtiva = '';
                if (pontosPen.length >= 2) salvarCaminhoAtivo();
                else if (caminhoAtivo >= 0) getCaminhos().splice(caminhoAtivo, 1);
                caminhoAtivo = -1; pontosPen = []; pathFechado = false;
                penLayer.innerHTML = '';
                document.getElementById('btn-confirmar-pen').style.display = 'none';
                renderizarTodos();
            } else if (f === 'livre') {
                modoLivre = false; ferramentaAtiva = '';
            } else if (f === 'borracha') {
                modoBorracha = false; ferramentaAtiva = '';
                pontosBorracha = []; borrachaLayer.innerHTML = '';
            }
            ['pen','livre','borracha'].forEach(n => {
                const it = document.getElementById('pitem-'+n);
                if (it) it.classList.remove('ativo');
            });
            const ic2 = document.getElementById('ferr-icon');
            const lb2 = document.getElementById('ferr-label');
            if (ic2) ic2.textContent = '🖊';
            if (lb2) lb2.textContent = 'DRAW';
            // Esconde botão FECHAR ao sair da Pen Tool
            const _bfp = document.getElementById('pitem-fechar');
            if (_bfp) _bfp.style.display = 'none';
            fecharTodosPopups();
            return;
        }
        _origSelecionarFerramenta(f);
        const ic = document.getElementById('ferr-icon');
        const lb = document.getElementById('ferr-label');
        if (ic) ic.textContent = _ferrIcones[f] || '🖊';
        if (lb) lb.textContent = _ferrLabels[f] || 'DRAW';
        // Atualiza visual dos popup-items de ferramenta
        ['pen','livre','borracha'].forEach(n => {
            const it = document.getElementById('pitem-'+n);
            if (it) it.classList.toggle('ativo', n === f);
        });
        // Mostra botão FECHAR só quando Pen Tool ativa
        const btnFecharPen = document.getElementById('pitem-fechar');
        if (btnFecharPen) btnFecharPen.style.display = (f === 'pen') ? 'flex' : 'none';
        fecharTodosPopups();
    };

    // Desenha previews iniciais dos pincéis ao abrir o popup pela primeira vez
    document.getElementById('popup-pinceis-wrap').addEventListener('touchstart', function _initPrev() {
        desenharPreviews();
        this.removeEventListener('touchstart', _initPrev);
    }, {passive: true, capture: true});

    // ── FIM POPUP MENUS ───────────────────────────────────────────────────────

    // ── MANUAL ───────────────────────────────────────────────────────────────
    window.abrirManual = () => {
        document.getElementById('modal-manual').style.display = 'block';
        irSecao(0);
    };
    window.fecharManual = () => {
        document.getElementById('modal-manual').style.display = 'none';
    };
    window.irSecao = (idx) => {
        const total = 6;
        for (let i = 0; i < total; i++) {
            const sec = document.getElementById('msec-' + i);
            if (sec) sec.style.display = i === idx ? 'block' : 'none';
        }
        document.querySelectorAll('.manual-nav-btn').forEach((btn, i) => {
            btn.classList.toggle('ativa', i === idx);
        });
        document.getElementById('modal-manual').scrollTo({ top: 0, behavior: 'smooth' });
    };
    // ── FIM MANUAL ───────────────────────────────────────────────────────────

    iniciarAuth();
});
