//Path: T2Editor/plugin/link/link.js

class T2LinkPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['createLink'];
        
        // 에디터 초기화 시 링크 이벤트 즉시 설정
        setTimeout(() => {
            this.initializeLinks();
        }, 100);
        
        // 에디터 클릭 이벤트 리스너 추가 (동적으로 추가된 링크 감지)
        this.editorClickHandler = (e) => {
            if (e.target.tagName === 'A' && this.editor.editor.contains(e.target)) {
                this.handleLinkClick(e, e.target);
            }
        };
        this.editor.editor.addEventListener('click', this.editorClickHandler);
    }

    handleCommand(command, button) {
        switch(command) {
            case 'createLink':
                this.showLinkModal();
                break;
        }
    }

    onContentSet(html) {
        // 컨텐츠 설정 시 링크 초기화
        setTimeout(() => {
            this.initializeLinks();
        }, 50);
    }

    showLinkModal() {
        const selection = window.getSelection();
        
        // 선택된 텍스트가 없으면 알림
        if (!selection.rangeCount || selection.getRangeAt(0).collapsed) {
            T2Utils.showNotification('텍스트를 선택한 후 링크를 추가해주세요.', 'warning');
            return;
        }
        
        const range = selection.getRangeAt(0);
        
        // 현재 선택영역 저장
        this.editor.saveSelection();
        
        // 선택 영역의 링크 검색
        let existingLink = this.findExistingLink(range);
        
        const modalContent = `
            <div class="t2-link-editor-modal">
                <h3>${existingLink ? '링크 수정' : '링크 추가'}</h3>
                <div class="t2-link-input-container">
                    <input type="text" class="t2-link-url-input" 
                           placeholder="https://" 
                           value="${existingLink ? existingLink.href : ''}">
                    <div class="t2-link-options">
                        <label>
                           <input type="checkbox" class="t2-link-new-tab" ${existingLink ? (existingLink.target === '_blank' ? 'checked' : '') : 'checked'}>
                            새 탭에서 열기
                        </label>
                    </div>
                </div>
                <div class="t2-btn-group">
                    ${existingLink ? '<button class="t2-btn" data-action="remove">링크 제거</button>' : ''}
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="insert">${existingLink ? '수정' : '추가'}</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupLinkModalEvents(modal, existingLink);
    }

    setupLinkModalEvents(modal, existingLink) {
        const urlInput = modal.querySelector('.t2-link-url-input');
        const newTabCheckbox = modal.querySelector('.t2-link-new-tab');

        // 이벤트 핸들러
        const handleLink = () => {
            const url = urlInput.value.trim();
            const newTab = newTabCheckbox.checked;
            
            if (!url) {
                T2Utils.showNotification('URL을 입력해주세요.', 'warning');
                return;
            }
            
            // URL 형식 검증
            let finalUrl = url;
            if (!/^https?:\/\//i.test(url)) {
                finalUrl = 'http://' + url;
            }
            
            if (!T2Utils.validateUrl(finalUrl)) {
                T2Utils.showNotification('올바른 URL 형식이 아닙니다.', 'error');
                return;
            }
            
            this.editor.restoreSelection();
            
            try {
                const selection = window.getSelection();
                if (!selection.rangeCount) {
                    T2Utils.showNotification('선택 영역을 찾을 수 없습니다.', 'error');
                    return;
                }
                
                const range = selection.getRangeAt(0);
                
                if (existingLink) {
                    // 기존 링크 수정
                    existingLink.href = finalUrl;
                    existingLink.target = newTab ? '_blank' : '';
                    existingLink.rel = newTab ? 'noopener noreferrer' : '';
                } else {
                    // 새 링크 생성
                    const selectedText = range.toString();
                    if (!selectedText) {
                        T2Utils.showNotification('텍스트가 선택되지 않았습니다.', 'warning');
                        return;
                    }
                    
                    const newLink = this.createLinkElement(finalUrl, selectedText, newTab);
                    
                    range.deleteContents();
                    range.insertNode(newLink);
                    
                    // 커서를 링크 다음으로 이동
                    range.setStartAfter(newLink);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                
                modal.remove();
                this.editor.createUndoPoint();
                this.editor.autoSave();
                this.editor.normalizeContent();
                
                // 새로 생성된 링크에 이벤트 설정
                setTimeout(() => {
                    this.initializeLinks();
                }, 50);
            } catch (error) {
                console.error('Link creation error:', error);
                T2Utils.showNotification('링크를 적용하는 중 오류가 발생했습니다.', 'error');
            }
        };
        
        // 모달 버튼 이벤트 설정
        modal.querySelector('[data-action="insert"]').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLink();
        };
        
        modal.querySelector('[data-action="cancel"]').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.remove();
        };
        
        if (existingLink) {
            modal.querySelector('[data-action="remove"]').onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeLinkFromSelection(existingLink);
                modal.remove();
            };
        }
        
        // Enter 키 이벤트
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLink();
            }
        });
        
        // 모달이 열렸을 때 포커스
        setTimeout(() => {
            urlInput.focus();
            urlInput.select();
        }, 100);
    }

    findExistingLink(range) {
        const startNode = range.startContainer;
        const endNode = range.endContainer;
        
        // 현재 선택된 노드가 속한 링크 찾기
        const findLinkParent = (node) => {
            while (node && node !== this.editor.editor) {
                if (node.nodeName === 'A') {
                    return node;
                }
                node = node.parentNode;
            }
            return null;
        };
        
        // 선택 영역의 시작점이 링크 내부인지 확인
        const startLink = findLinkParent(startNode);
        const endLink = findLinkParent(endNode);
        
        // 선택 영역이 단일 링크 내부에 있는 경우
        if (startLink && startLink === endLink) {
            return startLink;
        }
        
        // 선택 영역이 정확히 하나의 링크와 일치하는지 확인
        const selectedText = range.toString();
        
        // 시작점부터 끝점까지의 모든 링크 요소 수집
        const allLinks = [];
        const commonAncestor = range.commonAncestorContainer;
        
        if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
            const treeWalker = document.createTreeWalker(
                commonAncestor,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        return node.nodeName === 'A' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                    }
                }
            );
            
            let currentNode;
            while (currentNode = treeWalker.nextNode()) {
                if (range.intersectsNode(currentNode)) {
                    if (currentNode.textContent === selectedText) {
                        return currentNode;
                    }
                    allLinks.push(currentNode);
                }
            }
        }
        
        // 정확히 하나의 링크만 선택된 경우
        if (allLinks.length === 1 && allLinks[0].textContent === selectedText) {
            return allLinks[0];
        }
        
        return null;
    }

    createLinkElement(url, text, newTab = false) {
        const link = document.createElement('a');
        link.href = url;
        link.textContent = text;
        
        if (newTab) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        
        // 링크 스타일 적용
        link.style.color = '#4A90E2';
        link.style.textDecoration = 'none';
        
        // 새로 생성된 링크에도 즉시 이벤트 설정
        this.setupLinkEvents(link);
        
        return link;
    }

    removeLinkFromSelection(existingLink) {
        this.editor.restoreSelection();
        
        try {
            const parent = existingLink.parentNode;
            
            // 링크의 텍스트 콘텐츠를 텍스트 노드로 변환
            const textNode = document.createTextNode(existingLink.textContent);
            parent.replaceChild(textNode, existingLink);
            
            // 커서를 텍스트 노드 끝으로 이동
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStart(textNode, textNode.length);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.editor.createUndoPoint();
            this.editor.autoSave();
            this.editor.normalizeContent();
        } catch (error) {
            console.error('Link removal error:', error);
            T2Utils.showNotification('링크를 제거하는 중 오류가 발생했습니다.', 'error');
        }
    }

    showLinkPreview(link) {
        // 기존 미리보기 제거
        const existingPreview = this.editor.container.querySelector('.t2-link-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        const preview = document.createElement('div');
        preview.className = 't2-link-preview';
        preview.innerHTML = `
            <div class="t2-link-preview-content">
                <div class="t2-link-preview-url">${this.truncateUrl(link.href, 50)}</div>
                <div class="t2-link-preview-actions">
                    <button class="t2-btn t2-link-edit" data-action="edit">편집</button>
                    <button class="t2-btn t2-link-remove" data-action="remove">제거</button>
                    <button class="t2-btn t2-link-visit" data-action="visit">방문</button>
                </div>
            </div>
        `;

        // 미리보기 위치 설정
        const linkRect = link.getBoundingClientRect();
        const editorRect = this.editor.editor.getBoundingClientRect();
        
        preview.style.position = 'absolute';
        preview.style.top = (linkRect.bottom - editorRect.top + 5) + 'px';
        preview.style.left = (linkRect.left - editorRect.left) + 'px';
        preview.style.zIndex = '1000';

        // 이벤트 설정
        preview.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = e.target.closest('[data-action]')?.dataset.action;
            
            switch(action) {
                case 'edit':
                    this.editLink(link);
                    break;
                case 'remove':
                    this.removeLink(link);
                    break;
                case 'visit':
                    window.open(link.href, link.target || '_blank');
                    break;
            }
            
            preview.remove();
        });

        this.editor.container.style.position = 'relative';
        this.editor.container.appendChild(preview);

        // 외부 클릭 시 제거
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

    editLink(link) {
        // 링크 텍스트 선택
        const range = document.createRange();
        range.selectNodeContents(link);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 링크 모달 표시
        this.showLinkModal();
    }

    removeLink(link) {
        const parent = link.parentNode;
        const textNode = document.createTextNode(link.textContent);
        parent.replaceChild(textNode, link);
        
        this.editor.createUndoPoint();
        this.editor.autoSave();
        this.editor.normalizeContent();
    }

    initializeLinks() {
        // 에디터 내의 모든 링크에 이벤트 추가
        const links = this.editor.editor.querySelectorAll('a');
        links.forEach(link => {
            // 이미 이벤트가 설정되지 않은 링크만 처리
            if (!link.dataset.linkEventsSetup) {
                this.setupLinkEvents(link);
            }
        });
    }

    setupLinkEvents(link) {
        // 링크 클릭 핸들러
        const clickHandler = (e) => {
            this.handleLinkClick(e, link);
        };
        
        // 기존 이벤트 제거 후 새로 추가
        link.removeEventListener('click', clickHandler);
        link.addEventListener('click', clickHandler);

        // 링크 호버 이벤트
        link.addEventListener('mouseenter', () => {
            link.style.textDecoration = 'underline';
        });

        link.addEventListener('mouseleave', () => {
            link.style.textDecoration = 'none';
        });

        // 이벤트 설정 완료 표시
        link.dataset.linkEventsSetup = 'true';
    }

    handleLinkClick(e, link) {
        // contentEditable이 활성화된 상태에서만 처리
        if (this.editor.editor.contentEditable === 'true' || this.editor.editor.isContentEditable) {
            e.preventDefault();
            e.stopPropagation();
            
            // Ctrl/Cmd + 클릭으로 링크 열기
            if (e.ctrlKey || e.metaKey) {
                window.open(link.href, link.target || '_blank');
            } else {
                // 링크 미리보기 표시
                this.showLinkPreview(link);
            }
        }
    }

    truncateUrl(url, maxLength) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    // 자동 링크 감지 및 변환 (선택적 기능)
    autoLinkDetection(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #4A90E2; text-decoration: none;">${url}</a>`;
        });
    }

    // 이메일 자동 링크 감지 (선택적 기능)
    autoEmailDetection(text) {
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
        return text.replace(emailRegex, (email) => {
            return `<a href="mailto:${email}" style="color: #4A90E2; text-decoration: none;">${email}</a>`;
        });
    }
}

window.T2LinkPlugin = T2LinkPlugin;