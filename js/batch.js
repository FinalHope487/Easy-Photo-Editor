Object.assign(PhotoEditor.prototype, {
    addFilesToBatch(files) {
        this.batchFiles.push(...files);
        this.updateBatchList();
        document.getElementById('batch-panel').classList.remove('hidden');
    },

    updateBatchList() {
        document.getElementById('batch-count').innerText = this.batchFiles.length;
        const listObj = document.getElementById('batch-list');
        listObj.innerHTML = '';
        this.batchFiles.forEach((file, index) => {
            const el = document.createElement('div');
            el.className = 'batch-item';
            el.innerHTML = `
                <span class="batch-item-name">${file.name}</span>
                <span class="batch-item-status" id="batch-status-${index}">待處理</span>
            `;
            listObj.appendChild(el);
        });
    },

    async processBatch() {
        const format = document.getElementById('export-format').value;
        const ext = format.split('/')[1];

        for (let i = 0; i < this.batchFiles.length; i++) {
            const file = this.batchFiles[i];
            const statusEl = document.getElementById(`batch-status-${i}`);
            statusEl.innerText = '處理中...';

            await this.processSingleFile(file, format, ext);
            statusEl.innerText = '完成';
            statusEl.classList.add('done');
        }
    },

    processSingleFile(file, format, ext) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Apply current adjustments
                    const tempCanvas = document.createElement('canvas');

                    const isRotated = Math.abs(this.adjustments.rotation) % 180 === 90;
                    tempCanvas.width = isRotated ? img.height : img.width;
                    tempCanvas.height = isRotated ? img.width : img.height;

                    const ctx = tempCanvas.getContext('2d');
                    ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
                    ctx.rotate(this.adjustments.rotation * Math.PI / 180);
                    ctx.scale(this.adjustments.flipH, this.adjustments.flipV);

                    const b = 100 + this.adjustments.brightness;
                    const c = 100 + this.adjustments.contrast;
                    const s = 100 + this.adjustments.saturation;
                    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

                    ctx.drawImage(img, -img.width / 2, -img.height / 2);

                    tempCanvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            // Provide original name without extension
                            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'auto_export';
                            a.download = `${baseName}_edited.${ext}`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(url), 100);
                        }
                        setTimeout(resolve, 300); // small delay to allow browser to handle download
                    }, format, 0.9);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    directConvert(files) {
        const format = document.getElementById('export-format').value;
        const ext = format.split('/')[1];

        files.forEach((file, i) => {
            setTimeout(() => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = img.width;
                        tempCanvas.height = img.height;
                        const ctx = tempCanvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        tempCanvas.toBlob((blob) => {
                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || `converted_${i}`;
                                a.download = `${baseName}_converted.${ext}`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(url), 100);
                            }
                        }, format, 0.9);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }, i * 300);
        });
    }
});
