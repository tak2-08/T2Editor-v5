//Path: T2Editor/plugin/image/image.js

class T2ImagePlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertImage'];
        this.config = null;
        this.uploadQueue = [];
        this.maxConcurrentUploads = 3;
        this.currentUploads = 0;
        this.maxRetries = 3;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch(`${t2editor_url}/config/get_upload_config.php`);
            this.config = await response.json();
        } catch (error) {
            console.error('Failed to load upload config:', error);
            this.config = {
                maxUploadSize: 50,
                allowedExtensions: {
                    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']
                },
                acceptStrings: {
                    image: '.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.ico'
                }
            };
        }
    }

    handleCommand(command, button) {
        switch(command) {
            case 'insertImage':
                this.showImageUploadModal();
                break;
        }
    }

    async handlePaste(clipboardData) {
        if (clipboardData.items) {
            const imageFiles = [];
            
            for (let i = 0; i < clipboardData.items.length; i++) {
                const item = clipboardData.items[i];
                
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    if (file) {
                        imageFiles.push(file);
                    }
                }
            }
            
            if (imageFiles.length > 0) {
                await this.handleMultipleImageInsert(imageFiles);
                return true;
            }
        }
        return false;
    }

    onContentSet(html) {
        setTimeout(() => {
            this.initializeImageBlocks();
        }, 100);
    }

    showImageUploadModal() {
        if (!this.config) {
            T2Utils.showNotification('설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
            return;
        }

        const modalContent = `
            <div class="t2-image-editor-modal">
                <h3>이미지 추가</h3>
                <div class="t2-image-tabs">
                    <button class="t2-tab active" data-tab="upload">파일 업로드</button>
                    <button class="t2-tab" data-tab="url">이미지 URL</button>
                </div>
                <div class="t2-tab-content">
                    <div class="t2-tab-pane active" data-pane="upload">
                        <div class="t2-image-preview-grid"></div>
                        <form enctype="multipart/form-data" method="post" class="t2-image-upload-form">
                            <div class="t2-image-upload-area">
                                <span class="material-icons">cloud_upload</span>
                                <div class="t2-image-upload-text">클릭하여 이미지 선택</div>
                                <div class="t2-image-upload-hint">(또는 이미지를 여기로 드래그하세요)<br>최대 ${this.config.maxUploadSize}MB (최대 15개)</div>
                                <input type="file" name="bf_file[]" accept="${this.config.acceptStrings.image}" multiple>
                                <input type="hidden" name="uid" value="${this.editor.generateUid()}">
                            </div>
                        </form>
                    </div>
                    <div class="t2-tab-pane" data-pane="url">
                        <div class="t2-url-input-container">
                            <input type="text" class="t2-image-url-input" placeholder="이미지 URL을 입력하세요">
                            <div class="t2-url-preview"></div>
                        </div>
                    </div>
                </div>
                <div class="t2-btn-group">
                    <button type="button" class="t2-btn" data-action="cancel">취소</button>
                    <button type="button" class="t2-btn" data-action="upload" disabled>추가</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupModalEvents(modal);
    }

    setupModalEvents(modal) {
        const previewGrid = modal.querySelector('.t2-image-preview-grid');
        const fileInput = modal.querySelector('input[type="file"]');
        const uploadBtn = modal.querySelector('[data-action="upload"]');
        const uploadArea = modal.querySelector('.t2-image-upload-area');
        const form = modal.querySelector('.t2-image-upload-form');
        const urlInput = modal.querySelector('.t2-image-url-input');
        const urlPreview = modal.querySelector('.t2-url-preview');
        
        const previewFiles = new Map();
        let imageUrl = '';

        modal.querySelectorAll('.t2-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                modal.querySelectorAll('.t2-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const targetPane = tab.dataset.tab;
                modal.querySelectorAll('.t2-tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                    if (pane.dataset.pane === targetPane) {
                        pane.classList.add('active');
                    }
                });

                if (targetPane === 'upload') {
                    uploadBtn.disabled = previewFiles.size === 0;
                } else {
                    uploadBtn.disabled = !imageUrl;
                }
            });
        });

        let urlPreviewDebounce;
        urlInput.addEventListener('input', (e) => {
            const url = e.target.value.trim();
            clearTimeout(urlPreviewDebounce);
            
            urlPreviewDebounce = setTimeout(() => {
                if (url) {
                    const img = new Image();
                    img.onload = () => {
                        imageUrl = url;
                        urlPreview.innerHTML = `
                            <div class="t2-url-preview-image">
                                <img src="${url}" alt="URL Preview">
                            </div>
                        `;
                        uploadBtn.disabled = false;
                    };
                    img.onerror = () => {
                        imageUrl = '';
                        urlPreview.innerHTML = `
                            <div class="t2-url-preview-error">
                                올바른 이미지 URL이 아닙니다
                            </div>
                        `;
                        uploadBtn.disabled = true;
                    };
                    img.src = url;
                } else {
                    imageUrl = '';
                    urlPreview.innerHTML = '';
                    uploadBtn.disabled = true;
                }
            }, 300);
        });

        const handleFiles = (files) => {
            const remainingSlots = 15 - previewFiles.size;
            const filesToProcess = Array.from(files).slice(0, remainingSlots);
            
            if (files.length > remainingSlots) {
                T2Utils.showNotification(`최대 15개까지만 업로드할 수 있습니다. ${filesToProcess.length}개만 추가됩니다.`, 'warning');
            }

            filesToProcess.forEach(file => {
                if (!this.validateImageFile(file)) {
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewItem = document.createElement('div');
                    previewItem.className = 't2-preview-item';
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <button type="button" class="t2-preview-remove">
                            <span class="material-icons">close</span>
                        </button>
                    `;

                    const removeBtn = previewItem.querySelector('.t2-preview-remove');
                    removeBtn.onclick = () => {
                        previewFiles.delete(file);
                        previewItem.remove();
                        uploadBtn.disabled = previewFiles.size === 0;
                    };

                    previewFiles.set(file, previewItem);
                    previewGrid.appendChild(previewItem);
                    uploadBtn.disabled = false;
                };
                reader.readAsDataURL(file);
            });
        };

        fileInput.onchange = (e) => handleFiles(e.target.files);
        T2Utils.setupDragAndDrop(uploadArea, handleFiles);
        modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();

        modal.querySelector('[data-action="upload"]').onclick = () => {
            const activeTab = modal.querySelector('.t2-tab.active').dataset.tab;
            
            if (activeTab === 'upload') {
                if (previewFiles.size > 0) {
                    this.handleMultipleImageInsert(Array.from(previewFiles.keys()));
                }
            } else if (activeTab === 'url' && imageUrl) {
                this.handleUrlImageUpload(imageUrl);
            }
            
            modal.remove();
        };
    }

    validateImageFile(file) {
        if (!this.config) {
            T2Utils.showNotification('설정을 불러오는 중입니다.', 'warning');
            return false;
        }

        const fileExt = file.name.toLowerCase().split('.').pop();
        
        if (!this.config.allowedExtensions.image.includes(fileExt)) {
            T2Utils.showNotification('지원하지 않는 이미지 형식입니다.', 'error');
            return false;
        }
        
        const maxSize = this.config.maxUploadSize * 1024 * 1024;
        if (file.size > maxSize) {
            T2Utils.showNotification(`파일 크기가 너무 큽니다. (최대 ${this.config.maxUploadSize}MB)`, 'error');
            return false;
        }
        
        return true;
    }

    async processImageFile(file) {
        if (!this.validateImageFile(file)) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Url = e.target.result;
                const img = new Image();
                
                img.onload = () => {
                    const blockId = this.generateBlockId();
                    const imageData = {
                        url: base64Url,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        blockId: blockId,
                        isUploading: true,
                        file: file
                    };
                    resolve(imageData);
                };
                
                img.onerror = () => reject(new Error('이미지 로드 실패'));
                img.src = base64Url;
            };
            
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsDataURL(file);
        });
    }

    async handleMultipleImageInsert(files) {
        try {
            const imageDataArray = await Promise.all(
                files.map(file => this.processImageFile(file))
            );
            
            const validImages = imageDataArray.filter(data => data !== null);
            
            if (validImages.length > 0) {
                this.insertImageBlocks(validImages);
                
                validImages.forEach(imageData => {
                    this.queueUpload(imageData.file, imageData.blockId);
                });
            }
        } catch (error) {
            console.error('Multiple image insert error:', error);
            T2Utils.showNotification('일부 이미지 처리에 실패했습니다.', 'error');
        }
    }

    queueUpload(file, blockId, retryCount = 0) {
        this.uploadQueue.push({ file, blockId, retryCount });
        this.processUploadQueue();
    }

    async processUploadQueue() {
        if (this.currentUploads >= this.maxConcurrentUploads || this.uploadQueue.length === 0) {
            return;
        }

        const uploadTask = this.uploadQueue.shift();
        this.currentUploads++;

        try {
            await this.uploadToServer(uploadTask.file, uploadTask.blockId);
        } catch (error) {
            console.error('Upload failed:', error);
            
            if (uploadTask.retryCount < this.maxRetries) {
                T2Utils.showNotification(`업로드 재시도 중... (${uploadTask.retryCount + 1}/${this.maxRetries})`, 'info');
                uploadTask.retryCount++;
                this.uploadQueue.unshift(uploadTask);
            } else {
                T2Utils.showNotification('이미지 업로드에 실패했습니다.', 'error');
                this.markUploadFailed(uploadTask.blockId);
            }
        } finally {
            this.currentUploads--;
            this.processUploadQueue();
        }
    }

    async uploadToServer(file, blockId) {
        const formData = new FormData();
        formData.append('bf_file[]', file);
        formData.append('uid', this.editor.generateUid());

        const response = await fetch(`${t2editor_url}/plugin/image/image_upload.php`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success && data.files.length > 0) {
            this.updateImageBlock(blockId, data.files[0]);
        } else {
            throw new Error(data.message || '업로드 실패');
        }
    }

    updateImageBlock(blockId, fileData) {
        const block = this.editor.editor.querySelector(`[data-block-id="${blockId}"]`);
        if (!block) return;

        const img = block.querySelector('img');
        if (img) {
            img.src = fileData.url;
            img.dataset.width = fileData.width;
            img.dataset.height = fileData.height;
        }

        block.removeAttribute('data-uploading');
        
        const uploadIndicator = block.querySelector('.t2-upload-indicator');
        if (uploadIndicator) {
            uploadIndicator.remove();
        }
    }

    markUploadFailed(blockId) {
        const block = this.editor.editor.querySelector(`[data-block-id="${blockId}"]`);
        if (!block) return;

        block.setAttribute('data-upload-failed', 'true');
        
        const uploadIndicator = block.querySelector('.t2-upload-indicator');
        if (uploadIndicator) {
            uploadIndicator.innerHTML = '<span class="material-icons" style="color: #f44336;">error</span>';
        }
    }

    async handleUrlImageUpload(url) {
        try {
            T2Utils.showNotification('이미지를 다운로드하고 있습니다...', 'info');
            
            const { blob, width, height } = await this.captureImage(url);
            
            const fileName = `image_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            if (!this.validateImageFile(file)) {
                return;
            }
            
            const formData = new FormData();
            formData.append('bf_file[]', file);
            formData.append('uid', this.editor.generateUid());

            const response = await fetch(`${t2editor_url}/plugin/image/image_upload.php`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.insertImageBlocks(data.files);
                T2Utils.showNotification('이미지가 성공적으로 추가되었습니다.', 'success');
            } else {
                throw new Error(data.message || '업로드 실패');
            }
        } catch (error) {
            console.error('URL image upload error:', error);
            T2Utils.showNotification('이미지 처리 중 오류가 발생했습니다.', 'error');
        }
    }

    async captureImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const container = document.createElement('div');
            container.style.cssText = 'position: fixed; left: -9999px; top: -9999px; visibility: hidden;';
            document.body.appendChild(container);

            const cleanup = () => {
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            };

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const maxSize = 2000;
                    let width = img.naturalWidth;
                    let height = img.naturalHeight;
                    
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        cleanup();
                        if (blob && blob.size > 0) {
                            resolve({ blob, width, height });
                        } else {
                            reject(new Error('빈 이미지'));
                        }
                    }, 'image/jpeg', 0.92);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            img.onerror = () => {
                cleanup();
                reject(new Error('이미지 로드 실패'));
            };

            img.crossOrigin = 'anonymous';
            img.src = url;
            container.appendChild(img);

            setTimeout(() => {
                cleanup();
                reject(new Error('시간 초과'));
            }, 10000);
        });
    }

    insertSingleImageBlock(imageData) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const currentBlock = this.editor.getClosestBlock(range.startContainer);
        
        if (currentBlock && currentBlock !== this.editor.editor) {
            const topBreak = document.createElement('p');
            topBreak.innerHTML = '<br>';
            currentBlock.parentNode.insertBefore(topBreak, currentBlock.nextSibling);
            
            const mediaBlock = this.createImageBlock(imageData);
            topBreak.parentNode.insertBefore(mediaBlock, topBreak.nextSibling);
            
            const bottomBreak = document.createElement('p');
            bottomBreak.innerHTML = '<br>';
            mediaBlock.parentNode.insertBefore(bottomBreak, mediaBlock.nextSibling);
            
            this.cleanupEmptyLines(mediaBlock);
            
            const newRange = document.createRange();
            newRange.setStartAfter(bottomBreak);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.editor.normalizeContent();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        }
    }

    insertImageBlocks(files) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const currentBlock = this.editor.getClosestBlock(range.startContainer);
        
        if (currentBlock && currentBlock !== this.editor.editor) {
            const topBreak = document.createElement('p');
            topBreak.innerHTML = '<br>';
            currentBlock.parentNode.insertBefore(topBreak, currentBlock.nextSibling);
            
            let lastElement = topBreak;
            
            files.forEach((file, index) => {
                const mediaBlock = this.createImageBlock(file);
                
                lastElement.parentNode.insertBefore(mediaBlock, lastElement.nextSibling);
                lastElement = mediaBlock;
                
                if (index < files.length - 1) {
                    const breakLine = document.createElement('p');
                    breakLine.innerHTML = '<br>';
                    lastElement.parentNode.insertBefore(breakLine, lastElement.nextSibling);
                    lastElement = breakLine;
                }
            });
            
            const bottomBreak = document.createElement('p');
            bottomBreak.innerHTML = '<br>';
            lastElement.parentNode.insertBefore(bottomBreak, lastElement.nextSibling);
            
            files.forEach((file, index) => {
                const blocks = this.editor.editor.querySelectorAll('.t2-media-block');
                if (blocks[blocks.length - files.length + index]) {
                    this.cleanupEmptyLines(blocks[blocks.length - files.length + index]);
                }
            });
            
            const newRange = document.createRange();
            newRange.setStartAfter(bottomBreak);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.editor.normalizeContent();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        }
    }

    createImageBlock(file) {
        const mediaBlock = document.createElement('div');
        mediaBlock.className = 't2-media-block';
        mediaBlock.contentEditable = false;
        
        if (file.blockId) {
            mediaBlock.setAttribute('data-block-id', file.blockId);
        }
        
        if (file.isUploading) {
            mediaBlock.setAttribute('data-uploading', 'true');
        }
        
        const container = document.createElement('div');
        container.style.width = file.width + 'px';
        container.style.maxWidth = '100%';
        container.style.margin = '0 auto';
        container.style.position = 'relative';
        
        const img = document.createElement('img');
        img.src = file.url;
        img.style.width = '100%';
        img.dataset.width = file.width;
        img.dataset.height = file.height;
        
        container.appendChild(img);
        
        if (file.isUploading) {
            const uploadIndicator = document.createElement('div');
            uploadIndicator.className = 't2-upload-indicator';
            uploadIndicator.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 5px;
            `;
            uploadIndicator.innerHTML = `
                <span class="material-icons" style="font-size: 14px; animation: spin 1s linear infinite;">sync</span>
                <span>업로드 중...</span>
            `;
            container.appendChild(uploadIndicator);
            
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            if (!document.querySelector('style[data-t2-spin]')) {
                style.setAttribute('data-t2-spin', 'true');
                document.head.appendChild(style);
            }
        }
        
        mediaBlock.appendChild(container);
        
        const controls = this.createMediaControls(container, img);
        mediaBlock.appendChild(controls);
        
        return mediaBlock;
    }

    createMediaControls(container, mediaElement) {
        const controls = document.createElement('div');
        controls.className = 't2-media-controls';
        controls.contentEditable = false;

        const width = parseInt(mediaElement.dataset.width) || parseInt(container.style.width) || 320;
        const height = parseInt(mediaElement.dataset.height) || parseInt(container.style.height) || 180;
        
        const editorWidth = this.editor.editor.clientWidth;
        const maxWidthPercentage = Math.min(100, Math.floor((editorWidth / width) * 100));
        const currentWidth = parseInt(container.style.width);
        const percentage = Math.round((currentWidth / width) * 100);

        controls.innerHTML = `
            <button class="t2-btn delete-btn">
                <span class="material-icons">delete</span>
            </button>
            <input type="range" min="30" max="${maxWidthPercentage}" value="${percentage}" class="size-slider" style="width: 100px;">
        `;

        const sizeSlider = controls.querySelector('.size-slider');
        if (sizeSlider) {
            const resizeObserver = new ResizeObserver(() => {
                const newEditorWidth = this.editor.editor.clientWidth;
                const newMaxPercentage = Math.min(100, Math.floor((newEditorWidth / width) * 100));
                sizeSlider.max = newMaxPercentage;
                
                if (parseInt(sizeSlider.value) > newMaxPercentage) {
                    sizeSlider.value = newMaxPercentage;
                    const newWidth = Math.round((width * newMaxPercentage) / 100);
                    container.style.width = `${newWidth}px`;
                    container.style.maxWidth = '100%';
                    mediaElement.style.width = '100%';
                }
            });
            
            resizeObserver.observe(this.editor.editor);

            sizeSlider.addEventListener('input', (e) => {
                const percentage = parseInt(e.target.value);
                const newWidth = Math.round((width * percentage) / 100);
                
                container.style.width = `${newWidth}px`;
                container.style.maxWidth = '100%';
                mediaElement.style.width = '100%';
                
                mediaElement.dataset.currentWidth = newWidth;
            });
        }

        const deleteBtn = controls.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mediaBlock = controls.closest('.t2-media-block');
                if (mediaBlock) {
                    mediaBlock.remove();
                    this.editor.createUndoPoint();
                    this.editor.autoSave();
                }
            });
        }

        return controls;
    }

    cleanupEmptyLines(imageBlock) {
        let prev = imageBlock.previousElementSibling;
        let emptyCount = 0;
        const toRemove = [];
        
        while (prev && prev.tagName === 'P' && 
               !prev.textContent.trim() && 
               (prev.innerHTML === '<br>' || prev.querySelector('br'))) {
            emptyCount++;
            if (emptyCount > 1) {
                toRemove.push(prev);
            }
            prev = prev.previousElementSibling;
        }
        
        let next = imageBlock.nextElementSibling;
        emptyCount = 0;
        
        while (next && next.tagName === 'P' && 
               !next.textContent.trim() && 
               (next.innerHTML === '<br>' || next.querySelector('br'))) {
            emptyCount++;
            if (emptyCount > 1) {
                toRemove.push(next);
            }
            next = next.nextElementSibling;
        }
        
        toRemove.forEach(el => el.remove());
    }

    initializeImageBlocks() {
        this.editor.editor.querySelectorAll('img:not(.t2-media-block img)').forEach(img => {
            const width = parseInt(img.style.width) || img.naturalWidth || 320;
            const height = parseInt(img.style.height) || img.naturalHeight || 180;
            
            const mediaBlock = this.createImageBlock({
                url: img.src,
                width: width,
                height: height
            });
            
            img.parentNode.replaceChild(mediaBlock, img);
            this.cleanupEmptyLines(mediaBlock);
        });

        this.editor.editor.querySelectorAll('.t2-media-block').forEach(block => {
            if (block.querySelector('iframe, video')) return;
            
            const container = block.querySelector('div:first-child');
            const mediaElement = container?.querySelector('img');
            
            if (mediaElement) {
                block.contentEditable = false;
                
                const currentWidth = parseInt(container.style.width) || 320;
                const currentHeight = parseInt(container.style.height) || 180;
                
                if (!container.style.maxWidth) {
                    container.style.maxWidth = '100%';
                }
                if (!container.style.margin) {
                    container.style.margin = '0 auto';
                }
                
                mediaElement.style.width = '100%';
                
                if (block.parentNode.nodeName === 'P') {
                    const p = block.parentNode;
                    p.parentNode.insertBefore(block, p);
                    p.remove();
                }
                
                const existingControls = block.querySelector('.t2-media-controls');
                if (existingControls) {
                    existingControls.remove();
                }
                const controls = this.createMediaControls(container, mediaElement);
                block.appendChild(controls);
                
                this.cleanupEmptyLines(block);
            }
        });
    }

    generateBlockId() {
        return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

window.T2ImagePlugin = T2ImagePlugin;