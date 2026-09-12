//Path: T2Editor/plugin/table/table.js

class T2TablePlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertTable'];
    }

    handleCommand(command, button) {
        switch(command) {
            case 'insertTable':
                this.showTableModal();
                break;
        }
    }

    handlePaste(clipboardData) {
        // 테이블 붙여넣기 처리
        const htmlText = clipboardData.getData('text/html');
        
        if (htmlText && htmlText.includes('<table')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlText;
            
            const tables = tempDiv.querySelectorAll('table');
            tables.forEach(origTable => {
                const table = origTable.cloneNode(true);
                table.className = 't2-table';
                table.setAttribute('data-t2-table', 'true');
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                
                // 모든 셀에 스타일 적용
                const cells = table.querySelectorAll('td, th');
                cells.forEach(cell => {
                    cell.style.border = '1px solid #ccc';
                    cell.style.padding = '8px';
                    if (cell.tagName === 'TH') {
                        cell.style.backgroundColor = '#f5f5f5';
                    }
                });
                
                const tableWrapper = this.createTableWrapper(table);
                this.editor.insertAtCursor(tableWrapper);
                this.setupTableControlEvents(tableWrapper.querySelector('.t2-table-controls'), table);
                this.setupTableCellEditing(table);
            });
            
            this.editor.normalizeContent();
            this.editor.createUndoPoint();
            return true; // 처리됨
        }
        
        return false; // 처리되지 않음
    }

    onContentSet(html) {
        // 컨텐츠 설정 시 테이블 블록 초기화
        setTimeout(() => {
            this.initializeTableBlocks();
        }, 100);
    }

    showTableModal() {
        const modalContent = `
            <div class="t2-table-editor-modal">
                <h3>테이블 삽입</h3>
                <div class="t2-table-size-selector">
                    <div class="t2-table-size-inputs">
                        <div class="t2-table-input-group">
                            <label>가로 셀 수:</label>
                            <div class="t2-input-with-controls">
                                <button class="t2-btn t2-table-control-btn" data-action="decrease-cols">
                                    <span class="material-icons">remove</span>
                                </button>
                                <input type="number" class="t2-table-cols" value="3" min="1" max="30">
                                <button class="t2-btn t2-table-control-btn" data-action="increase-cols">
                                    <span class="material-icons">add</span>
                                </button>
                            </div>
                        </div>
                        <div class="t2-table-input-group">
                            <label>세로 셀 수:</label>
                            <div class="t2-input-with-controls">
                                <button class="t2-btn t2-table-control-btn" data-action="decrease-rows">
                                    <span class="material-icons">remove</span>
                                </button>
                                <input type="number" class="t2-table-rows" value="3" min="1" max="30">
                                <button class="t2-btn t2-table-control-btn" data-action="increase-rows">
                                    <span class="material-icons">add</span>
                                </button>
                            </div>
                        </div>
                        <div class="t2-table-warning" style="display: none; color: #e67e22; margin-top: 10px; font-size: 13px;">
                            <span class="material-icons" style="font-size: 16px; vertical-align: middle;">warning</span>
                            큰 테이블은 가로 스크롤이 생성됩니다.
                        </div>
                    </div>
                    <div class="t2-table-preview-container" style="width: 160px; height: 160px; overflow: hidden; border: 1px solid #ddd; border-radius: 4px;">
                        <div class="t2-table-preview" style="transform-origin: top left;"></div>
                    </div>
                </div>
                <div class="t2-table-style-options">
                    <div class="t2-table-style-option">
                        <p>테이블 너비:&nbsp;</p>
                        <select class="t2-table-width">
                            <option value="100%">100% (전체)</option>
                            <option value="75%">75%</option>
                            <option value="50%">50%</option>
                            <option value="custom">직접 입력</option>
                        </select>
                        <div class="t2-custom-width-container" style="display: none;">
                            <input type="number" class="t2-custom-width-value" value="100" min="10" max="100">
                            <span>%</span>
                        </div>
                    </div>
                    <div class="t2-table-style-option">
                        <p>테두리 스타일:&nbsp;</p>
                        <select class="t2-table-border-style">
                            <option value="solid">실선</option>
                            <option value="dashed">점선</option>
                            <option value="dotted">점선 (원형)</option>
                            <option value="double">이중선</option>
                        </select>
                    </div>
                </div>
                <div class="t2-btn-group">
                    <button class="t2-btn" data-action="cancel">취소</button>
                    <button class="t2-btn" data-action="insert">삽입</button>
                </div>
            </div>
        `;

        const modal = T2Utils.createModal(modalContent);
        this.setupTableModalEvents(modal);
    }

    setupTableModalEvents(modal) {
        const previewContainer = modal.querySelector('.t2-table-preview');
        const colsInput = modal.querySelector('.t2-table-cols');
        const rowsInput = modal.querySelector('.t2-table-rows');
        const tableWidthSelect = modal.querySelector('.t2-table-width');
        const customWidthContainer = modal.querySelector('.t2-custom-width-container');
        const customWidthInput = modal.querySelector('.t2-custom-width-value');
        const tableWarning = modal.querySelector('.t2-table-warning');

        // 미리보기 테이블 업데이트 함수
        const updateTablePreview = () => {
            const cols = parseInt(colsInput.value) || 3;
            const rows = parseInt(rowsInput.value) || 3;
            
            // 큰 테이블에 대한 경고
            if (cols > 10 || rows > 10) {
                tableWarning.style.display = 'block';
            } else {
                tableWarning.style.display = 'none';
            }
            
            // 미리보기 배율 계산
            const scale = Math.min(1, 140 / Math.max(cols * 16, rows * 16));
            
            // 미리보기 테이블 생성
            let tableHTML = `<table class="t2-preview-table" style="transform: scale(${scale}); transform-origin: top left;">`;
            
            // 헤더 행
            tableHTML += '<tr>';
            for (let col = 0; col < cols; col++) {
                tableHTML += `<th style="width: 16px; height: 16px; border: 1px solid #ccc; background: #f5f5f5;"></th>`;
            }
            tableHTML += '</tr>';
            
            // 데이터 행
            for (let row = 1; row < rows; row++) {
                tableHTML += '<tr>';
                for (let col = 0; col < cols; col++) {
                    tableHTML += '<td style="width: 16px; height: 16px; border: 1px solid #ccc;"></td>';
                }
                tableHTML += '</tr>';
            }
            
            tableHTML += '</table>';
            previewContainer.innerHTML = tableHTML;
        };

        // 컨트롤 이벤트 설정
        modal.querySelector('[data-action="decrease-cols"]').onclick = () => {
            colsInput.value = Math.max(1, parseInt(colsInput.value) - 1);
            updateTablePreview();
        };
        
        modal.querySelector('[data-action="increase-cols"]').onclick = () => {
            colsInput.value = Math.min(30, parseInt(colsInput.value) + 1);
            updateTablePreview();
        };
        
        modal.querySelector('[data-action="decrease-rows"]').onclick = () => {
            rowsInput.value = Math.max(1, parseInt(rowsInput.value) - 1);
            updateTablePreview();
        };
        
        modal.querySelector('[data-action="increase-rows"]').onclick = () => {
            rowsInput.value = Math.min(30, parseInt(rowsInput.value) + 1);
            updateTablePreview();
        };

        // 너비 설정 변경 이벤트
        tableWidthSelect.addEventListener('change', () => {
            if (tableWidthSelect.value === 'custom') {
                customWidthContainer.style.display = 'flex';
            } else {
                customWidthContainer.style.display = 'none';
            }
        });

        // 입력 필드 이벤트
        colsInput.addEventListener('input', () => {
            colsInput.value = Math.min(30, Math.max(1, parseInt(colsInput.value) || 1));
            updateTablePreview();
        });
        
        rowsInput.addEventListener('input', () => {
            rowsInput.value = Math.min(30, Math.max(1, parseInt(rowsInput.value) || 1));
            updateTablePreview();
        });

        // 최초 미리보기 테이블 생성
        updateTablePreview();

        // 삽입 버튼 클릭 이벤트
        modal.querySelector('[data-action="insert"]').onclick = () => {
            const cols = parseInt(colsInput.value) || 3;
            const rows = parseInt(rowsInput.value) || 3;
            const borderStyle = modal.querySelector('.t2-table-border-style').value;
            
            // 테이블 너비 설정
            let tableWidth;
            if (tableWidthSelect.value === 'custom') {
                const customWidth = parseInt(customWidthInput.value) || 100;
                tableWidth = Math.min(100, Math.max(10, customWidth)) + '%';
            } else {
                tableWidth = tableWidthSelect.value;
            }
            
            this.insertTableAtCursor(cols, rows, tableWidth, borderStyle);
            modal.remove();
        };

        // 취소 버튼 클릭 이벤트
        modal.querySelector('[data-action="cancel"]').onclick = () => modal.remove();
    }

    insertTableAtCursor(cols, rows, width, borderStyle) {
        const table = document.createElement('table');
        table.className = 't2-table';
        table.style.width = width;
        table.style.borderCollapse = 'collapse';
        table.setAttribute('border', '1');
        table.setAttribute('data-t2-table', 'true');

        const borderColor = '#ccc';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let col = 0; col < cols; col++) {
            const th = document.createElement('th');
            th.style.border = `1px ${borderStyle} ${borderColor}`;
            th.style.padding = '8px';
            th.style.backgroundColor = '#f5f5f5';
            th.textContent = `헤더 ${col + 1}`;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (let row = 1; row < rows; row++) {
            const tr = document.createElement('tr');
            for (let col = 0; col < cols; col++) {
                const td = document.createElement('td');
                td.style.border = `1px ${borderStyle} ${borderColor}`;
                td.style.padding = '8px';
                td.innerHTML = `<br>`;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        const tableWrapper = this.createTableWrapper(table);
        this.editor.insertAtCursor(tableWrapper);
        this.setupTableControlEvents(tableWrapper.querySelector('.t2-table-controls'), table);
        this.setupTableCellEditing(table);
        this.setupTableResizing(table);

        return tableWrapper;
    }

    createTableWrapper(table) {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 't2-table-wrapper';
        tableWrapper.contentEditable = false;

        // 테이블 크기 계산
        const cols = table.querySelector('tr')?.children.length || 0;
        const rows = table.querySelectorAll('tr').length;
        const cellWidth = 50;
        const padding = 12 * 2;
        const tableWidth = cols * (cellWidth + padding);
        const mediaBlockWidth = 320;
        const editorWidth = this.editor.editor.clientWidth;
        const needsScroll = tableWidth > mediaBlockWidth || tableWidth > editorWidth;

        if (needsScroll) {
            const scrollWrapper = document.createElement('div');
            scrollWrapper.className = 't2-table-scroll-wrapper';
            scrollWrapper.appendChild(table);
            tableWrapper.appendChild(scrollWrapper);
            table.classList.add('t2-table-large');
        } else {
            tableWrapper.appendChild(table);
        }

        const tableControls = this.createTableControls(table, rows, cols);
        tableWrapper.appendChild(tableControls);

        // 다운로드 버튼 추가
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 't2-table-download-btn';
        downloadBtn.innerHTML = '<span class="material-icons">download</span>';
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.exportTableToCSV(table);
        });
        tableWrapper.appendChild(downloadBtn);

        return tableWrapper;
    }

    createTableControls(table, rows, cols) {
        const tableControls = document.createElement('div');
        tableControls.className = 't2-table-controls';
        tableControls.innerHTML = `
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
        `;
        return tableControls;
    }

    setupTableControlEvents(controls, table) {
        // 테이블 크기에 따라 스크롤 래퍼를 동적으로 추가/제거하는 함수
        const updateTableScroll = () => {
            const cols = table.querySelector('tr')?.children.length || 0;
            const rows = table.querySelectorAll('tr').length;
            const cellWidth = 50;
            const padding = 12 * 2;
            const tableWidth = cols * (cellWidth + padding);
            const mediaBlockWidth = 320;
            const editorWidth = this.editor.editor.clientWidth;
            const needsScroll = tableWidth > mediaBlockWidth || tableWidth > editorWidth;

            const wrapper = table.closest('.t2-table-wrapper');
            const scrollWrapper = table.closest('.t2-table-scroll-wrapper');

            if (needsScroll && !scrollWrapper) {
                const newScrollWrapper = document.createElement('div');
                newScrollWrapper.className = 't2-table-scroll-wrapper';
                wrapper.insertBefore(newScrollWrapper, table);
                newScrollWrapper.appendChild(table);
                table.classList.add('t2-table-large');
            } else if (!needsScroll && scrollWrapper) {
                wrapper.insertBefore(table, scrollWrapper);
                scrollWrapper.remove();
                table.classList.remove('t2-table-large');
            }
        };

        // 열 추가 이벤트
        controls.querySelector('[data-action="add-col"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rows = table.querySelectorAll('tr');
            const colCount = rows[0].children.length;
            rows.forEach((row, rowIndex) => {
                const cell = rowIndex === 0 ? document.createElement('th') : document.createElement('td');
                cell.style.border = rows[0].children[0].style.border;
                cell.style.padding = '8px';
                if (rowIndex === 0) {
                    cell.style.backgroundColor = '#f5f5f5';
                    cell.textContent = `헤더 ${colCount + 1}`;
                } else {
                    cell.innerHTML = '<br>';
                }
                row.appendChild(cell);
                this.setupCellEditing(cell);
            });
            updateTableScroll();
            this.editor.createUndoPoint();
        });

        // 열 제거 이벤트
        controls.querySelector('[data-action="remove-col"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rows = table.querySelectorAll('tr');
            if (rows[0].children.length <= 1) return;
            rows.forEach(row => row.removeChild(row.lastChild));
            updateTableScroll();
            this.editor.createUndoPoint();
        });

        // 행 추가 이벤트
        controls.querySelector('[data-action="add-row"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rows = table.querySelectorAll('tr');
            const colCount = rows[0].children.length;
            const tbody = table.querySelector('tbody') || table;
            const newRow = document.createElement('tr');
            for (let col = 0; col < colCount; col++) {
                const td = document.createElement('td');
                td.style.border = rows[0].children[0].style.border;
                td.style.padding = '8px';
                td.innerHTML = '<br>';
                newRow.appendChild(td);
                this.setupCellEditing(td);
            }
            tbody.appendChild(newRow);
            updateTableScroll();
            this.editor.createUndoPoint();
        });

        // 행 제거 이벤트
        controls.querySelector('[data-action="remove-row"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rows = table.querySelectorAll('tr');
            if (rows.length <= 1) return;
            const tbody = table.querySelector('tbody') || table;
            tbody.removeChild(tbody.lastChild);
            updateTableScroll();
            this.editor.createUndoPoint();
        });

        // 테이블 삭제 이벤트
        controls.querySelector('[data-action="delete-table"]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wrapper = table.closest('.t2-table-wrapper');
            if (wrapper) {
                wrapper.remove();
                this.editor.createUndoPoint();
            }
        });

        // 초기 스크롤 상태 설정
        updateTableScroll();
    }

    setupTableCellEditing(table) {
        const cells = table.querySelectorAll('th, td');
        cells.forEach(cell => {
            this.setupCellEditing(cell);
        });
    }

    setupCellEditing(cell) {
        cell.contentEditable = true;
        
        cell.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(cell);
            selection.removeAllRanges();
            selection.addRange(range);
        });
        
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.execCommand('insertHTML', false, '<br>');
            }
        });
    }

    setupTableResizing(table) {
        let isResizing = false;
        let currentTh = null;
        let startX = 0;
        let startWidth = 0;
        
        const headers = table.querySelectorAll('th');
        headers.forEach(th => {
            th.addEventListener('mousedown', (e) => {
                const thRect = th.getBoundingClientRect();
                if (thRect.right - e.clientX <= 5) {
                    isResizing = true;
                    currentTh = th;
                    startX = e.clientX;
                    startWidth = th.offsetWidth;
                    
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const diffX = e.clientX - startX;
            const newWidth = Math.max(30, startWidth + diffX);
            
            currentTh.style.width = `${newWidth}px`;
            
            const colIndex = Array.from(currentTh.parentNode.children).indexOf(currentTh);
            const rows = table.querySelectorAll('tr');
            
            rows.forEach(row => {
                const cell = row.children[colIndex];
                if (cell) {
                    cell.style.width = `${newWidth}px`;
                }
            });
            
            e.preventDefault();
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                currentTh = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                this.editor.createUndoPoint();
            }
        });
    }

    exportTableToCSV(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const csvRows = [];

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            const rowData = cells.map(cell => {
                let text = cell.textContent.trim();
                if (text.includes('"') || text.includes(',')) {
                    text = `"${text.replace(/"/g, '""')}"`;
                }
                return text;
            });
            csvRows.push(rowData.join(','));
        });

        const csvContent = csvRows.join('\n');
        T2Utils.downloadTextFile(csvContent, `table_export_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
    }

    initializeTableBlocks() {
        this.editor.editor.querySelectorAll('.table-responsive').forEach(responsiveWrapper => {
            const table = responsiveWrapper.querySelector('table');
            if (table) {
                if (!table.classList.contains('t2-table')) table.classList.add('t2-table');

                const tableWrapper = this.createTableWrapper(table);
                responsiveWrapper.parentNode.insertBefore(tableWrapper, responsiveWrapper);
                responsiveWrapper.remove();

                this.setupTableControlEvents(tableWrapper.querySelector('.t2-table-controls'), table);
                this.setupTableCellEditing(table);
                this.setupTableResizing(table);
            }
        });

        this.editor.editor.querySelectorAll('table.t2-table').forEach(table => {
            let tableWrapper = table.closest('.t2-table-wrapper');

            if (!tableWrapper) {
                tableWrapper = this.createTableWrapper(table);
                table.parentNode.insertBefore(tableWrapper, table);
                tableWrapper.appendChild(table);

                this.setupTableControlEvents(tableWrapper.querySelector('.t2-table-controls'), table);
                this.setupTableCellEditing(table);
                this.setupTableResizing(table);
            }
        });
    }
}

window.T2TablePlugin = T2TablePlugin;