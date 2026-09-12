//Path: T2Editor/plugin/code/code.js

class T2CodePlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertCodeBlock'];
    }

    handleCommand(command, button) {
        switch(command) {
            case 'insertCodeBlock':
                this.insertCodeBlock();
                break;
        }
    }

    onContentSet(html) {
        setTimeout(() => {
            this.initializeCodeBlocks();
        }, 100);
    }

    insertCodeBlock() {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const currentBlock = this.editor.getClosestBlock(range.startContainer);
        
        const codeBlock = this.createCodeBlock();
        
        if (currentBlock && currentBlock !== this.editor.editor) {
            // 현재 블록 다음에 빈 줄 추가
            const topBreak = document.createElement('p');
            topBreak.innerHTML = '<br>';
            currentBlock.parentNode.insertBefore(topBreak, currentBlock.nextSibling);
            
            // 코드 블록 삽입
            topBreak.parentNode.insertBefore(codeBlock, topBreak.nextSibling);
            
            // 코드 블록 다음에 빈 줄 추가
            const bottomBreak = document.createElement('p');
            bottomBreak.innerHTML = '<br>';
            codeBlock.parentNode.insertBefore(bottomBreak, codeBlock.nextSibling);
            
            const codeElement = codeBlock.querySelector('code');
            if (codeElement) {
                setTimeout(() => {
                    codeElement.focus();
                    if (codeElement.classList.contains('code-placeholder')) {
                        codeElement.textContent = '';
                        codeElement.classList.remove('code-placeholder');
                    }
                    const newRange = document.createRange();
                    newRange.setStart(codeElement, 0);
                    newRange.collapse(true);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }, 50);
            }
            
            // 중복 공백 정리
            this.cleanupEmptyLines(codeBlock);
            
            this.editor.createUndoPoint();
            this.editor.autoSave();
        }
    }

    createCodeBlock() {
        const mediaBlock = document.createElement('div');
        mediaBlock.className = 't2-media-block t2-code-block';
        mediaBlock.contentEditable = false;
        
        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.margin = '0 auto';
        
        const pre = document.createElement('pre');
        pre.contentEditable = false;
        
        const codeElement = document.createElement('code');
        codeElement.textContent = '코드를 입력하세요';
        codeElement.classList.add('code-placeholder');
        codeElement.setAttribute('contenteditable', 'true');
        codeElement.style.outline = 'none';
        codeElement.style.display = 'block';
        codeElement.style.whiteSpace = 'pre';
        codeElement.style.wordWrap = 'normal';
        codeElement.style.overflowWrap = 'normal';
        
        this.setupCodeEvents(codeElement);
        
        pre.appendChild(codeElement);
        container.appendChild(pre);
        mediaBlock.appendChild(container);
        
        const controls = this.createCodeControls();
        mediaBlock.appendChild(controls);
        
        return mediaBlock;
    }

    createCodeControls() {
        const controls = document.createElement('div');
        controls.className = 't2-media-controls';
        controls.contentEditable = false;

        controls.innerHTML = `
            <button class="t2-btn delete-btn" type="button">
                <span class="material-icons">delete</span>
            </button>
        `;

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

    setupCodeEvents(codeElement) {
        // 클릭 이벤트
        codeElement.addEventListener('click', function(e) {
            e.stopPropagation();
            if (this.classList.contains('code-placeholder')) {
                this.textContent = '';
                this.classList.remove('code-placeholder');
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(this, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });

        // 포커스 이벤트
        codeElement.addEventListener('focus', function(e) {
            e.stopPropagation();
            if (this.classList.contains('code-placeholder')) {
                this.textContent = '';
                this.classList.remove('code-placeholder');
            }
        });

        // 블러 이벤트
        codeElement.addEventListener('blur', function() {
            if (this.textContent.trim() === '') {
                this.textContent = '코드를 입력하세요';
                this.classList.add('code-placeholder');
            }
        });

        // 붙여넣기 이벤트
        codeElement.addEventListener('paste', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 플레이스홀더 제거
            if (codeElement.classList.contains('code-placeholder')) {
                codeElement.textContent = '';
                codeElement.classList.remove('code-placeholder');
            }
            
            // 붙여넣을 텍스트 가져오기
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            
            // 현재 선택 영역 가져오기
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // 텍스트를 줄바꿈 기준으로 분리
            const lines = text.split(/\r?\n/);
            
            // DocumentFragment 생성
            const fragment = document.createDocumentFragment();
            
            lines.forEach((line, index) => {
                // 각 줄을 텍스트 노드로 추가
                if (line) {
                    fragment.appendChild(document.createTextNode(line));
                }
                
                // 마지막 줄이 아니면 줄바꿈 추가
                if (index < lines.length - 1) {
                    fragment.appendChild(document.createTextNode('\n'));
                }
            });
            
            // Fragment를 현재 위치에 삽입
            range.insertNode(fragment);
            
            // 커서를 붙여넣은 텍스트 끝으로 이동
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            
            this.editor.createUndoPoint();
            this.editor.autoSave();
        });

        // 키보드 이벤트
        codeElement.addEventListener('keydown', (e) => {
            e.stopPropagation();
            
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '    ');
            } else if (e.key === 'Enter') {
                // Enter 키 처리 개선
                e.preventDefault();
                
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                
                // 줄바꿈 삽입
                const newline = document.createTextNode('\n');
                range.deleteContents();
                range.insertNode(newline);
                
                // 커서를 새 줄로 이동
                range.setStartAfter(newline);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // 들여쓰기 유지 (선택사항)
                const textBeforeCursor = codeElement.textContent.substring(0, range.startOffset - 1);
                const lastLine = textBeforeCursor.split('\n').pop();
                const leadingSpaces = lastLine.match(/^(\s*)/)[1];
                if (leadingSpaces) {
                    document.execCommand('insertText', false, leadingSpaces);
                }
            }
        });

        // 입력 이벤트
        codeElement.addEventListener('input', (e) => {
            e.stopPropagation();
            this.editor.createUndoPoint();
            this.editor.autoSave();
        });
        
        // 마우스 이벤트로 선택 영역 활성화
        codeElement.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        });
        
        codeElement.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }

    // 코드 블록 주변의 중복 빈 줄 정리
    cleanupEmptyLines(codeBlock) {
        // 이전 요소들 확인
        let prev = codeBlock.previousElementSibling;
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
        
        // 다음 요소들 확인
        let next = codeBlock.nextElementSibling;
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
        
        // 중복 빈 줄 제거
        toRemove.forEach(el => el.remove());
    }

    initializeCodeBlocks() {
        // 기존 코드 블록 변환
        this.editor.editor.querySelectorAll('.t2-code-block:not(.t2-media-block)').forEach(oldBlock => {
            const codeElement = oldBlock.querySelector('code');
            if (!codeElement) return;
            
            const mediaBlock = document.createElement('div');
            mediaBlock.className = 't2-media-block t2-code-block';
            mediaBlock.contentEditable = false;
            
            const container = document.createElement('div');
            container.style.width = '100%';
            container.style.margin = '0 auto';
            
            const pre = codeElement.parentElement.cloneNode(true);
            pre.contentEditable = false;
            container.appendChild(pre);
            mediaBlock.appendChild(container);
            
            const controls = this.createCodeControls();
            mediaBlock.appendChild(controls);
            
            // p 태그 안에 있는 경우 밖으로 빼내기
            if (oldBlock.parentNode.nodeName === 'P') {
                const p = oldBlock.parentNode;
                p.parentNode.insertBefore(mediaBlock, p);
                p.remove();
            } else {
                oldBlock.parentNode.replaceChild(mediaBlock, oldBlock);
            }
            
            const newCodeElement = mediaBlock.querySelector('code');
            if (newCodeElement) {
                newCodeElement.setAttribute('contenteditable', 'true');
                newCodeElement.style.outline = 'none';
                newCodeElement.style.whiteSpace = 'pre';
                newCodeElement.style.wordWrap = 'normal';
                newCodeElement.style.overflowWrap = 'normal';
                this.setupCodeEvents(newCodeElement);
            }
            
            // 코드 블록 주변 중복 공백 정리
            this.cleanupEmptyLines(mediaBlock);
        });

        // 이미 미디어 블록인 코드 블록 처리
        this.editor.editor.querySelectorAll('.t2-media-block.t2-code-block').forEach(block => {
            block.contentEditable = false;
            
            const pre = block.querySelector('pre');
            if (pre) {
                pre.contentEditable = false;
            }
            
            const codeElement = block.querySelector('code');
            if (codeElement) {
                codeElement.setAttribute('contenteditable', 'true');
                codeElement.style.outline = 'none';
                codeElement.style.whiteSpace = 'pre';
                codeElement.style.wordWrap = 'normal';
                codeElement.style.overflowWrap = 'normal';
                
                if (!codeElement.dataset.eventsSetup) {
                    this.setupCodeEvents(codeElement);
                    codeElement.dataset.eventsSetup = 'true';
                }
                
                if (!block.querySelector('.t2-media-controls')) {
                    const controls = this.createCodeControls();
                    block.appendChild(controls);
                }
                
                // p 태그에서 빼내기
                if (block.parentNode.nodeName === 'P') {
                    const p = block.parentNode;
                    p.parentNode.insertBefore(block, p);
                    p.remove();
                }
            }
            
            // 코드 블록 주변 중복 공백 정리
            this.cleanupEmptyLines(block);
        });
    }
}

window.T2CodePlugin = T2CodePlugin;