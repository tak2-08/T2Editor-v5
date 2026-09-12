// Path: T2Editor/plugin/collab/collab.js
(function(){
'use strict';

function isoNow(){ return (new Date()).toISOString(); }
function generateUUIDv4(){
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        buf[6] = (buf[6] & 0x0f) | 0x40;
        buf[8] = (buf[8] & 0x3f) | 0x80;
        const toHex = (n)=> (n+0x100).toString(16).substr(1);
        return Array.from(buf).map(toHex).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.+)$/, '$1-$2-$3-$4-$5');
    } else {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
            const r = Math.random()*16|0, v = c==='x'? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }
}

// 메모리 저장소 사용
const memoryStorage = {
    data: {},
    getItem(key) {
        return this.data[key] || null;
    },
    setItem(key, value) {
        this.data[key] = value;
    },
    removeItem(key) {
        delete this.data[key];
    },
    key(index) {
        const keys = Object.keys(this.data);
        return keys[index] || null;
    },
    get length() {
        return Object.keys(this.data).length;
    }
};

function getClientId(){
    let id = memoryStorage.getItem('t2_collab_client_id');
    if (!id) { 
        id = generateUUIDv4(); 
        memoryStorage.setItem('t2_collab_client_id', id); 
    }
    return id;
}

// HTML 콘텐츠 정규화 함수
function normalizeHTML(html) {
    if (!html) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 빈 태그 정리
    tempDiv.querySelectorAll('p, div').forEach(el => {
        if (!el.innerHTML.trim() || el.innerHTML === '<br>') {
            el.innerHTML = '<br>';
        }
    });
    
    // 연속된 br 태그 정리
    let cleanedHTML = tempDiv.innerHTML.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
    
    return cleanedHTML;
}

// HTML diff 알고리즘 - 전체 HTML을 비교하여 변경사항 감지
function computeHTMLDiff(prevHTML, currHTML) {
    prevHTML = normalizeHTML(prevHTML || '');
    currHTML = normalizeHTML(currHTML || '');
    
    if (prevHTML === currHTML) return null;
    
    return {
        type: 'full',
        content: currHTML,
        timestamp: isoNow()
    };
}

async function postAction(t2url, action, body) {
    const url = t2url + '/plugin/collab/collab_number.php';
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(Object.assign({}, body, { action }))
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return await resp.json();
    } catch(e) {
        console.error('postAction error:', e);
        return null;
    }
}

function sendHostDeleteBeacon(t2url, code, host_token) {
    try {
        if (!code || !host_token) return false;
        const url = t2url + '/plugin/collab/collab_number_delete.php';
        const payload = JSON.stringify({ code: code, host_token: host_token });
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon) {
            const ok = navigator.sendBeacon(url, blob);
            if (!ok) {
                try {
                    fetch(url, { method:'POST', body: payload, headers:{'Content-Type':'application/json'}, keepalive: true }).catch(()=>{});
                } catch(e){}
            }
            return ok;
        } else {
            try {
                fetch(url, { method:'POST', body: payload, headers:{'Content-Type':'application/json'}, keepalive: true }).catch(()=>{});
                return true;
            } catch(e){
                return false;
            }
        }
    } catch(e){ return false; }
}

class T2CollabPlugin {
    constructor(editor) {
        this.editor = editor;
        this.container = editor.container || document;
        this.toolbarBtn = this.container.querySelector('[data-command="collab"]');
        this.client_id = getClientId();
        this.collabCode = null;
        this.nickname = null;
        this.hostToken = null;
        this.isHost = false;
        this.t2url = (typeof t2editor_url !== 'undefined') ? t2editor_url : '';
        this.pollInterval = 2000; // 1.5초 → 2초로 증가
        this.debounceMs = 1000; // 800ms → 1000ms로 증가
        this._pollTimer = null;
        this._debounceTimer = null;
        this.localLastContent = '';
        this.knownServerVersion = 0;
        this._mutationObserver = null;
        this._inputHandler = null;
        this._unloadHandler = null;
        this._isUpdating = false;
        this._pendingUpdate = null;
        this._lastSentContent = '';
        
        // 충돌 해결을 위한 상태 관리
        this._conflictCount = 0;
        this._maxConflictRetries = 3;
        
        // 플러그인 명령어 등록
        this.commands = ['collab'];
        
        console.log('T2CollabPlugin initialized');
        this.init();
    }

    init() {
        if (!this.toolbarBtn) {
            console.error('Collab button not found');
            return;
        }
        
        console.log('Collab button found, setting up event listener');
        
        const state = this._loadRoomState();
        if (state && state.code) {
            this.collabCode = state.code;
            this.nickname = state.nickname || '';
            this.hostToken = state.hostToken || null;
            this.isHost = !!state.isHost;
            setTimeout(()=>this._initialSync(), 50);
            if (this.isHost) this._installHostUnloadHandler();
        }
    }

    // 명령어 처리 메서드 추가
    handleCommand(command, button) {
        console.log('handleCommand called:', command);
        if (command === 'collab') {
            this.openModal();
        }
    }

    _roomKey(code){ return `t2_collab_room_${code}`; }
    
    _saveRoomState(){ 
        if (!this.collabCode) return; 
        try { 
            memoryStorage.setItem(this._roomKey(this.collabCode), JSON.stringify({
                code:this.collabCode,
                nickname:this.nickname,
                hostToken:this.hostToken,
                isHost:this.isHost
            })); 
        } catch(e){
            console.error('Save room state error:', e);
        } 
    }
    
    _loadRoomState(){ 
        try { 
            for (let i=0; i < memoryStorage.length; i++){ 
                const k = memoryStorage.key(i); 
                if (!k) continue; 
                if (k.startsWith('t2_collab_room_')) { 
                    const v = memoryStorage.getItem(k); 
                    if (!v) continue; 
                    try { return JSON.parse(v); } catch(e){} 
                } 
            } 
        } catch(e){} 
        return null; 
    }
    
    _clearRoomState(){ 
        if (!this.collabCode) return; 
        try { 
            memoryStorage.removeItem(this._roomKey(this.collabCode)); 
        } catch(e){} 
    }

    async _initialSync() {
        if (!this.collabCode) return;
        const resp = await postAction(this.t2url, 'get', { code: this.collabCode });
        if (resp && resp.success && resp.data) {
            const d = resp.data;
            const content = d.content || '';
            const version = d.version || 0;
            this.knownServerVersion = version;
            this.localLastContent = content;
            this._lastSentContent = content;
            this._setEditorContent(content);
            this.startPolling();
        }
    }

    async createRoom(){
        const resp = await postAction(this.t2url, 'create', {});
        if (resp && resp.success) {
            this.collabCode = resp.code;
            this.hostToken = resp.host_token || null;
            this.isHost = true;
            this._saveRoomState();
            this._installHostUnloadHandler();
            return true;
        }
        return false;
    }
    
    async checkRoomExists(code){
        const resp = await postAction(this.t2url, 'exists', { code });
        return resp && resp.success;
    }
    
    async joinRoom(code, nickname){
        const resp = await postAction(this.t2url, 'join', { code, nickname, client_id: this.client_id });
        if (resp && resp.success) {
            this.collabCode = code;
            this.nickname = resp.nickname || nickname;
            this._saveRoomState();
            if (resp.data) {
                this.knownServerVersion = resp.data.version || 0;
                this.localLastContent = resp.data.content || '';
                this._lastSentContent = this.localLastContent;
                this._setEditorContent(this.localLastContent);
            }
            return resp.data || {};
        }
        return null;
    }
    
    async leaveRoom(){
        if (!this.collabCode) return;
        if (this.isHost) {
            await this.stopRoom();
            return;
        }
        await postAction(this.t2url, 'leave', { code:this.collabCode, client_id:this.client_id });
        this._clearRoomState();
        this.stopPolling();
        this.collabCode = null; 
        this.nickname = null; 
        this.isHost = false; 
        this.hostToken = null;
    }
    
    async kickUser(target_client_id){
        if (!this.isHost || !this.hostToken || !this.collabCode) return false;
        const resp = await postAction(this.t2url, 'kick', { code:this.collabCode, target_client_id, host_token:this.hostToken });
        return resp && resp.success;
    }
    
    async stopRoom(){
        if (!this.isHost || !this.hostToken || !this.collabCode) return false;
        try {
            const resp = await fetch(`${this.t2url}/plugin/collab/collab_number_delete.php`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ code:this.collabCode, host_token:this.hostToken })
            });
            this._clearRoomState();
            this.stopPolling();
            this._removeHostUnloadHandler();
            this.collabCode=null; 
            this.nickname=null; 
            this.isHost=false; 
            this.hostToken=null;
            const result = await resp.json();
            return result && result.success;
        } catch(e){
            this._clearRoomState();
            this.stopPolling();
            this._removeHostUnloadHandler();
            this.collabCode=null; 
            this.nickname=null; 
            this.isHost=false; 
            this.hostToken=null;
            return false;
        }
    }

    _getEditorContent() {
        if (this.editor && this.editor.editor && 'innerHTML' in this.editor.editor) {
            return this.editor.editor.innerHTML || '';
        }
        const ta = this.container.querySelector('textarea');
        return ta ? ta.value : '';
    }
    
    _setEditorContent(content) {
        if (this._isUpdating) return;
        this._isUpdating = true;
        
        try {
            const currentContent = this._getEditorContent();
            
            // 내용이 실제로 변경된 경우에만 업데이트 (에디터 강제 리셋 방지)
            if (currentContent !== content) {
                if (this.editor && this.editor.editor && 'innerHTML' in this.editor.editor) {
                    this.editor.editor.innerHTML = content;
                    
                    // 에디터 정규화 강제 실행
                    if (this.editor.normalizeContent) {
                        setTimeout(() => {
                            this.editor.normalizeContent();
                        }, 10);
                    }
                } else {
                    const ta = this.container.querySelector('textarea');
                    if (ta) ta.value = content;
                }
                
                this.localLastContent = content;
                this._lastSentContent = content;
            }
        } finally {
            setTimeout(() => { this._isUpdating = false; }, 100);
        }
    }

    scheduleLocalUpdate() {
        if (this._isUpdating) return;
        
        const curr = this._getEditorContent();
        
        // 마지막으로 보낸 내용과 현재 내용이 같으면 업데이트 생략
        if (curr === this._lastSentContent) return;
        
        const diff = computeHTMLDiff(this.localLastContent, curr);
        if (!diff) return;
        
        this.localLastContent = curr;
        this._pendingUpdate = diff;
        
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(async ()=>{
            await this._flushPendingUpdate();
        }, this.debounceMs);
    }

    async _flushPendingUpdate() {
        if (!this._pendingUpdate || this._isUpdating) return;
        
        const diff = this._pendingUpdate;
        this._pendingUpdate = null;
        
        const payload = {
            code: this.collabCode,
            client_id: this.client_id,
            base_version: this.knownServerVersion,
            diff: diff,
            ts: isoNow()
        };
        if (this.isHost && this.hostToken) payload.host_token = this.hostToken;
        
        const resp = await postAction(this.t2url, 'apply_op', payload);
        if (resp && resp.success) {
            this.knownServerVersion = resp.version || this.knownServerVersion;
            this._lastSentContent = this.localLastContent;
            this._conflictCount = 0; // 충돌 해결 성공 시 리셋
        } else {
            // 충돌 발생 시 서버에서 전체 내용 가져오기
            this._conflictCount++;
            if (this._conflictCount <= this._maxConflictRetries) {
                const full = await postAction(this.t2url, 'get', { code:this.collabCode });
                if (full && full.success && full.data) {
                    this.knownServerVersion = full.data.version || 0;
                    this.localLastContent = full.data.content || '';
                    this._lastSentContent = this.localLastContent;
                    this._setEditorContent(this.localLastContent);
                }
            } else {
                console.warn('Max conflict retries reached, stopping collaboration');
                this.leaveRoom();
            }
        }
    }

    async pollOnce() {
        if (!this.collabCode || this._isUpdating) return;
        
        const resp = await postAction(this.t2url, 'get', { 
            code:this.collabCode, 
            since_version: this.knownServerVersion 
        });
        
        if (!resp || !resp.success) return;
        if (resp.modified === false) return;
        
        if (resp.data && resp.data.content !== undefined) {
            const serverContent = resp.data.content || '';
            const localContent = this.localLastContent;
            
            // 서버 내용이 로컬과 다를 때만 업데이트 (에디터 강제 리셋 방지)
            if (localContent !== serverContent) {
                this.localLastContent = serverContent;
                this._lastSentContent = serverContent;
                this._setEditorContent(serverContent);
            }
            
            this.knownServerVersion = resp.data.version || this.knownServerVersion;
        }
    }

    startPolling() {
        if (this._pollTimer) return;
        this._pollTimer = setInterval(()=>this.pollOnce(), this.pollInterval);
        this.pollOnce();
        this._attachEditorHook();
    }

    stopPolling() {
        if (this._pollTimer) { 
            clearInterval(this._pollTimer); 
            this._pollTimer = null; 
        }
        if (this._debounceTimer) { 
            clearTimeout(this._debounceTimer); 
            this._debounceTimer = null; 
        }
        this._detachEditorHook();
    }

    _attachEditorHook() {
        if (this._inputHandler) return;
        
        this._inputHandler = ()=>{ 
            if (!this._isUpdating) {
                this.scheduleLocalUpdate(); 
            }
        };
        
        // MutationObserver로 DOM 변화 감지
        this._mutationObserver = new MutationObserver((mutations) => {
            if (!this._isUpdating) {
                this.scheduleLocalUpdate();
            }
        });
        
        if (this.editor && this.editor.editor) {
            this.editor.editor.addEventListener('input', this._inputHandler);
            this.editor.editor.addEventListener('paste', this._inputHandler);
            this.editor.editor.addEventListener('cut', this._inputHandler);
            
            // DOM 변화 관찰 시작
            this._mutationObserver.observe(this.editor.editor, {
                childList: true,
                subtree: true,
                characterData: true
            });
        } else {
            const ta = this.container.querySelector('textarea');
            if (ta) {
                ta.addEventListener('input', this._inputHandler);
                ta.addEventListener('paste', this._inputHandler);
                ta.addEventListener('cut', this._inputHandler);
            }
        }
    }
    
    _detachEditorHook(){
        if (this._inputHandler) {
            if (this.editor && this.editor.editor) {
                this.editor.editor.removeEventListener('input', this._inputHandler);
                this.editor.editor.removeEventListener('paste', this._inputHandler);
                this.editor.editor.removeEventListener('cut', this._inputHandler);
            } else {
                const ta = this.container.querySelector('textarea');
                if (ta) {
                    ta.removeEventListener('input', this._inputHandler);
                    ta.removeEventListener('paste', this._inputHandler);
                    ta.removeEventListener('cut', this._inputHandler);
                }
            }
            this._inputHandler = null;
        }
        
        if (this._mutationObserver) {
            this._mutationObserver.disconnect();
            this._mutationObserver = null;
        }
    }

    _installHostUnloadHandler(){
        if (this._unloadHandler) return;
        const handler = (ev) => {
            try {
                sendHostDeleteBeacon(this.t2url, this.collabCode, this.hostToken);
            } catch(e){}
        };
        this._unloadHandler = handler;
        window.addEventListener('beforeunload', handler, { passive: true });
        window.addEventListener('pagehide', handler, { passive: true });
        this._visibilityHandler = (e)=>{ 
            if (document.visibilityState === 'hidden') handler(); 
        };
        document.addEventListener('visibilitychange', this._visibilityHandler, { passive:true });
    }
    
    _removeHostUnloadHandler(){
        if (!this._unloadHandler) return;
        window.removeEventListener('beforeunload', this._unloadHandler);
        window.removeEventListener('pagehide', this._unloadHandler);
        if (this._visibilityHandler) { 
            document.removeEventListener('visibilitychange', this._visibilityHandler); 
            this._visibilityHandler = null; 
        }
        this._unloadHandler = null;
    }

    openModal(){
        console.log('openModal called');
        
        const overlay = document.createElement('div');
        overlay.className = 't2-collab-overlay';
        const box = document.createElement('div');
        box.className = 't2-collab-modal';
        overlay.appendChild(box);

        box.innerHTML = `
            <h3>협업하기</h3>
            <div class="t2-collab-tabs">
                <button class="t2-tab active" data-tab="create">협업하기</button>
                <button class="t2-tab" data-tab="join">협업 참여하기</button>
            </div>
            <div class="t2-tab-content">
                <div class="t2-tab-pane active" data-pane="create">
                    <div class="t2-collab-create-section">
                        <button class="t2-collab-create-btn">새 협업 방 만들기</button>
                    </div>
                    <div class="t2-collab-host-nick-section" style="display:none;">
                        <label>닉네임</label>
                        <input type="text" class="t2-collab-host-nick" placeholder="표시될 닉네임을 입력" value="${this.nickname || ''}" />
                        <div class="t2-collab-btn-group">
                            <button class="t2-collab-start-btn" disabled>협업 시작하기</button>
                        </div>
                    </div>
                </div>
                <div class="t2-tab-pane" data-pane="join">
                    <div class="t2-collab-join-section">
                        <label>협업 코드</label>
                        <input type="text" class="t2-collab-join-code" placeholder="협업 코드 입력" />
                        <label style="margin-top:16px">닉네임</label>
                        <input type="text" class="t2-collab-join-nick" placeholder="표시될 닉네임을 입력" />
                        <div class="t2-collab-btn-group">
                            <button class="t2-collab-join-btn" disabled>협업 참여하기</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="t2-collab-info-section" style="display:none;">
                <div class="t2-collab-info-header">
                    <div>방 코드: <strong class="t2-collab-display-code"></strong></div>
                    <button class="t2-collab-copy-btn">코드 복사</button>
                </div>
                <div class="t2-collab-info-row">내 닉네임: <strong class="t2-collab-display-nick"></strong></div>
                <div class="t2-collab-users-header">참여자 목록</div>
                <ul class="t2-collab-users"></ul>
                <div class="t2-collab-btn-group">
                    <button class="t2-collab-stop-btn" style="display:none">협업 중지</button>
                    <button class="t2-collab-leave-btn">나가기</button>
                </div>
            </div>
            <div class="t2-collab-close-group">
                <button class="t2-collab-close-btn">닫기</button>
            </div>
        `;
        document.body.appendChild(overlay);

        const tabs = box.querySelectorAll('.t2-tab');
        const panes = box.querySelectorAll('.t2-tab-pane');
        const createBtn = box.querySelector('.t2-collab-create-btn');
        const hostNickSection = box.querySelector('.t2-collab-host-nick-section');
        const hostNickInput = box.querySelector('.t2-collab-host-nick');
        const startBtn = box.querySelector('.t2-collab-start-btn');
        const joinCodeInput = box.querySelector('.t2-collab-join-code');
        const joinNickInput = box.querySelector('.t2-collab-join-nick');
        const joinBtn = box.querySelector('.t2-collab-join-btn');
        const infoSection = box.querySelector('.t2-collab-info-section');
        const dispCode = box.querySelector('.t2-collab-display-code');
        const dispNick = box.querySelector('.t2-collab-display-nick');
        const copyBtn = box.querySelector('.t2-collab-copy-btn');
        const usersList = box.querySelector('.t2-collab-users');
        const stopBtn = box.querySelector('.t2-collab-stop-btn');
        const leaveBtn = box.querySelector('.t2-collab-leave-btn');
        const closeBtn = box.querySelector('.t2-collab-close-btn');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetPane = tab.dataset.tab;
                panes.forEach(pane => {
                    pane.classList.remove('active');
                    if (pane.dataset.pane === targetPane) {
                        pane.classList.add('active');
                    }
                });
            });
        });

        createBtn.addEventListener('click', async () => {
            const ok = await this.createRoom();
            if (ok) {
                box.querySelector('.t2-collab-create-section').style.display = 'none';
                hostNickSection.style.display = 'block';
                hostNickInput.focus();
            } else {
                alert('방 생성 실패');
            }
        });

        hostNickInput.addEventListener('input', (e) => {
            startBtn.disabled = (e.target.value.trim().length === 0);
        });

        startBtn.addEventListener('click', async () => {
            const nick = hostNickInput.value.trim() || '익명';
            const data = await this.joinRoom(this.collabCode, nick);
            if (data) {
                box.querySelector('.t2-tab-content').style.display = 'none';
                infoSection.style.display = 'block';
                dispCode.textContent = this.collabCode;
                dispNick.textContent = this.nickname;
                if (this.isHost) stopBtn.style.display = 'inline-block';
                this.startPolling();
                this._updateUsersList(usersList);
            } else {
                alert('협업 시작 실패');
            }
        });

        const checkJoinInputs = () => {
            const code = joinCodeInput.value.trim();
            const nick = joinNickInput.value.trim();
            joinBtn.disabled = !(code.length > 3 && nick.length > 0);
        };
        joinCodeInput.addEventListener('input', checkJoinInputs);
        joinNickInput.addEventListener('input', checkJoinInputs);

        joinBtn.addEventListener('click', async () => {
            const code = joinCodeInput.value.trim();
            const nick = joinNickInput.value.trim() || '익명';
            if (!code) {
                alert('방 코드를 입력하세요');
                return;
            }
            const exists = await this.checkRoomExists(code);
            if (!exists) {
                alert('해당 방이 없습니다');
                return;
            }
            const data = await this.joinRoom(code, nick);
            if (data) {
                box.querySelector('.t2-tab-content').style.display = 'none';
                infoSection.style.display = 'block';
                dispCode.textContent = this.collabCode;
                dispNick.textContent = this.nickname;
                this.startPolling();
                this._updateUsersList(usersList);
            } else {
                alert('참여 실패');
            }
        });

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.collabCode).then(() => {
                alert('코드가 복사되었습니다.');
            }).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = this.collabCode;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('코드가 복사되었습니다.');
            });
        });

        usersList.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-clientid]');
            if (!btn) return;
            const target_client_id = btn.getAttribute('data-clientid');
            if (!this.isHost) {
                alert('방장만 강퇴할 수 있습니다');
                return;
            }
            const ok = await this.kickUser(target_client_id);
            if (ok) {
                this._updateUsersList(usersList);
            } else {
                alert('강퇴 실패');
            }
        });

        stopBtn.addEventListener('click', async () => {
            if (!this.isHost) return;
            const ok = await this.stopRoom();
            if (ok) {
                overlay.remove();
                alert('협업 중지 및 방 삭제 완료');
            } else {
                alert('협업 중지 실패');
            }
        });

        leaveBtn.addEventListener('click', async () => {
            await this.leaveRoom();
            overlay.remove();
        });

        closeBtn.addEventListener('click', () => {
            overlay.remove();
        });

        if (this.collabCode && this.nickname) {
            box.querySelector('.t2-tab-content').style.display = 'none';
            infoSection.style.display = 'block';
            dispCode.textContent = this.collabCode;
            dispNick.textContent = this.nickname;
            if (this.isHost) stopBtn.style.display = 'inline-block';
            this._updateUsersList(usersList);
        }
    }

    async _updateUsersList(container) {
        const resp = await postAction(this.t2url, 'get', { code: this.collabCode });
        if (resp && resp.success && resp.data) {
            this._renderUsers(container, resp.data.users || []);
        }
    }

    _renderUsers(container, users) {
        container.innerHTML = '';
        
        // 방장 찾기
        let hostUser = null;
        users.forEach(u => {
            if (u.isHost) {
                hostUser = u;
            }
        });
        
        (users || []).forEach(u => {
            const li = document.createElement('li');
            const left = document.createElement('div');
            left.className = 't2-collab-user-name';
            left.textContent = u.nickname || '(익명)';

            // '나' 뱃지 표시
            if (u.client_id === this.client_id) {
                const badge = document.createElement('span');
                badge.className = 't2-collab-badge-me';
                badge.textContent = '나';
                left.appendChild(badge);
            }

            // 방장 뱃지 표시 - 실제 방장인 경우에만
            if (u.isHost && u.client_id === hostUser?.client_id) {
                const hostBadge = document.createElement('span');
                hostBadge.className = 't2-collab-badge-host';
                hostBadge.textContent = '방장';
                left.appendChild(hostBadge);
            }

            li.appendChild(left);

            // 강퇴 버튼 - 현재 사용자가 방장이고, 대상이 방장이 아니며, 대상이 자신이 아닐 때만 표시
            if (this.isHost && !u.isHost && u.client_id !== this.client_id) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 't2-collab-kick-btn';
                kickBtn.textContent = '강퇴';
                kickBtn.setAttribute('data-clientid', u.client_id);
                li.appendChild(kickBtn);
            }

            container.appendChild(li);
        });
    }
}

// 전역으로 플러그인 클래스 노출
window.T2CollabPlugin = T2CollabPlugin;

// 자동 등록 (에디터 인스턴스가 있으면)
document.addEventListener('DOMContentLoaded', function() {
    // 모든 에디터 컨테이너 찾기
    const containers = document.querySelectorAll('.t2-editor-container');
    containers.forEach(container => {
        // 에디터 인스턴스 찾기
        const editorId = container.id.replace('_container', '');
        const editorInstance = window[editorId + '_editor'];
        
        if (editorInstance) {
            console.log('Registering collab plugin for editor:', editorId);
            const collabPlugin = new T2CollabPlugin(editorInstance);
            editorInstance.registerPlugin('collab', collabPlugin);
        }
    });
});

})();