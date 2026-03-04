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

        if (this.activeTextInput) {
            this.finalizeText();
            // Allow click to potentially select another text box or create a new one immediately
        }

        const clickCoords = this.getCanvasCoords(e);

        // 1. Global Hit Detection for Text Objects (works in any tool)
        let clickedObject = null;
        let clickedHandle = null;

        // Check selected object's handles first
        if (this.selectedTextObject && !this.selectedTextObject.isEditing) {
            const obj = this.selectedTextObject;
            const hw = 4 / this.scale; // Handle hit radius
            const padding = 4 / this.scale;

            // Top-left handle
            if (clickCoords.x >= obj.x - padding - hw && clickCoords.x <= obj.x - padding + hw &&
                clickCoords.y >= obj.y - padding - hw && clickCoords.y <= obj.y - padding + hw) {
                clickedObject = obj;
                clickedHandle = 'tl';
            }
            // Bottom-right handle
            else if (clickCoords.x >= obj.x + obj.width + padding - hw && clickCoords.x <= obj.x + obj.width + padding + hw &&
                clickCoords.y >= obj.y + obj.height + padding - hw && clickCoords.y <= obj.y + obj.height + padding + hw) {
                clickedObject = obj;
                clickedHandle = 'br';
            }
        }

        // Check objects body if no handle clicked
        if (!clickedHandle) {
            for (let i = this.textObjects.length - 1; i >= 0; i--) {
                const obj = this.textObjects[i];
                if (clickCoords.x >= obj.x && clickCoords.x <= obj.x + obj.width &&
                    clickCoords.y >= obj.y && clickCoords.y <= obj.y + obj.height) {
                    clickedObject = obj;
                    break;
                }
            }
        }

        if (clickedObject) {
            if (clickedHandle) {
                // Start Resizing
                this.resizingTextObject = clickedObject;
                this.resizeHandle = clickedHandle;
                // Store initial state for delta calculations
                this.dragOffsetX = clickCoords.x;
                this.dragOffsetY = clickCoords.y;
                this.originalFontSize = clickedObject.fontSize;
                this.originalObjectY = clickedObject.y;
            } else {
                // Start Moving or Editing
                if (this.selectedTextObject === clickedObject && !this.draggingTextObject) {
                    // Single click on already selected object -> Edit
                    clickedObject.isEditing = true;
                    this._spawnTextEditor(e.clientX, e.clientY, clickedObject);
                    this.render();
                    return;
                }

                // Select and prepare to move
                this.selectedTextObject = clickedObject;
                this.draggingTextObject = clickedObject;
                this.dragOffsetX = clickCoords.x - clickedObject.x;
                this.dragOffsetY = clickCoords.y - clickedObject.y;

                // Sync sidebar
                document.getElementById('tool-size').value = clickedObject.fontSize;
                document.getElementById('val-size').innerText = `${Math.round(clickedObject.fontSize)}px`;
                this.toolSize = clickedObject.fontSize;
                document.getElementById('tool-color').value = clickedObject.color;
                this.toolColor = clickedObject.color;
                const fontSelect = document.getElementById('text-font');
                if (fontSelect) fontSelect.value = clickedObject.fontFamily;
            }

            this.updateToolUI();
            this.render();
            return;
        }

        // If clicked outside any text object, deselect
        if (this.selectedTextObject) {
            this.selectedTextObject = null;
            this.updateToolUI();
            this.render();
        }

        // 2. Tool specific actions
        if (this.activeTool === 'text') {
            // Create a new one at this position
            this._spawnTextEditor(e.clientX, e.clientY, null, clickCoords.x, clickCoords.y);
            this.updateToolUI();
            this.render();
            return;
        }

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
        this.drawingCtx.strokeStyle = this.activeTool === 'eraser' ? '#000' : this.toolColor;
        this.drawingCtx.fillStyle = this.activeTool === 'eraser' ? '#000' : this.toolColor;

        if (this.activeTool === 'pen' || this.activeTool === 'eraser') {
            this.drawingCtx.beginPath();
            this.drawingCtx.moveTo(this.startX, this.startY);
        }
    },

    onMouseMove(e) {
        if (!this.image) return;

        if (this.brushCursor && !this.brushCursor.classList.contains('hidden')) {
            this.brushCursor.style.left = `${e.clientX}px`;
            this.brushCursor.style.top = `${e.clientY}px`;
        }

        if (this.resizingTextObject) {
            const dragCoords = this.getCanvasCoords(e);
            const dy = dragCoords.y - this.dragOffsetY;

            // Adjust font size based on vertical drag
            // If dragging bottom-right: dragging down (positive dy) increases size
            // If dragging top-left: dragging up (negative dy) increases size
            let sizeDelta = this.resizeHandle === 'br' ? dy : -dy;

            // Roughly scale: 1 pixel of drag = 1 pixel of font size change
            let newSize = this.originalFontSize + sizeDelta;
            newSize = Math.max(8, newSize); // Min size constraint
            newSize = Math.min(800, newSize); // Max size constraint

            this.resizingTextObject.fontSize = Math.round(newSize);

            // If resizing from top-left, we also need to adjust the Y position 
            // so the bottom remains anchored visually.
            if (this.resizeHandle === 'tl') {
                const heightDiff = (newSize * 1.2 * this.resizingTextObject.text.split('\n').length) - (this.originalFontSize * 1.2 * this.resizingTextObject.text.split('\n').length);
                // Adjust position upward by the exact amount it grew
                this.resizingTextObject.y = this.originalObjectY - heightDiff;
            }

            // Update UI
            document.getElementById('tool-size').value = newSize;
            document.getElementById('val-size').innerText = `${Math.round(newSize)}px`;
            this.toolSize = newSize;

            this.render();
            return;
        }

        if (this.draggingTextObject) {
            const dragCoords = this.getCanvasCoords(e);
            this.draggingTextObject.x = dragCoords.x - this.dragOffsetX;
            this.draggingTextObject.y = dragCoords.y - this.dragOffsetY;
            this.render();
            return;
        }

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
        if (this.activeTool !== 'pen' && this.activeTool !== 'eraser' && this.activeTool !== 'mosaic') {
            this.drawingCtx.clearRect(0, 0, this.drawingLayer.width, this.drawingLayer.height);
        }

        if (this.activeTool === 'pen' || this.activeTool === 'eraser') {
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
        if (this.resizingTextObject) {
            this.resizingTextObject = null;
            this.resizeHandle = null;
            this.saveState();
            return;
        }

        if (this.draggingTextObject) {
            this.draggingTextObject = null;
            this.saveState(); // Optional: allow undoing a text move
            return;
        }

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

        const modTempCanvas = document.createElement('canvas');
        modTempCanvas.width = imgW;
        modTempCanvas.height = imgH;
        const modCtx = modTempCanvas.getContext('2d');
        modCtx.drawImage(this.modLayer, -imgX, -imgY);

        const newImg = new Image();
        newImg.onload = () => {
            this.image = newImg;
            this.originalImage = newImg; // Reset original
            this.drawingLayer.width = imgW;
            this.drawingLayer.height = imgH;

            this.originalModLayer.width = imgW;
            this.originalModLayer.height = imgH;
            this.originalModCtx.clearRect(0, 0, imgW, imgH);
            this.originalModCtx.drawImage(modTempCanvas, 0, 0);

            this.modLayer.width = imgW;
            this.modLayer.height = imgH;
            this.modCtx.clearRect(0, 0, imgW, imgH);
            this.modCtx.drawImage(modTempCanvas, 0, 0);

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
        const size = this.toolSize; // Mosaic brush size (matches pen)
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
        this.drawingCtx.beginPath();
        this.drawingCtx.arc(x, y, size / 2, 0, 2 * Math.PI);
        this.drawingCtx.fill();
    },

    mergeDrawingToImage() {
        if (this.activeTool === 'eraser') {
            this.modCtx.globalCompositeOperation = 'destination-out';
        }

        this.modCtx.drawImage(this.drawingLayer, 0, 0);

        if (this.activeTool === 'eraser') {
            this.modCtx.globalCompositeOperation = 'source-over';
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.originalModLayer.width;
        tempCanvas.height = this.originalModLayer.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.scale(this.adjustments.flipH, this.adjustments.flipV);
        ctx.rotate(-this.adjustments.rotation * Math.PI / 180);
        ctx.translate(-this.modLayer.width / 2, -this.modLayer.height / 2);
        ctx.drawImage(this.drawingLayer, 0, 0);

        if (this.activeTool === 'eraser') {
            this.originalModCtx.globalCompositeOperation = 'destination-out';
        }
        this.originalModCtx.drawImage(tempCanvas, 0, 0);
        if (this.activeTool === 'eraser') {
            this.originalModCtx.globalCompositeOperation = 'source-over';
        }

        this.drawingCtx.clearRect(0, 0, this.drawingLayer.width, this.drawingLayer.height);
        this.render();
        this.saveState();
    },

    finalizeText() {
        if (!this.activeTextInput) return;

        const text = this.activeTextInput.value;
        const x = parseFloat(this.activeTextInput.dataset.canvasX);
        const y = parseFloat(this.activeTextInput.dataset.canvasY);
        const fontFamily = this.activeTextInput.style.fontFamily || 'Arial';
        const fontSize = this.toolSize;
        const color = this.activeTextInput.style.color || '#000';
        const editingId = this.activeTextInput.dataset.isEditingId;

        if (text.trim() !== '') {
            if (editingId && editingId !== 'new') {
                // Update existing text object
                const obj = this.textObjects.find(o => o.id === editingId);
                if (obj) {
                    obj.text = text;
                    obj.fontSize = fontSize;
                    obj.fontFamily = fontFamily;
                    obj.color = color;
                    obj.isEditing = false;
                }
            } else {
                // Create a new text object
                const newObj = {
                    id: 'text_' + Date.now(),
                    text: text,
                    x: x,
                    y: y,
                    width: 0, // Calculated dynamically during render
                    height: 0,
                    fontSize: fontSize,
                    fontFamily: fontFamily,
                    color: color,
                    isEditing: false
                };
                this.textObjects.push(newObj);
                this.selectedTextObject = newObj;
            }
            this.saveState();
        } else if (editingId && editingId !== 'new') {
            // If they cleared all text from an existing object, delete it
            this.textObjects = this.textObjects.filter(o => o.id !== editingId);
            if (this.selectedTextObject && this.selectedTextObject.id === editingId) {
                this.selectedTextObject = null;
            }
            this.saveState();
        }

        if (this.activeTextInput.parentNode) {
            this.activeTextInput.parentNode.removeChild(this.activeTextInput);
        }
        this.activeTextInput = null;
        this.updateToolUI();
        this.render();
    },

    _spawnTextEditor(clientX, clientY, existingObj = null, newX = 0, newY = 0) {
        const input = document.createElement('textarea');
        input.className = 'canvas-text-input';

        const fontFamily = existingObj ? existingObj.fontFamily : (document.getElementById('text-font') ? document.getElementById('text-font').value : 'Arial, sans-serif');
        const fontSize = existingObj ? existingObj.fontSize : this.toolSize;
        const color = existingObj ? existingObj.color : this.toolColor;

        input.style.fontFamily = fontFamily;
        input.style.fontSize = `${fontSize * this.scale}px`;
        input.style.color = color;

        input.style.left = `${clientX + window.scrollX}px`;
        input.style.top = `${clientY + window.scrollY}px`;

        if (existingObj) {
            input.value = existingObj.text;
            input.dataset.canvasX = existingObj.x;
            input.dataset.canvasY = existingObj.y;
            input.dataset.isEditingId = existingObj.id;
        } else {
            input.dataset.canvasX = newX;
            input.dataset.canvasY = newY;
            input.dataset.isEditingId = "new";
        }

        document.body.appendChild(input);

        const resizeInput = function () {
            this.style.width = '1px';
            this.style.height = '1px';
            this.style.width = (this.scrollWidth + 2) + 'px';
            this.style.height = (this.scrollHeight + 2) + 'px';
        };
        input.addEventListener('input', resizeInput);

        setTimeout(() => {
            input.focus();
            resizeInput.call(input);
            // Put cursor at the end
            input.setSelectionRange(input.value.length, input.value.length);
        }, 10);

        this.activeTextInput = input;
    },

    updateFlattenButtonVisibility() {
        const btnFlatten = document.getElementById('btn-flatten-text');
        const btnDelete = document.getElementById('btn-delete-text');

        const isSelectedText = this.selectedTextObject && !this.selectedTextObject.isEditing;
        // Don't need activeTool === 'text' constraint for these buttons anymore since cross-tool 
        // selection makes the sidebar text-font-group show up when a text object is selected anyway.
        // Wait, ui.js currently only shows text-font-group if activeTool === 'text'. 
        // We will fix ui.js in the next step to show text-font-group if a text object is selected.

        if (btnFlatten) {
            if (isSelectedText) {
                btnFlatten.classList.remove('hidden');
            } else {
                btnFlatten.classList.add('hidden');
            }
        }

        if (btnDelete) {
            if (isSelectedText) {
                btnDelete.classList.remove('hidden');
            } else {
                btnDelete.classList.add('hidden');
            }
        }
    },

    deleteTextObject(obj) {
        if (!obj) return;
        this.textObjects = this.textObjects.filter(o => o.id !== obj.id);
        if (this.selectedTextObject && this.selectedTextObject.id === obj.id) {
            this.selectedTextObject = null;
        }
        this.updateToolUI();
        this.render();
        this.saveState();
    },

    flattenTextObject(obj) {
        if (!obj) return;

        // Render it once to modLayer exactly where it is
        this.modCtx.save();
        this.modCtx.font = `${obj.fontSize}px ${obj.fontFamily}`;
        this.modCtx.fillStyle = obj.color;
        this.modCtx.textBaseline = 'top';

        const lines = obj.text.split('\n');
        const lineHeight = obj.fontSize * 1.2;

        // Match our slight offset for WYSIWYG
        const offsetY = obj.fontSize * 0.08 + (1);
        const offsetX = 1;

        lines.forEach((line, index) => {
            this.modCtx.fillText(line, obj.x + offsetX, obj.y + offsetY + (index * lineHeight));
        });

        // Also draw to original modLayer for full resolution tracking if needed...
        // For simplicity with our current architecture, drawing to modLayer + saveState is enough 
        // because the user is expected to do merges visually on this layer.
        // Actually, we should merge the exact same way mergeDrawingToImage does it.
        this.modCtx.restore();

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.originalModLayer.width;
        tempCanvas.height = this.originalModLayer.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.scale(this.adjustments.flipH, this.adjustments.flipV);
        ctx.rotate(-this.adjustments.rotation * Math.PI / 180);
        ctx.translate(-this.modLayer.width / 2, -this.modLayer.height / 2);

        // Prepare a tiny isolated temp canvas to proxy the text drawing
        const textCanvas = document.createElement('canvas');
        textCanvas.width = this.modLayer.width;
        textCanvas.height = this.modLayer.height;
        const textCtx = textCanvas.getContext('2d');
        textCtx.font = `${obj.fontSize}px ${obj.fontFamily}`;
        textCtx.fillStyle = obj.color;
        textCtx.textBaseline = 'top';
        lines.forEach((line, index) => {
            textCtx.fillText(line, obj.x + offsetX, obj.y + offsetY + (index * lineHeight));
        });

        ctx.drawImage(textCanvas, 0, 0);
        this.originalModCtx.drawImage(tempCanvas, 0, 0);

        // Remove from objects array
        this.textObjects = this.textObjects.filter(o => o.id !== obj.id);
        if (this.selectedTextObject && this.selectedTextObject.id === obj.id) {
            this.selectedTextObject = null;
        }

        this.updateToolUI();
        this.render();
        this.saveState();
    }
});
