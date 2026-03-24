// Professional Chess Integration System - High Precision Research Engine
class ProIntegratedAssistant {
    constructor() {
        this.active = false;
        this.processor = null;
        this.observer = null;
        this.lastFen = null;
        this.eval = 0;
        this.shadow = null;
        this.modes = {
            'std': 18,
            'ultra': 24,
            'max': 30
        };
        this.currentDepth = 18;
    }

    init() {
        this.injectDashboard();
        console.info('Pro Integration Active');
    }

    injectDashboard() {
        const host = document.createElement('div');
        host.id = 'pro-chess-monitor-' + Date.now();
        document.body.appendChild(host);
        this.shadow = host.attachShadow({ mode: 'closed' });

        const css = `
            .dash {
                position: fixed; top: 10px; right: 10px; width: 260px;
                background: #1e1e1e; border: 1px solid #333;
                border-radius: 10px; color: #fff; font-family: 'Segoe UI', Tahoma, sans-serif;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4); z-index: 10000000;
                overflow: hidden; border-top: 5px solid #00ff00;
            }
            .head { padding: 12px; background: #252525; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
            .head span { font-weight: 800; color: #00ff00; letter-spacing: 0.5px; }
            .body { padding: 15px; }
            .eval-bar { height: 4px; background: #333; border-radius: 2px; margin-bottom: 10px; position: relative; }
            .eval-fill { height: 100%; width: 50%; background: #00ff00; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            .stat { font-size: 11px; color: #aaa; margin-top: 8px; display: flex; justify-content: space-between; }
            .btn-start { 
                width: 100%; padding: 12px; background: #00ff00; color: #000; border: none; 
                margin-top: 15px; border-radius: 6px; font-weight: 800; cursor: pointer;
                transition: background 0.2s;
            }
            .btn-start:hover { background: #00cc00; }
            .btn-start.active { background: #ff3e3e; color: #fff; }
            .log { font-family: monospace; font-size: 10px; color: #00ff00; margin-top: 10px; max-height: 100px; overflow-y: auto; background: #000; padding: 5px; border-radius: 4px; border: 1px solid #333; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        this.shadow.appendChild(style);

        const container = document.createElement('div');
        container.className = 'dash';
        container.innerHTML = `
            <div class="head"><span>PRO ENGINE v2.0</span><small id="depth-tag">D:18</small></div>
            <div class="body">
                <div class="eval-bar"><div class="eval-fill" id="eval-fill"></div></div>
                <div id="move-suggestion" style="font-size: 18px; font-weight: 700; color: #00ff00; text-align: center;">--</div>
                <div class="stat"><span>Score: <b id="score-val">0.0</b></span><span id="proc-status">STANDBY</span></div>
                <button class="btn-start" id="main-btn">ENABLE REAL-TIME</button>
                <div class="log" id="log">Awaiting command...</div>
            </div>
        `;
        this.shadow.appendChild(container);

        this.shadow.getElementById('main-btn').addEventListener('click', () => this.toggle());
    }

    async toggle() {
        const btn = this.shadow.getElementById('main-btn');
        if (!this.active) {
            this.log('Booting core...');
            if (!await this.initEngine()) return;
            this.active = true;
            btn.textContent = 'DISABLE ENGINE';
            btn.classList.add('active');
            this.startMutationObserver();
            this.triggerSync();
        } else {
            this.stop();
            btn.textContent = 'ENABLE REAL-TIME';
            btn.classList.remove('active');
        }
    }

    async initEngine() {
        try {
            if (this.processor) this.processor.terminate();
            const url = "/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js";
            this.processor = new Worker(url);
            this.processor.onmessage = (e) => this.handleCoreMessage(e.data);
            this.processor.postMessage('uci');
            this.processor.postMessage('isready');
            this.log('Core linked');
            return true;
        } catch (e) {
            this.log('Failure: Path blocked');
            return false;
        }
    }

    handleCoreMessage(data) {
        if (data.includes('uciok')) this.updateStatus('UCI READY');
        if (data.includes('readyok')) this.updateStatus('ENGINE IDLE');
        
        if (data.includes('score cp')) {
            const score = parseInt(data.match(/score cp (-?\d+)/)[1]);
            this.updateEvaluation(score);
        }
        
        if (data.startsWith('bestmove')) {
            const move = data.split(' ')[1];
            if (move && move !== '(none)') this.displayMove(move);
        }
    }

    startMutationObserver() {
        const board = document.querySelector('wc-chess-board') || document.body;
        this.observer = new MutationObserver(() => this.triggerSync());
        this.observer.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'fen'] });
        this.log('Live monitoring active');
    }

    triggerSync() {
        if (!this.active) return;
        const fen = this.getFEN();
        if (fen && fen !== this.lastFen) {
            this.lastFen = fen;
            this.process(fen);
        }
    }

    process(fen) {
        if (!this.processor) return;
        this.processor.postMessage(`position fen ${fen}`);
        this.processor.postMessage(`go depth ${this.currentDepth}`);
        this.updateStatus('ANALYZING...');
    }

    displayMove(move) {
        this.shadow.getElementById('move-suggestion').textContent = move;
        this.drawMarkers(move);
        this.updateStatus('READY');
    }

    drawMarkers(move) {
        this.clearMarkers();
        const map = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
        const from = `${map[move[0]]}${move[1]}`;
        const to = `${map[move[2]]}${move[3]}`;
        
        const board = document.querySelector('wc-chess-board');
        if (!board) return;
        const root = board.shadowRoot || board;

        [from, to].forEach((pos, i) => {
            const sq = root.querySelector(`.square-${pos}`);
            if (sq) {
                const marker = document.createElement('div');
                marker.className = 'pro-marker';
                marker.style.cssText = `
                    position: absolute; width: 100%; height: 100%; top: 0; left: 0;
                    background: ${i === 0 ? 'rgba(0, 255, 0, 0.3)' : 'rgba(0, 255, 0, 0.5)'};
                    border: 3px solid #00ff00; box-sizing: border-box; z-index: 100;
                    pointer-events: none; animation: pulse 1s infinite;
                `;
                sq.appendChild(marker);
            }
        });
    }

    clearMarkers() {
        const board = document.querySelector('wc-chess-board');
        if (board) {
            const root = board.shadowRoot || board;
            root.querySelectorAll('.pro-marker').forEach(m => m.remove());
        }
    }

    getFEN() {
        const board = document.querySelector('wc-chess-board');
        if (!board) return null;
        
        let fen = board.getAttribute('fen');
        if (fen) return fen;

        // Pro piece-scanner for non-standard boards
        const root = board.shadowRoot || board;
        const pieces = root.querySelectorAll('.piece');
        if (pieces.length === 0) return null;

        let grid = Array(8).fill(null).map(() => Array(8).fill(null));
        let turn = 'w';

        // Detect turn from site turn-indicator or pieces
        const whiteTurn = document.querySelector('.turn-indicator.white') || document.querySelector('.player-info.white.active');
        if (!whiteTurn) {
            const blackTurn = document.querySelector('.turn-indicator.black') || document.querySelector('.player-info.black.active');
            if (blackTurn) turn = 'b';
        }

        pieces.forEach(p => {
            const c = p.className;
            const t = c.match(/([wb][prnbqk])/);
            const s = c.match(/square-(\d)(\d)/);
            if (t && s) {
                const type = {
                    'wp':'P','wr':'R','wn':'N','wb':'B','wq':'Q','wk':'K',
                    'bp':'p','br':'r','bn':'n','bb':'b','bq':'q','bk':'k'
                }[t[1]];
                grid[8-parseInt(s[2])][parseInt(s[1])-1] = type;
            }
        });

        let f = "";
        for (let r=0; r<8; r++) {
            let e = 0;
            for (let c=0; c<8; c++) {
                if (!grid[r][c]) e++;
                else { if (e > 0) { f += e; e = 0; } f += grid[r][c]; }
            }
            if (e > 0) f += e; if (r < 7) f += "/";
        }
        return `${f} ${turn} - - 0 1`;
    }

    updateEvaluation(score) {
        const textVal = (score / 100).toFixed(1);
        this.shadow.getElementById('score-val').textContent = (score > 0 ? '+' : '') + textVal;
        
        // Normalize 0.5 to center, map -500..500 to 0..100
        const percent = Math.max(0, Math.min(100, (score / 10) + 50));
        this.shadow.getElementById('eval-fill').style.width = percent + '%';
    }

    updateStatus(s) {
        this.shadow.getElementById('proc-status').textContent = s;
    }

    log(m) {
        const l = this.shadow.getElementById('log');
        l.innerHTML = `[${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}] ${m}<br>${l.innerHTML}`;
    }

    stop() {
        this.active = false;
        if (this.observer) this.observer.disconnect();
        if (this.processor) this.processor.terminate();
        this.clearMarkers();
        this.log('Session killed');
    }
}

// Pro activation
(() => {
    const run = () => setTimeout(() => new ProIntegratedAssistant().init(), 1000);
    if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
