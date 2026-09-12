//Path: T2Editor/js/core.js
class T2Editor {
    constructor(container) {
        this.container = container;
        this.editor = container.querySelector('.t2-editor');
        this.toolbar = container.querySelector('.t2-toolbar');
        this.plugins = new Map();
        this.config = {
            autoSave: true,
            plugins: ['image', 'video', 'file', 'table', 'code', 'link', 'export']
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

    handleCommand(command, button) {
        // 플러그인에서 처리할 수 있는 명령인지 확인
        for (let [name, plugin] of this.plugins) {
            if (plugin.commands && plugin.commands.includes(command)) {
                plugin.handleCommand(command, button);
                this.createUndoPoint();
                return;
            }
        }

        // 기본 명령어 처리
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
            default:
                this.execCommand(command);
                if (['bold', 'italic', 'underline', 'strikeThrough'].includes(command)) {
                    button.classList.toggle('active');
                }
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
        if (!this.autoSaveEnabled) return;

        const content = this.editor.innerHTML;
        const normalizedContent = content.replace(/<p>\s*<\/p>/g, '<p><br></p>');
        localStorage.setItem('t2editor-autosave', normalizedContent);
    }

    loadAutoSave() {
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
            if (this.autoSaveEnabled) {
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
        const colors = [
            '#000000', '#434343', '#666666', '#999999',
            '#b7b7b7', '#cccccc', '#d9d9d9', '#f3f3f3',
            '#ffffff', '#ed2f27', '#ff8d3f', '#eeea7e',
            '#acbc8a', '#56bf56', '#588c7e', '#5ed0fe',
            '#0187fe', '#3c55dc', '#7d4afe', '#f2a5d8'
        ];
        
        const palette = document.createElement('div');
        palette.className = 't2-color-palette';
        palette.style.cssText = `
            background: white;
            border: 1px solid #ccc;
            padding: 10px;
            border-radius: 4px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-width: 120px;
        `;
        
        colors.forEach(color => {
            const option = document.createElement('div');
            option.className = 't2-color-option';
            option.style.cssText = `
                width: 25px;
                height: 25px;
                border-radius: 4px;
                cursor: pointer;
                border: 1px solid #ddd;
                background-color: ${color};
            `;
            
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.restoreSelection();
                this.execCommand(command, color);
                palette.parentElement.remove();
                this.createUndoPoint();
            });
            
            palette.appendChild(option);
        });
        
        this.showDropdown(palette, button);
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
                if (window[`T2${name.charAt(0).toUpperCase() + name.slice(1)}Plugin`]) {
                    const PluginClass = window[`T2${name.charAt(0).toUpperCase() + name.slice(1)}Plugin`];
                    const plugin = new PluginClass(this);
                    this.plugins.set(name, plugin);
                    console.log(`Plugin ${name} loaded successfully`);
                }
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error(`Failed to load plugin ${name}:`, error);
        }
    }

    registerPlugin(name, plugin) {
        this.plugins.set(name, plugin);
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