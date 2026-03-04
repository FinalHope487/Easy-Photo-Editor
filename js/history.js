Object.assign(PhotoEditor.prototype, {
    saveState() {
        if (!this.image) return;
        // If we are not at the end of history, truncate it
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const state = JSON.stringify({
            orig: this.originalImage.src,
            mod: this.originalModLayer.toDataURL('image/png'),
            adj: { ...this.adjustments }
        });
        this.history.push(state);
        this.historyIndex++;

        // Limit history
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }
    },

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    },

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    },

    restoreState(stateStr) {
        let state;
        if (stateStr.startsWith('data:image')) {
            state = { orig: stateStr, mod: null, adj: { brightness: 0, contrast: 0, saturation: 0, rotation: 0, flipH: 1, flipV: 1 } };
        } else {
            state = JSON.parse(stateStr);
        }

        const img = new Image();
        img.onload = () => {
            this.originalImage = img;
            this.adjustments = state.adj;

            ['brightness', 'contrast', 'saturation'].forEach(prop => {
                const valEl = document.getElementById(`val-${prop}`);
                const adjEl = document.getElementById(`adj-${prop}`);
                if (valEl) valEl.value = state.adj[prop];
                if (adjEl) adjEl.value = state.adj[prop];
            });

            if (state.mod) {
                const modImg = new Image();
                modImg.onload = () => {
                    this.originalModLayer.width = modImg.width;
                    this.originalModLayer.height = modImg.height;
                    this.originalModCtx.clearRect(0, 0, modImg.width, modImg.height);
                    this.originalModCtx.drawImage(modImg, 0, 0);
                    this.applyAdjustments();
                };
                modImg.src = state.mod;
            } else {
                this.originalModLayer.width = img.width;
                this.originalModLayer.height = img.height;
                this.originalModCtx.clearRect(0, 0, img.width, img.height);
                this.applyAdjustments();
            }
        };
        img.src = state.orig;
    }
});
