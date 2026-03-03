class PhotoEditor {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.wrapper = document.getElementById('canvas-wrapper');

        // State
        this.image = null;         // Current rendered image
        this.originalImage = null; // Unmodified base image

        // Transform
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Adjustments
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            rotation: 0,
            flipH: 1,
            flipV: 1
        };

        // Tools
        this.activeTool = 'select'; // select, crop, pen, rect, circle, mosaic
        this.toolSize = 5;
        this.toolColor = '#eb4034';

        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.drawingLayer = null; // Temp canvas for current drawing
        this.drawingCtx = null;

        // Crop state
        this.cropBox = null;
        this.isDraggingCrop = null;

        // History
        this.history = [];
        this.historyIndex = -1;

        // Batch
        this.batchFiles = [];

        this.init();
    }

    init() {
        this.bindEvents();
        this.setupTooltips();
        this.setupDrawingLayer();
    }

    setupTooltips() {
        // Create dynamic tooltip element
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'dynamic-tooltip';
        document.body.appendChild(tooltipEl);

        document.querySelectorAll('[title], [data-tooltip]').forEach(el => {
            const title = el.getAttribute('title') || el.getAttribute('data-tooltip');
            if (el.hasAttribute('title')) {
                el.setAttribute('data-tooltip', title);
                el.removeAttribute('title');
            }

            el.addEventListener('mouseenter', () => {
                tooltipEl.innerText = el.getAttribute('data-tooltip');
                tooltipEl.classList.add('show');

                const rect = el.getBoundingClientRect();
                const tipRect = tooltipEl.getBoundingClientRect();

                // Determine position based on element position
                let top = rect.bottom + 8;
                let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

                // If in left sidebar, show on the right
                if (el.closest('.sidebar.tools-sidebar')) {
                    top = rect.top + (rect.height / 2) - (tipRect.height / 2);
                    left = rect.right + 8;
                }

                // Check bounds to prevent going outside window
                if (left < 10) left = 10;
                if (left + tipRect.width > window.innerWidth - 10) left = window.innerWidth - tipRect.width - 10;
                if (top + tipRect.height > window.innerHeight - 10) top = rect.top - tipRect.height - 8;

                tooltipEl.style.left = `${left}px`;
                tooltipEl.style.top = `${top}px`;
            });

            el.addEventListener('mouseleave', () => {
                tooltipEl.classList.remove('show');
            });
        });
    }

    setupDrawingLayer() {
        this.drawingLayer = document.createElement('canvas');
        this.drawingCtx = this.drawingLayer.getContext('2d');
    }

    loadImageFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.image = img;
                // Reset adjustments
                this.adjustments = { brightness: 0, contrast: 0, saturation: 0, rotation: 0, flipH: 1, flipV: 1 };

                // Hide empty state
                document.getElementById('empty-state').classList.add('hidden');
                this.canvas.classList.remove('hidden');

                // Reset history
                this.history = [];
                this.historyIndex = -1;

                this.applyAdjustments(); // Will create base working image
                this.fitToScreen();
                this.saveState();

                // Show tools
                document.body.classList.add('has-image');
                this.fitToScreen();
                this.saveState();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    fitToScreen() {
        if (!this.image) return;
        const wrapperRect = this.wrapper.getBoundingClientRect();
        const padding = 40;

        const scaleX = (wrapperRect.width - padding) / this.image.width;
        const scaleY = (wrapperRect.height - padding) / this.image.height;
        this.scale = Math.min(scaleX, scaleY, 1); // Max scale 1 (100%) initially

        this.panX = (wrapperRect.width - (this.image.width * this.scale)) / 2;
        this.panY = (wrapperRect.height - (this.image.height * this.scale)) / 2;

        this.updateZoomLabel();
        this.render();
    }

    updateZoomLabel() {
        document.getElementById('zoom-level').innerText = `${Math.round(this.scale * 100)}%`;
        if (this.image) {
            const dimLabel = document.getElementById('image-dimensions');
            if (dimLabel) dimLabel.innerText = `${this.image.width} × ${this.image.height}`;
        }
    }

    applyAdjustments() {
        if (!this.originalImage) return;

        // Create temp canvas to apply adjustments and save to this.image
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');

        // Handle rotation sizes
        const isRotated = Math.abs(this.adjustments.rotation) % 180 === 90;
        tempCanvas.width = isRotated ? this.originalImage.height : this.originalImage.width;
        tempCanvas.height = isRotated ? this.originalImage.width : this.originalImage.height;

        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate(this.adjustments.rotation * Math.PI / 180);
        ctx.scale(this.adjustments.flipH, this.adjustments.flipV);

        // CSS Filter for brightness, contrast, saturation
        const b = 100 + this.adjustments.brightness;
        const c = 100 + this.adjustments.contrast;
        const s = 100 + this.adjustments.saturation;
        ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

        ctx.drawImage(this.originalImage, -this.originalImage.width / 2, -this.originalImage.height / 2);

        const newImg = new Image();
        newImg.onload = () => {
            this.image = newImg;
            this.drawingLayer.width = newImg.width;
            this.drawingLayer.height = newImg.height;
            this.render();
        };
        newImg.src = tempCanvas.toDataURL('image/png');
    }

    render() {
        if (!this.image) return;

        const wrapperRect = this.wrapper.getBoundingClientRect();
        this.canvas.width = wrapperRect.width;
        this.canvas.height = wrapperRect.height;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.scale, this.scale);

        // (Optional) Fill background only if not PNG, but to preserve transparency we don't fill
        // this.ctx.fillStyle = '#1c1f26';
        // this.ctx.fillRect(0, 0, this.image.width, this.image.height);

        this.ctx.drawImage(this.image, 0, 0);

        // Draw drawing layer (active strokes/shapes)
        if (this.drawingLayer.width > 0 && this.drawingLayer.height > 0) {
            this.ctx.drawImage(this.drawingLayer, 0, 0);
        }

        this.ctx.restore();

        if (this.activeTool === 'crop' && this.cropBox) {
            const { x: cropBoxX, y: cropBoxY, width: cropBoxW, height: cropBoxH } = this.cropBox;

            // Draw darkened overlay using 4 rects (avoid clearRect/destination-out which erases canvas)
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, cropBoxY); // Top
            this.ctx.fillRect(0, cropBoxY + cropBoxH, this.canvas.width, this.canvas.height - cropBoxY - cropBoxH); // Bottom
            this.ctx.fillRect(0, cropBoxY, cropBoxX, cropBoxH); // Left
            this.ctx.fillRect(cropBoxX + cropBoxW, cropBoxY, this.canvas.width - cropBoxX - cropBoxW, cropBoxH); // Right

            // Draw grid lines inside crop box 
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            // Verticals
            this.ctx.moveTo(cropBoxX + cropBoxW / 3, cropBoxY);
            this.ctx.lineTo(cropBoxX + cropBoxW / 3, cropBoxY + cropBoxH);
            this.ctx.moveTo(cropBoxX + cropBoxW * 2 / 3, cropBoxY);
            this.ctx.lineTo(cropBoxX + cropBoxW * 2 / 3, cropBoxY + cropBoxH);
            // Horizontals
            this.ctx.moveTo(cropBoxX, cropBoxY + cropBoxH / 3);
            this.ctx.lineTo(cropBoxX + cropBoxW, cropBoxY + cropBoxH / 3);
            this.ctx.moveTo(cropBoxX, cropBoxY + cropBoxH * 2 / 3);
            this.ctx.lineTo(cropBoxX + cropBoxW, cropBoxY + cropBoxH * 2 / 3);
            this.ctx.stroke();

            // Draw crop box border
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(cropBoxX, cropBoxY, cropBoxW, cropBoxH);

            // Draw corner handles
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 4;
            const hL = 20; // Handle length

            this.ctx.beginPath();
            // Top Left
            this.ctx.moveTo(cropBoxX, cropBoxY + hL);
            this.ctx.lineTo(cropBoxX, cropBoxY);
            this.ctx.lineTo(cropBoxX + hL, cropBoxY);

            // Top Right
            this.ctx.moveTo(cropBoxX + cropBoxW - hL, cropBoxY);
            this.ctx.lineTo(cropBoxX + cropBoxW, cropBoxY);
            this.ctx.lineTo(cropBoxX + cropBoxW, cropBoxY + hL);

            // Bottom Left
            this.ctx.moveTo(cropBoxX, cropBoxY + cropBoxH - hL);
            this.ctx.lineTo(cropBoxX, cropBoxY + cropBoxH);
            this.ctx.lineTo(cropBoxX + hL, cropBoxY + cropBoxH);

            // Bottom Right
            this.ctx.moveTo(cropBoxX + cropBoxW - hL, cropBoxY + cropBoxH);
            this.ctx.lineTo(cropBoxX + cropBoxW, cropBoxY + cropBoxH);
            this.ctx.lineTo(cropBoxX + cropBoxW, cropBoxY + cropBoxH - hL);
            this.ctx.stroke();
        }
    }

    scheduleCropSettle() {
        if (this.cropSettleTimer) clearTimeout(this.cropSettleTimer);
        this.cropSettleTimer = setTimeout(() => this.settleCropBox(), 1500);
    }

    settleCropBox() {
        if (!this.cropBox || this.activeTool !== 'crop' || this.isPanning || this.isDraggingCrop) return;

        // Target is 80% of canvas
        const padding = 0.8;
        const targetW = this.canvas.width * padding;
        const targetH = this.canvas.height * padding;

        const aspectBox = this.cropBox.width / this.cropBox.height;
        const aspectTarget = targetW / targetH;

        let newCropW, newCropH;
        if (aspectBox > aspectTarget) {
            newCropW = targetW;
            newCropH = targetW / aspectBox;
        } else {
            newCropH = targetH;
            newCropW = targetH * aspectBox;
        }

        const newCropX = (this.canvas.width - newCropW) / 2;
        const newCropY = (this.canvas.height - newCropH) / 2;

        // Scale factor for the image and pan
        const factor = newCropW / this.cropBox.width;

        // Target image scale
        const targetScale = this.scale * factor;

        // Target image pan relative to cropBox
        const relX = this.panX - this.cropBox.x;
        const relY = this.panY - this.cropBox.y;

        const targetPanX = newCropX + relX * factor;
        const targetPanY = newCropY + relY * factor;

        this.animateCropSettle(
            this.cropBox.x, this.cropBox.y, this.cropBox.width, this.cropBox.height,
            newCropX, newCropY, newCropW, newCropH,
            this.scale, targetScale,
            this.panX, targetPanX,
            this.panY, targetPanY,
            Date.now(), 300
        );
    }

    animateCropSettle(cx0, cy0, cw0, ch0, cx1, cy1, cw1, ch1, s0, s1, px0, px1, py0, py1, startTime, duration) {
        if (this.isPanning || this.isDraggingCrop || this.activeTool !== 'crop') return; // Cancel on interaction

        const now = Date.now();
        let t = (now - startTime) / duration;
        if (t > 1) t = 1;

        const ease = 1 - Math.pow(1 - t, 3); // Cubic ease out

        this.cropBox.x = cx0 + (cx1 - cx0) * ease;
        this.cropBox.y = cy0 + (cy1 - cy0) * ease;
        this.cropBox.width = cw0 + (cw1 - cw0) * ease;
        this.cropBox.height = ch0 + (ch1 - ch0) * ease;

        this.scale = s0 + (s1 - s0) * ease;
        this.panX = px0 + (px1 - px0) * ease;
        this.panY = py0 + (py1 - py0) * ease;

        this.render();
        this.updateZoomLabel();

        if (t < 1) {
            requestAnimationFrame(() => this.animateCropSettle(cx0, cy0, cw0, ch0, cx1, cy1, cw1, ch1, s0, s1, px0, px1, py0, py1, startTime, duration));
        }
    }

    exportImage(fileName = 'edited-photo') {
        if (!this.image) return;
        const format = document.getElementById('export-format').value;
        const ext = format.split('/')[1];

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.image.width;
        tempCanvas.height = this.image.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(this.image, 0, 0);

        // Include drawing layer
        if (this.drawingLayer && this.drawingLayer.width > 0 && this.drawingLayer.height > 0) {
            ctx.drawImage(this.drawingLayer, 0, 0);
        }

        tempCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }, format, 0.9);
    }
}
