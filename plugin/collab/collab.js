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
        if (!code || !host_token) {
            console.error('Missing code or host_token for beacon');
            return false;
        }
        
        const url = t2url + '/plugin/collab/collab_number_delete.php';
        const payload = JSON.stringify({ 
            code: code, 
            host_token: host_token,
            timestamp: Date.now() // 중복 요청 방지를 위한 타임스탬프
        });
        
        console.log('Sending delete beacon for room:', code);
        
        // 1. sendBeacon 시도
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const ok = navigator.sendBeacon(url, blob);
            console.log('sendBeacon result:', ok);
            
            if (ok) return true;
        }
        
        // 2. fetch with keepalive 시도
        if (typeof fetch === 'function') {
            console.log('Trying fetch with keepalive');
            fetch(url, {
                method: 'POST',
                body: payload,
                headers: {'Content-Type': 'application/json'},
                keepalive: true, // 페이지 종료 후에도 요청 유지
                mode: 'no-cors' // CORS 문제 회피
            }).catch(e => console.error('Fetch keepalive error:', e));
            return true;
        }
        
        // 3. 동기 XMLHttpRequest 시도 (최후의 수단)
        try {
            console.log('Trying sync XHR');
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, false); // 동기 요청
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(payload);
            return true;
        } catch(e) {
            console.error('Sync XHR error:', e);
            return false;
        }
    } catch(e) {
        console.error('sendHostDeleteBeacon error:', e);
        return false;
    }
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
        const resp = await postAction(this.t2url, 'join', {
            code,
            client_id: this.client_id,
            nickname
        });
        if (resp && resp.success) {
            this.collabCode = code;
            this.nickname = nickname;
            this.hostToken = resp.is_host ? resp.host_token : null;
            this.isHost = !!resp.is_host;
            this._saveRoomState();
            if (this.isHost) this._installHostUnloadHandler();
            return resp.data;
        }
        return null;
    }
    
    async leaveRoom(){
        if (!this.collabCode) return true;
        const resp = await postAction(this.t2url, 'leave', {
            code: this.collabCode,
            client_id: this.client_id
        });
        if (resp && resp.success) {
            this._stopPolling();
            this._uninstallHostUnloadHandler();
            this._clearRoomState();
            this.collabCode = null;
            this.nickname = null;
            this.hostToken = null;
            this.isHost = false;
            this.localLastContent = '';
            this.knownServerVersion = 0;
            this._lastSentContent = '';
            this._conflictCount = 0;
            return true;
        }
        return false;
    }
    
    async stopRoom(){
        if (!this.isHost || !this.hostToken) return false;
        const resp = await postAction(this.t2url, 'stop', {
            code: this.collabCode,
            host_token: this.hostToken
        });
        if (resp && resp.success) {
            this._stopPolling();
            this._uninstallHostUnloadHandler();
            this._clearRoomState();
            this.collabCode = null;
            this.nickname = null;
            this.hostToken = null;
            this.isHost = false;
            this.localLastContent = '';
            this.knownServerVersion = 0;
            this._lastSentContent = '';
            this._conflictCount = 0;
            return true;
        }
        return false;
    }
    
    async kickUser(target_client_id){
        if (!this.isHost) return false;
        const resp = await postAction(this.t2url, 'kick', {
            code: this.collabCode,
            client_id: this.client_id,
            target_client_id
        });
        return resp && resp.success;
    }
    
    _installHostUnloadHandler(){
        if (this._unloadHandler) return;
        
        // beforeunload와 pagehide 이벤트 모두 등록
        this._unloadHandler = (event) => {
            // 기본 동작 차단 (브라우저 경고 메시지 표시)
            if (event.type === 'beforeunload') {
                event.preventDefault();
                event.returnValue = '';
            }
            
            // 방 삭제 요청 전송
            if (this.isHost && this.collabCode && this.hostToken) {
                console.log('Host leaving - sending delete request');
                sendHostDeleteBeacon(this.t2url, this.collabCode, this.hostToken);
            }
        };
        
        // 여러 이벤트에 등록하여 더 안정적으로 동작하도록
        window.addEventListener('beforeunload', this._unloadHandler);
        window.addEventListener('pagehide', this._unloadHandler);
        window.addEventListener('unload', this._unloadHandler);
    }
    
    _uninstallHostUnloadHandler(){
        if (this._unloadHandler) {
            window.removeEventListener('beforeunload', this._unloadHandler);
            window.removeEventListener('pagehide', this._unloadHandler);
            window.removeEventListener('unload', this._unloadHandler);
            this._unloadHandler = null;
        }
    }
    
    startPolling(){
        this._stopPolling();
        this._setupContentObserver();
        this._pollTimer = setInterval(() => this._pollServer(), this.pollInterval);
    }
    
    _stopPolling(){
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        this._removeContentObserver();
    }
    
    _setupContentObserver(){
        if (this._mutationObserver || this._inputHandler) return;
        
        this._inputHandler = () => this._debounceUpdate();
        this.editor.editor.addEventListener('input', this._inputHandler);
        
        this._mutationObserver = new MutationObserver(() => this._debounceUpdate());
        this._mutationObserver.observe(this.editor.editor, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    }
    
    _removeContentObserver(){
        if (this._inputHandler) {
            this.editor.editor.removeEventListener('input', this._inputHandler);
            this._inputHandler = null;
        }
        if (this._mutationObserver) {
            this._mutationObserver.disconnect();
            this._mutationObserver = null;
        }
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
    }
    
    _debounceUpdate(){
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        this._debounceTimer = setTimeout(() => {
            this._handleLocalChange();
            this._debounceTimer = null;
        }, this.debounceMs);
    }
    
    _handleLocalChange(){
        if (this._isUpdating) return;
        
        const currentContent = this.editor.editor.innerHTML;
        const diff = computeHTMLDiff(this.localLastContent, currentContent);
        
        if (diff) {
            this._pendingUpdate = diff;
            this._sendUpdate();
        }
    }
    
    async _sendUpdate(){
        if (!this._pendingUpdate || this._isUpdating) return;
        
        this._isUpdating = true;
        try {
            const resp = await postAction(this.t2url, 'update', {
                code: this.collabCode,
                client_id: this.client_id,
                version: this.knownServerVersion,
                diff: this._pendingUpdate
            });
            
            if (resp && resp.success) {
                this.knownServerVersion = resp.new_version || this.knownServerVersion + 1;
                this.localLastContent = this.editor.editor.innerHTML;
                this._lastSentContent = this.localLastContent;
                this._conflictCount = 0;
            } else if (resp && resp.conflict) {
                this._handleConflict(resp.current_content, resp.current_version);
            } else {
                console.error('Update failed');
                this._conflictCount++;
                if (this._conflictCount < this._maxConflictRetries) {
                    setTimeout(() => this._sendUpdate(), 500 * this._conflictCount);
                } else {
                    alert('업데이트 실패: 네트워크 확인');
                    this._conflictCount = 0;
                }
            }
        } catch(e) {
            console.error('Send update error:', e);
        } finally {
            this._isUpdating = false;
            this._pendingUpdate = null;
        }
    }
    
    _handleConflict(serverContent, serverVersion){
        this._conflictCount++;
        if (this._conflictCount >= this._maxConflictRetries) {
            alert('충돌 발생: 최신 버전으로 업데이트');
            this._setEditorContent(serverContent);
            this.localLastContent = serverContent;
            this._lastSentContent = serverContent;
            this.knownServerVersion = serverVersion;
            this._conflictCount = 0;
            return;
        }
        
        this.localLastContent = this.editor.editor.innerHTML;
        setTimeout(() => this._sendUpdate(), 500);
    }
    
    async _pollServer(){
        if (this._isUpdating) return;
        
        try {
            const resp = await postAction(this.t2url, 'get', {
                code: this.collabCode,
                client_id: this.client_id,
                version: this.knownServerVersion
            });
            
            if (resp && resp.success && resp.data) {
                const d = resp.data;
                if (d.version > this.knownServerVersion) {
                    const newContent = d.content || '';
                    if (newContent !== this._lastSentContent) {
                        this._isUpdating = true;
                        this._setEditorContent(newContent);
                        this.localLastContent = newContent;
                        this.knownServerVersion = d.version;
                        this._isUpdating = false;
                    }
                }
            }
        } catch(e) {
            console.error('Poll error:', e);
        }
    }
    
    _setEditorContent(html){
        this.editor.setContent(html);
    }
    
    _getEditorContent(){
        return this.editor.editor.innerHTML;
    }
    
    openModal(){
        console.log('openModal called');
        const overlay = document.createElement('div');
        overlay.className = 't2-modal-overlay';
        overlay.innerHTML = `
            <div class="t2-modal-box t2-collab-modal">
                <div class="t2-collab-header">
                    <h3>협업 편집</h3>
                    <button class="t2-collab-close-btn material-icons">close</button>
                </div>
                <div class="t2-tab-container">
                    <div class="t2-tabs">
                        <button class="t2-tab active" data-tab="create">방 만들기</button>
                        <button class="t2-tab" data-tab="join">참여하기</button>
                    </div>
                    <div class="t2-tab-content">
                        <div class="t2-tab-pane active" data-pane="create">
                            <div class="t2-collab-create-section">
                                <p>새 협업 방을 생성합니다.</p>
                                <button class="t2-collab-create-btn">방 생성</button>
                            </div>
                            <div class="t2-collab-host-nick-section" style="display:none;">
                                <p>닉네임을 입력하세요:</p>
                                <input type="text" class="t2-collab-host-nick" placeholder="닉네임 (선택사항)">
                                <button class="t2-collab-start-btn" disabled>시작</button>
                            </div>
                        </div>
                        <div class="t2-tab-pane" data-pane="join">
                            <p>참여할 방 코드를 입력하세요:</p>
                            <input type="text" class="t2-collab-join-code" placeholder="방 코드">
                            <p>닉네임을 입력하세요:</p>
                            <input type="text" class="t2-collab-join-nick" placeholder="닉네임 (선택사항)">
                            <button class="t2-collab-join-btn" disabled>참여</button>
                        </div>
                    </div>
                </div>
                <div class="t2-collab-info-section" style="display:none;">
                    <p>방 코드: <span class="t2-collab-display-code"></span> <button class="t2-collab-copy-btn material-icons">content_copy</button></p>
                    <p>내 닉네임: <span class="t2-collab-display-nick"></span></p>
                    <p>참여자 목록:</p>
                    <ul class="t2-collab-users"></ul>
                    <button class="t2-collab-stop-btn" style="display:none;">협업 중지 (방 삭제)</button>
                    <button class="t2-collab-leave-btn">나가기</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const box = overlay.querySelector('.t2-collab-modal');
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
        
        if (editorInstance && !editorInstance.getPlugin('collab')) {
            console.log('Registering collab plugin for editor:', editorId);
            const collabPlugin = new T2CollabPlugin(editorInstance);
            editorInstance.registerPlugin('collab', collabPlugin);
        }
    });
});

})();