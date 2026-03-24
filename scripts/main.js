// Research Data Collector - Robust v2.1 (Sync Fix Edition)
class RobustFastMonitor {
    constructor() {
        this.active = false;
        this.processor = null;
        this.observer = null;
        this.poll = null;
        this.lastFen = null;
        this.shadow = null;
        this.targetElo = 850;
        
        this.profiles = {
            300: { depth: 4,  topProb: 0.30, delay: [1500, 4500] },
            500: { depth: 6,  topProb: 0.45, delay: [1000, 3000] },
            850: { depth: 9,  topProb: 0.60, delay: [500,  2000] }
        };
        this.moves = [];
    }

    init() {
        this.setupUI();
        console.info('Research Monitor v2.1 (Robust Sync Active)');
    }

    setupUI() {
        const host = document.createElement('div');
        host.id = 'rob-host-' + Math.random().toString(36).substr(2, 5);
        document.body.appendChild(host);
        this.shadow = host.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = `
            .panel-wrap {
                position: fixed; bottom: 20px; right: 20px; width: 240px;
                background: #ffffff; border: 1px solid #d1d1d1;
                border-radius: 12px; padding: 15px; font-family: -apple-system, system-ui, sans-serif;
                font-size: 13px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                z-index: 9999999; color: #1a1a1a; border-top: 4px solid #2ecc71;
            }
            .header { font-weight: 700; margin-bottom: 12px; font-size: 14px; color: #1e8449; }
            .status-log { 
                margin-top: 10px; font-size: 11px; background: #f8fcf9; 
                padding: 8px; border-radius: 6px; color: #666; 
                max-height: 80px; overflow-y: auto; border: 1px solid #e9f7ef;
                line-height: 1.4;
            }
            .ctrl-select { width: 100%; padding: 8px; margin-top: 8px; border-radius: 6px; border: 1px solid #cbd5e0; background: #fff; }
            .btn { 
                width: 100%; margin-top: 15px; padding: 10px; 
                background: #2ecc71; color: white; border: none; 
                border-radius: 8px; cursor: pointer; font-weight: 600;
                transition: transform 0.1s, background 0.2s;
            }
            .btn:active { transform: scale(0.98); }
            .btn.active { background: #e74c3c; }
            .output-box { 
                margin-top: 12px; padding: 12px; 
                background: #ebfaf0; border-radius: 8px; 
                border-left: 4px solid #2ecc71; 
                display: none; animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        `;
        this.shadow.appendChild(style);

        const wrap = document.createElement('div');
        wrap.className = 'panel-wrap';
        wrap.innerHTML = `
            <div class="header">📋 Research Monitor v2.1</div>
            <select class="ctrl-select" id="elo-selector">
                <option value="300">Niveau: 300 ELO</option>
                <option value="500">Niveau: 500 ELO</option>
                <option value="850" selected>Niveau: 850 ELO</option>
            </select>
            <button class="btn" id="toggle-btn">Connect Interface</button>
            <div class="status-log" id="log-text">System standby...</div>
            <div class="output-box" id="res-output"></div>
        `;
        this.shadow.appendChild(wrap);

        this.shadow.getElementById('toggle-btn').addEventListener('click', () => this.toggle());
        this.shadow.getElementById('elo-selector').addEventListener('change', (e) => this.targetElo = parseInt(e.target.value));
    }

    async toggle() {
        const btn = this.shadow.getElementById('toggle-btn');
        if (!this.active) {
            this.log('Re-linking core components...');
            if (!await this.startEngine()) return;
            this.active = true;
            btn.textContent = 'Disconnect Interface';
            btn.classList.add('active');
            this.startSync();
        } else {
            this.stop();
            btn.textContent = 'Connect Interface';
            btn.classList.remove('active');
        }
    }

    async startEngine() {
        try {
            if (this.processor) this.processor.terminate();
            const url = "/bundles/app/js/vendor/jschessengine/stockfish.asm.1abfa10c.js";
            this.processor = new Worker(url);
            this.processor.onmessage = (e) => this.handleData(e.data);
            this.processor.postMessage('uci');
            this.processor.postMessage('setoption name MultiPV value 3'); 
            this.processor.postMessage('isready');
            return true;
        } catch (e) {
            this.log('Worker block detected');
            return false;
        }
    }

    handleData(data) {
        if (data.includes('multipv')) {
            const mv = data.match(/pv ([a-h][1-8][a-h][1-8])/)[1];
            const rank = parseInt(data.match(/multipv (\d+)/)[1]);
            this.moves[rank - 1] = mv;
        }
        if (data.startsWith('bestmove')) this.displayLogic();
    }

    displayLogic() {
        if (!this.active || this.moves.length === 0) return;
        const cfg = this.profiles[this.targetElo];
        let move = this.moves[0];
        
        if (Math.random() > cfg.topProb && this.moves.length > 1) {
            move = this.moves[Math.random() > 0.4 && this.moves.length > 2 ? 2 : 1];
            this.log('Stealth variance applied');
        }

        setTimeout(() => {
            if (this.active) {
                this.render(move);
                this.draw(move);
                this.log('Sync valid: ' + move);
            }
        }, cfg.delay[0] + Math.random() * (cfg.delay[1] - cfg.delay[0]));
    }

    render(move) {
        const box = this.shadow.getElementById('res-output');
        box.style.display = 'block';
        box.innerHTML = `<div style="font-weight: 600; color: #1e8449;">Suggested Path:</div> ${move}`;
    }

    draw(move) {
        this.clear();
        const b = document.querySelector('wc-chess-board');
        if (!b) return;
        const root = b.shadowRoot || b;
        const map = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 };
        const f = `${map[move[0]]}${move[1]}`, t = `${map[move[2]]}${move[3]}`;

        [f, t].forEach((pos, i) => {
            const sq = root.querySelector(`.square-${pos}`);
            if (sq) {
                const el = document.createElement('div');
                el.className = 'research-marker';
                el.style.cssText = `
                    position: absolute; width:100%; height:100%; top:0; left:0;
                    background: ${i===0 ? 'rgba(46, 204, 113, 0.25)' : 'rgba(46, 204, 113, 0.45)'};
                    border: 2px solid #2ecc71; box-sizing: border-box; z-index: 100; pointer-events: none;
                `;
                sq.appendChild(el);
            }
        });
    }

    clear() {
        const boards = document.querySelectorAll('wc-chess-board, #board-single');
        boards.forEach(b => {
            const r = b.shadowRoot || b;
            r.querySelectorAll('.research-marker').forEach(m => m.remove());
        });
    }

    startSync() {
        // Hybrid Sync: Observer + Polling backup
        const b = document.querySelector('wc-chess-board');
        if (this.observer) this.observer.disconnect();
        this.observer = new MutationObserver(() => this.sync());
        if (b) this.observer.observe(b, { attributes: true, subtree: true, childList: true });
        
        if (this.poll) clearInterval(this.poll);
        this.poll = setInterval(() => this.sync(), 800);
        this.log('Dual-sync monitoring active');
    }

    sync() {
        if (!this.active) return;
        const fen = this.getFEN();
        if (fen && fen !== this.lastFen) {
            this.lastFen = fen;
            this.moves = [];
            this.analyze(fen);
        }
    }

    analyze(fen) {
        if (!this.processor) return;
        const d = this.profiles[this.targetElo].depth;
        this.processor.postMessage(`position fen ${fen}`);
        this.processor.postMessage(`go depth ${d}`);
        this.log('Board change detected...');
    }

    getFEN() {
        const board = document.querySelector('wc-chess-board') || document.querySelector('#board-single');
        if (!board) return null;

        // Try native FEN first
        let fen = board.getAttribute('fen');
        if (fen && fen.length > 10) return this.injectTurn(fen);

        // DOM Fallback
        const root = board.shadowRoot || board;
        const pieces = root.querySelectorAll('.piece');
        if (pieces.length === 0) return null;

        let grid = Array(8).fill(null).map(() => Array(8).fill(null));
        pieces.forEach(p => {
            const c = p.className, t = c.match(/([wb][prnbqk])/), s = c.match(/square-(\d)(\d)/);
            if (t && s) {
                const type = {'wp':'P','wr':'R','wn':'N','wb':'B','wq':'Q','wk':'K','bp':'p','br':'r','bn':'n','bb':'b','bq':'q','bk':'k'}[t[1]];
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
        return this.injectTurn(f + " {turn} - - 0 1");
    }

    injectTurn(fen) {
        // Precise turn detection via move list or player highlights
        let turn = 'w';
        if (document.querySelector('.player-info.black.active') || document.querySelector('.move-list-item.selected')?.classList.contains('white')) {
            // Note: In Chess.com move list, if 'white' move is selected, it's actually black to move next
            turn = 'b';
        }
        // Site-specific turn indicator fallback
        const turnIndicator = document.querySelector('.turn-indicator.black');
        if (turnIndicator) turn = 'b';
        
        return fen.replace('{turn}', turn).replace(' w ', ` ${turn} `).replace(' b ', ` ${turn} `);
    }

    log(m) {
        const log = this.shadow.getElementById('log-text');
        if (log) log.innerHTML = `[${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}] ${m}<br>${log.innerHTML}`;
    }

    stop() {
        this.active = false;
        if (this.poll) clearInterval(this.poll);
        if (this.observer) this.observer.disconnect();
        if (this.processor) this.processor.terminate();
        this.clear();
        this.shadow.getElementById('res-output').style.display = 'none';
        this.lastFen = null;
    }
}

(() => {
    const run = () => setTimeout(() => new RobustFastMonitor().init(), 1000);
    if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
