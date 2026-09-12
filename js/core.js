//Path: T2Editor/js/core.js
class T2Editor {
    constructor(container) {
        this.container = container;
        this.editor = container.querySelector('.t2-editor');
        this.toolbar = container.querySelector('.t2-toolbar');
        this.plugins = new Map();
        this.config = {
            autoSave: true,
            plugins: ['image', 'video', 'file', 'table', 'code', 'link', 'export', 'collab', 'draw']
        };
        
        // 디바이스 및 브라우저 감지
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        // 상태 관리
        this.alignmentState = 'left';
        this.bulletState = { active: false, type: null, count: 1 };
        this.undoStack = [];
        this.redoStack = [];
        this.lastCheckpoint = null;
        this.savedSelection = null;
        
        // DOM 요소 참조
        this.undoBtn = container.querySelector('[data-command="undo"]');
        this.redoBtn = container.querySelector('[data-command="redo"]');
        this.charCount = container.querySelector('.t2-char-count span');
        
        // 자동 저장 설정
        this.autoSaveEnabled = localStorage.getItem('t2editor-autosave-enabled') !== 'false';
        
        // Collab 플러그인 상태
        this.collab = null;
        
        this.init();
    }

    init() {
        this.setupEditor();
        this.setupEventListeners();
        this.setupAutoSaveToggle();
        this.setupBeforeUnload();
        
        if (this.autoSaveEnabled) {
            this.loadAutoSave();
        }
        
        this.updateUndoRedoButtons();
        this.updateCharCount();
        
        // 플러그인 로딩
        this.loadPlugins();
    }

    setupEditor() {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        this.editor.appendChild(p);
        
        this.editor.style.whiteSpace = 'pre-wrap';
        this.editor.style.wordBreak = 'break-word';
    }

    setupEventListeners() {
        // 툴바 이벤트
        this.toolbar.addEventListener('click', (e) => {
            const button = e.target.closest('.t2-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const command = button.dataset.command;
            this.handleCommand(command, button);
        });

        // 선택 변경 시 서식 버튼 상태 업데이트
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this.editor || this.editor.contains(document.activeElement)) {
                this.updateFormatButtons();
            }
        });

        // 키보드 이벤트
        if (this.isIOS || this.isSafari) {
            this.editor.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace') {
                    this.handleBackspace(e);
                }
            });
        } else {
            this.editor.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleEnterKey();
                } else if (e.key === 'Backspace') {
                    this.handleBackspace(e);
                }
            });
        }

        // 에디터 입력 이벤트
        this.editor.addEventListener('input', (e) => {
            this.handleInput(e);
        });

        // 붙여넣기 이벤트
        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e.clipboardData);
        });

        // DOM 노드 삽입 이벤트
        this.editor.addEventListener('DOMNodeInserted', (e) => {
            this.handleNodeInserted(e);
        });
    }

    // 서식 버튼 상태 업데이트
    updateFormatButtons() {
        const formatCommands = ['bold', 'italic', 'underline', 'strikeThrough'];
        
        formatCommands.forEach(command => {
            const button = this.toolbar.querySelector(`[data-command="${command}"]`);
            if (!button) return;
            
            try {
                const isActive = document.queryCommandState(command);
                if (isActive) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            } catch (e) {
                // queryCommandState 실패 시 무시
            }
        });
    }

    handleCommand(command, button) {
        // 먼저 플러그인에서 처리할 수 있는지 확인
        for (let [name, plugin] of this.plugins) {
            if (plugin.commands && plugin.commands.includes(command)) {
                console.log(`Command '${command}' handled by plugin '${name}'`);
                plugin.handleCommand(command, button);
                this.createUndoPoint();
                return;
            }
        }

        // 플러그인에서 처리하지 않으면 기본 명령어 처리
        switch(command) {
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'fontSize':
                this.showFontSizeList(button);
                break;
            case 'justifyContent':
                this.toggleAlignment(button);
                break;
            case 'foreColor':
            case 'backColor':
                this.saveSelection();
                this.showColorPalette(command, button);
                break;
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strikeThrough':
                this.execCommand(command);
                this.editor.focus();
                setTimeout(() => this.updateFormatButtons(), 0);
                break;
            default:
                // 알 수 없는 명령어는 로그만 출력
                console.warn(`Unknown command: ${command}`);
                break;
        }
        
        this.createUndoPoint();
    }

    handleInput(e) {
        this.autoSave();
        this.handleBulletPoints();
        
        if (this.isIOS || this.isSafari) {
            requestAnimationFrame(() => {
                this.normalizeContent();
            });
        } else {
            this.normalizeContent();
        }
        
        this.createUndoPoint();
        this.updateCharCount();
    }

    handleEnterKey() {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        let currentBlock = this.getClosestBlock(range.startContainer);
        
        if (!currentBlock || currentBlock === this.editor) {
            currentBlock = document.createElement('p');
            currentBlock.innerHTML = '<br>';
            this.editor.appendChild(currentBlock);
            this.setCaretToStart(currentBlock);
            return;
        }
        
        const newBlock = document.createElement('p');
        
        if (range.collapsed) {
            const beforeRange = document.createRange();
            beforeRange.selectNodeContents(currentBlock);
            beforeRange.setEnd(range.startContainer, range.startOffset);
            const afterRange = document.createRange();
            afterRange.selectNodeContents(currentBlock);
            afterRange.setStart(range.startContainer, range.startOffset);
            
            const beforeContent = beforeRange.cloneContents();
            const afterContent = afterRange.cloneContents();
            
            if (beforeContent.textContent.trim()) {
                currentBlock.innerHTML = '';
                currentBlock.appendChild(beforeContent);
            } else {
                currentBlock.innerHTML = '<br>';
            }
            
            if (afterContent.textContent.trim()) {
                newBlock.appendChild(afterContent);
            } else {
                newBlock.innerHTML = '<br>';
            }
        } else {
            newBlock.innerHTML = '<br>';
        }
        
        currentBlock.parentNode.insertBefore(newBlock, currentBlock.nextSibling);
        this.setCaretToStart(newBlock);
        
        this.normalizeContent();
        this.createUndoPoint();
        this.autoSave();
    }

    handleBackspace(e) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        if (this.editor.childNodes.length <= 1) {
            const onlyBlock = this.editor.firstElementChild;
            if (!onlyBlock || onlyBlock.textContent.trim() === '') {
                e.preventDefault();
                if (!onlyBlock || onlyBlock.tagName !== 'P') {
                    this.resetEditor();
                }
                return;
            }
        }
        
        if (range.collapsed && this.isAtBlockStart(range)) {
            e.preventDefault();
            
            const currentBlock = this.getClosestBlock(range.startContainer);
            if (!currentBlock || currentBlock === this.editor) return;
            
            const previousBlock = currentBlock.previousElementSibling;
            if (!previousBlock) return;
            
            this.mergeBlocks(previousBlock, currentBlock);
            this.createUndoPoint();
        }
        
        setTimeout(() => this.normalizeContent(), 0);
    }

    handlePaste(clipboardData) {
        // 플러그인에서 붙여넣기 처리
        for (let [name, plugin] of this.plugins) {
            if (plugin.handlePaste && plugin.handlePaste(clipboardData)) {
                return; // 플러그인에서 처리됨
            }
        }

        // 기본 텍스트 붙여넣기 처리
        const plainText = clipboardData.getData('text/plain');
        const htmlText = clipboardData.getData('text/html');
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // 선택된 텍스트가 있으면 먼저 삭제
        if (!range.collapsed) {
            range.deleteContents();
        }
        
        // 현재 커서 위치와 블록 정보 저장
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        const currentBlock = this.getClosestBlock(startContainer) || this.editor;
        
        // 붙여넣기 전에 현재 블록의 텍스트 내용 저장
        const originalBlockText = currentBlock.textContent;
        const textBeforeCursor = originalBlockText.substring(0, startOffset);
        const textAfterCursor = originalBlockText.substring(startOffset);
        
        if (htmlText && !this.isIOS && !this.isSafari) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlText;
            
            this.cleanupPastedHTML(tempDiv);
            
            // HTML 내용을 텍스트로 변환하여 붙여넣기
            const pastedContent = tempDiv.textContent || tempDiv.innerText;
            const pastedLines = pastedContent.split(/\r?\n/);
            
            // 새로운 내용 구성
            let newContent = textBeforeCursor;
            let lastLine = '';
            
            pastedLines.forEach((line, index) => {
                if (index === 0) {
                    newContent += line;
                    lastLine = line;
                } else {
                    newContent += '\n' + line;
                    lastLine = line;
                }
            });
            
            newContent += textAfterCursor;
            
            // 현재 블록의 내용 업데이트
            if (currentBlock === this.editor) {
                // 에디터 자체가 블록인 경우 p 태그 생성
                const p = document.createElement('p');
                p.textContent = newContent;
                this.editor.innerHTML = '';
                this.editor.appendChild(p);
                
                // 커서 위치 계산: 붙여넣은 내용의 마지막 위치
                const cursorPosition = textBeforeCursor.length + pastedContent.length;
                setTimeout(() => {
                    this.setCaretPosition(p, cursorPosition);
                }, 0);
            } else {
                // 일반 블록인 경우
                currentBlock.textContent = newContent;
                
                // 커서 위치 계산: 붙여넣은 내용의 마지막 위치
                const cursorPosition = textBeforeCursor.length + pastedContent.length;
                setTimeout(() => {
                    this.setCaretPosition(currentBlock, cursorPosition);
                }, 0);
            }
        } else {
            // 일반 텍스트 붙여넣기
            const pastedLines = plainText.split(/\r?\n/);
            
            if (pastedLines.length === 1) {
                // 한 줄만 붙여넣는 경우
                const newText = textBeforeCursor + plainText + textAfterCursor;
                
                if (currentBlock === this.editor) {
                    const p = document.createElement('p');
                    p.textContent = newText;
                    this.editor.innerHTML = '';
                    this.editor.appendChild(p);
                    
                    const cursorPosition = textBeforeCursor.length + plainText.length;
                    setTimeout(() => {
                        this.setCaretPosition(p, cursorPosition);
                    }, 0);
                } else {
                    currentBlock.textContent = newText;
                    const cursorPosition = textBeforeCursor.length + plainText.length;
                    setTimeout(() => {
                        this.setCaretPosition(currentBlock, cursorPosition);
                    }, 0);
                }
            } else {
                // 여러 줄 붙여넣는 경우
                let newBlocks = [];
                
                // 첫 번째 블록: 커서 앞의 텍스트 + 첫 번째 줄
                const firstBlockText = textBeforeCursor + pastedLines[0];
                if (firstBlockText.trim() !== '') {
                    const firstBlock = document.createElement('p');
                    firstBlock.textContent = firstBlockText;
                    newBlocks.push(firstBlock);
                }
                
                // 중간 블록들: 두 번째 줄부터 마지막 전 줄까지
                for (let i = 1; i < pastedLines.length - 1; i++) {
                    if (pastedLines[i].trim() !== '') {
                        const middleBlock = document.createElement('p');
                        middleBlock.textContent = pastedLines[i];
                        newBlocks.push(middleBlock);
                    }
                }
                
                // 마지막 블록: 마지막 줄 + 커서 뒤의 텍스트
                const lastBlockText = pastedLines[pastedLines.length - 1] + textAfterCursor;
                if (lastBlockText.trim() !== '') {
                    const lastBlock = document.createElement('p');
                    lastBlock.textContent = lastBlockText;
                    newBlocks.push(lastBlock);
                }
                
                // 기존 블록 교체
                if (currentBlock.parentNode) {
                    newBlocks.forEach((block, index) => {
                        if (index === 0) {
                            currentBlock.parentNode.replaceChild(block, currentBlock);
                        } else {
                            currentBlock.parentNode.insertBefore(block, newBlocks[index - 1].nextSibling);
                        }
                    });
                    
                    // 커서를 마지막 블록의 붙여넣은 텍스트 끝으로 이동
                    const lastBlock = newBlocks[newBlocks.length - 1];
                    const cursorPosition = pastedLines[pastedLines.length - 1].length;
                    setTimeout(() => {
                        this.setCaretPosition(lastBlock, cursorPosition);
                    }, 0);
                }
            }
        }
        
        this.normalizeContent();
        this.createUndoPoint();
        this.autoSave();
    }

    setCaretPosition(element, offset) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        // 요소 내의 모든 텍스트 노드를 찾기
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        if (textNodes.length === 0) {
            // 텍스트 노드가 없으면 요소 자체에 설정
            range.setStart(element, Math.min(offset, element.childNodes.length));
            range.collapse(true);
        } else {
            // 텍스트 노드들이 있으면 오프셋 계산
            let currentOffset = 0;
            let targetNode = null;
            let targetOffset = 0;
            
            for (let i = 0; i < textNodes.length; i++) {
                const textNode = textNodes[i];
                const nodeLength = textNode.textContent.length;
                
                if (offset <= currentOffset + nodeLength) {
                    targetNode = textNode;
                    targetOffset = offset - currentOffset;
                    break;
                }
                currentOffset += nodeLength;
            }
            
            if (!targetNode) {
                // 오프셋이 모든 텍스트를 넘어서면 마지막 텍스트 노드의 끝으로
                targetNode = textNodes[textNodes.length - 1];
                targetOffset = targetNode.textContent.length;
            }
            
            range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
            range.collapse(true);
        }
        
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 요소에 포커스 주기
        element.focus();
    }

    handleNodeInserted(e) {
        if (e.target.nodeType === Node.TEXT_NODE && e.target.parentNode === this.editor) {
            const p = document.createElement('p');
            e.target.parentNode.insertBefore(p, e.target);
            p.appendChild(e.target);
            this.normalizeContent();
        }
    }

    // 유틸리티 메서드들
    getClosestBlock(node) {
        const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE'];
        while (node && node !== this.editor) {
            if (blockTags.includes(node.nodeName)) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    }

    isBlockElement(element) {
        const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE'];
        return blockTags.includes(element.tagName);
    }

    isAtBlockStart(range) {
        const block = this.getClosestBlock(range.startContainer);
        if (!block) return false;
        
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        blockRange.collapse(true);
        
        return range.compareBoundaryPoints(Range.START_TO_START, blockRange) === 0;
    }

    setCaretToStart(element) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        let target = element.firstChild;
        while (target && target.nodeType === Node.ELEMENT_NODE && target.tagName !== 'BR') {
            target = target.firstChild;
        }
        
        if (!target) {
            range.setStart(element, 0);
        } else if (target.nodeType === Node.TEXT_NODE) {
            range.setStart(target, 0);
        } else {
            range.setStartBefore(target);
        }
        
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    setCaretPosition(element, offset) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        let targetNode = element.firstChild;
        while (targetNode && targetNode.nodeType !== Node.TEXT_NODE) {
            targetNode = targetNode.firstChild;
        }
        
        if (!targetNode) {
            targetNode = element;
            offset = 0;
        }
        
        range.setStart(targetNode, Math.min(offset, targetNode.length));
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);
    }

    mergeBlocks(target, source) {
        const caretPosition = target.textContent.length;
        
        if (target.innerHTML === '<br>') {
            target.innerHTML = '';
        }
        if (source.innerHTML === '<br>') {
            source.innerHTML = '';
        }
        
        while (source.firstChild) {
            target.appendChild(source.firstChild);
        }
        source.remove();
        
        this.setCaretPosition(target, caretPosition);
        this.normalizeContent();
    }

    normalizeContent() {
        const blocks = Array.from(this.editor.childNodes);
        let lastMediaBlock = null;

        blocks.forEach((node, index) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const p = document.createElement('p');
                node.parentNode.insertBefore(p, node);
                p.appendChild(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const isMediaBlock = node.classList?.contains('t2-media-block') ||
                                   node.classList?.contains('t2-code-block') ||
                                   node.classList?.contains('t2-file-block');

                if (isMediaBlock) {
                    // 모든 미디어 블록은 p 태그로 감싸지 않음
                    node.contentEditable = false;
                    
                    // 연속된 빈 p 태그 제거
                    let prevSibling = node.previousElementSibling;
                    let emptyCount = 0;
                    
                    while (prevSibling && prevSibling.tagName === 'P' && 
                           !prevSibling.textContent.trim() && 
                           (prevSibling.innerHTML === '<br>' || prevSibling.querySelector('br'))) {
                        emptyCount++;
                        const toRemove = prevSibling;
                        prevSibling = prevSibling.previousElementSibling;
                        
                        if (emptyCount > 1) {
                            toRemove.remove();
                        }
                    }
                    
                    let nextSibling = node.nextElementSibling;
                    emptyCount = 0;
                    
                    while (nextSibling && nextSibling.tagName === 'P' && 
                           !nextSibling.textContent.trim() && 
                           (nextSibling.innerHTML === '<br>' || nextSibling.querySelector('br'))) {
                        emptyCount++;
                        const toRemove = nextSibling;
                        nextSibling = nextSibling.nextElementSibling;
                        
                        if (emptyCount > 1) {
                            toRemove.remove();
                        }
                    }
                    
                    lastMediaBlock = node;
                } else {
                    // 일반 블록 처리
                    if (!node.textContent.trim() && !node.querySelector('br, img, iframe, video')) {
                        if (this.isIOS || this.isSafari) {
                            node.innerHTML = '<br>';
                        } else {
                            node.innerHTML = '\u200B<br>';
                        }
                    }
                }
            }
        });

        if (!this.editor.firstChild) {
            const p = document.createElement('p');
            if (this.isIOS || this.isSafari) {
                p.innerHTML = '<br>';
            } else {
                p.innerHTML = '\u200B<br>';
            }
            this.editor.appendChild(p);
        }
    }

    cleanupPastedHTML(element) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );
        
        const nodesToRemove = [];
        let node;
        
        while (node = walker.nextNode()) {
            node.removeAttribute('style');
            node.removeAttribute('class');
            
            if (['STYLE', 'SCRIPT', 'META'].includes(node.tagName)) {
                nodesToRemove.push(node);
            }
            
            if (this.isBlockElement(node) && !node.textContent.trim()) {
                node.innerHTML = '<br>';
            }
        }
        
        nodesToRemove.forEach(node => node.parentNode.removeChild(node));
    }

    resetEditor() {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        this.editor.innerHTML = '';
        this.editor.appendChild(p);
        this.setCaretToStart(p);
    }

    // 실행 취소/재실행
    createUndoPoint() {
        const currentContent = this.editor.innerHTML;
        if (currentContent === this.lastCheckpoint) return;
        
        this.undoStack.push(this.lastCheckpoint);
        this.lastCheckpoint = currentContent;
        this.redoStack = [];
        
        if (this.undoStack.length > 100) {
            this.undoStack.shift();
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const currentContent = this.editor.innerHTML;
        this.redoStack.push(currentContent);
        
        const previousContent = this.undoStack.pop();
        this.lastCheckpoint = previousContent;
        this.editor.innerHTML = previousContent;
        
        this.updateUndoRedoButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const currentContent = this.editor.innerHTML;
        this.undoStack.push(currentContent);
        
        const nextContent = this.redoStack.pop();
        this.lastCheckpoint = nextContent;
        this.editor.innerHTML = nextContent;
        
        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        this.undoBtn.disabled = this.undoStack.length === 0;
        this.redoBtn.disabled = this.redoStack.length === 0;
    }

    // 기본 명령어 실행
    execCommand(command, value = null) {
        document.execCommand('styleWithCSS', false, true);
        
        switch(command) {
            case 'fontSize':
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                
                const span = document.createElement('span');
                span.style.fontSize = value + 'px';
                
                const existingSpan = range.commonAncestorContainer.parentElement;
                if (existingSpan && existingSpan.style.fontSize) {
                    existingSpan.style.fontSize = value + 'px';
                } else {
                    range.surroundContents(span);
                }
                break;
            default:
                document.execCommand(command, false, value);
        }
        
        this.normalizeContent();
    }

    // 선택 영역 저장/복원
    saveSelection() {
        if (window.getSelection) {
            this.savedSelection = window.getSelection().getRangeAt(0).cloneRange();
        }
    }

    restoreSelection() {
        if (this.savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
        }
    }

    // 자동 저장
    setupAutoSaveToggle() {
        const statusBar = this.container.querySelector('.t2-editor-status');
        const autoSaveToggle = document.createElement('div');
        autoSaveToggle.className = 't2-autosave-toggle';

        autoSaveToggle.innerHTML = `
            <label class="t2-switch">
                <input type="checkbox" ${this.autoSaveEnabled ? 'checked' : ''}>
                <span class="t2-slider"></span>
            </label>
            <span class="t2-autosave-text">자동 저장</span>
        `;

        const toggleCheckbox = autoSaveToggle.querySelector('input[type="checkbox"]');
        
        toggleCheckbox.addEventListener('change', (e) => {
            this.autoSaveEnabled = e.target.checked;
            localStorage.setItem('t2editor-autosave-enabled', this.autoSaveEnabled);

            if (!this.autoSaveEnabled) {
                this.clearAutoSave();
            } else {
                this.autoSave();
            }
        });

        const logo = statusBar.querySelector('.t2-logo').parentElement;
        logo.parentNode.insertBefore(autoSaveToggle, logo.nextSibling);
    }

    autoSave() {
        // Collab 모드에서는 자동 저장을 하지 않음
        if (this.collab) {
            return;
        }

        if (!this.autoSaveEnabled) return;

        const content = this.editor.innerHTML;
        const normalizedContent = content.replace(/<p>\s*<\/p>/g, '<p><br></p>');
        localStorage.setItem('t2editor-autosave', normalizedContent);
    }

    loadAutoSave() {
        // Collab 모드에서는 자동 저장된 내용을 불러오지 않음
        if (this.collab) {
            return;
        }

        if (!this.autoSaveEnabled) return;

        const saved = localStorage.getItem('t2editor-autosave');
        if (saved) {
            this.editor.innerHTML = saved;
            this.normalizeContent();
        }
    }

    clearAutoSave() {
        localStorage.removeItem('t2editor-autosave');
    }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => {
            // Collab 모드가 아닐 때만 자동 저장
            if (this.autoSaveEnabled && !this.collab) {
                this.autoSave();
            }
        });
    }

    updateCharCount() {
        let text = this.editor.textContent;
        text = text.replace(/\s+/g, '');
        this.charCount.textContent = text.length;
    }

    // 글꼴 크기 관련
    showFontSizeList(button) {
        const sizes = ['11', '13', '15', '16', '19', '24', '30', '34', '38'];
        const list = document.createElement('div');
        list.className = 't2-font-size-list';
        list.style.cssText = `
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 5px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-width: 120px;
        `;
        
        const currentFontSize = this.getCurrentFontSize();
        
        sizes.forEach(size => {
            const option = document.createElement('div');
            option.className = 't2-font-size-option';
            
            const isCurrentSize = parseInt(size) === currentFontSize;
            
            const optionContent = document.createElement('div');
            optionContent.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
            `;
            
            const sizeText = document.createElement('span');
            sizeText.textContent = `${size}px`;
            optionContent.appendChild(sizeText);
            
            if (isCurrentSize) {
                const checkmark = document.createElement('span');
                checkmark.className = 'material-icons';
                checkmark.textContent = 'check';
                checkmark.style.fontSize = '16px';
                checkmark.style.color = '#1a73e8';
                optionContent.appendChild(checkmark);
            }
            
            option.appendChild(optionContent);
            
            option.style.cssText = `
                padding: 5px 15px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.1s ease;
                ${isCurrentSize ? 'background-color: #e8f0fe; font-weight: 500;' : ''}
            `;
            
            option.addEventListener('mouseenter', () => {
                option.style.backgroundColor = isCurrentSize ? '#d2e3fc' : '#f5f5f5';
            });
            
            option.addEventListener('mouseleave', () => {
                option.style.backgroundColor = isCurrentSize ? '#e8f0fe' : 'transparent';
            });
            
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.execCommand('fontSize', size);
                list.parentElement.remove();
                this.createUndoPoint();
            });
            
            list.appendChild(option);
        });
        
        this.showDropdown(list, button);
    }

    getCurrentFontSize() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        
        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode;
        }
        
        while (node && node !== this.editor) {
            const fontSize = window.getComputedStyle(node).fontSize;
            if (fontSize && fontSize !== 'inherit') {
                return parseInt(fontSize);
            }
            node = node.parentNode;
        }
        
        return parseInt(window.getComputedStyle(this.editor).fontSize);
    }

// 색상 팔레트
showColorPalette(command, button) {
    const self = this; // this 컨텍스트 보존

    // 버튼 위치 계산
    const buttonRect = button.getBoundingClientRect();
    const toolbarRect = this.toolbar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // 팔레트 크기
    const pickerHeight = 325;
    const pickerWidth = pickerHeight * 0.65;

    const pickerContainer = document.createElement('div');
    pickerContainer.className = 't2-color-picker-container';

    // 툴바 기준 상대 위치 계산
    let left = buttonRect.left - toolbarRect.left;

    // 오른쪽으로 벗어나면 조정
    if (buttonRect.left + pickerWidth > viewportWidth - 10) {
        left = viewportWidth - toolbarRect.left - pickerWidth - 10;
    }

    // 왼쪽으로 벗어나면 조정
    if (left < 0) {
        left = 0;
    }

    pickerContainer.style.cssText = `
        position: absolute;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        padding: 12px;
        width: ${pickerWidth}px;
        height: ${pickerHeight}px;
        left: ${left}px;
        top: ${buttonRect.bottom - toolbarRect.top + 8}px;
        z-index: 10000;
        overflow: hidden;
        border: 1px solid #ddd;
    `;

    // 현재 색상값 (H, S, L)
    let currentHue = 0;
    let currentSaturation = 100;
    let currentLightness = 50;

    const updateColor = () => {
        const hex = hslToHex(currentHue, currentSaturation, currentLightness);
        colorPreview.style.backgroundColor = hex;
        colorInput.value = hex;
        updateSaturationSlider();
        updateLightnessSlider();
    };

    // --- 상단 hue 컬러 버튼 ---
    const hueSlider = document.createElement('div');
    hueSlider.style.cssText = `
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
        overflow-x: auto;
        padding-bottom: 2px;
    `;
    const hueColors = [
        { hue: 0, color: '#ef4444' }, { hue: 30, color: '#f97316' },
        { hue: 60, color: '#eab308' }, { hue: 120, color: '#22c55e' },
        { hue: 200, color: '#3b82f6' }, { hue: 270, color: '#a855f7' },
        { hue: 330, color: '#ec4899' }, { hue: 240, color: '#6366f1' },
        { hue: 180, color: '#14b8a6' }, { hue: 190, color: '#06b6d4' }
    ];
    hueColors.forEach(({ hue, color }) => {
        const circle = document.createElement('div');
        circle.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: ${color};
            cursor: pointer;
            flex-shrink: 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: transform 0.15s;
        `;
        circle.addEventListener('mouseenter', () => circle.style.transform = 'scale(1.08)');
        circle.addEventListener('mouseleave', () => circle.style.transform = 'scale(1)');
        circle.addEventListener('click', () => {
            currentHue = hue;
            drawRainbowCanvas();
            updateColor();
            updateIndicators();
        });
        hueSlider.appendChild(circle);
    });

    // --- 메인 영역: 캔버스(레인보우) + 오른쪽 밝기 슬라이더 ---
    const mainArea = document.createElement('div');
    mainArea.style.cssText = `display: flex; gap: 8px; margin-bottom: 8px; height: ${pickerHeight * 0.5}px;`;

    // 캔버스 (무지개)
    const canvasWrapper = document.createElement('div');
    // touch-action:none 추가해서 터치 스크롤 방지
    canvasWrapper.style.cssText = `flex: 1; position: relative; border-radius: 12px; overflow: hidden; cursor: crosshair; touch-action: none;`;
    const rainbowCanvas = document.createElement('canvas');
    rainbowCanvas.style.cssText = `width: 100%; height: 100%; display: block;`;
    canvasWrapper.appendChild(rainbowCanvas);

    // 메인 선택 인디케이터
    const mainIndicator = document.createElement('div');
    mainIndicator.style.cssText = `
        position: absolute;
        width: 12px;
        height: 12px;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        transform: translate(-50%,-50%);
        pointer-events: none;
        left: 50%;
        top: 50%;
    `;
    canvasWrapper.appendChild(mainIndicator);

    // 밝기 슬라이더 (우측 세로)
    const lightnessSlider = document.createElement('div');
    lightnessSlider.style.cssText = `
        width: 24px;
        border-radius: 8px;
        position: relative;
        cursor: pointer;
        touch-action: none;
    `;
    const lightHandle = document.createElement('div');
    lightHandle.style.cssText = `
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        border: 2px solid #d1d5db;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        left: 50%;
        transform: translate(-50%, -50%);
        top: 50%;
        /* 핸들이 포인터 이벤트를 받아야 드래그 가능 */
    `;
    lightnessSlider.appendChild(lightHandle);

    mainArea.appendChild(canvasWrapper);
    mainArea.appendChild(lightnessSlider);

    // --- 채도 슬라이더 ---
    const saturationSlider = document.createElement('div');
    saturationSlider.style.cssText = `
        width: 100%;
        height: 20px;
        border-radius: 8px;
        position: relative;
        cursor: pointer;
        margin-bottom: 8px;
        touch-action: none;
        background: linear-gradient(to right, #888, red);
    `;
    const satHandle = document.createElement('div');
    satHandle.style.cssText = `
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        border: 2px solid #d1d5db;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        top: 50%;
        left: 100%;
        transform: translate(-50%,-50%);
        /* pointer-events 없음 제거 -> 핸들에서 직접 잡을 수 있게 */
    `;
    saturationSlider.appendChild(satHandle);

    // --- 미리보기 및 입력, 적용 버튼 ---
    const previewArea = document.createElement('div');
    previewArea.style.cssText = `display:flex; align-items:center; gap:8px; margin-bottom:10px;`;
    const colorPreview = document.createElement('div');
    colorPreview.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        box-shadow: 0 1px 6px rgba(0,0,0,0.15);
        flex-shrink: 0;
        background-color: #ff0000;
    `;
    const colorInput = document.createElement('input');
    colorInput.type = 'text';
    colorInput.value = '#ff0000';
    colorInput.style.cssText = `
        flex: 1;
        padding: 5px 0;
        padding-left:2px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        color: #1f2937;
        outline: none;
    `;
    previewArea.appendChild(colorPreview);
    previewArea.appendChild(colorInput);

    const applyButton = document.createElement('button');
    applyButton.textContent = '적용';
    applyButton.style.cssText = `
        width: 100%;
        padding: 8px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
    `;

    // 요소 조립
    pickerContainer.appendChild(hueSlider);
    pickerContainer.appendChild(mainArea);
    pickerContainer.appendChild(saturationSlider);
    pickerContainer.appendChild(previewArea);
    pickerContainer.appendChild(applyButton);
    this.toolbar.appendChild(pickerContainer);

    // 캔버스 그리기 (devicePixelRatio 고려)
    function drawRainbowCanvas() {
        const rect = rainbowCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        rainbowCanvas.width = Math.round(rect.width * dpr);
        rainbowCanvas.height = Math.round(rect.height * dpr);
        rainbowCanvas.style.width = rect.width + 'px';
        rainbowCanvas.style.height = rect.height + 'px';
        const ctx = rainbowCanvas.getContext('2d');
        ctx.clearRect(0, 0, rainbowCanvas.width, rainbowCanvas.height);

        // hue gradient horizontally
        for (let x = 0; x < rainbowCanvas.width; x++) {
            const hue = (x / Math.max(1, (rainbowCanvas.width - 1))) * 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            ctx.fillRect(x, 0, 1, rainbowCanvas.height);
        }

        // 위에서 흰색 -> 투명
        let g1 = ctx.createLinearGradient(0, 0, 0, rainbowCanvas.height/2);
        g1.addColorStop(0, 'rgba(255,255,255,1)');
        g1.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, rainbowCanvas.width, rainbowCanvas.height/2);

        // 아래에서 투명 -> 검정
        let g2 = ctx.createLinearGradient(0, rainbowCanvas.height/2, 0, rainbowCanvas.height);
        g2.addColorStop(0, 'rgba(0,0,0,0)');
        g2.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, rainbowCanvas.height/2, rainbowCanvas.width, rainbowCanvas.height/2);
    }

    function updateSaturationSlider() {
        const leftColor = `hsl(${currentHue}, 0%, ${currentLightness}%)`;
        const rightColor = `hsl(${currentHue}, 100%, ${currentLightness}%)`;
        saturationSlider.style.background = `linear-gradient(to right, ${leftColor}, ${rightColor})`;
        satHandle.style.left = `${currentSaturation}%`;
    }

    function updateLightnessSlider() {
        const topColor = `hsl(${currentHue}, ${currentSaturation}%, 100%)`;
        const bottomColor = `hsl(${currentHue}, ${currentSaturation}%, 0%)`;
        lightnessSlider.style.background = `linear-gradient(to bottom, ${topColor}, ${bottomColor})`;
        lightHandle.style.top = `${100 - currentLightness}%`;
    }

    function updateIndicators() {
        const xPercent = (currentHue / 360) * 100;
        const yPercent = (100 - currentLightness);
        mainIndicator.style.left = `${xPercent}%`;
        mainIndicator.style.top = `${yPercent}%`;
    }

    // --- 포인터(터치/마우스/펜) 기반 상호작용 처리 ---
    let draggingMain = false;
    let draggingSat = false;
    let draggingLight = false;
    let activePointerId = null;

    function handleMainMove(e) {
        const rect = rainbowCanvas.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        currentHue = Math.round(x * 360);
        currentLightness = Math.round((1 - y) * 100);
        updateColor();
        updateIndicators();
    }

    function handleSatMove(e) {
        const rect = saturationSlider.getBoundingClientRect();
        const clientX = e.clientX;
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        currentSaturation = Math.round(x * 100);
        updateColor();
        updateIndicators();
    }

    function handleLightMove(e) {
        const rect = lightnessSlider.getBoundingClientRect();
        const clientY = e.clientY;
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        currentLightness = Math.round((1 - y) * 100);
        updateColor();
        updateIndicators();
    }

    // PointerEvent 사용 (권장)
    if (window.PointerEvent) {
        // 캔버스
        rainbowCanvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingMain = true;
            activePointerId = e.pointerId;
            try { rainbowCanvas.setPointerCapture(e.pointerId); } catch (err) {}
            handleMainMove(e);
        });
        rainbowCanvas.addEventListener('pointermove', (e) => {
            if (draggingMain && e.pointerId === activePointerId) handleMainMove(e);
        });
        rainbowCanvas.addEventListener('pointerup', (e) => {
            if (e.pointerId === activePointerId) {
                draggingMain = false;
                try { rainbowCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
                activePointerId = null;
            }
        });
        rainbowCanvas.addEventListener('pointercancel', () => { draggingMain = false; activePointerId = null; });

        // 채도 슬라이더
        saturationSlider.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingSat = true;
            activePointerId = e.pointerId;
            try { saturationSlider.setPointerCapture(e.pointerId); } catch (err) {}
            handleSatMove(e);
        });
        satHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingSat = true;
            activePointerId = e.pointerId;
            try { satHandle.setPointerCapture(e.pointerId); } catch (err) {}
            handleSatMove(e);
        });
        document.addEventListener('pointermove', (e) => { if (draggingSat && e.pointerId === activePointerId) handleSatMove(e); });
        document.addEventListener('pointerup', (e) => {
            if (draggingSat && e.pointerId === activePointerId) {
                draggingSat = false;
                try { saturationSlider.releasePointerCapture(e.pointerId); } catch (err) {}
                try { satHandle.releasePointerCapture(e.pointerId); } catch (err) {}
                activePointerId = null;
            }
        });

        // 밝기 슬라이더
        lightnessSlider.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingLight = true;
            activePointerId = e.pointerId;
            try { lightnessSlider.setPointerCapture(e.pointerId); } catch (err) {}
            handleLightMove(e);
        });
        lightHandle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingLight = true;
            activePointerId = e.pointerId;
            try { lightHandle.setPointerCapture(e.pointerId); } catch (err) {}
            handleLightMove(e);
        });
        document.addEventListener('pointermove', (e) => { if (draggingLight && e.pointerId === activePointerId) handleLightMove(e); });
        document.addEventListener('pointerup', (e) => {
            if (draggingLight && e.pointerId === activePointerId) {
                draggingLight = false;
                try { lightnessSlider.releasePointerCapture(e.pointerId); } catch (err) {}
                try { lightHandle.releasePointerCapture(e.pointerId); } catch (err) {}
                activePointerId = null;
            }
        });
    } else {
        // 구형 브라우저용 마우스 이벤트 폴백
        rainbowCanvas.addEventListener('mousedown', (e) => { draggingMain = true; handleMainMove(e); });
        document.addEventListener('mousemove', (e) => { if (draggingMain) handleMainMove(e); });
        document.addEventListener('mouseup', () => { draggingMain = false; });

        saturationSlider.addEventListener('mousedown', (e) => { draggingSat = true; handleSatMove(e); });
        satHandle.addEventListener('mousedown', (e) => { draggingSat = true; handleSatMove(e); });
        document.addEventListener('mousemove', (e) => { if (draggingSat) handleSatMove(e); });
        document.addEventListener('mouseup', () => { draggingSat = false; });

        lightnessSlider.addEventListener('mousedown', (e) => { draggingLight = true; handleLightMove(e); });
        lightHandle.addEventListener('mousedown', (e) => { draggingLight = true; handleLightMove(e); });
        document.addEventListener('mousemove', (e) => { if (draggingLight) handleLightMove(e); });
        document.addEventListener('mouseup', () => { draggingLight = false; });
    }

    // 색 입력 직접 입력 처리
    colorInput.addEventListener('input', () => {
        const hex = colorInput.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            const hsl = hexToHsl(hex);
            currentHue = hsl.h;
            currentSaturation = hsl.s;
            currentLightness = hsl.l;
            drawRainbowCanvas();
            updateColor();
            updateIndicators();
        }
    });

    // 적용 버튼
    applyButton.addEventListener('click', () => {
        if (self.restoreSelection) self.restoreSelection();
        if (self.execCommand) self.execCommand(command, colorInput.value);
        closeModal();
        if (self.createUndoPoint) self.createUndoPoint();
    });

    // 모달 닫기
    function closeModal() {
        if (pickerContainer.parentNode) pickerContainer.parentNode.removeChild(pickerContainer);
        document.removeEventListener('mousedown', closeHandler);
        document.removeEventListener('keydown', handleEsc);
        window.removeEventListener('resize', resizeHandler);
        // 추가로 pointer/mouse 이벤트가 document에 붙어있을 수 있으니 안전하게 리셋 변수를 초기화
        draggingMain = draggingSat = draggingLight = false;
        activePointerId = null;
    }

    // 외부 클릭시 닫기
    const closeHandler = (e) => {
        if (!pickerContainer.contains(e.target) && e.target !== button) {
            closeModal();
        }
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
    };

    // 리사이즈 핸들러 (캔버스 재그리기)
    const resizeHandler = () => {
        requestAnimationFrame(() => {
            drawRainbowCanvas();
            updateIndicators();
            updateSaturationSlider();
            updateLightnessSlider();
        });
    };
    window.addEventListener('resize', resizeHandler);

    requestAnimationFrame(() => {
        document.addEventListener('mousedown', closeHandler);
        document.addEventListener('keydown', handleEsc);
    });

    // 초기 렌더링
    function initialSetup() {
        drawRainbowCanvas();
        updateSaturationSlider();
        updateLightnessSlider();
        updateIndicators();
        updateColor();
    }
    requestAnimationFrame(initialSetup);

    // HSL <-> HEX 변환 함수
    function hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
    function hexToHsl(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return { h: 0, s: 0, l: 0 };
        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }
}




    // 정렬
    toggleAlignment(button) {
        const alignments = ['left', 'center', 'right'];
        const commands = ['justifyLeft', 'justifyCenter', 'justifyRight'];
        const icons = ['format_align_left', 'format_align_center', 'format_align_right'];
        
        let currentIndex = alignments.indexOf(this.alignmentState);
        currentIndex = (currentIndex + 1) % alignments.length;
        
        this.alignmentState = alignments[currentIndex];
        button.querySelector('.material-icons').textContent = icons[currentIndex];
        
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const block = this.getClosestBlock(range.commonAncestorContainer);
        
        if (block) {
            block.style.textAlign = this.alignmentState;
        }
        
        this.execCommand(commands[currentIndex]);
        this.createUndoPoint();
    }

    // 드롭다운 표시
    showDropdown(element, button) {
        const buttonRect = button.getBoundingClientRect();
        const toolbarRect = this.toolbar.getBoundingClientRect();
        
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.cssText = `
            position: absolute;
            top: ${buttonRect.bottom - toolbarRect.top}px;
            left: ${buttonRect.left - toolbarRect.left}px;
            z-index: 10000;
        `;
        
        dropdownContainer.appendChild(element);
        this.toolbar.appendChild(dropdownContainer);
        
        const dropdownRect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        if (dropdownRect.right > viewportWidth) {
            const overflow = dropdownRect.right - viewportWidth;
            dropdownContainer.style.left = `${parseInt(dropdownContainer.style.left) - overflow - 10}px`;
        }
        
        const closeHandler = (e) => {
            if (!element.contains(e.target) && e.target !== button) {
                dropdownContainer.remove();
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        
        requestAnimationFrame(() => {
            document.addEventListener('mousedown', closeHandler);
        });
    }

    insertAtCursor(element) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let currentBlock = this.getClosestBlock(range.startContainer);

        if (!currentBlock || currentBlock === this.editor) {
            currentBlock = document.createElement('p');
            currentBlock.innerHTML = '<br>';
            this.editor.appendChild(currentBlock);
        }

        // 공백 추가 없이 삽입만
        const wrapper = document.createElement('p');
        wrapper.appendChild(element);
        currentBlock.parentNode.insertBefore(wrapper, currentBlock.nextSibling);

        this.normalizeContent();
        this.createUndoPoint();
    }

    // 컨텐츠 설정
    setContent(html) {
        if (!html) return;
        
        this.editor.innerHTML = html;
        
        // 플러그인들에게 컨텐츠 설정 알림
        for (let [name, plugin] of this.plugins) {
            if (plugin.onContentSet) {
                plugin.onContentSet(html);
            }
        }
        
        this.normalizeContent();
    }

    // 플러그인 관리
    loadPlugins() {
        this.config.plugins.forEach(pluginName => {
            this.loadPlugin(pluginName);
        });
    }

    async loadPlugin(name) {
        try {
            const script = document.createElement('script');
            script.src = `${t2editor_url}/plugin/${name}/${name}.js`;
            
            script.onload = () => {
                const className = `T2${name.charAt(0).toUpperCase() + name.slice(1)}Plugin`;
                if (window[className]) {
                    const PluginClass = window[className];
                    const plugin = new PluginClass(this);
                    this.plugins.set(name, plugin);
                    console.log(`Plugin ${name} loaded and registered successfully`);
                    
                    // Collab 플러그인인 경우 참조 저장
                    if (name === 'collab') {
                        this.collab = plugin;
                    }
                    
                    // 플러그인이 등록된 후 명령어 확인
                    if (plugin.commands) {
                        console.log(`Plugin ${name} registered commands:`, plugin.commands);
                    }
                } else {
                    console.error(`Plugin class ${className} not found after loading ${name}.js`);
                }
            };
            
            script.onerror = (e) => {
                console.error(`Failed to load plugin script ${name}:`, e);
            };
            
            document.head.appendChild(script);
        } catch (error) {
            console.error(`Failed to load plugin ${name}:`, error);
        }
    }

    registerPlugin(name, plugin) {
        this.plugins.set(name, plugin);
        
        // Collab 플러그인인 경우 참조 저장
        if (name === 'collab') {
            this.collab = plugin;
        }
    }

    getPlugin(name) {
        return this.plugins.get(name);
    }

    // 유틸리티 함수들 - 원본과 동일한 generateUid
    generateUid() {
        const random = Math.floor(Math.random() * 1000000000);
        const timestamp = new Date().getTime();
        return `${random}${timestamp}`;
    }

    handleBulletPoints() {
        // 추후 구현
    }
}

// 글로벌 에디터 인스턴스 생성 함수
window.T2Editor = T2Editor;