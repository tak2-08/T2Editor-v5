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
        this.currentSize = 8;
        this.history = [];
        this.historyStep = -1;
        this.dpr = 1;
        console.log('T2DrawPlugin initialized');
    }

    handleCommand(command, button) {
        if (command === 'insertDrawing') {
            const placeholderBlock = this.createPlaceholderBlock();
            this.insertPlaceholderAtCursor(placeholderBlock);
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
        if (existingOverlay) existingOverlay.remove();
        
        this.currentDrawingBlock = existingBlock;
        const isPlaceholder = existingBlock?.dataset.placeholder === 'true';
        
        const overlay = document.createElement('div');
        overlay.className = 't2-modal-overlay';
        overlay.style.touchAction = 'none';
        
        const modal = document.createElement('div');
        modal.className = 't2-draw-modal-v2';
        modal.style.touchAction = 'none';
        modal.innerHTML = `
            <div class="t2-draw-header-v2">
                <h2 class="t2-draw-title">${isPlaceholder ? '그림 그리기' : '그림 수정'}</h2>
                <button class="t2-draw-close-v2" data-action="close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            
            <!-- Mobile/Tablet Toolbar -->
            <div class="t2-draw-toolbar-mobile">
                <div class="t2-draw-toolbar-scroll">
                    <div class="t2-draw-tools-mobile">
                        <button class="t2-draw-tool-v2 active" data-tool="pen" title="펜">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="t2-draw-tool-v2" data-tool="eraser" title="지우개">
                            <span class="material-icons">auto_fix_high</span>
                        </button>
                    </div>
                    
                    <div class="t2-draw-brush-control">
                        <div class="t2-brush-preview" style="width: 8px; height: 8px; background-color: #000000;"></div>
                        <input type="range" class="t2-draw-size-slider" min="1" max="50" value="8">
                        <span class="t2-brush-size-text">8px</span>
                    </div>
                    
                    <div class="t2-draw-actions-mobile">
                        <button class="t2-draw-action-v2" data-action="undo" title="실행취소" disabled>
                            <span class="material-icons">undo</span>
                        </button>
                        <button class="t2-draw-action-v2" data-action="redo" title="다시실행" disabled>
                            <span class="material-icons">redo</span>
                        </button>
                        <button class="t2-draw-action-v2" data-action="clear" title="전체 지우기">
                            <span class="material-icons">delete_sweep</span>
                        </button>
                    </div>
                    
                    <div class="t2-draw-colors-mobile">
                        <div class="t2-color-swatch active" data-color="#000000" style="background: #000000;"></div>
                        <div class="t2-color-swatch" data-color="#ef4444" style="background: #ef4444;"></div>
                        <div class="t2-color-swatch" data-color="#3b82f6" style="background: #3b82f6;"></div>
                        <div class="t2-color-swatch" data-color="#22c55e" style="background: #22c55e;"></div>
                        <div class="t2-color-swatch" data-color="#facc15" style="background: #facc15;"></div>
                        <div class="t2-color-swatch" data-color="#a855f7" style="background: #a855f7;"></div>
                        <input type="color" class="t2-draw-color-picker" value="#000000">
                    </div>
                </div>
            </div>
            
            <div class="t2-draw-content-wrapper">
                <!-- Desktop Sidebar -->
                <div class="t2-draw-sidebar-desktop">
                    <div class="t2-draw-tools-desktop">
                        <button class="t2-draw-tool-v2 active" data-tool="pen" title="펜">
                            <span class="material-icons">edit</span>
                        </button>
                        <button class="t2-draw-tool-v2" data-tool="eraser" title="지우개">
                            <span class="material-icons">auto_fix_high</span>
                        </button>
                    </div>
                    
                    <div class="t2-draw-brush-control-desktop">
                        <div class="t2-brush-preview-desktop" style="width: 8px; height: 8px; background-color: #000000;"></div>
                        <input type="range" class="t2-draw-size-slider-desktop" min="1" max="50" value="8">
                        <span class="t2-brush-size-text-desktop">8px</span>
                    </div>
                    
                    <div class="t2-draw-actions-desktop">
                        <button class="t2-draw-action-v2" data-action="undo" title="실행취소" disabled>
                            <span class="material-icons">undo</span>
                        </button>
                        <button class="t2-draw-action-v2" data-action="redo" title="다시실행" disabled>
                            <span class="material-icons">redo</span>
                        </button>
                        <button class="t2-draw-action-v2" data-action="clear" title="전체 지우기">
                            <span class="material-icons">delete_sweep</span>
                        </button>
                    </div>
                    
                    <div class="t2-draw-colors-desktop">
                        <div class="t2-color-swatch active" data-color="#000000" style="background: #000000;"></div>
                        <div class="t2-color-swatch" data-color="#ef4444" style="background: #ef4444;"></div>
                        <div class="t2-color-swatch" data-color="#3b82f6" style="background: #3b82f6;"></div>
                        <div class="t2-color-swatch" data-color="#22c55e" style="background: #22c55e;"></div>
                        <input type="color" class="t2-draw-color-picker" value="#000000">
                    </div>
                </div>
                
                <!-- Canvas Area -->
                <div class="t2-draw-canvas-area" style="touch-action: none; user-select: none; -webkit-user-select: none;">
                    <canvas class="t2-draw-canvas-v2" width="800" height="600" style="touch-action: none;"></canvas>
                </div>
            </div>
            
            <div class="t2-draw-footer-v2">
                <button class="t2-btn-cancel-v2" data-action="cancel">취소</button>
                <button class="t2-btn-primary-v2" data-action="insert">${isPlaceholder ? '추가하기' : '수정 완료'}</button>
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
        this.canvas = modal.querySelector('.t2-draw-canvas-v2');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // 고해상도 캔버스 설정
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = 800;
        const displayHeight = 600;
        
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        this.canvas.style.touchAction = 'none';
        
        this.ctx.scale(dpr, dpr);
        this.dpr = dpr;
        
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
        const dpr = this.dpr || 1;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.fillStyle = '#ffffff';
    }

    loadExistingImage(existingBlock) {
        const img = existingBlock.querySelector('img');
        if (img && img.src && !img.src.startsWith('data:image/png;base64,iVBOR')) {
            const tempImg = new Image();
            const imgUrl = new URL(img.src, window.location.href);
            const isSameOrigin = imgUrl.origin === window.location.origin;
            
            if (!isSameOrigin) tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = () => {
                try {
                    const dpr = this.dpr || 1;
                    const displayWidth = 800;
                    const displayHeight = 600;
                    
                    this.canvas.width = displayWidth * dpr;
                    this.canvas.height = displayHeight * dpr;
                    this.canvas.style.width = displayWidth + 'px';
                    this.canvas.style.height = displayHeight + 'px';
                    
                    this.resetContext();
                    this.fillWhiteBackground();
                    
                    // 이미지를 캔버스에 맞춰서 그리기
                    this.ctx.drawImage(tempImg, 0, 0, displayWidth, displayHeight);
                    
                    this.saveHistory();
                    this.updateHistoryButtons();
                } catch (error) {
                    console.error('Image drawing error:', error);
                    this.fillWhiteBackground();
                    this.saveHistory();
                }
            };
            
            tempImg.onerror = () => {
                this.fillWhiteBackground();
                this.saveHistory();
            };
            
            tempImg.src = img.src;
        } else {
            this.fillWhiteBackground();
            this.saveHistory();
        }
    }

    fillWhiteBackground() {
        this.resetContext();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    }

    setupDrawingEvents() {
        let lastX = 0, lastY = 0;
        let lastMidX = 0, lastMidY = 0;
        let isFirstPoint = true;
        
        const getCanvasCoordinates = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            return { x, y };
        };
        
        const startDrawing = (e) => {
            const coords = getCanvasCoordinates(e);
            
            this.isDrawing = true;
            isFirstPoint = true;
            this.ctx.beginPath();
            this.ctx.moveTo(coords.x, coords.y);
            lastX = coords.x;
            lastY = coords.y;
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            
            const coords = getCanvasCoordinates(e);
            
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
            
            // 베지어 곡선으로 부드러운 선 그리기
            if (isFirstPoint) {
                this.ctx.lineTo(coords.x, coords.y);
                isFirstPoint = false;
            } else {
                const midX = (lastX + coords.x) / 2;
                const midY = (lastY + coords.y) / 2;
                
                this.ctx.quadraticCurveTo(lastX, lastY, midX, midY);
                
                lastMidX = midX;
                lastMidY = midY;
            }
            
            this.ctx.stroke();
            lastX = coords.x;
            lastY = coords.y;
        };

        const stopDrawing = () => {
            if (this.isDrawing) {
                // 마지막 포인트까지 그리기
                if (!isFirstPoint) {
                    this.ctx.lineTo(lastX, lastY);
                    this.ctx.stroke();
                }
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
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });
    }

    setupEventListeners(modal, overlay) {
        // Tool buttons
        modal.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.t2-draw-tool-v2').forEach(b => b.classList.remove('active'));
                modal.querySelectorAll(`[data-tool="${btn.dataset.tool}"]`).forEach(b => b.classList.add('active'));
                this.currentTool = btn.dataset.tool;
            });
        });
        
        // Color swatches
        modal.querySelectorAll('.t2-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                modal.querySelectorAll('.t2-color-swatch').forEach(s => s.classList.remove('active'));
                modal.querySelectorAll(`[data-color="${swatch.dataset.color}"]`).forEach(s => s.classList.add('active'));
                this.currentColor = swatch.dataset.color;
                modal.querySelectorAll('.t2-draw-color-picker').forEach(p => p.value = this.currentColor);
                this.updateBrushPreviews();
            });
        });
        
        // Color pickers
        modal.querySelectorAll('.t2-draw-color-picker').forEach(picker => {
            picker.addEventListener('input', (e) => {
                this.currentColor = e.target.value;
                modal.querySelectorAll('.t2-draw-color-picker').forEach(p => p.value = this.currentColor);
                modal.querySelectorAll('.t2-color-swatch').forEach(s => s.classList.remove('active'));
                this.updateBrushPreviews();
            });
        });
        
        // Size sliders
        const updateSize = (value) => {
            this.currentSize = parseInt(value);
            modal.querySelectorAll('.t2-draw-size-slider, .t2-draw-size-slider-desktop').forEach(s => s.value = value);
            this.updateBrushPreviews();
        };
        
        modal.querySelectorAll('.t2-draw-size-slider, .t2-draw-size-slider-desktop').forEach(slider => {
            slider.addEventListener('input', (e) => updateSize(e.target.value));
        });
        
        // Actions
        modal.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                switch(action) {
                    case 'close':
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
        
        this.updateBrushPreviews();
    }

    updateBrushPreviews() {
        const modal = this.canvas.closest('.t2-draw-modal-v2');
        if (!modal) return;
        
        modal.querySelectorAll('.t2-brush-preview, .t2-brush-preview-desktop').forEach(preview => {
            preview.style.width = this.currentSize + 'px';
            preview.style.height = this.currentSize + 'px';
            preview.style.backgroundColor = this.currentColor;
        });
        
        modal.querySelectorAll('.t2-brush-size-text, .t2-brush-size-text-desktop').forEach(text => {
            text.textContent = this.currentSize + 'px';
        });
    }

    handleCancel(overlay) {
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
        const modal = this.canvas.closest('.t2-draw-modal-v2');
        if (!modal) return;
        
        modal.querySelectorAll('[data-action="undo"]').forEach(btn => {
            btn.disabled = this.historyStep <= 0;
        });
        
        modal.querySelectorAll('[data-action="redo"]').forEach(btn => {
            btn.disabled = this.historyStep >= this.history.length - 1;
        });
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
            
            const blob = await new Promise((resolve, reject) => {
                this.canvas.toBlob((b) => {
                    if (b && b.size > 0) resolve(b);
                    else reject(new Error('Empty blob'));
                }, 'image/png', 1.0);
            });
            
            const fileName = `drawing_${Date.now()}.png`;
            const file = new File([blob], fileName, { type: blob.type });
            
            const formData = new FormData();
            formData.append('bf_file[]', file);
            formData.append('uid', this.editor.generateUid());
            
            const response = await fetch(`${t2editor_url}/plugin/image/image_upload.php`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            
            const data = await response.json();
            
            if (data.success && data.files && data.files.length > 0) {
                this.updateDrawingBlock(data.files[0]);
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
            
            const loadingIndicator = container.querySelector('.t2-drawing-loading');
            if (loadingIndicator) loadingIndicator.remove();
        }
        
        delete this.currentDrawingBlock.dataset.placeholder;
        
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
        blocks.forEach(block => this.setupDrawingBlockEvents(block));
    }

    closeModal(overlay) {
        if (overlay && overlay.parentNode) overlay.remove();
        this.canvas = null;
        this.ctx = null;
        this.history = [];
        this.historyStep = -1;
        this.currentDrawingBlock = null;
    }

    onContentSet(html) {
        setTimeout(() => this.initializeDrawingBlocks(), 100);
    }
}

window.T2DrawPlugin = T2DrawPlugin;