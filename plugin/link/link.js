//Path: T2Editor/plugin/link/link.js

class T2LinkPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertLink'];
    }

    handleCommand(command, button) {
        switch(command) {
            case 'insertLink':
                this.insertLink();
                break;
        }
    }

    onContentSet(html) {
        setTimeout(() => {
            this.initializeLinkBlocks();
        }, 100);
    }

    insertLink() {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
            T2Utils.showNotification('링크로 만들 텍스트를 선택해주세요.', 'warning');
            return;
        }

        const modalContent = `
            <div class="t2-link-editor-modal">
                <h3>링크 삽입</h3>
                <div class="t2-link-input-group">
                    <label>링크 주소:</label>
                    <input type="text" class="t2-link-url" placeholder="https://example.com">
                </div>
                <div class="t2-link-input-group">
                    <label>표시할 텍스트:</label>
                    <input type="text" class="t2-link-text" placeholder="링크 텍스트">
                </div>
                <div class="t2-link-preview">
                    <span>미리보기: </span>
                    <a class="t2-link-preview-anchor" href="#" target="_blank" style="color: #2563eb; text-decoration: underline;">선택한 텍스트</a>
                </div>
                <div class="t2-btn-group">
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="insert">삽입</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupLinkModalEvents(modal, selection);
    }

    setupLinkModalEvents(modal, selection) {
        const urlInput = modal.querySelector('.t2-link-url');
        const textInput = modal.querySelector('.t2-link-text');
        const previewAnchor = modal.querySelector('.t2-link-preview-anchor');
        const insertBtn = modal.querySelector('[data-action="insert"]');

        // 초기값 설정
        const selectedText = selection.toString().trim();
        textInput.value = selectedText;
        previewAnchor.textContent = selectedText;

        // URL 입력 시 미리보기 업데이트
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            previewAnchor.href = url || '#';
        });

        // 텍스트 입력 시 미리보기 업데이트
        textInput.addEventListener('input', () => {
            const text = textInput.value.trim();
            previewAnchor.textContent = text || selectedText;
        });

        // 삽입 버튼 클릭 이벤트
        insertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = urlInput.value.trim();
            const text = textInput.value.trim();

            if (!url) {
                T2Utils.showNotification('링크 주소를 입력해주세요.', 'error');
                return;
            }

            if (!text) {
                T2Utils.showNotification('링크 텍스트를 입력해주세요.', 'error');
                return;
            }

            this.createLink(url, text, selection);
            modal.remove();
        });

        // 취소 버튼 클릭 이벤트
        modal.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.remove();
        });

        // 엔터 키로 삽입
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                insertBtn.click();
            }
        });

        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                insertBtn.click();
            }
        });

        urlInput.focus();
    }

    createLink(url, text, selection) {
        const range = selection.getRangeAt(0);
        const linkElement = document.createElement('a');
        linkElement.href = url;
        linkElement.textContent = text;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.style.color = '#2563eb';
        linkElement.style.textDecoration = 'underline';

        // 선택된 텍스트를 링크로 교체
        range.deleteContents();
        range.insertNode(linkElement);

        // 링크 블록으로 감싸기
        const linkBlock = this.wrapLinkInBlock(linkElement);
        range.insertNode(linkBlock);

        this.editor.normalizeContent();
        this.editor.createUndoPoint();
        this.editor.autoSave();
    }

    wrapLinkInBlock(linkElement) {
        const linkBlock = document.createElement('div');
        linkBlock.className = 't2-media-block t2-link-block';
        linkBlock.contentEditable = false;

        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.margin = '0 auto';
        container.style.padding = '8px';
        container.style.border = '1px solid #e5e7eb';
        container.style.borderRadius = '4px';
        container.style.backgroundColor = '#f9fafb';

        const linkWrapper = document.createElement('div');
        linkWrapper.style.display = 'flex';
        linkWrapper.style.alignItems = 'center';
        linkWrapper.style.gap = '8px';

        const linkIcon = document.createElement('span');
        linkIcon.className = 'material-icons';
        linkIcon.textContent = 'link';
        linkIcon.style.color = '#6b7280';
        linkIcon.style.fontSize = '16px';

        const linkText = document.createElement('span');
        linkText.style.flex = '1';
        linkText.style.overflow = 'hidden';
        linkText.style.textOverflow = 'ellipsis';
        linkText.style.whiteSpace = 'nowrap';

        linkText.appendChild(linkElement);

        linkWrapper.appendChild(linkIcon);
        linkWrapper.appendChild(linkText);
        container.appendChild(linkWrapper);
        linkBlock.appendChild(container);

        const controls = this.createLinkControls(linkElement);
        linkBlock.appendChild(controls);

        return linkBlock;
    }

    createLinkControls(linkElement) {
        const controls = document.createElement('div');
        controls.className = 't2-media-controls';
        controls.contentEditable = false;

        controls.innerHTML = `
            <button class="t2-btn edit-btn" type="button">
                <span class="material-icons">edit</span>
            </button>
            <button class="t2-btn delete-btn" type="button">
                <span class="material-icons">delete</span>
            </button>
        `;

        const editBtn = controls.querySelector('.edit-btn');
        const deleteBtn = controls.querySelector('.delete-btn');

        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showEditLinkModal(linkElement, controls.closest('.t2-link-block'));
        });

        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const linkBlock = controls.closest('.t2-link-block');
            if (linkBlock) {
                linkBlock.remove();
                this.editor.createUndoPoint();
                this.editor.autoSave();
            }
        });

        return controls;
    }

    showEditLinkModal(linkElement, linkBlock) {
        const currentUrl = linkElement.href;
        const currentText = linkElement.textContent;

        const modalContent = `
            <div class="t2-link-editor-modal">
                <h3>링크 수정</h3>
                <div class="t2-link-input-group">
                    <label>링크 주소:</label>
                    <input type="text" class="t2-link-url" value="${currentUrl}">
                </div>
                <div class="t2-link-input-group">
                    <label>표시할 텍스트:</label>
                    <input type="text" class="t2-link-text" value="${currentText}">
                </div>
                <div class="t2-link-preview">
                    <span>미리보기: </span>
                    <a class="t2-link-preview-anchor" href="${currentUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">${currentText}</a>
                </div>
                <div class="t2-btn-group">
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="update">수정</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupEditLinkModalEvents(modal, linkElement, linkBlock);
    }

    setupEditLinkModalEvents(modal, linkElement, linkBlock) {
        const urlInput = modal.querySelector('.t2-link-url');
        const textInput = modal.querySelector('.t2-link-text');
        const previewAnchor = modal.querySelector('.t2-link-preview-anchor');
        const updateBtn = modal.querySelector('[data-action="update"]');

        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            previewAnchor.href = url || '#';
        });

        textInput.addEventListener('input', () => {
            const text = textInput.value.trim();
            previewAnchor.textContent = text || linkElement.textContent;
        });

        updateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = urlInput.value.trim();
            const text = textInput.value.trim();

            if (!url) {
                T2Utils.showNotification('링크 주소를 입력해주세요.', 'error');
                return;
            }

            if (!text) {
                T2Utils.showNotification('링크 텍스트를 입력해주세요.', 'error');
                return;
            }

            // 링크 요소 업데이트
            linkElement.href = url;
            linkElement.textContent = text;

            // 미리보기 업데이트
            const previewElement = linkBlock.querySelector('a');
            if (previewElement) {
                previewElement.href = url;
                previewElement.textContent = text;
            }

            modal.remove();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        });

        modal.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.remove();
        });

        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateBtn.click();
            }
        });

        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateBtn.click();
            }
        });

        urlInput.focus();
        urlInput.select();
    }

    initializeLinkBlocks() {
        // 기존 링크를 링크 블록으로 변환
        this.editor.editor.querySelectorAll('a[href]:not(.t2-link-block a)').forEach(link => {
            // 이미 링크 블록 안에 있으면 건너뜀
            if (link.closest('.t2-link-block')) return;

            // 일반 텍스트 링크만 변환
            const parent = link.parentElement;
            if (parent && parent.textContent === link.textContent) {
                const linkBlock = this.wrapLinkInBlock(link.cloneNode(true));
                parent.parentNode.replaceChild(linkBlock, parent);
            }
        });

        // 이미 링크 블록인 요소들 초기화
        this.editor.editor.querySelectorAll('.t2-link-block').forEach(block => {
            block.contentEditable = false;

            const linkElement = block.querySelector('a');
            if (linkElement) {
                linkElement.target = '_blank';
                linkElement.rel = 'noopener noreferrer';
            }

            // 컨트롤이 없으면 추가
            const existingControls = block.querySelector('.t2-media-controls');
            if (!existingControls && linkElement) {
                const controls = this.createLinkControls(linkElement);
                block.appendChild(controls);
            }

            // p 태그에서 빼내기
            if (block.parentNode.nodeName === 'P') {
                const p = block.parentNode;
                p.parentNode.insertBefore(block, p);
                p.remove();
            }
        });
    }
}

window.T2LinkPlugin = T2LinkPlugin;