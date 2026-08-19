Object.assign(PhotoEditor.prototype, {
    /** 收合列上要看得出現在調的是什麼，不然收起來就等於忘了設定值。 */
    updateAttrSummary() {
        const el = document.getElementById('attr-summary');
        if (!el) return;
        const names = {
            pen: '筆刷', eraser: '橡皮擦', text: '文字', mosaic: '馬賽克',
            rect: '矩形', 'rect-fill': '實心矩形',
            circle: '圓形', 'circle-fill': '實心圓形', crop: '裁切',
        };
        const name = names[this.activeTool] || '工具設定';
        if (this.activeTool === 'crop') { el.innerText = name; return; }
        const size = this.activeTool === 'text' ? this.currentTextSize() : this.toolSize;
        el.innerText = `${name} ${Math.round(size)}px`;
    },

    /** 換工具就把面板攤開：剛選完工具多半就是要調它的參數。 */
    expandAttrs() {
        document.body.classList.remove('attrs-collapsed');
        const btn = document.getElementById('btn-attr-collapse');
        if (btn) {
            btn.setAttribute('aria-expanded', 'true');
            btn.setAttribute('aria-label', '收合工具設定');
        }
    },

    /** 同一個滑桿在文字工具下代表字級、其餘工具下代表筆刷粗細，範圍也不同。 */
    syncSizeSlider() {
        const slider = document.getElementById('tool-size');
        const label = document.getElementById('val-size');
        if (!slider) return;
        const isText = this.activeTool === 'text';
        const value = isText ? this.currentTextSize() : this.toolSize;
        slider.min = isText ? 8 : 1;
        // 大圖需要大字級：上限跟著圖片高度走，否則 100px 的字在 4000px 的圖上還是小
        slider.max = isText && this.image
            ? Math.max(100, Math.round(this.image.height / 2)) : 100;
        slider.value = value;
        if (label) label.innerText = `${Math.round(value)}px`;
        this.updateAttrSummary();
    },

    updateToolUI() {
        if (this._attrsToolShown !== this.activeTool) {
            this._attrsToolShown = this.activeTool;
            this.expandAttrs();
        }
        const attrPanel = document.getElementById('attr-panel');
        const drawGroup = document.getElementById('draw-attrs');
        const cropGroup = document.getElementById('crop-attrs');

        if (['pen', 'eraser', 'text', 'rect', 'rect-fill', 'circle', 'circle-fill', 'mosaic'].includes(this.activeTool)) {
            attrPanel.classList.add('show');
            if (drawGroup) {
                drawGroup.classList.remove('hidden');
                drawGroup.style.display = ''; // Show draw group
            }
            if (cropGroup) cropGroup.classList.add('hidden');

            const colorGroup = document.getElementById('color-attr-group');
            if (colorGroup) {
                colorGroup.style.display = (this.activeTool === 'eraser' || this.activeTool === 'mosaic') ? 'none' : '';
            }

            const fontGroup = document.getElementById('text-font-group');
            if (fontGroup) {
                fontGroup.style.display = this.activeTool === 'text' ? '' : 'none';
            }
            this.syncSizeSlider();
            if (typeof this.updateFlattenButtonVisibility === 'function') {
                this.updateFlattenButtonVisibility();
            }

        } else if (this.activeTool === 'crop') {
            attrPanel.classList.add('show');
            // `.hidden` 是 display:none !important，光設 style.display 蓋不掉它，
            // 「確定裁切」按鈕會永遠是 0×0。必須把 class 拿掉。
            if (cropGroup) {
                cropGroup.classList.remove('hidden');
                cropGroup.style.display = '';
            }
            if (drawGroup) drawGroup.classList.add('hidden');

            if (!this.cropBox && this.image) {
                this.fitToScreen();
                this.cropBox = {
                    x: this.panX,
                    y: this.panY,
                    width: this.image.width * this.scale,
                    height: this.image.height * this.scale
                };
            }
        } else if (this.selectedTextObject) {
            attrPanel.classList.add('show');
            if (drawGroup) {
                drawGroup.classList.remove('hidden');
                drawGroup.style.display = '';
            }
            if (cropGroup) cropGroup.classList.add('hidden');
            const colorGroup = document.getElementById('color-attr-group');
            if (colorGroup) colorGroup.style.display = '';
            const fontGroup = document.getElementById('text-font-group');
            if (fontGroup) {
                fontGroup.style.display = '';
            }
            if (typeof this.updateFlattenButtonVisibility === 'function') {
                this.updateFlattenButtonVisibility();
            }
        } else if (this.activeTool === 'select') {
            attrPanel.classList.remove('show');
        } else {
            attrPanel.classList.remove('show');
        }
    },

    bindEvents() {
        // File Upload
        const fileInput = document.getElementById('file-upload');
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (e.target.files.length === 1) {
                    this.loadImageFromFile(e.target.files[0]);
                } else {
                    this.addFilesToBatch(Array.from(e.target.files));
                    // Load the first one into editor
                    this.loadImageFromFile(e.target.files[0]);
                }
            }
        });

        // Drag and Drop
        const dropZone = document.getElementById('drop-zone');
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.remove('hidden');
        });
        window.addEventListener('dragleave', (e) => {
            if (e.clientX === 0 && e.clientY === 0) {
                dropZone.classList.add('hidden');
            }
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.add('hidden');
            if (e.dataTransfer.files.length > 0) {
                if (e.dataTransfer.files.length === 1) {
                    this.loadImageFromFile(e.dataTransfer.files[0]);
                } else {
                    this.addFilesToBatch(Array.from(e.dataTransfer.files));
                    this.loadImageFromFile(e.dataTransfer.files[0]);
                }
            }
        });

        // Paste
        window.addEventListener('paste', (e) => {
            if (e.clipboardData.files.length > 0) {
                this.loadImageFromFile(e.clipboardData.files[0]);
            }
        });

        // Resize
        window.addEventListener('resize', () => {
            if (this.image) this.fitToScreen();
        });

        // Zoom 
        const applyZoom = (zoomAmount, cx, cy) => {
            if (!this.image || this.activeTextInput) return;
            const targetX = (cx - this.panX) / this.scale;
            const targetY = (cy - this.panY) / this.scale;

            this.scale *= zoomAmount;

            // Limit scale between 10% and 500%
            if (this.scale < 0.1) this.scale = 0.1;
            if (this.scale > 5) this.scale = 5;

            this.panX = cx - (targetX * this.scale);
            this.panY = cy - (targetY * this.scale);

            this.updateZoomLabel();
            this.render();
            if (this.activeTool === 'crop') this.scheduleCropSettle();
        };

        this.wrapper.addEventListener('wheel', (e) => {
            if (!this.image || this.activeTextInput) return;
            e.preventDefault();
            const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = this.wrapper.getBoundingClientRect();
            applyZoom(zoomAmount, e.clientX - rect.left, e.clientY - rect.top);
        }, { passive: false });

        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            const rect = this.wrapper.getBoundingClientRect();
            applyZoom(1.2, rect.width / 2, rect.height / 2);
        });
        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            const rect = this.wrapper.getBoundingClientRect();
            applyZoom(1 / 1.2, rect.width / 2, rect.height / 2);
        });
        document.getElementById('btn-zoom-fit').addEventListener('click', () => {
            this.fitToScreen();
            if (this.activeTool === 'crop') {
                this.cropBox = {
                    x: this.panX,
                    y: this.panY,
                    width: this.image.width * this.scale,
                    height: this.image.height * this.scale
                };
                this.render();
            }
        });

        // Tools（只綁真的工具鈕；#btn-props-toggle 也用 .tool-btn 樣式但沒有 data-tool）
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const toolName = target.dataset.tool;

                // Toggle logic for shapes
                if ((toolName === 'rect' && this.activeTool.startsWith('rect')) ||
                    (toolName === 'circle' && this.activeTool.startsWith('circle'))) {

                    if (this.activeTool.endsWith('-fill')) {
                        this.activeTool = toolName; // revert to empty
                    } else {
                        this.activeTool = toolName + '-fill'; // set to filled
                    }

                    // Update visual icon and title
                    const icon = target.querySelector('svg') || target.querySelector('i');
                    if (icon) {
                        if (this.activeTool.endsWith('-fill')) {
                            target.setAttribute('data-tooltip', toolName === 'rect' ? '實心矩形 (R)' : '實心圓形 (O)');
                            icon.style.fill = 'currentColor';
                        } else {
                            target.setAttribute('data-tooltip', toolName === 'rect' ? '空心矩形 (R)' : '空心圓形 (O)');
                            icon.style.fill = 'none';
                        }
                    }

                    // Trigger tooltip update if visible
                    const tooltipEl = document.querySelector('.dynamic-tooltip');
                    if (tooltipEl && tooltipEl.classList.contains('show')) {
                        tooltipEl.innerText = target.getAttribute('data-tooltip');
                    }
                } else {
                    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                    target.classList.add('active');
                    this.activeTool = toolName;
                }

                this.updateToolUI();

                // Brush Cursor Visibility（觸控裝置沒有游標可以跟，顯示了只會卡住不動）
                const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
                if (this.brushCursor) {
                    if (hasFinePointer &&
                        (this.activeTool === 'pen' || this.activeTool === 'eraser' || this.activeTool === 'mosaic')) {
                        this.brushCursor.classList.remove('hidden');
                        this.updateBrushCursorSize(); // Keep size synced
                    } else {
                        this.brushCursor.classList.add('hidden');
                    }
                }

                if (this.activeTextInput && this.activeTool !== 'text') {
                    this.finalizeText();
                }

                this.canvas.className = `tool-${this.activeTool.replace('-fill', '')}`;
                this.render(); // Ensure crop box rendering starts immediately
                this.render(); // Re-render to show/hide crop overlay
            });
        });

        const btnApplyCrop = document.getElementById('btn-apply-crop');
        if (btnApplyCrop) {
            btnApplyCrop.addEventListener('click', () => {
                if (typeof this.applyIOSCrop === 'function') {
                    this.applyIOSCrop();
                }
            });
        }

        // Tool Attributes
        document.getElementById('tool-size').addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            document.getElementById('val-size').innerText = `${size}px`;
            // 這個滑桿在文字情境下調的是字級，不能寫進筆刷粗細——否則調完字級
            // 切回筆刷會發現筆刷也被改掉了
            const isTextContext = this.activeTool === 'text' ||
                this.activeTextInput || this.selectedTextObject;
            if (isTextContext) {
                this.textSize = size;
            } else {
                this.toolSize = size;
            }
            if (this.brushCursor && !this.brushCursor.classList.contains('hidden')) {
                this.updateBrushCursorSize();
            }
            if (this.activeTextInput) {
                this.activeTextInput.style.fontSize = `${size * this.scale}px`;
                this.activeTextInput.dispatchEvent(new Event('input')); // trigger resize
            } else if (this.selectedTextObject) {
                this.selectedTextObject.fontSize = size;
                this.render();
            }
        });
        document.getElementById('tool-color').addEventListener('input', (e) => {
            this.toolColor = e.target.value;
            if (this.activeTextInput) {
                this.activeTextInput.style.color = this.toolColor;
            } else if (this.selectedTextObject) {
                this.selectedTextObject.color = this.toolColor;
                this.render();
            }
        });

        const fontSelect = document.getElementById('text-font');
        if (fontSelect) {
            fontSelect.addEventListener('change', (e) => {
                if (this.activeTextInput) {
                    this.activeTextInput.style.fontFamily = e.target.value;
                    this.activeTextInput.dispatchEvent(new Event('input'));
                    this.activeTextInput.focus();
                } else if (this.selectedTextObject) {
                    this.selectedTextObject.fontFamily = e.target.value;
                    this.render();
                }
            });
        }

        document.querySelectorAll('.palette-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                this.toolColor = color;
                document.getElementById('tool-color').value = color;
                if (this.activeTextInput) {
                    this.activeTextInput.style.color = color;
                } else if (this.selectedTextObject) {
                    this.selectedTextObject.color = color;
                    this.render();
                }
            });
        });

        // Flatten & Delete Text Logic
        const btnFlatten = document.getElementById('btn-flatten-text');
        if (btnFlatten) {
            btnFlatten.addEventListener('click', () => {
                if (this.selectedTextObject) {
                    this.flattenTextObject(this.selectedTextObject);
                }
            });
        }
        const btnDelete = document.getElementById('btn-delete-text');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                if (this.selectedTextObject) {
                    this.deleteTextObject(this.selectedTextObject);
                }
            });
        }

        // Adjustments
        const updateAdjustment = (id, prop) => {
            const range = document.getElementById(`adj-${id}`);
            const inputNum = document.getElementById(`val-${id}`);

            range.addEventListener('input', (e) => {
                const parsed = parseInt(e.target.value) || 0;
                this.adjustments[prop] = parsed;
                inputNum.value = parsed;
                this.applyAdjustments();
            });

            inputNum.addEventListener('input', (e) => {
                let parsed = parseInt(e.target.value) || 0;
                if (parsed < -100) parsed = -100;
                if (parsed > 100) parsed = 100;
                this.adjustments[prop] = parsed;
                range.value = parsed;
                this.applyAdjustments();
            });
        };
        updateAdjustment('brightness', 'brightness');
        updateAdjustment('contrast', 'contrast');
        updateAdjustment('saturation', 'saturation');

        document.getElementById('btn-reset-adj').addEventListener('click', () => {
            this.adjustments = { ...this.adjustments, brightness: 0, contrast: 0, saturation: 0 };
            ['brightness', 'contrast', 'saturation'].forEach(prop => {
                document.getElementById(`adj-${prop}`).value = 0;
                document.getElementById(`val-${prop}`).value = 0;
            });
            this.applyAdjustments();
        });

        // Transforms
        document.getElementById('btn-rotate-ccw').addEventListener('click', () => { this.adjustments.rotation -= 90; this.applyAdjustments(); this.saveState(); });
        document.getElementById('btn-rotate-cw').addEventListener('click', () => { this.adjustments.rotation += 90; this.applyAdjustments(); this.saveState(); });
        document.getElementById('btn-flip-h').addEventListener('click', () => { this.adjustments.flipH *= -1; this.applyAdjustments(); this.saveState(); });
        document.getElementById('btn-flip-v').addEventListener('click', () => { this.adjustments.flipV *= -1; this.applyAdjustments(); this.saveState(); });

        // History
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());

        // Save/Export
        const exportPopover = document.getElementById('export-popover');
        const exportFilenameInput = document.getElementById('export-filename');
        const btnConfirmExport = document.getElementById('btn-confirm-export');
        const btnExport = document.getElementById('btn-export');

        btnExport.addEventListener('click', () => {
            if (!this.image) return;

            let defaultName = 'edited-photo';
            if (this.currentFileName) {
                const parts = this.currentFileName.split('.');
                if (parts.length > 1) parts.pop();
                defaultName = parts.join('.') + '_edited';
            }
            exportFilenameInput.value = defaultName;

            if (exportPopover.classList.contains('hidden')) {
                exportPopover.classList.remove('hidden');
                exportFilenameInput.focus();
                exportFilenameInput.select();
            } else {
                exportPopover.classList.add('hidden');
            }
        });

        btnConfirmExport.addEventListener('click', () => {
            const fileName = exportFilenameInput.value.trim() || 'edited-photo';
            exportPopover.classList.add('hidden');
            this.exportImage(fileName);
        });

        document.addEventListener('mousedown', (e) => {
            if (!exportPopover.classList.contains('hidden')) {
                if (!exportPopover.contains(e.target) && !btnExport.contains(e.target)) {
                    exportPopover.classList.add('hidden');
                }
            }
        });

        exportFilenameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                btnConfirmExport.click();
            } else if (e.key === 'Escape') {
                exportPopover.classList.add('hidden');
            }
        });

        // 手機版影像調整 bottom sheet
        const scrim = document.getElementById('mobile-scrim');
        const setPropsOpen = (open) => {
            document.body.classList.toggle('props-open', open);
            if (scrim) scrim.classList.toggle('hidden', !open);
        };
        const btnPropsToggle = document.getElementById('btn-props-toggle');
        if (btnPropsToggle) {
            btnPropsToggle.addEventListener('click', () => {
                setPropsOpen(!document.body.classList.contains('props-open'));
            });
        }
        const btnAttrCollapse = document.getElementById('btn-attr-collapse');
        if (btnAttrCollapse) {
            btnAttrCollapse.addEventListener('click', () => {
                const collapsed = document.body.classList.toggle('attrs-collapsed');
                btnAttrCollapse.setAttribute('aria-expanded', String(!collapsed));
                btnAttrCollapse.setAttribute('aria-label',
                    collapsed ? '展開工具設定' : '收合工具設定');
            });
        }

        const btnCloseProps = document.getElementById('btn-close-props');
        if (btnCloseProps) btnCloseProps.addEventListener('click', () => setPropsOpen(false));
        if (scrim) scrim.addEventListener('click', () => setPropsOpen(false));

        // Batch toggle
        document.getElementById('btn-batch-toggle').addEventListener('click', () => {
            document.getElementById('batch-panel').classList.toggle('hidden');
        });
        document.getElementById('btn-close-batch').addEventListener('click', () => {
            document.getElementById('batch-panel').classList.add('hidden');
        });
        document.getElementById('btn-batch-apply').addEventListener('click', () => this.processBatch());

        // Direct Convert
        document.getElementById('btn-direct-convert').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*';
            input.onchange = (e) => this.directConvert(Array.from(e.target.files));
            input.click();
        });

        // Canvas pointer events：滑鼠、觸控、觸控筆共用同一組 handler。
        // 用 mousedown/mousemove 的話，手機上拖曳完全收不到事件。
        this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));

        // Right click Context Menu for text objects
        this.canvas.addEventListener('contextmenu', (e) => {
            if (this.activeTool === 'text' && this.selectedTextObject && !this.activeTextInput) {
                const coords = this.getCanvasCoords(e);
                const obj = this.selectedTextObject;
                if (coords.x >= obj.x && coords.x <= obj.x + obj.width &&
                    coords.y >= obj.y && coords.y <= obj.y + obj.height) {
                    e.preventDefault();
                    if (confirm('是否將選取的文字合併至畫布？ (成為點陣圖)')) {
                        this.flattenTextObject(obj);
                    }
                }
            }
        });

        // Handle cursor visibility bounds
        this.canvas.addEventListener('mouseenter', () => {
            if (this.brushCursor && (this.activeTool === 'pen' || this.activeTool === 'eraser' || this.activeTool === 'mosaic') && this.image) {
                this.updateBrushCursorSize(); // Update size when entering
                this.brushCursor.style.opacity = '1';
                this.brushCursor.classList.remove('hidden');
            }
        });
        this.canvas.addEventListener('mouseleave', () => {
            if (this.brushCursor) {
                this.brushCursor.style.opacity = '0';
                this.brushCursor.classList.add('hidden');
            }
        });

        window.addEventListener('pointermove', this.onPointerMove.bind(this), { passive: false });
        window.addEventListener('pointerup', this.onPointerUp.bind(this));
        window.addEventListener('pointercancel', this.onPointerUp.bind(this));

        // 手機上瀏覽器的手勢（雙指縮放整頁、下拉刷新）不能吃掉畫布操作
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        // Global Keyboard shortcuts
        const isTypingTarget = (el) => !!el && (
            el.isContentEditable ||
            el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.tagName === 'SELECT'
        );

        document.addEventListener('keydown', (e) => {
            if (this.activeTextInput) return;
            // 使用者正在輸入框打字時，鍵盤是他的，不是快捷鍵的。
            // 沒有這道閘門，輸入「portrait」會依序觸發 P(畫筆) O(圓形) T(文字)，
            // 而 Backspace 會刪掉畫布上選取中的文字物件。
            if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;

            // Delete selected text object
            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedTextObject) {
                this.deleteTextObject(this.selectedTextObject);
                e.preventDefault();
                return;
            }

            // Undo / Redo
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redo();
            }
            // Tool Shortcuts
            else if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
                const key = e.key.toLowerCase();
                const toolMap = {
                    'v': 'select',
                    'c': 'crop',
                    'p': 'pen',
                    'e': 'eraser',
                    't': 'text',
                    'r': 'rect',
                    'o': 'circle',
                    'm': 'mosaic'
                };

                if (toolMap[key]) {
                    e.preventDefault();
                    // Because rect/circle have toggle logic inside the click handler, calling .click() on the corresponding tool button already toggles it if activeTool starts with the tool name
                    const toolBtn = document.querySelector(`.tool-btn[data-tool="${toolMap[key]}"]`);
                    if (toolBtn) toolBtn.click();
                }
            }
        });
    }
});
