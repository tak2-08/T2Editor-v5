//Path: T2Editor/plugin/video/video.js

class T2VideoPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertYouTube'];
        this.allowedVideoTypes = ['mp4', 'webm', 'ogg'];
    }

    handleCommand(command, button) {
        switch(command) {
            case 'insertYouTube':
                this.insertVideo();
                break;
        }
    }

    onContentSet(html) {
        setTimeout(() => {
            this.initializeVideoBlocks();
        }, 100);
    }

    insertVideo() {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const savedRange = range.cloneRange();

        const modalContent = `
            <div class="t2-video-editor-modal">
                <h3>비디오 삽입</h3>
                <div class="t2-video-tabs">
                    <button class="t2-tab active" data-tab="url">동영상 URL</button>
                    <button class="t2-tab" data-tab="upload">파일 업로드</button>
                </div>
                <div class="t2-tab-content">
                    <div class="t2-tab-pane active" data-pane="url">
                        <input type="text" placeholder="동영상 링크 삽입" class="t2-youtube-url">
                        <div class="t2-video-type-info">
                            지원 동영상 유형: 유튜브, 비디오 파일(.mp4, .webm, .ogg) 링크
                        </div>
                    </div>
                    <div class="t2-tab-pane" data-pane="upload">
                        <div class="t2-video-upload-area">
                            <span class="material-icons">cloud_upload</span>
                            <div class="t2-video-upload-text">클릭하여 동영상 선택</div>
                            <div class="t2-video-upload-hint">지원 형식: MP4, WebM, Ogg (최대 50MB)</div>
                            <input type="file" accept=".mp4,.webm,.ogg,video/mp4,video/webm,video/ogg" />
                        </div>
                        <div class="t2-video-preview-container"></div>
                        <div class="t2-upload-progress" style="display: none;">
                            <div class="t2-progress-bar">
                                <div class="t2-progress-fill"></div>
                            </div>
                            <div class="t2-progress-text">동영상 업로드 중...</div>
                        </div>
                    </div>
                </div>
                <div class="t2-btn-group">
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="insert">삽입</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupVideoModalEvents(modal, savedRange);
    }

    setupVideoModalEvents(modal, savedRange) {
        const urlInput = modal.querySelector('.t2-youtube-url');
        const fileInput = modal.querySelector('input[type="file"]');
        const uploadArea = modal.querySelector('.t2-video-upload-area');
        const previewContainer = modal.querySelector('.t2-video-preview-container');
        const progressContainer = modal.querySelector('.t2-upload-progress');
        const progressBar = modal.querySelector('.t2-progress-fill');
        const progressText = modal.querySelector('.t2-progress-text');
        const insertBtn = modal.querySelector('[data-action="insert"]');
        
        let uploadedVideoUrl = null;
        let activeTab = 'url';

        modal.querySelectorAll('.t2-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                modal.querySelectorAll('.t2-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const targetPane = tab.dataset.tab;
                activeTab = targetPane;
                
                modal.querySelectorAll('.t2-tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                    if (pane.dataset.pane === targetPane) {
                        pane.classList.add('active');
                    }
                });

                if (activeTab === 'url') {
                    insertBtn.disabled = !urlInput.value.trim();
                } else {
                    insertBtn.disabled = !uploadedVideoUrl;
                }
            });
        });

        urlInput.addEventListener('input', () => {
            insertBtn.disabled = !urlInput.value.trim();
        });

        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const result = await this.handleVideoFileUpload(
                    e.target.files[0], 
                    previewContainer, 
                    progressContainer, 
                    progressBar, 
                    progressText, 
                    insertBtn
                );
                if (result) {
                    uploadedVideoUrl = result;
                }
            }
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (this.validateVideoFile(file)) {
                    fileInput.files = e.dataTransfer.files;
                    const result = await this.handleVideoFileUpload(
                        file, 
                        previewContainer, 
                        progressContainer, 
                        progressBar, 
                        progressText, 
                        insertBtn
                    );
                    if (result) {
                        uploadedVideoUrl = result;
                    }
                }
            }
        });

        const insertVideo = () => {
            let videoInfo = null;
            
            if (activeTab === 'url') {
                const url = urlInput.value.trim();
                videoInfo = T2Utils.getVideoType(url);
                
                if (!videoInfo) {
                    T2Utils.showNotification('올바른 비디오 URL을 입력해주세요.', 'error');
                    return;
                }
            } else if (activeTab === 'upload' && uploadedVideoUrl) {
                videoInfo = { type: 'video', url: uploadedVideoUrl };
            } else {
                T2Utils.showNotification('동영상을 선택해주세요.', 'error');
                return;
            }

            const videoBlock = this.createVideoBlock(videoInfo);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedRange);
            
            const currentBlock = this.editor.getClosestBlock(savedRange.startContainer);
            if (currentBlock && currentBlock !== this.editor.editor) {
                const topBreak = document.createElement('p');
                topBreak.innerHTML = '<br>';
                currentBlock.parentNode.insertBefore(topBreak, currentBlock.nextSibling);
                
                topBreak.parentNode.insertBefore(videoBlock, topBreak.nextSibling);
                
                const bottomBreak = document.createElement('p');
                bottomBreak.innerHTML = '<br>';
                videoBlock.parentNode.insertBefore(bottomBreak, videoBlock.nextSibling);
                
                this.cleanupEmptyLines(videoBlock);
                
                const newRange = document.createRange();
                newRange.setStartAfter(bottomBreak);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }

            this.editor.normalizeContent();
            this.editor.createUndoPoint();
            this.editor.autoSave();
            modal.remove();
        };

        modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
        modal.querySelector('[data-action="insert"]').onclick = insertVideo;
        
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                insertVideo();
            }
        });

        urlInput.focus();
    }

    validateVideoFile(file) {
        const fileExt = file.name.toLowerCase().split('.').pop();
        
        if (!this.allowedVideoTypes.includes(fileExt)) {
            T2Utils.showNotification('지원되지 않는 동영상 형식입니다. MP4, WebM, Ogg 파일만 업로드 가능합니다.', 'error');
            return false;
        }
        
        if (file.size > 50 * 1024 * 1024) {
            T2Utils.showNotification('파일 크기가 너무 큽니다. 최대 50MB까지 업로드 가능합니다.', 'error');
            return false;
        }
        
        return true;
    }

    async handleVideoFileUpload(file, previewContainer, progressContainer, progressBar, progressText, insertBtn) {
        if (!this.validateVideoFile(file)) {
            return null;
        }

        insertBtn.disabled = true;
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '동영상 업로드 중...';

        try {
            const formData = new FormData();
            formData.append('bf_file', file);
            formData.append('uid', this.editor.generateUid());

            const response = await fetch(`${t2editor_url}/plugin/file/file_upload.php`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                progressBar.style.width = '100%';
                progressText.textContent = '업로드 완료';
                
                previewContainer.innerHTML = `
                    <div class="t2-video-preview">
                        <video controls style="width: 100%; max-height: 200px;">
                            <source src="${data.file.url}" type="video/${file.name.split('.').pop()}">
                        </video>
                        <div class="t2-video-info">
                            <span class="t2-video-file-name" title="${file.name}">${file.name}</span>
                            <span class="t2-video-file-size">${T2Utils.formatFileSize(file.size)}</span>
                        </div>
                    </div>
                `;
                
                insertBtn.disabled = false;
                
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 1000);
                
                T2Utils.showNotification('동영상이 성공적으로 업로드되었습니다.', 'success');
                
                return data.file.url;
            } else {
                throw new Error(data.message || '업로드 실패');
            }
        } catch (error) {
            console.error('동영상 업로드 오류:', error);
            T2Utils.showNotification('동영상 업로드 중 오류가 발생했습니다.', 'error');
            insertBtn.disabled = false;
            progressContainer.style.display = 'none';
            return null;
        }
    }

    // iframe URL 생성 함수
    getVideoIframeUrl(videoInfo) {
        if (videoInfo.type === 'youtube') {
            return `https://www.youtube.com/embed/${videoInfo.id}`;
        } else {
            // 업로드한 비디오도 iframe으로 처리
            const videoPath = videoInfo.url;
            return `${t2editor_url}/plugin/video/video_view.php?video=${encodeURIComponent(videoPath)}`;
        }
    }

    createVideoBlock(videoInfo) {
        const defaultWidth = 560;
        const defaultHeight = 315;

        const wrapper = document.createElement('div');
        wrapper.className = 't2-media-block t2-video-block';
        wrapper.contentEditable = false;
        
        const videoContainer = document.createElement('div');
        videoContainer.style.width = defaultWidth + 'px';
        videoContainer.style.height = defaultHeight + 'px';
        videoContainer.style.maxWidth = '100%';
        videoContainer.style.margin = '0 auto';
        videoContainer.dataset.width = defaultWidth;
        videoContainer.dataset.height = defaultHeight;
        
        // 모든 비디오를 iframe으로 처리
        const videoElement = document.createElement('iframe');
        videoElement.src = this.getVideoIframeUrl(videoInfo);
        videoElement.frameBorder = "0";
        videoElement.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        videoElement.allowFullscreen = true;
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.borderRadius = '15px';
        videoElement.style.border = 'none';
        
        // 비디오 정보 저장
        videoElement.dataset.videoType = videoInfo.type;
        if (videoInfo.type === 'youtube') {
            videoElement.dataset.videoId = videoInfo.id;
        } else {
            videoElement.dataset.videoUrl = videoInfo.url;
        }
        
        videoContainer.appendChild(videoElement);

        const controls = this.createVideoControls(videoContainer, videoElement, videoInfo, defaultWidth, defaultHeight);
        
        wrapper.appendChild(videoContainer);
        wrapper.appendChild(controls);
        
        return wrapper;
    }

    createVideoControls(container, videoElement, videoInfo, defaultWidth, defaultHeight) {
        const controls = document.createElement('div');
        controls.className = 't2-media-controls';
        controls.contentEditable = false;

        const editorWidth = this.editor.editor.clientWidth;
        const maxWidthPercentage = Math.min(100, Math.floor((editorWidth / defaultWidth) * 100));
        const currentWidth = parseInt(container.style.width) || defaultWidth;
        const percentage = Math.round((currentWidth / defaultWidth) * 100);

        controls.innerHTML = `
            <button class="t2-btn delete-btn" type="button">
                <span class="material-icons">delete</span>
            </button>
            <button class="t2-btn edit-url-btn" type="button">
                <span class="material-icons">edit</span>
            </button>
            <input type="range" min="30" max="${maxWidthPercentage}" value="${percentage}" style="width: 100px;">
        `;

        // 삭제 버튼
        const deleteBtn = controls.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            controls.closest('.t2-media-block').remove();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        });

        // 크기 조절
        const rangeInput = controls.querySelector('input[type="range"]');
        if (rangeInput) {
            const resizeObserver = new ResizeObserver(() => {
                const newEditorWidth = this.editor.editor.clientWidth;
                const newMaxPercentage = Math.min(100, Math.floor((newEditorWidth / defaultWidth) * 100));
                rangeInput.max = newMaxPercentage;
                
                if (parseInt(rangeInput.value) > newMaxPercentage) {
                    rangeInput.value = newMaxPercentage;
                    const newWidth = Math.round((defaultWidth * newMaxPercentage) / 100);
                    const newHeight = Math.round((defaultHeight * newMaxPercentage) / 100);
                    
                    container.style.width = `${newWidth}px`;
                    container.style.height = `${newHeight}px`;
                }
            });
            
            resizeObserver.observe(this.editor.editor);

            rangeInput.addEventListener('input', (e) => {
                const percentage = parseInt(e.target.value);
                const newWidth = Math.round((defaultWidth * percentage) / 100);
                const newHeight = Math.round((defaultHeight * percentage) / 100);
                
                container.style.width = `${newWidth}px`;
                container.style.height = `${newHeight}px`;
                
                this.editor.createUndoPoint();
            });
        }

        // URL 편집
        const editUrlBtn = controls.querySelector('.edit-url-btn');
        if (editUrlBtn) {
            editUrlBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showVideoUrlEditModal(container, videoElement, videoInfo);
            });
        }

        return controls;
    }

    showVideoUrlEditModal(container, videoElement, currentVideoInfo) {
        let currentUrl = '';
        if (currentVideoInfo.type === 'youtube') {
            currentUrl = `https://youtube.com/watch?v=${currentVideoInfo.id}`;
        } else {
            currentUrl = currentVideoInfo.url;
        }
        
        const modalContent = `
            <div class="t2-video-editor-modal">
                <h3>비디오 URL 수정</h3>
                <input type="text" placeholder="동영상 링크 삽입" class="t2-youtube-url" value="${currentUrl}">
                <div class="t2-video-type-info">
                    지원 동영상 유형: 유튜브, 비디오 파일(.mp4, .webm, .ogg) 링크
                </div>
                <div class="t2-btn-group">
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="insert">수정</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        
        const updateVideo = () => {
            const url = modal.querySelector('.t2-youtube-url').value;
            const videoInfo = T2Utils.getVideoType(url);
            
            if (!videoInfo) {
                T2Utils.showNotification('올바른 비디오 URL을 입력해주세요.', 'error');
                return;
            }

            // 현재 크기 유지
            const currentWidth = parseInt(container.style.width);
            const currentHeight = parseInt(container.style.height);

            // iframe src 업데이트
            videoElement.src = this.getVideoIframeUrl(videoInfo);
            
            // 데이터 속성 업데이트
            videoElement.dataset.videoType = videoInfo.type;
            if (videoInfo.type === 'youtube') {
                videoElement.dataset.videoId = videoInfo.id;
                delete videoElement.dataset.videoUrl;
            } else {
                videoElement.dataset.videoUrl = videoInfo.url;
                delete videoElement.dataset.videoId;
            }

            // 크기 유지
            container.style.width = currentWidth + 'px';
            container.style.height = currentHeight + 'px';

            modal.remove();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        };

        modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
        modal.querySelector('[data-action="insert"]').onclick = updateVideo;
        
        modal.querySelector('.t2-youtube-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateVideo();
            }
        });

        modal.querySelector('.t2-youtube-url').focus();
    }

    cleanupEmptyLines(videoBlock) {
        let prev = videoBlock.previousElementSibling;
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
        
        let next = videoBlock.nextElementSibling;
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

    initializeVideoBlocks() {
        // 모든 iframe 처리 (유튜브 및 업로드 비디오)
        this.editor.editor.querySelectorAll('iframe:not(.t2-media-block iframe)').forEach(frame => {
            let videoInfo = null;
            
            // 유튜브 체크
            if (frame.src.includes('youtube.com/embed/')) {
                const videoId = frame.src.match(/embed\/([^?]+)/)?.[1];
                if (videoId) {
                    videoInfo = { type: 'youtube', id: videoId };
                }
            } 
            // 업로드한 비디오 체크
            else if (frame.src.includes('video_view.php')) {
                const urlMatch = frame.src.match(/video=([^&]+)/);
                if (urlMatch) {
                    videoInfo = { type: 'video', url: decodeURIComponent(urlMatch[1]) };
                }
            }
            
            if (videoInfo) {
                const wrapper = this.createVideoBlock(videoInfo);
                frame.parentNode.replaceChild(wrapper, frame);
                this.cleanupEmptyLines(wrapper);
            }
        });

        // video 태그를 iframe으로 변환
        this.editor.editor.querySelectorAll('video:not(.t2-media-block video)').forEach(video => {
            const videoInfo = { type: 'video', url: video.src };
            const wrapper = this.createVideoBlock(videoInfo);
            video.parentNode.replaceChild(wrapper, video);
            this.cleanupEmptyLines(wrapper);
        });

        // 기존 미디어 블록 처리
        this.editor.editor.querySelectorAll('.t2-media-block').forEach(block => {
            const container = block.querySelector('div:first-child');
            const mediaElement = container?.querySelector('iframe, video');
            
            if (!mediaElement) return;
            
            // video 태그를 iframe으로 교체
            if (mediaElement.tagName === 'VIDEO') {
                const videoInfo = { type: 'video', url: mediaElement.src };
                const newIframe = document.createElement('iframe');
                newIframe.src = this.getVideoIframeUrl(videoInfo);
                newIframe.frameBorder = "0";
                newIframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                newIframe.allowFullscreen = true;
                newIframe.style.width = '100%';
                newIframe.style.height = '100%';
                newIframe.style.borderRadius = '15px';
                newIframe.style.border = 'none';
                newIframe.dataset.videoType = 'video';
                newIframe.dataset.videoUrl = videoInfo.url;
                
                mediaElement.parentNode.replaceChild(newIframe, mediaElement);
            }
            
            // 블록 설정
            block.contentEditable = false;
            if (!block.classList.contains('t2-video-block')) {
                block.classList.add('t2-video-block');
            }
            
            if (!container.style.maxWidth) {
                container.style.maxWidth = '100%';
            }
            if (!container.style.margin) {
                container.style.margin = '0 auto';
            }
            
            // p 태그에서 빼내기
            if (block.parentNode.nodeName === 'P') {
                const p = block.parentNode;
                p.parentNode.insertBefore(block, p);
                p.remove();
            }
            
            // 컨트롤 재생성
            const existingControls = block.querySelector('.t2-media-controls');
            if (existingControls) {
                existingControls.remove();
            }
            
            const currentIframe = container.querySelector('iframe');
            if (currentIframe) {
                let videoInfo;
                if (currentIframe.dataset.videoType === 'youtube' || currentIframe.src.includes('youtube.com')) {
                    const videoId = currentIframe.dataset.videoId || currentIframe.src.match(/embed\/([^?]+)/)?.[1];
                    videoInfo = { type: 'youtube', id: videoId };
                } else {
                    const videoUrl = currentIframe.dataset.videoUrl || decodeURIComponent(currentIframe.src.match(/video=([^&]+)/)?.[1] || '');
                    videoInfo = { type: 'video', url: videoUrl };
                }
                
                const width = parseInt(container.dataset.width) || parseInt(container.style.width) || 560;
                const height = parseInt(container.dataset.height) || parseInt(container.style.height) || 315;
                
                const controls = this.createVideoControls(container, currentIframe, videoInfo, width, height);
                block.appendChild(controls);
            }
            
            this.cleanupEmptyLines(block);
        });
    }
}

// 스타일은 기존과 동일...
const style = document.createElement('style');
style.textContent = `
    /* 기존 스타일 코드 유지 */
    .t2-video-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 10px;
    }
    
    .t2-video-upload-area {
        border: 2px dashed #e5e7eb;
        border-radius: 8px;
        padding: 32px 16px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 20px;
        position: relative;
    }
    
    .t2-video-upload-area:hover,
    .t2-video-upload-area.drag-over {
        border-color: #2563eb;
        background: rgba(37,99,235,.05);
    }
    
    .t2-video-upload-area .material-icons {
        font-size: 48px;
        color: #6b7280;
        margin-bottom: 12px;
    }
    
    .t2-video-upload-text {
        font-size: 15px;
        color: #4b5563;
        margin-bottom: 4px;
    }
    
    .t2-video-upload-hint {
        font-size: 13px;
        color: #6b7280;
    }
    
    .t2-video-upload-area input[type="file"] {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
    }
    
    .t2-video-preview-container {
        margin-bottom: 20px;
    }
    
    .t2-video-preview {
        background: #f9fafb;
        border-radius: 8px;
        padding: 10px;
    }
    
    .t2-video-preview video {
        border-radius: 6px;
        margin-bottom: 10px;
    }
    
    .t2-video-info {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: #6b7280;
        gap: 10px;
    }
    
    .t2-video-file-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 70%;
    }
    
    .t2-video-file-size {
        flex-shrink: 0;
    }
`;

if (!document.querySelector('#t2-video-plugin-styles')) {
    style.id = 't2-video-plugin-styles';
    document.head.appendChild(style);
}

window.T2VideoPlugin = T2VideoPlugin;