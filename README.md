# TraceMaster

Ferramenta de desenho vetorial e vetorização de imagens, mobile-first, que roda 100% no navegador — sem instalação, sem servidor obrigatório.

## Funcionalidades

### Ferramentas de Desenho
| Ferramenta | Descrição |
|---|---|
| **Caneta (Pen)** | Criação de caminhos Bezier com pontos de ancoragem |
| **Pincel Livre** | 15+ tipos de pincel renderizados em SVG (Normal, Caligrafia, Aquarela, Neon, Spray, Carvão, Giz, Óleo, Pontilhismo, Cabelo, Estrelas e mais) |
| **Borracha** | Corta caminhos vetoriais com detecção de interseção |
| **Formas** | Elipse, Retângulo, Triângulo, Linha |
| **Seleção** | Mover, redimensionar e rotacionar elementos |
| **Texto** | Texto com Google Fonts, gradiente, negrito/itálico |
| **Degradê** | Gradientes lineares/radiais com 2–4 paradas de cor |
| **Conta-Gotas** | Captura cor de qualquer ponto da tela |

### Vetorização de Imagens
- **Modo Linhas** — OpenCV.js (Canny edge detection) para lineart e esboços
- **Modo Colorido** — ImageTracer.js para vetorização multi-cor de fotos
- Detecção automática de paleta de cores dominantes
- Pré-tratamento: brilho, contraste, desfoque, limiarização

### Organização
- **Camadas** — múltiplas camadas com opacidade, visibilidade e reordenação por arraste
- **Histórico** — desfazer/refazer com até 30 estados
- **Rascunho automático** — salvo a cada ação no localStorage

### Exportação
- SVG (vetorial, escalável)
- PDF (via jsPDF)
- Projeto `.tmaster` (formato interno, reaberto no app)

### Navegação
- Zoom e rotação com dois dedos (pinch/rotate)
- Modo espelho/simetria
- Grade, réguas e guias arrastáveis
- Modo canvas infinito
- Snap de pontos
- Lupa

### Conta e Sincronização
- Login com Google ou e-mail/senha (Firebase Auth)
- Sincronização de configurações via Firestore
- Modo demonstração sem conta

---

## Como Usar

### Opção 1: Live Server (VS Code) — Recomendado

1. Instale a extensão [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) no VS Code
2. Clique com o botão direito em `index.html` → **Open with Live Server**
3. O app abrirá em `http://127.0.0.1:5500`

### Opção 2: Python (qualquer computador)

```bash
# Python 3
python -m http.server 8080
# Abra http://localhost:8080 no navegador
```

### Opção 3: Node.js

```bash
npx serve .
# Abra a URL exibida no terminal
```

> **Por que não funciona com `file://`?**
> O app usa `fetch`, módulos ES e APIs como `IndexedDB` que são bloqueadas pelo navegador
> quando o arquivo é aberto diretamente. Um servidor local simples resolve.

---

## Configuração do Firebase

O Firebase é necessário para login e sincronização de configurações. Para usar suas próprias credenciais:

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Authentication** (Google + E-mail/Senha) e **Firestore**
3. Em *Configurações do Projeto → Seus apps → Web*, copie as credenciais
4. No projeto, copie o arquivo de exemplo:

```bash
cp firebase-config.example.js firebase-config.js
```

5. Edite `firebase-config.js` com suas credenciais reais:

```javascript
window.FIREBASE_CONFIG = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    // ...
};
```

> `firebase-config.js` está no `.gitignore` e **nunca será commitado**.

---

## Estrutura do Projeto

```
TraceMaster/
├── index.html                  # Estrutura HTML (sem CSS/JS inline)
├── styles.css                  # Todos os estilos
├── app.js                      # Toda a lógica da aplicação
├── firebase-config.js          # Credenciais Firebase reais (GITIGNORED)
├── firebase-config.example.js  # Template de configuração (commitar)
├── .gitignore                  # Protege firebase-config.js e outros
└── README.md                   # Esta documentação
```

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 + CSS3 + JavaScript ES2020 | Base do app (sem framework) |
| SVG | Renderização vetorial de todos os desenhos |
| [ImageTracer.js](https://github.com/jankovicsandras/imagetracerjs) | Vetorização multi-cor |
| [OpenCV.js 4.8.0](https://docs.opencv.org/4.8.0/opencv.js) | Detecção de bordas (Canny) |
| [jsPDF 2.5.1](https://github.com/parallax/jsPDF) | Exportação para PDF |
| [Firebase v10.7.1](https://firebase.google.com) | Auth + Firestore |
| [Google Fonts](https://fonts.google.com) | 20 famílias tipográficas |

---

## Requisitos

- Navegador moderno (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Conexão com internet para carregar CDNs (OpenCV.js, Firebase, Google Fonts)
- Servidor local para desenvolvimento (ver "Como Usar" acima)
- Conta Firebase própria para sincronização (opcional — modo demo funciona sem)

---

## Notas de Desenvolvimento

- Todos os projetos são salvos no `localStorage` do navegador (~5–10 MB por origem)
- Para projetos grandes, use a exportação SVG como backup
- O OpenCV.js (~30 MB) carrega de forma assíncrona — um indicador aparece enquanto carrega
- A vetorização por cor (ImageTracer) funciona mesmo antes do OpenCV terminar de carregar
