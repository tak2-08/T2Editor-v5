//Path: T2Editor/plugin/file/file.js

class T2FilePlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['attachFile'];
        this.config = null;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch(`${t2editor_url}/config/get_upload_config.php`);
            this.config = await response.json();
        } catch (error) {
            console.error('Failed to load upload config:', error);
            // 기본값 설정
            this.config = {
                maxUploadSize: 50,
                allowedExtensions: {
                    document: ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
                    video: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'],
                    other: ['zip', 'rar', '7z', 'tar', 'gz', 'mp3', 'm4a', 'wav', 'flac']
                },
                acceptStrings: {
                    all: '.pdf,.txt,.doc,.docx,.mp4,.webm,.mp3,.zip'
                }
            };
        }
    }

    handleCommand(command, button) {
        switch(command) {
            case 'attachFile':
                this.showFileUploadModal();
                break;
        }
    }

    onContentSet(html) {
        // 컨텐츠 설정 시 파일 블록 초기화
        setTimeout(() => {
            this.initializeFileBlocks();
        }, 100);
    }

    showFileUploadModal() {
        if (!this.config) {
            T2Utils.showNotification('설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
            return;
        }

        const modalContent = `
            <div class="t2-file-editor-modal">
                <h3>파일 첨부</h3>
                <div class="t2-file-upload-area">
                    <span class="material-icons">attach_file</span>
                    <div class="t2-file-upload-text">클릭하여 파일 선택</div>
                    <div class="t2-file-upload-hint">지원 형식: 문서, 비디오, 오디오, 압축 파일<br>최대 ${this.config.maxUploadSize}MB</div>
                    <input type="file" accept="${this.getAcceptString()}" />
                </div>
                <div class="t2-file-preview-grid"></div>
                <div class="t2-upload-progress" style="display: none;">
                    <div class="t2-progress-bar">
                        <div class="t2-progress-fill"></div>
                    </div>
                    <div class="t2-progress-text">파일 업로드 중...</div>
                </div>
                <div class="t2-btn-group">
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="upload" disabled>첨부</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupFileModalEvents(modal);
    }

    getAcceptString() {
        if (!this.config) return '';
        
        // 이미지를 제외한 모든 확장자
        const allExtensions = [
            ...this.config.allowedExtensions.document,
            ...this.config.allowedExtensions.video,
            ...this.config.allowedExtensions.other
        ];
        
        return allExtensions.map(ext => '.' + ext).join(',');
    }

    validateFile(file) {
        if (!this.config) {
            T2Utils.showNotification('설정을 불러오는 중입니다.', 'warning');
            return false;
        }

        const fileExt = file.name.toLowerCase().split('.').pop();
        
        // 이미지 파일 확인 (이미지는 이미지 플러그인에서 처리)
        if (this.config.allowedExtensions.image && this.config.allowedExtensions.image.includes(fileExt)) {
            T2Utils.showNotification('이미지 파일은 이미지 버튼을 사용해주세요.', 'warning');
            return false;
        }
        
        // 허용된 확장자 확인
        const allAllowedExtensions = [
            ...this.config.allowedExtensions.document,
            ...this.config.allowedExtensions.video,
            ...this.config.allowedExtensions.other
        ];
        
        if (!allAllowedExtensions.includes(fileExt)) {
            T2Utils.showNotification('지원하지 않는 파일 형식입니다.', 'error');
            return false;
        }
        
        // 파일 크기 검사
        const maxSize = this.config.maxUploadSize * 1024 * 1024;
        if (file.size > maxSize) {
            T2Utils.showNotification(`파일 크기가 너무 큽니다. (최대 ${this.config.maxUploadSize}MB)`, 'error');
            return false;
        }
        
        return true;
    }

    detectFileType(filename) {
        const fileExt = filename.toLowerCase().split('.').pop();
        
        if (this.config.allowedExtensions.document.includes(fileExt)) {
            return 'document';
        } else if (this.config.allowedExtensions.video.includes(fileExt)) {
            return 'video';
        } else if (this.config.allowedExtensions.image && this.config.allowedExtensions.image.includes(fileExt)) {
            return 'image';
        } else if (this.config.allowedExtensions.other.includes(fileExt)) {
            return 'other';
        }
        
        return 'unknown';
    }

    setupFileModalEvents(modal) {
        const previewGrid = modal.querySelector('.t2-file-preview-grid');
        const fileInput = modal.querySelector('input[type="file"]');
        const uploadBtn = modal.querySelector('[data-action="upload"]');
        const uploadArea = modal.querySelector('.t2-file-upload-area');
        const progressBar = modal.querySelector('.t2-progress-fill');
        const progressContainer = modal.querySelector('.t2-upload-progress');
        const progressText = modal.querySelector('.t2-progress-text');
        
        let selectedFile = null;

        const handleFile = (file) => {
            if (!this.validateFile(file)) {
                return;
            }

            const fileExt = file.name.toLowerCase().split('.').pop();
            const fileType = this.detectFileType(file.name);
            
            // 기존 미리보기 제거
            previewGrid.innerHTML = '';
            
            const previewItem = document.createElement('div');
            previewItem.className = 't2-file-preview-item';
            
            // 파일 타입별 미리보기 생성
            if (fileType === 'image') {
                // 이미지 파일인 경우 이미지 미리보기 표시
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewItem.innerHTML = `
                        <div class="t2-file-preview-image" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
                            <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                            <div class="t2-file-preview-image-label" style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; font-size: 12px;">
                                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">image</span>
                                이미지 파일
                            </div>
                        </div>
                        <div class="t2-file-preview-name">${file.name}</div>
                        <button type="button" class="t2-file-preview-remove">
                            <span class="material-icons">close</span>
                        </button>
                    `;
                    
                    const removeBtn = previewItem.querySelector('.t2-file-preview-remove');
                    removeBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedFile = null;
                        previewItem.remove();
                        uploadBtn.disabled = true;
                        fileInput.value = '';
                    };
                };
                reader.readAsDataURL(file);
            } else if (fileType === 'video') {
                // 비디오 파일 미리보기
                previewItem.innerHTML = `
                    <div class="t2-file-preview-icon" style="background-color: #8B5CF6; position: relative;">
                        <span class="material-icons" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px;">play_circle</span>
                    </div>
                    <div class="t2-file-preview-name">${file.name}</div>
                    <button type="button" class="t2-file-preview-remove">
                        <span class="material-icons">close</span>
                    </button>
                `;
            } else {
                // 일반 파일 미리보기
                const iconColor = this.getFileIconColor(fileExt);
                previewItem.innerHTML = `
                    <div class="t2-file-preview-icon" style="background-color: ${iconColor}"></div>
                    <div class="t2-file-preview-name">${file.name}</div>
                    <button type="button" class="t2-file-preview-remove">
                        <span class="material-icons">close</span>
                    </button>
                `;
            }

            // 공통 remove 버튼 이벤트 (이미지가 아닌 경우)
            if (fileType !== 'image') {
                const removeBtn = previewItem.querySelector('.t2-file-preview-remove');
                removeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectedFile = null;
                    previewItem.remove();
                    uploadBtn.disabled = true;
                    fileInput.value = '';
                };
            }

            selectedFile = file;
            previewGrid.appendChild(previewItem);
            uploadBtn.disabled = false;
        };

        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        };

        // 드래그 앤 드롭 처리
        T2Utils.setupDragAndDrop(uploadArea, (files) => {
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        // 취소 버튼
        modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
        
        // 업로드 버튼
        modal.querySelector('[data-action="upload"]').onclick = async () => {
            if (!selectedFile) return;
            
            const fileType = this.detectFileType(selectedFile.name);
            
            uploadBtn.disabled = true;
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            progressText.textContent = this.getUploadProgressText(fileType);

            try {
                if (fileType === 'image') {
                    // 이미지 파일인 경우 이미지 플러그인 사용
                    await this.handleImageUpload(selectedFile);
                    progressBar.style.width = '100%';
                    progressText.textContent = '업로드 완료';
                    modal.remove();
                } else if (fileType === 'video') {
                    // 비디오 파일인 경우 비디오 플러그인 사용
                    await this.handleVideoUpload(selectedFile);
                    progressBar.style.width = '100%';
                    progressText.textContent = '업로드 완료';
                    modal.remove();
                } else {
                    // 일반 파일 업로드
                    const formData = new FormData();
                    formData.append('bf_file', selectedFile);
                    formData.append('uid', this.editor.generateUid());

                    const response = await fetch(`${t2editor_url}/plugin/file/file_upload.php`, {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        progressBar.style.width = '100%';
                        progressText.textContent = '업로드 완료';
                        this.insertFileBlock(data.file);
                        modal.remove();
                        this.editor.createUndoPoint();
                        this.editor.autoSave();
                    } else {
                        throw new Error(data.message || '업로드 실패');
                    }
                }
            } catch (error) {
                console.error('File upload error:', error);
                T2Utils.showNotification('파일 업로드 중 오류가 발생했습니다.', 'error');
                uploadBtn.disabled = false;
                progressContainer.style.display = 'none';
            }
        };
    }

    getFileIconColor(fileExt) {
        const colors = {
            // 압축 파일
            'zip': '#E8B56F', 'rar': '#E8B56F', '7z': '#E8B56F', 'tar': '#E8B56F', 'gz': '#E8B56F', 'bz2': '#E8B56F',
            // 문서
            'pdf': '#F44336',
            'txt': '#585858', 'rtf': '#585858',
            'doc': '#2196F3', 'docx': '#2196F3',
            'xls': '#4CAF50', 'xlsx': '#4CAF50', 'ods': '#4CAF50',
            'ppt': '#FF9800', 'pptx': '#FF9800', 'odp': '#FF9800',
            'hwp': '#1976D2', 'odt': '#1976D2',
            // 오디오
            'mp3': '#9C27B0', 'm4a': '#9C27B0', 'wav': '#9C27B0', 'flac': '#9C27B0', 'aac': '#9C27B0', 'wma': '#9C27B0',
            // 비디오
            'mp4': '#8B5CF6', 'webm': '#8B5CF6', 'ogg': '#8B5CF6', 'mov': '#8B5CF6', 'avi': '#8B5CF6', 'mkv': '#8B5CF6', 'wmv': '#8B5CF6', 'flv': '#8B5CF6', 'm4v': '#8B5CF6',
            // 기타
            'json': '#FFC107', 'xml': '#FFC107', 'csv': '#4CAF50'
        };
        return colors[fileExt.toLowerCase()] || '#E8B56F';
    }

    getUploadProgressText(fileType) {
        switch(fileType) {
            case 'image': return '이미지 업로드 중...';
            case 'video': return '비디오 업로드 중...';
            case 'document': return '문서 업로드 중...';
            case 'other': return '파일 업로드 중...';
            default: return '파일 업로드 중...';
        }
    }

    async handleImageUpload(file) {
        // 이미지 플러그인 인스턴스 가져오기
        const imagePlugin = this.editor.getPlugin('image');
        
        if (imagePlugin) {
            // 이미지 플러그인의 업로드 함수 직접 호출
            await imagePlugin.uploadImageFile(file);
        } else {
            // 이미지 플러그인이 없는 경우 직접 처리
            const formData = new FormData();
            formData.append('bf_file[]', file);
            formData.append('uid', this.editor.generateUid());

            const response = await fetch(`${t2editor_url}/plugin/image/image_upload.php`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success && data.files && data.files.length > 0) {
                // 이미지 블록 직접 생성
                this.insertImageBlock(data.files[0]);
                T2Utils.showNotification('이미지가 성공적으로 업로드되었습니다.', 'success');
            } else {
                throw new Error(data.message || '이미지 업로드 실패');
            }
        }
    }

    async handleVideoUpload(file) {
        // 비디오 플러그인 인스턴스 가져오기
        const videoPlugin = this.editor.getPlugin('video');
        
        if (videoPlugin) {
            // 비디오 플러그인의 파일 업로드 함수 사용
            const formData = new FormData();
            formData.append('bf_file', file);
            formData.append('uid', this.editor.generateUid());

            const response = await fetch(`${t2editor_url}/plugin/file/file_upload.php`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                // 비디오 블록 생성
                const videoBlock = videoPlugin.createVideoBlock({ 
                    type: 'video', 
                    url: data.file.url 
                });
                
                // 현재 커서 위치에 삽입
                this.insertElementAtCursor(videoBlock);
                
                T2Utils.showNotification('비디오가 성공적으로 업로드되었습니다.', 'success');
            } else {
                throw new Error(data.message || '비디오 업로드 실패');
            }
        } else {
            // 비디오 플러그인이 없는 경우 일반 파일로 처리
            const formData = new FormData();
            formData.append('bf_file', file);
            formData.append('uid', this.editor.generateUid());

            const response = await fetch(`${t2editor_url}/plugin/file/file_upload.php`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.insertFileBlock(data.file);
                T2Utils.showNotification('파일이 성공적으로 업로드되었습니다.', 'success');
            } else {
                throw new Error(data.message || '파일 업로드 실패');
            }
        }
    }

insertElementAtCursor(element) {
    const selection = window.getSelection();
    let currentBlock = null;
    
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        currentBlock = this.editor.getClosestBlock(range.startContainer);
    }
    
    if (!currentBlock || currentBlock === this.editor.editor) {
        currentBlock = this.editor.editor.lastElementChild;
        if (!currentBlock || currentBlock.tagName !== 'P') {
            currentBlock = document.createElement('p');
            currentBlock.innerHTML = '<br>';
            this.editor.editor.appendChild(currentBlock);
        }
    }

    const topBreak = document.createElement('p');
    topBreak.innerHTML = '<br>';
    currentBlock.parentNode.insertBefore(topBreak, currentBlock.nextSibling);
    
    // 파일 블록 직접 삽입 (p 태그로 감싸지 않음)
    topBreak.parentNode.insertBefore(element, topBreak.nextSibling);
    
    const bottomBreak = document.createElement('p');
    bottomBreak.innerHTML = '<br>';
    element.parentNode.insertBefore(bottomBreak, element.nextSibling);
    
    // 중복 공백 정리
    this.cleanupEmptyLines(element);
    
    const newRange = document.createRange();
    newRange.setStartAfter(bottomBreak);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    this.editor.normalizeContent();
    this.editor.createUndoPoint();
    this.editor.autoSave();
}

// 파일 블록 주변의 중복 빈 줄 정리
cleanupEmptyLines(fileBlock) {
    let prev = fileBlock.previousElementSibling;
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
    
    let next = fileBlock.nextElementSibling;
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

    insertImageBlock(imageInfo) {
        const mediaBlock = document.createElement('div');
        mediaBlock.className = 't2-media-block';
        
        const container = document.createElement('div');
        container.style.width = imageInfo.width + 'px';
        container.style.maxWidth = '100%';
        container.style.margin = '0 auto';
        
        const img = document.createElement('img');
        img.src = imageInfo.url;
        img.style.width = '100%';
        img.dataset.width = imageInfo.width;
        img.dataset.height = imageInfo.height;
        
        container.appendChild(img);
        mediaBlock.appendChild(container);
        
        // 이미지 컨트롤 생성
        const controls = this.createImageControls(container, img);
        mediaBlock.appendChild(controls);
        
        // 현재 커서 위치에 삽입
        this.insertElementAtCursor(mediaBlock);
    }

    createImageControls(container, img) {
        const controls = document.createElement('div');
        controls.className = 't2-media-controls';
        controls.contentEditable = false;

        const width = parseInt(img.dataset.width) || parseInt(container.style.width) || 320;
        const height = parseInt(img.dataset.height) || parseInt(container.style.height) || 180;
        
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
                    img.style.width = '100%';
                }
            });
            
            resizeObserver.observe(this.editor.editor);

            sizeSlider.addEventListener('input', (e) => {
                const percentage = parseInt(e.target.value);
                const newWidth = Math.round((width * percentage) / 100);
                
                container.style.width = `${newWidth}px`;
                container.style.maxWidth = '100%';
                img.style.width = '100%';
                
                img.dataset.currentWidth = newWidth;
            });
        }

        // 삭제 버튼 이벤트
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

insertFileBlock(fileInfo) {
    const fileBlock = document.createElement('div');
    fileBlock.className = 't2-media-block t2-file-block';
    fileBlock.contentEditable = false;
    
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    const fileSize = T2Utils.formatFileSize(fileInfo.size);
    const fileExt = fileInfo.original_name.toLowerCase().split('.').pop();
    const isAudioFile = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'wma'].includes(fileExt);
    const isPdfFile = fileExt === 'pdf';
    
    let fileUrl = fileInfo.url;
    if (isPdfFile) {
        const matches = fileUrl.match(/data\/editor\/t2editor_(\d+)\/(.+\.pdf)$/i);
        if (matches) {
            const [, date, filename] = matches;
            fileUrl = t2editor_url + `/plugin/file/pdf_view.php?pdf=${date}/${filename}`;
        }
    }
    
    if (isAudioFile) {
        fileBlock.innerHTML = `
            <div class="audio-player">
                <audio src="${fileInfo.url}" preload="metadata"></audio>
            </div>
            <a href="${fileInfo.url}" download style="text-decoration: none; color: inherit;">
                <div class="audio-file-container">
                    <div class="audio-file-icon"></div>
                    <div class="audio-file-info">
                        <div class="audio-file-name">${fileInfo.original_name}</div>
                        <div class="audio-file-details">
                            <span>DATE: ${date}</span>
                            <span>Size: ${fileSize}</span>
                            <span class="audio-duration">--:--</span>
                        </div>
                    </div>
                </div>
            </a>
        `;

        const audio = fileBlock.querySelector('audio');
        const durationSpan = fileBlock.querySelector('.audio-duration');
        
        if (audio && durationSpan) {
            audio.addEventListener('loadedmetadata', () => {
                const minutes = Math.floor(audio.duration / 60);
                const seconds = Math.floor(audio.duration % 60);
                durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            });
            audio.addEventListener('error', () => {
                durationSpan.textContent = '--:--';
            });
        }
    } else {
        fileBlock.innerHTML = `
            <a href="${fileUrl}" ${!isPdfFile ? 'download' : ''} style="text-decoration: none; color: inherit;">
                <div class="file-container">
                    <div class="file-icon" style="background-color: ${this.getFileIconColor(fileExt)};"></div>
                    <div class="file-info">
                        <div class="file-name">${fileInfo.original_name}</div>
                        <div class="file-details">
                            <span>DATE: ${date}&nbsp;</span>
                            <span>Size: ${fileSize}</span>
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    const controls = document.createElement('div');
    controls.className = 't2-media-controls';
    controls.innerHTML = `
        <button class="t2-btn delete-file-btn">
            <span class="material-icons">delete</span>
        </button>
    `;
    
    const deleteBtn = controls.querySelector('.delete-file-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mediaBlock = e.target.closest('.t2-media-block');
        if (mediaBlock) {
            mediaBlock.remove();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        }
    });
    
    fileBlock.appendChild(controls);

    // 현재 커서 위치에 삽입 (수정된 부분)
    this.insertElementAtCursor(fileBlock);
}

initializeFileBlocks() {
    this.editor.editor.querySelectorAll('.t2-file-block').forEach(block => {
        block.contentEditable = false;
        
        // p 태그에서 빼내기
        if (block.parentNode.nodeName === 'P') {
            const p = block.parentNode;
            p.parentNode.insertBefore(block, p);
            p.remove();
        }
        
        // 이미 올바르게 초기화된 블록이면 건너뛰기
        if (block.querySelector('.t2-media-controls')) {
            // 중복 공백 정리만 수행
            this.cleanupEmptyLines(block);
            return;
        }
            
            // 링크 정보 추출
            const linkElements = block.querySelectorAll('a[href]');
            if (linkElements.length === 0) return;
            
            // 첫 번째 링크를 기준으로 사용
            const fileLink = linkElements[0];
            const url = fileLink.getAttribute('href');
            
            // 파일 정보 추출
            let fileName = '';
            let dateSpan = '';
            let sizeSpan = '';
            
            // 파일명 추출
            const fileNameElement = block.querySelector('.file-name, .audio-file-name');
            if (fileNameElement) {
                fileName = fileNameElement.textContent.trim();
            }
            
            // 날짜와 크기 정보 추출
            const detailSpans = block.querySelectorAll('.file-details span, .audio-file-details span');
            if (detailSpans.length >= 1) {
                dateSpan = detailSpans[0].textContent.trim();
            }
            if (detailSpans.length >= 2) {
                sizeSpan = detailSpans[1].textContent.trim();
            }
            
            // 파일 타입 확인
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const isAudioFile = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'wma'].includes(fileExtension);
            const isPdfFile = fileExtension === 'pdf';
            
            // 새로운 블록 생성
            const newBlock = document.createElement('div');
            newBlock.className = 't2-file-block t2-media-block';
            
            if (isAudioFile) {
                // 오디오 파일 블록
                newBlock.innerHTML = `
                    <div class="audio-player">
                        <audio src="${url}" preload="metadata"></audio>
                    </div>
                    <a href="${url}" download style="text-decoration: none; color: inherit;">
                        <div class="audio-file-container">
                            <div class="audio-file-icon"></div>
                            <div class="audio-file-info">
                                <div class="audio-file-name">${fileName}</div>
                                <div class="audio-file-details">
                                    <span>${dateSpan}</span>
                                    <span>${sizeSpan}</span>
                                    <span class="audio-duration">--:--</span>
                                </div>
                            </div>
                        </div>
                    </a>
                `;
                
                // 오디오 duration 설정
                const audio = newBlock.querySelector('audio');
                const durationSpan = newBlock.querySelector('.audio-duration');
                
                if (audio && durationSpan) {
                    audio.addEventListener('loadedmetadata', () => {
                        const minutes = Math.floor(audio.duration / 60);
                        const seconds = Math.floor(audio.duration % 60);
                        durationSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    });
                    audio.addEventListener('error', () => {
                        durationSpan.textContent = '--:--';
                    });
                }
            } else {
                // 일반 파일 블록
                const iconColor = this.getFileIconColor(fileExtension);
                newBlock.innerHTML = `
                    <a href="${url}" ${!isPdfFile ? 'download' : ''} style="text-decoration: none; color: inherit;">
                        <div class="file-container">
                            <div class="file-icon" style="background-color: ${iconColor};"></div>
                            <div class="file-info">
                                <div class="file-name">${fileName}</div>
                                <div class="file-details">
                                    <span>${dateSpan}&nbsp;</span>
                                    <span>${sizeSpan}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                `;
            }
            
            // 삭제 버튼 추가
            const controls = document.createElement('div');
            controls.className = 't2-media-controls';
            controls.innerHTML = `
                <button class="t2-btn delete-file-btn">
                    <span class="material-icons">delete</span>
                </button>
            `;
            
            // 삭제 버튼 이벤트 리스너 추가
            const deleteBtn = controls.querySelector('.delete-file-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const mediaBlock = e.target.closest('.t2-media-block');
                if (mediaBlock) {
                    mediaBlock.remove();
                    this.editor.createUndoPoint();
                    this.editor.autoSave();
                }
            });
            
            newBlock.appendChild(controls);
            
            // 기존 블록을 새 블록으로 교체
            block.parentNode.replaceChild(newBlock, block);
            
            // 부모가 p 태그가 아니면 p 태그로 감싸기
            if (newBlock.parentNode.nodeName !== 'P') {
                const p = document.createElement('p');
                newBlock.parentNode.insertBefore(p, newBlock);
                p.appendChild(newBlock);
                // 중복 공백 정리
                this.cleanupEmptyLines(newBlock);
            }
        });
    }
}

window.T2FilePlugin = T2FilePlugin;