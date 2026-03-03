Object.assign(PhotoEditor.prototype, {
    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.panX) / this.scale,
            y: (e.clientY - rect.top - this.panY) / this.scale
        };
    },

    onMouseDown(e) {
        if (!this.image) return;

        if (this.activeTool === 'crop') {
            if (this.cropBox) {
                const { x: cx, y: cy, width: cw, height: ch } = this.cropBox;
                const hit = 12; // Handle hit zone
                const ex = e.offsetX;
                const ey = e.offsetY;

                let handle = null;
                if (Math.abs(ex - cx) < hit && Math.abs(ey - cy) < hit) handle = 'tl';
                else if (Math.abs(ex - (cx + cw)) < hit && Math.abs(ey - cy) < hit) handle = 'tr';
                else if (Math.abs(ex - cx) < hit && Math.abs(ey - (cy + ch)) < hit) handle = 'bl';
                else if (Math.abs(ex - (cx + cw)) < hit && Math.abs(ey - (cy + ch)) < hit) handle = 'br';

                if (handle) {
                    this.isDraggingCrop = handle;
                    this.lastMouseX = e.clientX;
                    this.lastMouseY = e.clientY;
                    return;
                }
            }
            // Fallthrough to panning the image
            this.isPanning = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            return;
        }

        if (this.activeTool === 'select' || e.button === 1 || e.button === 2) {
            this.isPanning = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            return;
        }

        this.isDrawing = true;
        const coords = this.getCanvasCoords(e);
        this.startX = coords.x;
        this.startY = coords.y;

        this.drawingCtx.lineCap = 'round';
        this.drawingCtx.lineJoin = 'round';
        this.drawingCtx.lineWidth = this.toolSize;
        this.drawingCtx.strokeStyle = this.toolColor;
        this.drawingCtx.fillStyle = this.toolColor;

        if (this.activeTool === 'pen') {
            this.drawingCtx.beginPath();
            this.drawingCtx.moveTo(this.startX, this.startY);
        }
    },

    onMouseMove(e) {
        if (!this.image) return;

        if (this.isDraggingCrop) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            if (this.isDraggingCrop === 'tl') {
                this.cropBox.x += dx; this.cropBox.y += dy;
                this.cropBox.width -= dx; this.cropBox.height -= dy;
            } else if (this.isDraggingCrop === 'tr') {
                this.cropBox.y += dy;
                this.cropBox.width += dx; this.cropBox.height -= dy;
            } else if (this.isDraggingCrop === 'bl') {
                this.cropBox.x += dx;
                this.cropBox.width -= dx; this.cropBox.height += dy;
            } else if (this.isDraggingCrop === 'br') {
                this.cropBox.width += dx; this.cropBox.height += dy;
            }

            if (this.cropBox.width < 50) this.cropBox.width = 50;
            if (this.cropBox.height < 50) this.cropBox.height = 50;

            this.render();
            return;
        }

        if (this.isPanning) {
            this.panX += e.clientX - this.lastMouseX;
            this.panY += e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.render();
            return;
        }

        if (!this.isDrawing) return;

        const coords = this.getCanvasCoords(e);

        // Clear drawing layer
        if (this.activeTool !== 'pen' && this.activeTool !== 'mosaic') {
            this.drawingCtx.clearRect(0, 0, this.drawingLayer.width, this.drawingLayer.height);
        }

        if (this.activeTool === 'pen') {
            this.drawingCtx.lineTo(coords.x, coords.y);
            this.drawingCtx.stroke();
        } else if (this.activeTool === 'rect') {
            this.drawingCtx.strokeRect(this.startX, this.startY, coords.x - this.startX, coords.y - this.startY);
        } else if (this.activeTool === 'rect-fill') {
            this.drawingCtx.fillRect(this.startX, this.startY, coords.x - this.startX, coords.y - this.startY);
        } else if (this.activeTool === 'circle') {
            this.drawingCtx.beginPath();
            const radius = Math.sqrt(Math.pow(coords.x - this.startX, 2) + Math.pow(coords.y - this.startY, 2));
            this.drawingCtx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
            this.drawingCtx.stroke();
        } else if (this.activeTool === 'circle-fill') {
            this.drawingCtx.beginPath();
            const radius = Math.sqrt(Math.pow(coords.x - this.startX, 2) + Math.pow(coords.y - this.startY, 2));
            this.drawingCtx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
            this.drawingCtx.fill();
        } else if (this.activeTool === 'mosaic') {
            this.applyMosaicBrush(coords.x, coords.y);
        }

        this.render();
    },

    onMouseUp(e) {
        if (this.isDraggingCrop) {
            this.isDraggingCrop = null;
            this.scheduleCropSettle();
            return;
        }

        if (this.isPanning) {
            this.isPanning = false;
            if (this.activeTool === 'crop') this.scheduleCropSettle();
            return;
        }

        if (!this.isDrawing) return;
        this.isDrawing = false;

        const coords = this.getCanvasCoords(e);

        // Merge drawing layer to image
        this.mergeDrawingToImage();
    },

    applyIOSCrop() {
        if (this.activeTool !== 'crop' || !this.cropBox) return;

        const { x: cropBoxX, y: cropBoxY, width: cropBoxW, height: cropBoxH } = this.cropBox;

        // Define coordinates relative to image scale/pan
        const imgX = (cropBoxX - this.panX) / this.scale;
        const imgY = (cropBoxY - this.panY) / this.scale;
        const imgW = cropBoxW / this.scale;
        const imgH = cropBoxH / this.scale;

        if (imgW < 10 || imgH < 10) return; // Too small

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgW;
        tempCanvas.height = imgH;
        const ctx = tempCanvas.getContext('2d');

        // Draw the image onto the temp canvas, offset by -imgX and -imgY
        ctx.drawImage(this.image, -imgX, -imgY);

        const newImg = new Image();
        newImg.onload = () => {
            this.image = newImg;
            this.originalImage = newImg; // Reset original
            this.drawingLayer.width = imgW;
            this.drawingLayer.height = imgH;

            // Re-center and Reset
            this.fitToScreen();
            this.saveState();

            // Switch back to select tool
            const selectBtn = document.querySelector('[data-tool="select"]');
            if (selectBtn) selectBtn.click();
        };
        newImg.src = tempCanvas.toDataURL('image/png');
    },

    applyMosaicBrush(x, y) {
        const size = this.toolSize * 5; // Mosaic block size
        if (x < 0 || y < 0 || x > this.image.width || y > this.image.height) return;

        // Get pixel data from actual image
        const offscreen = document.createElement('canvas');
        offscreen.width = this.image.width;
        offscreen.height = this.image.height;
        const oCtx = offscreen.getContext('2d');
        oCtx.drawImage(this.image, 0, 0);

        const startX = Math.max(0, x - size / 2);
        const startY = Math.max(0, y - size / 2);
        const mw = Math.min(size, this.image.width - startX);
        const mh = Math.min(size, this.image.height - startY);

        const imgData = oCtx.getImageData(startX, startY, mw, mh);
        const data = imgData.data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }

        this.drawingCtx.fillStyle = `rgb(${r / count}, ${g / count}, ${b / count})`;
        this.drawingCtx.fillRect(startX, startY, mw, mh);
    },

    mergeDrawingToImage() {
        // Render current image + drawing layer into new image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.image.width;
        tempCanvas.height = this.image.height;
        const ctx = tempCanvas.getContext('2d');

        ctx.drawImage(this.image, 0, 0);
        ctx.drawImage(this.drawingLayer, 0, 0);

        const newImg = new Image();
        newImg.onload = () => {
            this.image = newImg;
            this.originalImage = newImg; // Reset base
            this.drawingCtx.clearRect(0, 0, this.drawingLayer.width, this.drawingLayer.height);
            this.render();
            this.saveState();
        };
        newImg.src = tempCanvas.toDataURL('image/png');
    }
});
