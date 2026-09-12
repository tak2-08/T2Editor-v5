//Path: T2Editor/plugin/textformat/textformat.js

class T2TextFormatPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = [];
        this.patterns = {
            code: /\[code\]([\s\S]*?)\[\/code\]/gi,
            img: /\[img\]([\s\S]*?)\[\/img\]/gi,
            table: /\[table\]([\s\S]*?)\[\/table\]/gi
        };
        
        this.init();
    }

    init() {
        // 에디터 입력 이벤트 리스너
        this.editor.editor.addEventListener('input', this.debounce(() => {
            this.convertTextFormats();
        }, 500));

        // 붙여넣기 이벤트 리스너
        this.editor.editor.addEventListener('paste', (e) => {
            setTimeout(() => {
                this.convertTextFormats();
            }, 100);
        });

        // 콘텐츠 설정 시 변환
        const originalSetContent = this.editor.setContent.bind(this.editor);
        this.editor.setContent = (html) => {
            const convertedHtml = this.convertTextFormatsInHTML(html);
            originalSetContent(convertedHtml);
        };
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    convertTextFormats() {
        const html = this.editor.editor.innerHTML;
        const convertedHtml = this.convertTextFormatsInHTML(html);
        
        if (convertedHtml !== html) {
            // 선택 영역 저장
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            
            // 콘텐츠 업데이트
            this.editor.editor.innerHTML = convertedHtml;
            
            // 선택 영역 복원
            if (range) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            this.editor.normalizeContent();
            this.editor.createUndoPoint();
        }
    }

    convertTextFormatsInHTML(html) {
        let convertedHtml = html;

        // 코드 블록 변환
        convertedHtml = convertedHtml.replace(this.patterns.code, (match, codeContent) => {
            return this.createCodeBlock(codeContent.trim());
        });

        // 이미지 블록 변환
        convertedHtml = convertedHtml.replace(this.patterns.img, (match, imgUrl) => {
            return this.createImageBlock(imgUrl.trim());
        });

        // 테이블 블록 변환 (간단한 마크다운 테이블 지원)
        convertedHtml = convertedHtml.replace(this.patterns.table, (match, tableContent) => {
            return this.createTableBlock(tableContent.trim());
        });

        return convertedHtml;
    }

    createCodeBlock(codeContent) {
        const blockId = this.generateBlockId();
        return `
        <div class="t2-media-block t2-code-block" contenteditable="false" data-block-id="${blockId}">
            <div style="width: 100%; margin: 0 auto;">
                <pre contenteditable="false">
                    <code contenteditable="true" style="outline: none; display: block; white-space: pre; word-wrap: normal; overflow-wrap: normal;">
                        ${this.escapeHtml(codeContent)}
                    </code>
                </pre>
            </div>
            <div class="t2-media-controls" contenteditable="false">
                <button class="t2-btn delete-btn" type="button">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>`;
    }

    createImageBlock(imgUrl) {
        const blockId = this.generateBlockId();
        return `
        <div class="t2-media-block" contenteditable="false" data-block-id="${blockId}">
            <div style="width: 320px; max-width: 100%; margin: 0 auto; position: relative;">
                <img src="${imgUrl}" style="width: 100%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display: none; text-align: center; padding: 20px; color: #666; background: #f5f5f5;">
                    이미지를 로드할 수 없습니다: ${imgUrl}
                </div>
            </div>
            <div class="t2-media-controls" contenteditable="false">
                <button class="t2-btn delete-btn">
                    <span class="material-icons">delete</span>
                </button>
                <input type="range" min="30" max="100" value="100" class="size-slider" style="width: 100px;">
            </div>
        </div>`;
    }

    createTableBlock(tableContent) {
        // 간단한 마크다운 테이블 파싱 (| 컬럼1 | 컬럼2 | 형식)
        const rows = tableContent.split('\n').filter(row => row.trim().startsWith('|'));
        if (rows.length < 2) {
            return `<div style="color: #666; padding: 10px; background: #f5f5f5;">유효하지 않은 테이블 형식입니다.</div>`;
        }

        let tableHTML = `<table class="t2-table" style="width: 100%; border-collapse: collapse;" border="1" data-t2-table="true">`;
        
        // 헤더 행
        const headerCells = this.parseTableRow(rows[0]);
        tableHTML += '<thead><tr>';
        headerCells.forEach(cell => {
            tableHTML += `<th style="border: 1px solid #ccc; padding: 8px; background-color: #f5f5f5;">${this.escapeHtml(cell)}</th>`;
        });
        tableHTML += '</tr></thead>';
        
        // 데이터 행
        tableHTML += '<tbody>';
        for (let i = 2; i < rows.length; i++) { // 1번째 행은 구분선이므로 2부터 시작
            const dataCells = this.parseTableRow(rows[i]);
            tableHTML += '<tr>';
            dataCells.forEach(cell => {
                tableHTML += `<td style="border: 1px solid #ccc; padding: 8px;">${this.escapeHtml(cell)}</td>`;
            });
            tableHTML += '</tr>';
        }
        tableHTML += '</tbody></table>';

        const blockId = this.generateBlockId();
        return `
        <div class="t2-table-wrapper" contenteditable="false" data-block-id="${blockId}">
            ${tableHTML}
            <div class="t2-table-controls" contenteditable="false">
                <div class="t2-table-control-group">
                    <span>가로:</span>
                    <button class="t2-btn t2-table-control-btn" data-action="add-col">
                        <span class="material-icons">add</span>
                    </button>
                    <button class="t2-btn t2-table-control-btn" data-action="remove-col">
                        <span class="material-icons">remove</span>
                    </button>
                </div>
                <div class="t2-table-control-group">
                    <span>세로:</span>
                    <button class="t2-btn t2-table-control-btn" data-action="add-row">
                        <span class="material-icons">add</span>
                    </button>
                    <button class="t2-btn t2-table-control-btn" data-action="remove-row">
                        <span class="material-icons">remove</span>
                    </button>
                </div>
                <button class="t2-btn t2-table-delete-btn" data-action="delete-table">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <button class="t2-table-download-btn">
                <span class="material-icons">download</span>
            </button>
        </div>`;
    }

    parseTableRow(row) {
        // 마크다운 테이블 행 파싱: | 컬럼1 | 컬럼2 | -> ['컬럼1', '컬럼2']
        return row.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell !== '' && !cell.match(/^[-:]+$/)); // 구분선 제거
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    generateBlockId() {
        return `format_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    onContentSet(html) {
        // 기존 콘텐츠에서 텍스트 형식 변환
        setTimeout(() => {
            this.convertTextFormats();
        }, 100);
    }
}

window.T2TextFormatPlugin = T2TextFormatPlugin;