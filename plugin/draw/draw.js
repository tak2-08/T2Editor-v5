//Path: T2Editor/plugin/draw/draw.js
class T2DrawPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertDrawing'];
        this.currentDrawingBlock = null;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentSize = 3;
        this.history = [];
        this.historyStep = -1;

        console.log('T2DrawPlugin initialized');
    }

    handleCommand(command, button) {
        if (command === 'insertDrawing') {
            // 현재 커서 위치에 빈 placeholder 블록 먼저 생성
            const placeholderBlock = this.createPlaceholderBlock();
            this.insertPlaceholderAtCursor(placeholderBlock);
            
            // 그 블록을 편집 모드로 열기
            this.openDrawingModal(placeholderBlock);
        }
    }

    createPlaceholderBlock() {
        const block = document.createElement('div');
        block.className = 't2-media-block t2-drawing-block';
        block.contentEditable = false;
        block.dataset.drawingBlock = 'true';
        block.dataset.placeholder = 'true';
        
        const container = document.createElement('div');
        container.style.width = '800px';
        container.style.maxWidth = '100%';
        container.style.margin = '0 auto';
        container.style.position = 'relative';
        container.dataset.originalWidth = '800';
        container.dataset.originalHeight = '600';
        
        const img = document.createElement('img');
        // 빈 투명 1x1 PNG
        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        img.alt = 'Drawing';
        img.dataset.width = '800';
        img.dataset.height = '600';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.minHeight = '100px';
        img.style.backgroundColor = '#f0f0f0';
        
        container.appendChild(img);
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 't2-drawing-loading';
        loadingIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 10px 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 4px;
            font-size: 14px;
        `;
        loadingIndicator.textContent = '그림을 그리는 중...';
        container.appendChild(loadingIndicator);
        
        block.appendChild(container);
        
        return block;
    }

    insertPlaceholderAtCursor(placeholderBlock) {
        try {
            const selection = window.getSelection();
            if (!selection.rangeCount) {
                this.editor.editor.appendChild(placeholderBlock);
                return;
            }
            
            const range = selection.getRangeAt(0);
            const currentBlock = this.editor.getClosestBlock(range.startContainer);
            
            if (currentBlock && currentBlock !== this.editor.editor) {
                currentBlock.parentNode.insertBefore(placeholderBlock, currentBlock.nextSibling);
            } else {
                this.editor.editor.appendChild(placeholderBlock);
            }
            
            // 빈 줄 추가
            const bottomBreak = document.createElement('p');
            bottomBreak.innerHTML = '<br>';
            placeholderBlock.parentNode.insertBefore(bottomBreak, placeholderBlock.nextSibling);
            
        } catch (error) {
            console.error('Placeholder insertion error:', error);
            this.editor.editor.appendChild(placeholderBlock);
        }
        
        this.editor.normalizeContent();
    }

    openDrawingModal(existingBlock = null) {
        const existingOverlay = document.querySelector('.t2-modal-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        this.currentDrawingBlock = existingBlock;
        const isPlaceholder = existingBlock?.dataset.placeholder === 'true';
        
        const overlay = document.createElement('div');
        overlay.className = 't2-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 't2-draw-modal';
        modal.innerHTML = `
            <div class="t2-draw-header">
                <h3>${isPlaceholder ? '그림 그리기' : '그림 수정'}</h3>
                <button class="t2-draw-close-btn" data-action="close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="t2-draw-toolbar">
                <div class="t2-draw-tool-group">
                    <button class="t2-draw-tool active" data-tool="pen" title="펜">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="t2-draw-tool" data-tool="eraser" title="지우개">
                        <span class="material-icons">auto_fix_high</span>
                    </button>
                </div>
                <div class="t2-draw-divider"></div>
                <div class="t2-draw-tool-group">
                    <select class="t2-draw-size">
                        <option value="1">1px</option>
                        <option value="2">2px</option>
                        <option value="3" selected>3px</option>
                        <option value="5">5px</option>
                        <option value="8">8px</option>
                        <option value="12">12px</option>
                        <option value="16">16px</option>
                    </select>
                    <label class="t2-draw-color-label">
                        <input type="color" class="t2-draw-color" value="#000000">
                        <span class="t2-draw-color-preview"></span>
                    </label>
                </div>
                <div class="t2-draw-divider"></div>
                <div class="t2-draw-tool-group">
                    <button class="t2-draw-action" data-action="undo" title="실행취소" disabled>
                        <span class="material-icons">undo</span>
                    </button>
                    <button class="t2-draw-action" data-action="redo" title="다시실행" disabled>
                        <span class="material-icons">redo</span>
                    </button>
                    <button class="t2-draw-action" data-action="clear" title="전체 지우기">
                        <span class="material-icons">delete_sweep</span>
                    </button>
                </div>
                <div class="t2-draw-divider"></div>
                <div class="t2-draw-tool-group">
                    <select class="t2-draw-canvas-size">
                        <option value="600x400">600×400</option>
                        <option value="800x600" selected>800×600</option>
                        <option value="1000x700">1000×700</option>
                        <option value="1200x800">1200×800</option>
                    </select>
                </div>
            </div>
            <div class="t2-draw-canvas-container">
                <canvas class="t2-draw-canvas" width="800" height="600"></canvas>
            </div>
            <div class="t2-draw-footer">
                <button class="t2-btn" data-action="cancel">취소</button>
                <button class="t2-btn t2-btn-primary" data-action="insert">${isPlaceholder ? '추가하기' : '수정 완료'}</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        this.setupCanvas(modal, existingBlock, isPlaceholder);
        this.setupEventListeners(modal, overlay);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.handleCancel(overlay);
            }
        });
    }

    setupCanvas(modal, existingBlock, isPlaceholder) {
        this.canvas = modal.querySelector('.t2-draw-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.resetContext();
        this.history = [];
        this.historyStep = -1;
        
        if (existingBlock && !isPlaceholder) {
            this.loadExistingImage(existingBlock);
        } else {
            this.fillWhiteBackground();
            this.saveHistory();
        }
        
        this.setupDrawingEvents();
    }

    resetContext() {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000000';
        this.ctx.fillStyle = '#ffffff';
    }

    loadExistingImage(existingBlock) {
        const img = existingBlock.querySelector('img');
        if (img && img.src && !img.src.startsWith('data:image/png;base64,iVBOR')) {
            const tempImg = new Image();
            
            const imgUrl = new URL(img.src, window.location.href);
            const isSameOrigin = imgUrl.origin === window.location.origin;
            
            if (!isSameOrigin) {
                tempImg.crossOrigin = 'anonymous';
            }
            
            tempImg.onload = () => {
                try {
                    this.canvas.width = tempImg.width;
                    this.canvas.height = tempImg.height;
                    
                    this.resetContext();
                    this.updateCanvasSizeSelector(tempImg.width, tempImg.height);
                    this.fillWhiteBackground();
                    this.ctx.drawImage(tempImg, 0, 0);
                    this.saveHistory();
                    this.updateHistoryButtons();
                } catch (error) {
                    console.error('Image drawing error:', error);
                    this.fillWhiteBackground();
                    this.saveHistory();
                    this.updateHistoryButtons();
                }
            };
            
            tempImg.onerror = (error) => {
                console.error('Image load error:', error);
                this.fillWhiteBackground();
                this.saveHistory();
                this.updateHistoryButtons();
            };
            
            tempImg.src = img.src;
        } else {
            this.fillWhiteBackground();
            this.saveHistory();
            this.updateHistoryButtons();
        }
    }

    updateCanvasSizeSelector(width, height) {
        const modal = this.canvas.closest('.t2-draw-modal');
        if (!modal) return;
        
        const sizeSelect = modal.querySelector('.t2-draw-canvas-size');
        const currentSize = `${width}x${height}`;
        let foundSize = false;
        
        for (let option of sizeSelect.options) {
            if (option.value === currentSize) {
                option.selected = true;
                foundSize = true;
                break;
            }
        }
        
        if (!foundSize) {
            const customOption = document.createElement('option');
            customOption.value = currentSize;
            customOption.text = currentSize;
            customOption.selected = true;
            sizeSelect.appendChild(customOption);
        }
    }

    fillWhiteBackground() {
        this.resetContext();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setupDrawingEvents() {
        const startDrawing = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            this.isDrawing = true;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            
            this.lastX = x;
            this.lastY = y;
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineWidth = this.currentSize;
            
            if (this.currentTool === 'pen') {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.currentColor;
            } else if (this.currentTool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.strokeStyle = 'rgba(0,0,0,1)';
            }
            
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        };

        const stopDrawing = () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.beginPath();
                this.saveHistory();
            }
        };

        this.canvas.addEventListener('mousedown', startDrawing);
        this.canvas.addEventListener('mousemove', draw);
        this.canvas.addEventListener('mouseup', stopDrawing);
        this.canvas.addEventListener('mouseout', stopDrawing);
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    setupEventListeners(modal, overlay) {
        modal.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                modal.querySelectorAll('.t2-draw-tool').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
            });
        });
        
        const colorInput = modal.querySelector('.t2-draw-color');
        const colorPreview = modal.querySelector('.t2-draw-color-preview');
        colorInput.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            colorPreview.style.backgroundColor = this.currentColor;
        });
        colorPreview.style.backgroundColor = this.currentColor;
        
        const sizeSelect = modal.querySelector('.t2-draw-size');
        sizeSelect.addEventListener('change', (e) => {
            this.currentSize = parseInt(e.target.value);
        });
        
        const canvasSizeSelect = modal.querySelector('.t2-draw-canvas-size');
        canvasSizeSelect.addEventListener('change', (e) => {
            const [width, height] = e.target.value.split('x').map(Number);
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            this.canvas.width = width;
            this.canvas.height = height;
            this.resetContext();
            this.fillWhiteBackground();
            this.ctx.putImageData(imageData, 0, 0);
            this.saveHistory();
        });
        
        modal.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                switch(action) {
                    case 'close':
                        this.handleCancel(overlay);
                        break;
                    case 'cancel':
                        this.handleCancel(overlay);
                        break;
                    case 'insert':
                        this.insertDrawing(overlay);
                        break;
                    case 'undo':
                        this.undo();
                        break;
                    case 'redo':
                        this.redo();
                        break;
                    case 'clear':
                        if (confirm('전체 내용을 지우시겠습니까?')) {
                            this.clearCanvas();
                        }
                        break;
                }
            });
        });
    }

    handleCancel(overlay) {
        // placeholder 블록이면 삭제
        if (this.currentDrawingBlock?.dataset.placeholder === 'true') {
            this.currentDrawingBlock.remove();
        }
        this.closeModal(overlay);
    }

    saveHistory() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        
        try {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.history.push({
                imageData: imageData,
                width: this.canvas.width,
                height: this.canvas.height
            });
        } catch (error) {
            console.error('History save error:', error);
        }
        
        this.updateHistoryButtons();
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.loadFromHistory();
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.loadFromHistory();
        }
    }

    loadFromHistory() {
        const historyItem = this.history[this.historyStep];
        if (historyItem && historyItem.imageData) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.putImageData(historyItem.imageData, 0, 0);
            this.updateHistoryButtons();
        }
    }

    updateHistoryButtons() {
        const modal = this.canvas.closest('.t2-draw-modal');
        if (!modal) return;
        
        const undoBtn = modal.querySelector('[data-action="undo"]');
        const redoBtn = modal.querySelector('[data-action="redo"]');
        
        if (undoBtn) undoBtn.disabled = this.historyStep <= 0;
        if (redoBtn) redoBtn.disabled = this.historyStep >= this.history.length - 1;
    }

    clearCanvas() {
        this.resetContext();
        this.fillWhiteBackground();
        this.saveHistory();
    }

    async insertDrawing(overlay) {
        try {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.beginPath();
            }
            
            this.resetContext();
            
            let blob = null;
            
            try {
                blob = await new Promise((resolve, reject) => {
                    this.canvas.toBlob((b) => {
                        if (b && b.size > 0) {
                            resolve(b);
                        } else {
                            reject(new Error('Empty blob'));
                        }
                    }, 'image/png', 1.0);
                });
            } catch (pngError) {
                blob = await new Promise((resolve, reject) => {
                    this.canvas.toBlob((b) => {
                        if (b && b.size > 0) {
                            resolve(b);
                        } else {
                            reject(new Error('Empty blob'));
                        }
                    }, 'image/jpeg', 0.95);
                });
            }
            
            if (!blob || blob.size === 0) {
                throw new Error('빈 이미지 생성');
            }
            
            const fileName = `drawing_${Date.now()}.png`;
            const file = new File([blob], fileName, { type: blob.type });
            
            const formData = new FormData();
            formData.append('bf_file[]', file);
            formData.append('uid', this.editor.generateUid());
            
            const response = await fetch(`${t2editor_url}/plugin/image/image_upload.php`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.files && data.files.length > 0) {
                const fileData = data.files[0];
                
                // 기존 블록 업데이트 (placeholder 포함)
                this.updateDrawingBlock(fileData);
                this.closeModal(overlay);
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Drawing upload error:', error);
            alert('그림 저장 중 오류:\n' + error.message);
        }
    }

    updateDrawingBlock(fileData) {
        if (!this.currentDrawingBlock) return;
        
        const img = this.currentDrawingBlock.querySelector('img');
        if (img) {
            img.src = fileData.url;
            img.dataset.width = fileData.width;
            img.dataset.height = fileData.height;
            img.style.backgroundColor = 'transparent';
            img.style.minHeight = 'auto';
        }
        
        const container = this.currentDrawingBlock.querySelector('div:first-child');
        if (container) {
            container.style.width = fileData.width + 'px';
            container.dataset.originalWidth = fileData.width;
            container.dataset.originalHeight = fileData.height;
            
            // 로딩 인디케이터 제거
            const loadingIndicator = container.querySelector('.t2-drawing-loading');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
        
        // placeholder 플래그 제거
        delete this.currentDrawingBlock.dataset.placeholder;
        
        // 컨트롤 추가 (placeholder였을 경우)
        if (!this.currentDrawingBlock.querySelector('.t2-media-controls')) {
            const controls = document.createElement('div');
            controls.className = 't2-media-controls';
            controls.contentEditable = false;
            controls.innerHTML = `
                <button class="t2-btn t2-edit-drawing" title="그림 수정">
                    <span class="material-icons">edit</span>
                </button>
                <button class="t2-btn delete-btn" title="그림 삭제">
                    <span class="material-icons">delete</span>
                </button>
            `;
            this.currentDrawingBlock.appendChild(controls);
            this.setupDrawingBlockEvents(this.currentDrawingBlock);
        }
        
        this.editor.createUndoPoint();
        this.editor.autoSave();
    }

    setupDrawingBlockEvents(block) {
        if (block.dataset.drawingEventsSet === 'true') return;
        
        const editBtn = block.querySelector('.t2-edit-drawing');
        const deleteBtn = block.querySelector('.delete-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openDrawingModal(block);
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('이 그림을 삭제하시겠습니까?')) {
                    block.remove();
                    this.editor.createUndoPoint();
                }
            });
        }
        
        block.dataset.drawingEventsSet = 'true';
    }

    initializeDrawingBlocks() {
        const blocks = this.editor.editor.querySelectorAll('.t2-drawing-block');
        blocks.forEach(block => {
            this.setupDrawingBlockEvents(block);
        });
    }

    closeModal(overlay) {
        if (overlay && overlay.parentNode) {
            overlay.remove();
        }
        this.canvas = null;
        this.ctx = null;
        this.history = [];
        this.historyStep = -1;
        this.currentDrawingBlock = null;
    }

    onContentSet(html) {
        setTimeout(() => {
            this.initializeDrawingBlocks();
        }, 100);
    }
}

window.T2DrawPlugin = T2DrawPlugin;