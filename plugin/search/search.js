// T2Editor/plugin/search/search.js

class T2SearchPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['search'];
        this.API_URL = 'https://dsclub.kr/api/search/index.php';
        this.CACHE_URL = 'https://dsclub.kr/api/search/cache.php';
        this.API_KEY = 'dsclubSEARCH2025';
        
        this.searchBar = null;
        this.resultsContainer = null;
        this.infoBar = null;
        this.isLoading = false;
        this.currentTags = [];
        this.currentOffset = 0;
        this.totalResults = 0;
        this.hasMore = false;
        this.LIMIT = 15;
        this.MAX_RESULTS = 100;
        
        this.editorSearchEnabled = this.loadEditorSearchSetting();
        this.editorHighlights = [];
        this.currentHighlightIndex = -1;
        
        this.db = null;
        this.initIndexedDB();
    }

    // ========== IndexedDB 초기화 ==========
    async initIndexedDB() {
        try {
            this.db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('T2SearchCache', 2);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    // 기존 store 삭제 후 재생성
                    if (db.objectStoreNames.contains('searches')) {
                        db.deleteObjectStore('searches');
                    }
                    const store = db.createObjectStore('searches', { keyPath: 'key' });
                    store.createIndex('hits', 'hits', { unique: false });
                    store.createIndex('expires', 'expires', { unique: false });
                    store.createIndex('created', 'created', { unique: false });
                };
            });
            this.cleanExpiredCache();
        } catch (e) {
            // 실패 처리
        }
    }

    // 만료된 캐시 정리
    async cleanExpiredCache() {
        if (!this.db) return;
        try {
            const tx = this.db.transaction(['searches'], 'readwrite');
            const store = tx.objectStore('searches');
            const index = store.index('expires');
            const now = Date.now();
            const request = index.openCursor();
            
            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.value.expires < now) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
            await new Promise(resolve => tx.oncomplete = resolve);
        } catch (e) {
            // 실패 처리
        }
    }

    // ========== 캐시 키 생성 ==========
    getCacheKey(tags, limit, offset) {
        // tags를 정렬하여 순서에 관계없이 같은 키 생성
        const sortedTags = [...tags].sort().join(',');
        return `${sortedTags}|${limit}|${offset}`;
    }

    // ========== 로컬 캐시 (IndexedDB) ==========
    async getLocalCache(key) {
        if (!this.db) return null;
        try {
            const tx = this.db.transaction(['searches'], 'readonly');
            const store = tx.objectStore('searches');
            const request = store.get(key);
            
            const data = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
            
            if (!data) return null;
            
            // 만료 체크
            if (data.expires < Date.now()) {
                this.deleteLocalCache(key);
                return null;
            }
            
            // 히트 카운트 업데이트
            this.updateCacheHits(key, data);
            
            return data.data;
        } catch (e) {
            return null;
        }
    }

    async setLocalCache(key, data, ttl = 3600000) {
        // 유효한 데이터만 캐시
        if (!this.db || !data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
            return;
        }
        
        try {
            const tx = this.db.transaction(['searches'], 'readwrite');
            const store = tx.objectStore('searches');
            
            // 기존 캐시 확인
            const existing = await new Promise((resolve) => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
            
            const cacheEntry = {
                key,
                data,
                hits: existing ? existing.hits + 1 : 1,
                created: existing ? existing.created : Date.now(),
                expires: Date.now() + ttl
            };
            
            // 인기 검색 TTL 연장
            if (cacheEntry.hits > 5) {
                cacheEntry.expires = Date.now() + (ttl * 2);
            }
            
            store.put(cacheEntry);
            await new Promise(resolve => tx.oncomplete = resolve);
            
            // 캐시 크기 제한
            this.limitLocalCacheSize();
        } catch (e) {
            // 실패 처리
        }
    }

    async deleteLocalCache(key) {
        if (!this.db) return;
        try {
            const tx = this.db.transaction(['searches'], 'readwrite');
            const store = tx.objectStore('searches');
            store.delete(key);
        } catch (e) {}
    }

    async updateCacheHits(key, data) {
        if (!this.db) return;
        try {
            const tx = this.db.transaction(['searches'], 'readwrite');
            const store = tx.objectStore('searches');
            data.hits++;
            store.put(data);
        } catch (e) {}
    }

    async limitLocalCacheSize() {
        if (!this.db) return;
        try {
            const tx = this.db.transaction(['searches'], 'readwrite');
            const store = tx.objectStore('searches');
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                const count = countRequest.result;
                if (count > 100) {
                    // 히트수가 낮은 순으로 삭제
                    const index = store.index('hits');
                    const request = index.openCursor();
                    let deleted = 0;
                    const toDelete = count - 100;
                    
                    request.onsuccess = (e) => {
                        const cursor = e.target.result;
                        if (cursor && deleted < toDelete) {
                            cursor.delete();
                            deleted++;
                            cursor.continue();
                        }
                    };
                }
            };
        } catch (e) {}
    }

    // ========== 공유 캐시 ==========
    async getSharedCache(tags, limit, offset) {
        try {
            const params = new URLSearchParams({
                tags: tags.join(','),
                limit: limit.toString(),
                offset: offset.toString()
            });
            
            const response = await fetch(`${this.CACHE_URL}?${params}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                return null;
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data || !result.data.results) {
                return null;
            }
            
            return result.data;
        } catch (e) {
            return null;
        }
    }

    async uploadToSharedCache(tags, limit, offset, results, total) {
        // 유효한 결과만 업로드
        if (!results || !Array.isArray(results) || results.length === 0) {
            return;
        }
        
        try {
            const response = await fetch(this.CACHE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tags: tags.join(','),
                    limit,
                    offset,
                    results,
                    total
                })
            });
        } catch (e) {
            //실패 처리
        }
    }

    // ========== 검색 실행  ==========
    async performSearch(query, isNewSearch = true) {
        if (this.isLoading) return;

        let tags = this.currentTags;
        if (isNewSearch && query) {
            tags = query.split(/[,，\s]+/).map(t => t.trim()).filter(t => t.length > 0);
            if (tags.length === 0) {
                this.showMessage('검색어를 입력해주세요.', 'empty', 'search');
                return;
            }
            this.currentTags = tags;
            
            // 에디터 검색
            if (this.editorSearchEnabled) {
                const editorResults = this.searchEditorContent(query);
                this.renderEditorResults(editorResults);
            }
        }

        if (tags.length === 0) return;

        this.isLoading = true;
        const searchBtn = this.searchBar.querySelector('.t2-search-btn');
        searchBtn.disabled = true;

        // 로딩 표시
        if (isNewSearch && !this.editorSearchEnabled) {
            this.resultsContainer.innerHTML = `<div class="t2-search-loading"><span class="material-icons">autorenew</span><div style="margin-top:8px">검색 중...</div></div>`;
        } else if (isNewSearch) {
            const loading = document.createElement('div');
            loading.className = 't2-search-loading';
            loading.innerHTML = `<span class="material-icons">autorenew</span><div style="margin-top:8px">T2Search로 검색 중...</div>`;
            this.resultsContainer.appendChild(loading);
        } else {
            const loadingMore = document.createElement('div');
            loadingMore.className = 't2-search-load-more';
            loadingMore.innerHTML = '<span class="material-icons" style="font-size:16px;animation:t2-spin 1s linear infinite">autorenew</span>';
            this.resultsContainer.appendChild(loadingMore);
        }

        try {
            const cacheKey = this.getCacheKey(tags, this.LIMIT, this.currentOffset);
            let data = null;
            
            // 1단계: 로컬 캐시 확인
            data = await this.getLocalCache(cacheKey);
            
            // 2단계: 공유 캐시 확인
            if (!data) {
                data = await this.getSharedCache(tags, this.LIMIT, this.currentOffset);
                if (data) {
                    // 로컬 캐시에 공유 캐시 데이터 저장
                    await this.setLocalCache(cacheKey, data);
                }
            }
            
            // 3단계: API 직접 호출
            if (!data) {
                const response = await fetch(this.API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.API_KEY,
                        'X-T2Editor': 'true' 
                    },
                    body: JSON.stringify({
                        tags,
                        limit: this.LIMIT,
                        offset: this.currentOffset
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const apiResult = await response.json();
                
                if (!apiResult.success) {
                    throw new Error(apiResult.error || '검색 실패');
                }
                
                // 결과 검증
                if (!apiResult.results || !Array.isArray(apiResult.results)) {
                    throw new Error('잘못된 검색 결과 형식');
                }
                
                data = {
                    results: apiResult.results,
                    total: apiResult.total || 0
                };
                
                // 유효한 결과만 캐시에 저장
                if (data.results.length > 0) {
                    await this.setLocalCache(cacheKey, data);
                    await this.uploadToSharedCache(tags, this.LIMIT, this.currentOffset, data.results, data.total);
                }
            }

            // 로딩 표시 제거
            const loadingEl = this.resultsContainer.querySelector('.t2-search-load-more, .t2-search-loading');
            if (loadingEl) loadingEl.remove();

            // 결과 처리
            if (isNewSearch) {
                this.totalResults = data.total;
                
                // 검색 결과가 없으면 메시지 표시
                if (data.results.length === 0) {
                    this.showMessage('검색 결과가 없습니다.', 'empty', 'block');
                    return;
                }
                
                // API 결과 헤더 추가
                this.renderApiHeader();
            }

            // 결과 렌더링
            if (data.results.length > 0) {
                this.appendResults(data.results);
            }
            
            // 페이징 상태 업데이트
            this.currentOffset += data.results.length;
            this.hasMore = this.currentOffset < Math.min(this.totalResults, this.MAX_RESULTS) && 
                          data.results.length === this.LIMIT;
            
            this.updateHeader();

        } catch (error) {
            console.error('Search error:', error);
            
            // 로딩 표시 제거
            const loadingEl = this.resultsContainer.querySelector('.t2-search-load-more, .t2-search-loading');
            if (loadingEl) loadingEl.remove();
            
            // 에러 메시지
            if (isNewSearch) {
                let errorMessage = 'T2Search가 바빠요, 나중에 다시 시도해주세요';
                let errorIcon = 'block';
                
                if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
                    errorMessage = '네트워크 연결을 확인해주세요';
                    errorIcon = 'wifi_off';
                } else if (error.message.includes('timeout')) {
                    errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요';
                    errorIcon = 'timer_off';
                } else if (error.message.includes('HTTP') || error.message.includes('검색 실패')) {
                    errorMessage = '검색 서비스에 문제가 있습니다. 잠시 후 다시 시도해주세요';
                    errorIcon = 'error';
                }
                
                this.showMessage(errorMessage, 'api-busy', errorIcon);
            }
        } finally {
            this.isLoading = false;
            searchBtn.disabled = false;
        }
    }

    // ========== 에디터 검색 설정 ==========
    loadEditorSearchSetting() {
        let value = localStorage.getItem('t2-editor-search-enabled');
        if (value === null) value = this.getCookie('t2-editor-search-enabled');
        return value !== 'false';
    }

    saveEditorSearchSetting(enabled) {
        localStorage.setItem('t2-editor-search-enabled', enabled);
        this.setCookie('t2-editor-search-enabled', enabled, 365);
    }

    setCookie(name, value, days) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
    }

    getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // ========== UI 관련 메서드 ==========
    handleCommand(command, button) {
        if (command === 'search') this.toggleSearchBar();
    }

    toggleSearchBar() {
        this.searchBar ? this.closeSearchBar() : this.createSearchBar();
    }

    createSearchBar() {
        const toolbar = this.editor.toolbar;
        
        this.searchBar = document.createElement('div');
        this.searchBar.className = 't2-search-bar';
        this.searchBar.innerHTML = `
            <div class="t2-search-input-wrapper">
                <span class="material-icons t2-search-icon">search</span>
                <input type="text" class="t2-search-input" placeholder="검색어 입력 (쉼표 또는 공백으로 구분)">
                <button class="t2-search-btn" type="button">검색</button>
            </div>
            <div class="t2-search-results"></div>
        `;

        this.infoBar = document.createElement('div');
        this.infoBar.className = 't2-search-info-bar';
        this.infoBar.innerHTML = `
            <div class="t2-editor-search-toggle">
                <label class="t2-search-switch">
                    <input type="checkbox" ${this.editorSearchEnabled ? 'checked' : ''}>
                    <span class="t2-search-slider"></span>
                </label>
                <span class="t2-editor-search-label">에디터 내 검색</span>
            </div>
            <a href="https://dsclub.kr/service/search" target="_blank" rel="noopener noreferrer" class="t2-search-powered">
                powered by <span>T2Search</span>
            </a>
        `;

        this.closeBtn = document.createElement('button');
        this.closeBtn.className = 't2-search-close';
        this.closeBtn.type = 'button';
        this.closeBtn.innerHTML = '<span class="material-icons">close</span>';

        this.applyStyles();
        toolbar.insertAdjacentElement('afterend', this.searchBar);
        this.searchBar.insertAdjacentElement('afterend', this.infoBar);
        this.infoBar.insertAdjacentElement('afterend', this.closeBtn);

        this.resultsContainer = this.searchBar.querySelector('.t2-search-results');
        const input = this.searchBar.querySelector('.t2-search-input');
        const searchBtn = this.searchBar.querySelector('.t2-search-btn');
        const editorToggle = this.infoBar.querySelector('.t2-editor-search-toggle input');

        editorToggle.addEventListener('change', (e) => {
            this.editorSearchEnabled = e.target.checked;
            this.saveEditorSearchSetting(this.editorSearchEnabled);
            if (input.value.trim()) this.resetAndSearch(input.value);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.resetAndSearch(input.value);
            }
        });

        input.addEventListener('input', (e) => {
            if (this.searchDebounce) clearTimeout(this.searchDebounce);
            this.searchDebounce = setTimeout(() => {
                if (this.editorSearchEnabled && e.target.value.trim()) {
                    this.searchEditorContent(e.target.value.trim());
                } else {
                    this.clearHighlights();
                }
            }, 300);
        });

        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.resetAndSearch(input.value);
        });

        this.closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeSearchBar();
        });

        this.resultsContainer.addEventListener('scroll', () => this.handleScroll());

        setTimeout(() => document.addEventListener('click', this.handleOutsideClick), 100);
        setTimeout(() => input.focus(), 100);
    }

    handleOutsideClick = (e) => {
        if (this.searchBar && !this.searchBar.contains(e.target)) {
            if (this.infoBar && this.infoBar.contains(e.target)) return;
            const searchButton = this.editor.toolbar.querySelector('[data-command="search"]');
            if (searchButton && searchButton.contains(e.target)) return;
            this.closeSearchBar();
        }
    }

    handleScroll() {
        if (this.isLoading || !this.hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = this.resultsContainer;
        if (scrollTop + clientHeight >= scrollHeight - 50) this.loadMore();
    }

    async loadMore() {
        if (this.currentOffset >= this.MAX_RESULTS) {
            this.hasMore = false;
            return;
        }
        await this.performSearch(null, false);
    }

    resetAndSearch(query) {
        this.currentOffset = 0;
        this.totalResults = 0;
        this.hasMore = false;
        this.resultsContainer.innerHTML = '';
        this.clearHighlights();
        
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            this.showMessage('검색어를 입력해주세요.', 'empty', 'search');
            return;
        }

        if (this.editorSearchEnabled) this.searchEditorContent(trimmedQuery);
        this.performSearch(query, true);
    }

    // ========== 에디터 내 검색 ==========
    searchEditorContent(query) {
        this.clearHighlights();
        const editorEl = this.editor.editor;
        const text = editorEl.innerText || editorEl.textContent;
        const lines = text.split('\n');
        const results = [];
        const searchTerms = query.toLowerCase().split(/[,，\s]+/).filter(t => t.length > 0);

        lines.forEach((line, lineIndex) => {
            const lineLower = line.toLowerCase();
            searchTerms.forEach(term => {
                let pos = 0;
                while ((pos = lineLower.indexOf(term, pos)) !== -1) {
                    const start = Math.max(0, pos - 20);
                    const end = Math.min(line.length, pos + term.length + 20);
                    let snippet = line.substring(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < line.length) snippet = snippet + '...';
                    results.push({
                        lineNumber: lineIndex + 1,
                        position: pos,
                        term: term,
                        snippet: snippet,
                        fullLine: line,
                        matchStart: pos,
                        matchEnd: pos + term.length
                    });
                    pos += term.length;
                }
            });
        });

        this.applyHighlights(searchTerms);
        return results;
    }

    applyHighlights(searchTerms) {
        const editorEl = this.editor.editor;
        this.editorHighlights = [];
        const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim()) textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const textLower = text.toLowerCase();
            const matches = [];

            searchTerms.forEach(term => {
                let pos = 0;
                while ((pos = textLower.indexOf(term, pos)) !== -1) {
                    matches.push({ start: pos, end: pos + term.length, term });
                    pos += term.length;
                }
            });

            if (matches.length === 0) return;
            matches.sort((a, b) => a.start - b.start);
            const mergedMatches = [];
            matches.forEach(m => {
                const last = mergedMatches[mergedMatches.length - 1];
                if (last && m.start <= last.end) {
                    last.end = Math.max(last.end, m.end);
                } else {
                    mergedMatches.push({ ...m });
                }
            });

            const parent = textNode.parentNode;
            if (!parent || parent.classList?.contains('t2-search-highlight')) return;

            for (let i = mergedMatches.length - 1; i >= 0; i--) {
                const match = mergedMatches[i];
                const range = document.createRange();
                try {
                    range.setStart(textNode, match.start);
                    range.setEnd(textNode, match.end);
                    const highlight = document.createElement('span');
                    highlight.className = 't2-search-highlight';
                    highlight.dataset.highlightIndex = this.editorHighlights.length;
                    range.surroundContents(highlight);
                    this.editorHighlights.push(highlight);
                } catch (e) {}
            }
        });
    }

    clearHighlights() {
        this.editorHighlights.forEach(el => {
            if (el && el.parentNode) {
                const parent = el.parentNode;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
            }
        });
        this.editorHighlights = [];
        this.currentHighlightIndex = -1;
        this.editor.editor.normalize();
    }

    renderEditorResults(results) {
        if (results.length === 0) return;
        const section = document.createElement('div');
        section.className = 't2-search-editor-section';
        const title = document.createElement('div');
        title.className = 't2-search-section-title';
        title.innerHTML = `<span class="material-icons">edit_note</span> 에디터 내 검색 결과 (${results.length}개)`;
        section.appendChild(title);

        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 't2-search-editor-item';
            item.dataset.resultIndex = index;
            const location = document.createElement('div');
            location.className = 't2-search-editor-location';
            location.textContent = `${result.lineNumber}번째 줄, ${result.position + 1}번째 문자`;
            const textEl = document.createElement('div');
            textEl.className = 't2-search-editor-text';
            const escapedSnippet = this.escapeHtml(result.snippet);
            const escapedTerm = this.escapeHtml(result.term);
            const regex = new RegExp(`(${this.escapeRegExp(escapedTerm)})`, 'gi');
            textEl.innerHTML = escapedSnippet.replace(regex, '<mark>$1</mark>');
            item.appendChild(location);
            item.appendChild(textEl);
            item.addEventListener('click', () => this.scrollToHighlight(index, results));
            section.appendChild(item);
        });

        if (this.resultsContainer.firstChild) {
            this.resultsContainer.insertBefore(section, this.resultsContainer.firstChild);
        } else {
            this.resultsContainer.appendChild(section);
        }
    }

    scrollToHighlight(index, results) {
        this.searchBar.querySelectorAll('.t2-search-editor-item.active').forEach(el => el.classList.remove('active'));
        this.editorHighlights.forEach(el => el.classList.remove('t2-search-highlight-active'));
        const item = this.searchBar.querySelector(`[data-result-index="${index}"]`);
        if (item) item.classList.add('active');
        if (this.editorHighlights[index]) {
            const highlight = this.editorHighlights[index];
            highlight.classList.add('t2-search-highlight-active');
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.currentHighlightIndex = index;
        }
    }

    renderApiHeader() {
        const existingHeader = this.resultsContainer.querySelector('.t2-search-api-header');
        if (existingHeader) return;
        
        const header = document.createElement('div');
        header.className = 't2-search-section-title t2-search-api-header';
        header.innerHTML = `<span class="material-icons" style="color:#4E80ED">public</span> T2Search 검색 결과`;
        header.style.marginTop = '8px';
        this.resultsContainer.appendChild(header);
    }

    renderHeader() {
        const header = document.createElement('div');
        header.className = 't2-search-header';
        header.style.cssText = 'font-size:12px;color:#888;margin-bottom:8px;padding:0 4px;';
        this.resultsContainer.appendChild(header);
        this.updateHeader();
    }

    updateHeader() {
        const header = this.resultsContainer.querySelector('.t2-search-header');
        if (header) {
            const maxShow = Math.min(this.totalResults, this.MAX_RESULTS);
            header.textContent = `총 ${this.totalResults}개 중 ${this.currentOffset}개 표시${this.totalResults > this.MAX_RESULTS ? ' (최대 100개)' : ''}`;
        }
    }

    appendResults(results) {
        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 't2-search-result-item';
            
            const title = this.escapeHtml(item.title || '제목 없음');
            const snippet = this.escapeHtml(item.snippet || '');
            const url = this.escapeHtml(item.url || '');
            const score = item.score ? item.score.toFixed(1) : '0';
            
            div.innerHTML = `
                <div class="t2-search-result-title">${title}</div>
                <div class="t2-search-result-snippet">${snippet}</div>
                <div class="t2-search-result-meta">
                    <span class="t2-search-result-url">${this.truncateUrl(url, 50)}</span>
                    <span class="t2-search-result-score">점수 ${score}</span>
                </div>
            `;
            
            div.addEventListener('click', () => this.insertResult(item));
            this.resultsContainer.appendChild(div);
        });
    }

    insertResult(item) {
        const title = item.title || '제목 없음';
        const snippet = item.snippet || '내용 없음';
        const url = item.url || '';

        // 1. 제목 (볼드)
        const titleP = document.createElement('p');
        const boldTitle = document.createElement('b');
        boldTitle.textContent = title;
        titleP.appendChild(boldTitle);

        // 2. 코드블럭 생성
        const codeBlock = document.createElement('div');
        codeBlock.className = 't2-media-block t2-code-block';
        codeBlock.contentEditable = 'false';
        
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin:0;padding:16px;background:#f5f5f5;border-radius:8px;overflow-x:auto;';
        
        const code = document.createElement('code');
        code.textContent = snippet;
        code.contentEditable = 'true';
        code.style.cssText = 'outline:none;display:block;white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:13px;line-height:1.5;';
        
        pre.appendChild(code);
        codeBlock.appendChild(pre);

        // 3. 링크
        const linkP = document.createElement('p');
        linkP.textContent = '- ';
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = url;
        link.style.cssText = 'color:#4A90E2;text-decoration:underline;';
        linkP.appendChild(link);

        // 4. 빈 줄
        const spacer = document.createElement('p');
        spacer.innerHTML = '<br>';

        // 5. 삽입
        const editorEl = this.editor.editor;
        
        // 마지막 요소 찾기
        let lastElement = editorEl.lastElementChild;
        if (!lastElement) {
            lastElement = document.createElement('p');
            lastElement.innerHTML = '<br>';
            editorEl.appendChild(lastElement);
        }

        // 요소들을 순서대로 추가
        editorEl.appendChild(titleP);
        editorEl.appendChild(codeBlock);
        editorEl.appendChild(linkP);
        editorEl.appendChild(spacer);

        // 코드 플러그인 이벤트 설정
        const codePlugin = this.editor.getPlugin('code');
        if (codePlugin && code) {
            codePlugin.setupCodeEvents(code);
        }

        // 링크 플러그인 이벤트 설정
        const linkPlugin = this.editor.getPlugin('link');
        if (linkPlugin && link) {
            linkPlugin.setupLinkEvents(link);
        }

        // 정규화 및 저장
        this.editor.normalizeContent();
        this.editor.createUndoPoint();
        this.editor.autoSave();
        
        // 커서를 마지막 빈 줄로 이동
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(spacer, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        this.editor.editor.focus();
        
        // 삽입된 위치로 스크롤
        spacer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // 검색창 닫기
        this.closeSearchBar();

        // 알림
        if (typeof T2Utils !== 'undefined' && T2Utils.showNotification) {
            T2Utils.showNotification('검색 결과가 삽입되었습니다.', 'success');
        }
    }

    showMessage(message, type = 'empty', icon = null) {
        const className = type === 'error' || type === 'api-busy' ? 't2-search-error' : 't2-search-empty';
        
        // 검색 불가 아이콘 설정
        if (!icon) {
            icon = (type === 'error' || type === 'api-busy') ? 'block' : 'search_off';
        }
        
        const msgEl = document.createElement('div');
        msgEl.className = className;
        msgEl.innerHTML = `
            <span class="material-icons" style="font-size:32px;margin-bottom:8px;opacity:0.5">${icon}</span>
            <div>${message}</div>
        `;
        this.resultsContainer.appendChild(msgEl);
    }

    // ========== 유틸리티 ==========
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    truncateUrl(url, maxLength) {
        if (!url) return '';
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    closeSearchBar() {
        document.removeEventListener('click', this.handleOutsideClick);
        this.clearHighlights();
        if (this.searchBar) {
            this.searchBar.remove();
            this.searchBar = null;
            this.resultsContainer = null;
        }
        if (this.infoBar) {
            this.infoBar.remove();
            this.infoBar = null;
        }
        if (this.closeBtn) {
            this.closeBtn.remove();
            this.closeBtn = null;
        }
        this.currentTags = [];
        this.currentOffset = 0;
        this.totalResults = 0;
        this.hasMore = false;
        if (this.searchDebounce) clearTimeout(this.searchDebounce);
    }

    applyStyles() {
        if (document.getElementById('t2-search-styles')) return;
        const style = document.createElement('style');
        style.id = 't2-search-styles';
        style.textContent = `
            .t2-search-bar{position:relative;background:var(--t2-bg,#fff);border:1px solid var(--t2-border,#e0e0e0);border-radius:24px;margin:8px 12px;padding:10px 16px;box-shadow:0 2px 12px rgba(0,0,0,0.1);z-index:100}
            .t2-search-input-wrapper{display:flex;align-items:center;gap:8px}
            .t2-search-icon{color:#888;font-size:20px;flex-shrink:0}
            .t2-search-input{flex:1;border:none;outline:none;font-size:14px;background:transparent;color:var(--t2-text,#333);min-width:0}
            .t2-search-input::placeholder{color:#999}
            .t2-search-btn{background:#3b82f6;color:#fff;border:none;border-radius:16px;padding:6px 16px;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.2s;flex-shrink:0}
            .t2-search-btn:hover{background:#2563eb}
            .t2-search-btn:disabled{background:#94a3b8;cursor:not-allowed}
            .t2-search-close{display:flex;justify-content:center;align-items:center;margin:4px 12px 8px;padding:6px;background:#f1f1f1;border:none;cursor:pointer;color:#888;border-radius:50%;transition:all 0.2s;width:30px;height:30px;margin-left:auto;margin-right:30px}
            .t2-search-close:hover{background:rgba(0,0,0,0.05);color:#333}
            .t2-search-results{max-height:350px;overflow-y:auto;margin-top:0;border-radius:0 0 16px 16px}
            .t2-search-results:not(:empty){margin-top:10px;padding-top:10px;border-top:1px solid var(--t2-border,#eee)}
            .t2-search-result-item{padding:12px;border-radius:8px;cursor:pointer;transition:background 0.15s;margin-bottom:4px}
            .t2-search-result-item:hover{background:var(--t2-hover,#f0f7ff)}
            .t2-search-result-title{font-weight:600;font-size:14px;color:var(--t2-text,#333);margin-bottom:4px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .t2-search-result-snippet{font-size:12px;color:#666;line-height:1.5;margin-bottom:4px}
            .t2-search-result-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:#999}
            .t2-search-result-url{color:#3b82f6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
            .t2-search-result-score{background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-weight:500}
            .t2-search-loading,.t2-search-empty,.t2-search-error{text-align:center;padding:20px 16px;color:#666;font-size:13px}
            .t2-search-error{color:#dc2626}
            .t2-search-loading .material-icons{animation:t2-spin 1s linear infinite;font-size:24px;color:#3b82f6}
            .t2-search-load-more{text-align:center;padding:12px;color:#888;font-size:12px}
            .t2-search-info-bar{display:flex;justify-content:space-between;align-items:center;margin:4px 12px 8px;padding:0 16px;font-size:11px}
            .t2-search-powered{color:#9ca3af;text-decoration:none;transition:opacity 0.2s;font-size:10px}
            .t2-search-powered:hover{opacity:0.8}
            .t2-search-powered span{color:#f97316;font-weight:600}
            .t2-editor-search-toggle{display:flex;align-items:center;gap:6px}
            .t2-editor-search-label{color:#6b7280;font-size:11px}
            .t2-search-switch{position:relative;display:inline-block;width:32px;height:18px}
            .t2-search-switch input{opacity:0;width:0;height:0}
            .t2-search-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#d1d5db;transition:0.3s;border-radius:18px}
            .t2-search-slider:before{position:absolute;content:"";height:14px;width:14px;left:2px;bottom:2px;background-color:white;transition:0.3s;border-radius:50%}
            .t2-search-switch input:checked+.t2-search-slider{background-color:#f59e0b}
            .t2-search-switch input:checked+.t2-search-slider:before{transform:translateX(14px)}
            .t2-search-editor-section{border-bottom:1px solid var(--t2-border,#eee);padding-bottom:12px;margin-bottom:12px}
            .t2-search-section-title{font-size:11px;font-weight:600;color:#ff6600;margin-bottom:8px;display:flex;align-items:center;gap:4px;text-transform:uppercase;letter-spacing:0.5px}
            .t2-search-section-title .material-icons{font-size:14px}
            .t2-search-editor-item{padding:10px 12px;border-radius:8px;cursor:pointer;transition:all 0.2s ease;margin-bottom:4px;background:var(--t2-bg-secondary,#f9fafb);border:1px solid transparent;box-shadow:0 1px 2px rgba(0,0,0,0.02)}
            .t2-search-editor-item:hover{background:var(--t2-hover,#f0f7ff);border-color:rgba(59,130,246,0.15);transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,0.05)}
            .t2-search-editor-item.active{background:rgba(251,191,36,0.08);border-color:rgba(251,191,36,0.2)}
            .t2-search-editor-location{font-size:10px;color:#6b7280;font-weight:500;margin-bottom:4px;font-family:monospace}
            .t2-search-editor-text{font-size:12px;color:var(--t2-text,#333);line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .t2-search-editor-text mark{background:rgba(251,191,36,0.3);color:inherit;padding:1px 2px;border-radius:3px;font-weight:500}
            .t2-search-highlight{background-color:rgba(251,191,36,0.25)!important;border-radius:2px}
            .t2-search-highlight-active{background-color:rgba(245,158,11,0.4)!important;outline:1px solid rgba(245,158,11,0.6)}
            @keyframes t2-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            [data-t2editor-theme="dark"] .t2-search-bar{background:#1e1e1e;border-color:#404040;box-shadow:0 2px 12px rgba(0,0,0,0.3)}
            [data-t2editor-theme="dark"] .t2-search-close:hover{background:rgba(255,255,255,0.1);color:#e0e0e0}
            [data-t2editor-theme="dark"] .t2-search-input{color:#e0e0e0}
            [data-t2editor-theme="dark"] .t2-search-result-item:hover{background:#2a2a2a}
            [data-t2editor-theme="dark"] .t2-search-result-title{color:#e0e0e0}
            [data-t2editor-theme="dark"] .t2-search-result-snippet{color:#aaa}
            [data-t2editor-theme="dark"] .t2-search-results:not(:empty){border-top-color:#404040}
            [data-t2editor-theme="dark"] .t2-search-result-score{background:#1e3a5f;color:#7dd3fc}
            [data-t2editor-theme="dark"] .t2-search-powered{color:#6b7280}
            [data-t2editor-theme="dark"] .t2-search-editor-item{background:#111827}
            [data-t2editor-theme="dark"] .t2-search-editor-item:hover{background:#1f2937;border-color:rgba(99,102,241,0.2)}
            [data-t2editor-theme="dark"] .t2-search-editor-item.active{background:rgba(251,191,36,0.1)}
            [data-t2editor-theme="dark"] .t2-search-editor-text{color:#e0e0e0}
            [data-t2editor-theme="dark"] .t2-search-editor-section{border-bottom-color:#404040}
        `;
        document.head.appendChild(style);
    }
}

window.T2SearchPlugin = T2SearchPlugin;