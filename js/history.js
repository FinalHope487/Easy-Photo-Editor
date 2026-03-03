Object.assign(PhotoEditor.prototype, {
    saveState() {
        if (!this.image) return;
        // If we are not at the end of history, truncate it
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Save just the image data URL
        const state = this.image.src;
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

    restoreState(src) {
        const img = new Image();
        img.onload = () => {
            this.originalImage = img;
            this.image = img;
            this.drawingLayer.width = img.width;
            this.drawingLayer.height = img.height;
            this.render();
        };
        img.src = src;
    }
});
