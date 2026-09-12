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

    async handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return false;
        
        const imageFiles = [];
        
        if (clipboardData.items) {
            for (let i = 0; i < clipboardData.items.length; i++) {
                const item = clipboardData.items[i];
                
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    if (file) {
                        imageFiles.push(file);
                    }
                }
            }
        }
        
        if (imageFiles.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            
            this.editor.saveSelection();
            
            await this.handleMultipleImageInsert(imageFiles, true);
            return true;
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
                <div class="t2-image-upload-area">
                    <span class="material-icons">cloud_upload</span>
                    <div class="t2-image-upload-text">클릭하여 이미지 선택</div>
                    <div class="t2-image-upload-hint">(또는 이미지를 여기로 드래그하세요)<br>최대 ${this.config.maxUploadSize}MB (최대 15개)</div>
                    <input type="file" name="bf_file[]" accept="${this.config.acceptStrings.image}" multiple>
                    <input type="hidden" name="uid" value="${this.editor.generateUid()}">
                </div>
                <div class="t2-image-preview-grid"></div>
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
        
        const previewFiles = new Map();

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
                    removeBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
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
            if (previewFiles.size > 0) {
                this.handleMultipleImageInsert(Array.from(previewFiles.keys()), false);
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

    async convertToWebP(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const webpReader = new FileReader();
                                webpReader.onload = (e) => {
                                    resolve({
                                        base64Url: e.target.result,
                                        width: img.naturalWidth,
                                        height: img.naturalHeight
                                    });
                                };
                                webpReader.onerror = () => reject(new Error('WebP 변환 실패'));
                                webpReader.readAsDataURL(blob);
                            } else {
                                reject(new Error('Blob 생성 실패'));
                            }
                        },
                        'image/webp',
                        quality
                    );
                };
                
                img.onerror = () => reject(new Error('이미지 로드 실패'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsDataURL(file);
        });
    }

    async processImageFile(file, isPaste = false) {
        if (!this.validateImageFile(file)) {
            return null;
        }

        try {
            if (isPaste) {
                const converted = await this.convertToWebP(file, 0.8);
                const blockId = this.generateBlockId();
                
                return {
                    url: converted.base64Url,
                    width: converted.width,
                    height: converted.height,
                    blockId: blockId,
                    isUploading: false,
                    isPasteImage: true,
                    file: null
                };
            } else {
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
        } catch (error) {
            console.error('Image processing error:', error);
            return null;
        }
    }

    async handleMultipleImageInsert(files, isPaste = false) {
        try {
            const imageDataArray = await Promise.all(
                files.map(file => this.processImageFile(file, isPaste))
            );
            
            const validImages = imageDataArray.filter(data => data !== null);
            
            if (validImages.length > 0) {
                this.insertImageBlocks(validImages);
                
                validImages.forEach(imageData => {
                    if (imageData.file && imageData.isUploading) {
                        this.queueUpload(imageData.file, imageData.blockId);
                    }
                });
                
                if (isPaste) {
                    T2Utils.showNotification('이미지가 추가되었습니다. (Base64 인코딩)', 'success');
                }
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

    insertImageBlocks(files) {
        if (this.editor.savedSelection) {
            this.editor.restoreSelection();
        }
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const currentBlock = this.editor.getClosestBlock(range.startContainer);
        
        if (currentBlock && currentBlock !== this.editor.editor) {
            const fragment = document.createDocumentFragment();
            
            files.forEach((file, index) => {
                const mediaBlock = this.createImageBlock(file);
                fragment.appendChild(mediaBlock);
                
                if (index < files.length - 1) {
                    const breakLine = document.createElement('p');
                    if (this.editor.isIOS || this.editor.isSafari) {
                        breakLine.innerHTML = '<br>';
                    } else {
                        breakLine.textContent = '\u200B';
                    }
                    fragment.appendChild(breakLine);
                }
            });
            
            if (!range.collapsed) {
                range.deleteContents();
            }
            
            range.insertNode(fragment);
            
            const lastNode = fragment.lastChild;
            range.setStartAfter(lastNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.editor.normalizeContent();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        }
    }

    createImageBlock(file) {
        const mediaBlock = document.createElement('div');
        mediaBlock.className = 't2-media-block';
        mediaBlock.contentEditable = false;
        
        const blockId = file.blockId || this.generateBlockId();
        mediaBlock.setAttribute('data-block-id', blockId);
        
        if (file.isUploading && !file.isPasteImage) {
            mediaBlock.setAttribute('data-uploading', 'true');
        }
        
        const container = document.createElement('div');
        container.style.width = file.width + 'px';
        container.style.maxWidth = '100%';
        container.style.margin = '0 auto';
        container.style.position = 'relative';
        
        container.dataset.originalWidth = file.width;
        container.dataset.originalHeight = file.height;
        
        const img = document.createElement('img');
        img.src = file.url;
        img.style.width = '100%';
        img.dataset.width = file.width;
        img.dataset.height = file.height;
        
        container.appendChild(img);
        
        if (file.isUploading && !file.isPasteImage) {
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
        
        const controls = this.createMediaControls(container, img, blockId);
        mediaBlock.appendChild(controls);
        
        return mediaBlock;
    }

    createMediaControls(container, mediaElement, blockId) {
        const controls = document.createElement('div');
        controls.className = 't2-media-controls';
        controls.contentEditable = false;

        const width = parseInt(mediaElement.dataset.width) || parseInt(container.style.width) || 320;
        const height = parseInt(mediaElement.dataset.height) || parseInt(container.style.height) || 180;
        
        const editorWidth = this.editor.editor.clientWidth;
        const maxWidthPercentage = Math.min(100, Math.floor((editorWidth / width) * 100));
        
        const currentWidth = parseInt(container.style.width) || width;
        const percentage = container.dataset.sliderPercentage || Math.round((currentWidth / width) * 100);

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
                    container.dataset.sliderPercentage = newMaxPercentage;
                }
            });
            
            resizeObserver.observe(this.editor.editor);

            let isSliding = false;
            let slideTimer = null;

            sizeSlider.addEventListener('mousedown', () => {
                isSliding = true;
            });

            sizeSlider.addEventListener('mouseup', () => {
                isSliding = false;
                if (this.editor.getPlugin('collab')) {
                    this.editor.getPlugin('collab')._debounceUpdate();
                }
            });

            sizeSlider.addEventListener('input', (e) => {
                const percentage = parseInt(e.target.value);
                const newWidth = Math.round((width * percentage) / 100);
                
                container.style.width = `${newWidth}px`;
                container.style.maxWidth = '100%';
                mediaElement.style.width = '100%';
                container.dataset.sliderPercentage = percentage;

                if (isSliding) {
                    if (slideTimer) clearTimeout(slideTimer);
                    slideTimer = setTimeout(() => {
                        if (this.editor.getPlugin('collab')) {
                            this.editor.getPlugin('collab')._debounceUpdate();
                        }
                    }, 300);
                }
            });

            const updateSliderFromDOM = () => {
                const currentPercentage = container.dataset.sliderPercentage;
                if (currentPercentage && parseInt(sizeSlider.value) !== parseInt(currentPercentage)) {
                    sizeSlider.value = currentPercentage;
                }
            };

            setInterval(updateSliderFromDOM, 100);
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
                    
                    if (this.editor.getPlugin('collab')) {
                        this.editor.getPlugin('collab')._debounceUpdate();
                    }
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
                
                if (!container.dataset.originalWidth) {
                    container.dataset.originalWidth = mediaElement.dataset.width || currentWidth;
                }
                if (!container.dataset.originalHeight) {
                    container.dataset.originalHeight = mediaElement.dataset.height || currentHeight;
                }
                
                if (block.parentNode.nodeName === 'P') {
                    const p = block.parentNode;
                    p.parentNode.insertBefore(block, p);
                    p.remove();
                }
                
                const existingControls = block.querySelector('.t2-media-controls');
                if (existingControls) {
                    existingControls.remove();
                }
                const controls = this.createMediaControls(container, mediaElement, block.getAttribute('data-block-id') || this.generateBlockId());
                block.appendChild(controls);
                
                this.cleanupEmptyLines(block);
            }
        });
    }

    showImageLinkPreview(link) {
        const existingPreview = this.editor.container.querySelector('.t2-image-link-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        const preview = document.createElement('div');
        preview.className = 't2-image-link-preview t2-link-preview';
        preview.innerHTML = `
            <div class="t2-link-preview-content">
                <div class="t2-link-preview-url">${this.truncateUrl(link.href, 50)}</div>
                <div class="t2-link-preview-actions">
                    <button class="t2-btn t2-link-add" data-action="add">이미지 블록으로 추가</button>
                    <button class="t2-btn t2-link-visit" data-action="visit">방문</button>
                    <button class="t2-btn" data-action="cancel">취소</button>
                </div>
            </div>
        `;

        const linkRect = link.getBoundingClientRect();
        const editorRect = this.editor.editor.getBoundingClientRect();
        
        preview.style.position = 'absolute';
        preview.style.top = (linkRect.bottom - editorRect.top + 5) + 'px';
        preview.style.left = (linkRect.left - editorRect.left) + 'px';
        preview.style.zIndex = '1000';

        preview.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = e.target.closest('[data-action]')?.dataset.action;
            
            switch(action) {
                case 'add':
                    this.createImageBlockFromUrl(link.href, link);
                    break;
                case 'visit':
                    window.open(link.href, '_blank');
                    break;
                case 'cancel':
                    break;
            }
            
            preview.remove();
        });

        this.editor.container.style.position = 'relative';
        this.editor.container.appendChild(preview);

        const closeHandler = (e) => {
            if (!preview.contains(e.target) && e.target !== link) {
                preview.remove();
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('mousedown', closeHandler);
        }, 100);
    }

    async createImageBlockFromUrl(url, linkElement) {
        try {
            const img = new Image();
            img.onload = () => {
                const imageData = {
                    url: url,
                    width: img.naturalWidth || 320,
                    height: img.naturalHeight || 180,
                    blockId: this.generateBlockId()
                };
                
                const mediaBlock = this.createImageBlock(imageData);
                linkElement.parentNode.replaceChild(mediaBlock, linkElement);
                
                this.editor.normalizeContent();
                this.editor.createUndoPoint();
                this.editor.autoSave();
                this.cleanupEmptyLines(mediaBlock);
            };
            img.onerror = () => {
                T2Utils.showNotification('이미지를 불러올 수 없습니다.', 'error');
            };
            img.src = url;
        } catch (error) {
            console.error('이미지 블록 생성 오류:', error);
            T2Utils.showNotification('이미지 블록 추가 중 오류가 발생했습니다.', 'error');
        }
    }

    generateBlockId() {
        return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    truncateUrl(url, maxLength) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }
}

window.T2ImagePlugin = T2ImagePlugin;