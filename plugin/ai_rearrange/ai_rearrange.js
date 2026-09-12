// Path: T2Editor/plugin/ai_rearrange/ai_rearrange.js
class T2Ai_rearrangePlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['rearrangeContent'];
        this.modal = null;
        this.isProcessing = false;
        this.pendingCommands = null;
        this.pendingIndexed = null;
        this.currentInstruction = null;
        
        this.apiUrl = 'https://dsclub.kr/api/ai/t2editor/groq/interaction_content/';
        this.limitsUrl = 'https://dsclub.kr/api/ai/t2editor/groq/interaction/limits.json';
        this.modelListUrl = 'https://dsclub.kr/api/ai/t2editor/groq/interaction/model_list.json';
        this.sharedSecret = 'dsclubT2Editor2025';
        this.rateLimitSecret = 'RateLimitSecret2025!@#';
        
        // Rate limit 상태 추가
        this.rateLimit = {
            ip: { remaining: null, limit: null },
            domain: { remaining: null, limit: null }
        };
        
        this.maxInputChars = null;
        this.aiModels = [];
        this.fallbackModels = ['Groq AI 모델 자동 선택'];
        
        this.limitsLoaded = false;
        this.rateLimitsLoaded = false;
        this.limitsLoadPromise = this.loadLimits();
        this.loadModelList();
        
        console.log('T2Ai_rearrangePlugin initialized');
    }

    async loadLimits() {
        try {
            const response = await fetch(this.limitsUrl, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.max_input_chars) {
                this.maxInputChars = data.max_input_chars;
            } else {
                this.maxInputChars = 10000; // 기본값
            }
            
            if (data.ip_limit && data.domain_limit) {
                this.rateLimit.ip.limit = data.ip_limit;
                this.rateLimit.domain.limit = data.domain_limit;
            }
            
            this.limitsLoaded = true;
            
            console.log('Rearrangement limits loaded:', {
                maxInputChars: this.maxInputChars,
                rateLimit: this.rateLimit
            });
        } catch (error) {
            console.error('Failed to load rearrangement limits:', error);
            this.maxInputChars = 10000; // 기본값
            this.limitsLoaded = false;
        }
    }

    async loadModelList() {
        try {
            const response = await fetch(this.modelListUrl, {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                    this.aiModels = data.models;
                    console.log('AI models loaded:', this.aiModels.length);
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to load model list:', error);
        }
        
        this.aiModels = this.fallbackModels;
        console.log('Using fallback AI models');
    }

    async loadRateLimits() {
        const licenseToken = window.T2EDITOR_LICENSE_TOKEN;
        if (!licenseToken) {
            console.warn('License token not available for rate limit load');
            this.rateLimit.ip.remaining = this.rateLimit.ip.limit;
            this.rateLimit.domain.remaining = this.rateLimit.domain.limit;
            this.rateLimitsLoaded = true;
            return;
        }

        try {
            const domainSig = await this.generateDomainSignature();
            const timestamp = Math.floor(Date.now() / 1000);
            const verifyHash = await this.generateVerifyHash(licenseToken, timestamp);
            
            const headers = {
                'Content-Type': 'application/json',
                'X-Domain-Timestamp': domainSig.timestamp,
                'X-Domain-Nonce': domainSig.nonce,
                'X-Domain-Signature': domainSig.signature,
                'X-T2Editor-License': licenseToken,
                'X-T2Editor-Timestamp': timestamp.toString(),
                'X-T2Editor-Verify': verifyHash
            };

            if (this.sharedSecret) {
                const signature = await this.generateSignature('');
                headers['X-DSCLUB-SIGN'] = signature;
            }

            const response = await fetch(this.apiUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data._rate_limit) {
                this.rateLimit.ip.remaining = data._rate_limit.ip.remaining ?? this.rateLimit.ip.limit;
                this.rateLimit.domain.remaining = data._rate_limit.domain.remaining ?? this.rateLimit.domain.limit;
                this.rateLimitsLoaded = true;
                console.log('Rate limits loaded:', this.rateLimit);
            } else {
                // Fallback to full if no data
                this.rateLimit.ip.remaining = this.rateLimit.ip.limit;
                this.rateLimit.domain.remaining = this.rateLimit.domain.limit;
                this.rateLimitsLoaded = true;
            }
        } catch (error) {
            console.error('Failed to load rate limits:', error);
            // Fallback to full remaining (used = 0)
            this.rateLimit.ip.remaining = this.rateLimit.ip.limit;
            this.rateLimit.domain.remaining = this.rateLimit.domain.limit;
            this.rateLimitsLoaded = true;
        }
    }

    handleCommand(command, button) {
        if (command === 'rearrangeContent') {
            this.openRearrangeModal();
        }
    }

    async openRearrangeModal() {
        if (!this.limitsLoaded) {
            try {
                await this.limitsLoadPromise;
            } catch (error) {
                console.error('Limits loading failed:', error);
            }
        }

        if (!this.rateLimitsLoaded) {
            await this.loadRateLimits();
        }

        if (this.modal) {
            this.modal.remove();
        }

        const overlay = document.createElement('div');
        overlay.className = 't2-rearrange-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        const modal = document.createElement('div');
        modal.className = 't2-rearrange-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            width: 95%;
            max-width: 900px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="material-icons" style="color: #667eea;">auto_fix_high</span>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">AI 콘텐츠 재배치</h3>
            </div>
            <button class="t2-rearrange-close" style="
                background: none;
                border: none;
                cursor: pointer;
                padding: 5px;
                display: flex;
                align-items: center;
                color: #6b7280;
            ">
                <span class="material-icons">close</span>
            </button>
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: white;
        `;

        const currentContent = this.analyzeContent();
        
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">
                    현재 콘텐츠 구조
                </label>
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; max-height: 150px; overflow-y: auto; font-family: monospace; font-size: 12px; color: #6b7280;">
                    ${currentContent.summary}
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">
                    AI에게 요청할 작업
                </label>
                <textarea 
                    class="t2-rearrange-instruction" 
                    placeholder="예: 이미지를 제일 위로 옮기고, 중요한 내용을 강조해주세요"
                    maxlength="${this.maxInputChars || 10000}"
                    style="
                        width: 100%;
                        min-height: 100px;
                        padding: 12px;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 14px;
                        resize: vertical;
                        font-family: inherit;
                        box-sizing: border-box;
                        outline: none;
                    "
                ></textarea>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <div class="t2-ai-char-count" style="font-size: 12px; color: #9ca3af;">
                        0/${this.maxInputChars || 10000}자
                    </div>
                    ${this.getRateLimitBadgeHTML()}
                </div>
                <div style="margin-top: 8px;">
                    <button class="t2-rearrange-powered" style="
                        padding: 6px 12px;
                        background: none;
                        color: #6b7280;
                        border: 1px solid #e5e7eb;
                        border-radius: 9px;
                        font-size: 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='none'">
                        <span class="material-icons" style="font-size: 16px;">auto_awesome</span>
                        Powered by AI
                    </button>
                </div>
            </div>

            <div class="t2-rearrange-result" style="display: none;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">
                    AI 처리 결과 미리보기
                </label>
                <div class="t2-rearrange-comparison" style="
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                ">
                    <div class="t2-rearrange-original" style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">원본 구조</div>
                        <div style="
                            background: #f9fafb;
                            border: 1px solid #e5e7eb;
                            border-radius: 8px;
                            padding: 12px;
                            max-height: 200px;
                            overflow-x: auto;
                            overflow-y: auto;
                            font-family: monospace;
                            font-size: 11px;
                            color: #6b7280;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        ">${currentContent.summary}</div>
                    </div>
                    <div class="t2-rearrange-preview-container" style="flex: 1; min-width: 0;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">수정된 구조</div>
                        <div class="t2-rearrange-preview" style="
                            background: #f0f9ff;
                            border: 1px solid #bae6fd;
                            border-radius: 8px;
                            padding: 12px;
                            max-height: 200px;
                            overflow-x: auto;
                            overflow-y: auto;
                            font-family: monospace;
                            font-size: 11px;
                            color: #0369a1;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        "></div>
                    </div>
                </div>
                <div class="t2-rearrange-commands" style="
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                ">
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">적용될 명령어</div>
                    <div class="t2-rearrange-commands-list" style="
                        font-size: 11px;
                        color: #374151;
                        line-height: 1.4;
                    "></div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 15px 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: white;
        `;
        footer.innerHTML = `
            <button class="t2-rearrange-cancel" style="
                padding: 8px 20px;
                background: #f3f4f6;
                color: #374151;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
            ">
                취소
            </button>
            <button class="t2-rearrange-execute" style="
                padding: 8px 20px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <span class="material-icons" style="font-size: 18px;">auto_fix_high</span>
                AI 실행
            </button>
            <button class="t2-rearrange-regenerate" style="
                padding: 8px 20px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: none;
                align-items: center;
                gap: 8px;
            ">
                <span class="material-icons" style="font-size: 18px;">refresh</span>
                재작성
            </button>
            <button class="t2-rearrange-apply" style="
                padding: 8px 20px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: none;
                align-items: center;
                gap: 8px;
            ">
                <span class="material-icons" style="font-size: 18px;">check</span>
                적용하기
            </button>
        `;

        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        this.modal = overlay;

        // 모바일 레이아웃 처리
        this.setupMobileLayout();

        // 이벤트 리스너
        const closeBtn = header.querySelector('.t2-rearrange-close');
        const cancelBtn = footer.querySelector('.t2-rearrange-cancel');
        const executeBtn = footer.querySelector('.t2-rearrange-execute');
        const regenerateBtn = footer.querySelector('.t2-rearrange-regenerate');
        const applyBtn = footer.querySelector('.t2-rearrange-apply');
        const instructionArea = content.querySelector('.t2-rearrange-instruction');
        const poweredBtn = content.querySelector('.t2-rearrange-powered');
        const charCount = content.querySelector('.t2-ai-char-count');

        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        executeBtn.addEventListener('click', () => {
            const instruction = instructionArea.value.trim();
            if (instruction) {
                this.currentInstruction = instruction;
                this.executeRearrange(instruction, currentContent.indexed);
            }
        });

        regenerateBtn.addEventListener('click', () => {
            if (this.currentInstruction) {
                this.executeRearrange(this.currentInstruction, this.pendingIndexed);
            }
        });

        applyBtn.addEventListener('click', () => {
            this.applyPendingCommands();
        });

        poweredBtn.addEventListener('click', () => {
            this.showAiInfoPopup();
        });

        // 입력 길이 제한 표시
        instructionArea.addEventListener('input', () => {
            const length = instructionArea.value.length;
            charCount.textContent = `${length}/${this.maxInputChars || 10000}자`;
            
            if (length >= this.maxInputChars) {
                charCount.style.color = '#ef4444';
            } else if (length >= this.maxInputChars * 0.9) {
                charCount.style.color = '#f59e0b';
            } else {
                charCount.style.color = '#9ca3af';
            }
        });

        instructionArea.focus();
    }

    setupMobileLayout() {
        const checkMobile = () => {
            const comparison = this.modal?.querySelector('.t2-rearrange-comparison');
            if (!comparison) return;

            if (window.innerWidth <= 768) {
                comparison.style.flexDirection = 'column';
                comparison.style.gap = '12px';
            } else {
                comparison.style.flexDirection = 'row';
                comparison.style.gap = '16px';
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
    }

    // ai.js의 rate limit 뱃지 표시 기능 개선
    getRateLimitBadgeHTML() {
        const ipRemaining = this.rateLimit.ip.remaining ?? this.rateLimit.ip.limit ?? '?';
        const domainRemaining = this.rateLimit.domain.remaining ?? this.rateLimit.domain.limit ?? '?';
        const ipLimit = this.rateLimit.ip.limit ?? '?';
        const domainLimit = this.rateLimit.domain.limit ?? '?';
        
        // ai.js 스타일대로 색상 설정 (적을수록 빨간색)
        const ipColor = ipRemaining <= 3 ? '#ef4444' : ipRemaining <= 10 ? '#f59e0b' : '#6b7280';
        const ipBgColor = ipRemaining <= 3 ? '#fef2f2' : ipRemaining <= 10 ? '#fffbeb' : '#f9fafb';
        const ipBorderColor = ipRemaining <= 3 ? '#fecaca' : ipRemaining <= 10 ? '#fcd34d' : '#e5e7eb';
        
        const domainColor = domainRemaining <= 10 ? '#ef4444' : domainRemaining <= 30 ? '#f59e0b' : '#6b7280';
        const domainBgColor = domainRemaining <= 10 ? '#fef2f2' : domainRemaining <= 30 ? '#fffbeb' : '#f9fafb';
        const domainBorderColor = domainRemaining <= 10 ? '#fecaca' : domainRemaining <= 30 ? '#fcd34d' : '#e5e7eb';
        
        return `
            <div class="t2-rate-limit-container" style="display: flex; gap: 6px; flex-wrap: wrap;">
                <div class="rate-limit-badge" style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    background: ${ipBgColor};
                    border: 1px solid ${ipBorderColor};
                    border-radius: 6px;
                    font-size: 11px;
                    color: ${ipColor};
                    font-weight: 500;
                ">
                    <span class="material-icons" style="font-size: 14px;">${ipRemaining <= 3 ? 'warning' : 'person'}</span>
                    <span>내 요청: ${ipRemaining}/${ipLimit}</span>
                </div>
                <div class="rate-limit-badge" style="
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    background: ${domainBgColor};
                    border: 1px solid ${domainBorderColor};
                    border-radius: 6px;
                    font-size: 11px;
                    color: ${domainColor};
                    font-weight: 500;
                ">
                    <span class="material-icons" style="font-size: 14px;">${domainRemaining <= 10 ? 'warning' : 'public'}</span>
                    <span>서버 요청: ${domainRemaining}/${domainLimit}</span>
                </div>
            </div>
        `;
    }

    // Rate limit 표시 업데이트
    updateRateLimitDisplay() {
        if (!this.modal) return;
        const container = this.modal.querySelector('.t2-rate-limit-container');
        if (!container) return;
        container.outerHTML = this.getRateLimitBadgeHTML();
    }

    // 상세 정보 팝업 수정 (모델 리스트 포함)
    showAiInfoPopup() {
        const existingPopup = document.querySelector('.t2-ai-info-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const popup = document.createElement('div');
        popup.className = 't2-ai-info-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            padding: 24px;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10002;
            animation: slideIn 0.3s ease-out;
        `;

        const modelList = this.aiModels.map(model => `<li style="margin: 4px 0; font-size: 13px; color: #6b7280;">${model}</li>`).join('');

        popup.innerHTML = `
            <style>
                @keyframes slideIn {
                    from {
                        transform: translate(-50%, -60%);
                        opacity: 0;
                    }
                    to {
                        transform: translate(-50%, -50%);
                        opacity: 1;
                    }
                }
            </style>
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="material-icons" style="color: #667eea; font-size: 28px;">auto_awesome</span>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">AI 콘텐츠 재배치 정보</h3>
                </div>
                <button class="t2-ai-info-close" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 5px;
                    display: flex;
                    align-items: center;
                    color: #6b7280;
                ">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div style="color: #374151; line-height: 1.6;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">
                    AI 콘텐츠 재배치는 기존 콘텐츠의 구조를 분석하여 사용자의 지시에 따라 자동으로 재배치, 편집, 서식 적용을 수행합니다.
                </p>
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111827;">
                        <span class="material-icons" style="font-size: 18px; vertical-align: middle; color: #667eea;">auto_mode</span>
                        동작 방식
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6b7280;">
                        <li>텍스트, 이미지, 코드, 테이블, 파일 블록을 인식하고 번호를 매깁니다</li>
                        <li>사용자의 지시를 분석하여 최적의 재배치 명령어를 생성합니다</li>
                        <li>이동, 수정, 서식 적용, 삽입, 삭제 등 다양한 작업을 지원합니다</li>
                        <li>특수 양식(코드, 이미지, 테이블 등)을 자동으로 변환하고 최적화합니다</li>
                        <li>변경사항을 미리보기로 확인한 후 선택적으로 적용합니다</li>
                    </ul>
                </div>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111827;">
                        <span class="material-icons" style="font-size: 18px; vertical-align: middle; color: #3b82f6;">model_training</span>
                        사용 가능한 AI 모델
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">
                        ${modelList}
                    </ul>
                </div>
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-bottom: 12px; opacity: 0.7;">
                    <h4 style="margin: 0 0 6px 0; font-size: 12px; font-weight: 500; color: #6b7280;">
                        <span class="material-icons" style="font-size: 14px; vertical-align: middle;">info</span>
                        요청 제한
                    </h4>
                    <p style="margin: 0; font-size: 11px; color: #6b7280; line-height: 1.5;">
                        IP당 하루 최대 ${this.rateLimit.ip.limit}회 · 도메인당 하루 최대 ${this.rateLimit.domain.limit}회 · 매일 자정(KST) 초기화
                    </p>
                </div>
                <div style="font-size: 10px; color: #9ca3af; line-height: 1.3; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    본 AI 서비스는 Groq의 AI API를 이용하며, DSc(dsclub.kr)가 재가공하여 제공합니다.
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        const closeBtn = popup.querySelector('.t2-ai-info-close');
        let autoCloseTimer = null;

        const closePopup = () => {
            if (autoCloseTimer) clearTimeout(autoCloseTimer);
            popup.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => popup.remove(), 300);
        };

        closeBtn.addEventListener('click', closePopup);

        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10001;`;
        document.body.insertBefore(overlay, popup);
        overlay.addEventListener('click', () => {
            overlay.remove();
            closePopup();
        });

        autoCloseTimer = setTimeout(() => {
            overlay.remove();
            closePopup();
        }, 10000);
    }

    // 개선된 콘텐츠 분석 (문장 단위 세분화)
    analyzeContent() {
        const indexed = {
            text: [],
            images: [],
            videos: [],
            codes: [],
            tables: [],
            files: []
        };

        let summary = '';
        let textIndex = 1;

        Array.from(this.editor.editor.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList?.contains('t2-media-block')) {
                    const img = node.querySelector('img');
                    const video = node.querySelector('video');
                    
                    if (img && !node.classList.contains('t2-drawing-block')) {
                        indexed.images.push({ element: node, id: `IMG:${indexed.images.length + 1}` });
                        summary += `[IMG:${indexed.images.length}] 이미지\n`;
                    } else if (video) {
                        indexed.videos.push({ element: node, id: `VIDEO:${indexed.videos.length + 1}` });
                        summary += `[VIDEO:${indexed.videos.length}] 비디오\n`;
                    }
                } else if (node.classList?.contains('t2-code-block')) {
                    indexed.codes.push({ element: node, id: `CODE:${indexed.codes.length + 1}` });
                    summary += `[CODE:${indexed.codes.length}] 코드블록\n`;
                } else if (node.classList?.contains('t2-table-wrapper')) {
                    indexed.tables.push({ element: node, id: `TABLE:${indexed.tables.length + 1}` });
                    summary += `[TABLE:${indexed.tables.length}] 테이블\n`;
                } else if (node.classList?.contains('t2-file-block')) {
                    indexed.files.push({ element: node, id: `FILE:${indexed.files.length + 1}` });
                    summary += `[FILE:${indexed.files.length}] 파일\n`;
                } else if (node.tagName === 'P' || node.tagName === 'DIV') {
                    const text = node.textContent.trim();
                    if (text && text !== '') {
                        // 문장 단위로 세분화 (쉼표, 마침표 기준)
                        const sentences = this.splitIntoSentences(text);
                        sentences.forEach(sentence => {
                            if (sentence.trim()) {
                                indexed.text.push({ element: node, id: `T:${textIndex}`, content: sentence });
                                summary += `[T:${textIndex}] ${sentence.substring(0, 50)}${sentence.length > 50 ? '...' : ''}\n`;
                                textIndex++;
                            }
                        });
                    }
                }
            }
        });

        return { indexed, summary: summary || '(빈 콘텐츠)' };
    }

    // 문장 분리 헬퍼 함수
    splitIntoSentences(text) {
        const protectedPatterns = [
            /\[code[\s\S]*?\[\/code\]/gi,
            /\[img[\s\S]*?\[\/img\]/gi,
            /\[table[\s\S]*?\[\/table\]/gi,
            /\[link:[^\]]+\][\s\S]*?\[\/link\]/gi
        ];
        
        let protectedText = text;
        const protectedBlocks = [];
        
        protectedPatterns.forEach((pattern, i) => {
            protectedText = protectedText.replace(pattern, (match) => {
                const key = `___PROTECTED${i}_${protectedBlocks.length}___`;
                protectedBlocks.push({ key, value: match });
                return key;
            });
        });

        // 문장 분리
        let sentences = protectedText.split(/(?<=[.!?])\s+/);
        
        // 보호된 블록 복원
        sentences = sentences.map(sentence => {
            protectedBlocks.forEach(block => {
                sentence = sentence.replace(block.key, block.value);
            });
            return sentence.trim();
        }).filter(sentence => sentence.length > 0);

        return sentences.length > 0 ? sentences : [text];
    }

    buildIndexedContent(indexed) {
        let content = '';
        
        const allElements = [
            ...indexed.text,
            ...indexed.images,
            ...indexed.videos,
            ...indexed.codes,
            ...indexed.tables,
            ...indexed.files
        ].sort((a, b) => {
            const aPos = Array.from(this.editor.editor.childNodes).indexOf(a.element);
            const bPos = Array.from(this.editor.editor.childNodes).indexOf(b.element);
            return aPos - bPos;
        });

        allElements.forEach(item => {
            if (item.content) {
                content += `${item.id}: ${item.content}\n`;
            } else {
                content += `${item.id}\n`;
            }
        });

        return content;
    }

    async executeRearrange(instruction, indexed) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const resultArea = this.modal.querySelector('.t2-rearrange-result');
        const previewArea = this.modal.querySelector('.t2-rearrange-preview');
        const commandsList = this.modal.querySelector('.t2-rearrange-commands-list');
        const executeBtn = this.modal.querySelector('.t2-rearrange-execute');
        const regenerateBtn = this.modal.querySelector('.t2-rearrange-regenerate');
        const applyBtn = this.modal.querySelector('.t2-rearrange-apply');

        resultArea.style.display = 'block';
        executeBtn.disabled = true;
        executeBtn.style.opacity = '0.6';
        executeBtn.style.cursor = 'not-allowed';
        regenerateBtn.style.display = 'none';
        applyBtn.style.display = 'none';

        previewArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 40px 0;">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #e5e7eb;
                    border-top-color: #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
                <p style="color: #6b7280; margin: 0;">AI가 콘텐츠를 분석하고 있습니다...</p>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        try {
            const licenseToken = window.T2EDITOR_LICENSE_TOKEN;
            if (!licenseToken) {
                throw new Error('라이센스 토큰이 없습니다');
            }

            const domainSig = await this.generateDomainSignature();
            const timestamp = Math.floor(Date.now() / 1000);
            const verifyHash = await this.generateVerifyHash(licenseToken, timestamp);

            const contentStr = this.buildIndexedContent(indexed);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Domain-Timestamp': domainSig.timestamp,
                    'X-Domain-Nonce': domainSig.nonce,
                    'X-Domain-Signature': domainSig.signature,
                    'X-T2Editor-License': licenseToken,
                    'X-T2Editor-Timestamp': timestamp.toString(),
                    'X-T2Editor-Verify': verifyHash
                },
                body: JSON.stringify({
                    content: contentStr,
                    instruction: instruction
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            if (!data.commands || !Array.isArray(data.commands)) {
                throw new Error('잘못된 응답 형식');
            }

            // Rate limit 정보 업데이트
            if (data._rate_limit) {
                this.rateLimit.ip.remaining = data._rate_limit.ip.remaining;
                this.rateLimit.domain.remaining = data._rate_limit.domain.remaining;
                this.updateRateLimitDisplay();
            }

            // 명령어 저장
            this.pendingCommands = data.commands;
            this.pendingIndexed = indexed;

            // 미리보기 생성
            const previewSummary = await this.generatePreviewSummary(indexed, data.commands);
            previewArea.textContent = previewSummary;

            // 명령어 목록 표시
            commandsList.innerHTML = data.commands.map(cmd => 
                `<div style="margin-bottom: 4px;">${this.getCommandDescription(cmd)}</div>`
            ).join('');

            // 재작성 및 적용하기 버튼 표시
            regenerateBtn.style.display = 'flex';
            applyBtn.style.display = 'flex';
            executeBtn.style.display = 'none';

        } catch (error) {
            console.error('재배치 오류:', error);
            previewArea.innerHTML = `
                <div style="padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <span class="material-icons">error_outline</span>
                        <strong>오류 발생</strong>
                    </div>
                    <p style="margin: 0;">${error.message}</p>
                </div>
            `;
        } finally {
            this.isProcessing = false;
            executeBtn.disabled = false;
            executeBtn.style.opacity = '1';
            executeBtn.style.cursor = 'pointer';
        }
    }

    async generatePreviewSummary(indexed, commands) {
        // 명령어를 기반으로 수정된 구조 생성
        let summary = '';
        let textIndex = 1;

        // 원본 구조를 기반으로 명령어 적용 시뮬레이션
        const allElements = [
            ...indexed.text,
            ...indexed.images,
            ...indexed.videos,
            ...indexed.codes,
            ...indexed.tables,
            ...indexed.files
        ];

        // 간단한 시뮬레이션 - 실제 적용은 applyPendingCommands에서
        allElements.forEach(item => {
            if (item.content) {
                summary += `[${item.id}] ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''}\n`;
                textIndex++;
            } else {
                summary += `[${item.id}]\n`;
            }
        });

        // 명령어에 따른 변경사항 추가 표시
        if (commands.length > 0) {
            summary += `\n// ${commands.length}개의 변경사항이 적용됩니다:\n`;
            commands.forEach(cmd => {
                summary += `// ${this.getCommandDescription(cmd).replace('• ', '')}\n`;
            });
        }

        return summary || '(변경사항 없음)';
    }

    async applyPendingCommands() {
        if (!this.pendingCommands || !this.pendingIndexed) {
            return;
        }

        try {
            await this.applyCommands(this.pendingCommands, this.pendingIndexed);
            
            // 성공 시 모달 닫기
            this.closeModal();
            
        } catch (error) {
            console.error('명령어 적용 오류:', error);
            alert('명령어 적용 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async applyCommands(commands, indexed) {
        const allIndexed = {
            ...indexed.text.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
            ...indexed.images.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
            ...indexed.videos.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
            ...indexed.codes.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
            ...indexed.tables.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
            ...indexed.files.reduce((acc, item) => ({ ...acc, [item.id]: item }), {})
        };

        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            await this.executeCommand(cmd, allIndexed);
        }

        this.editor.normalizeContent();
        this.editor.createUndoPoint();
        this.editor.autoSave();
    }

    async executeCommand(cmd, indexed) {
        try {
            switch (cmd.cmd) {
                case 'move':
                    const fromItem = indexed[cmd.from];
                    if (fromItem && fromItem.element) {
                        const targetPos = parseInt(cmd.to) - 1;
                        const children = Array.from(this.editor.editor.childNodes);
                        const targetNode = children[targetPos];
                        
                        if (targetNode) {
                            this.editor.editor.insertBefore(fromItem.element, targetNode);
                        } else {
                            this.editor.editor.appendChild(fromItem.element);
                        }
                    }
                    break;

                case 'edit':
                    const editItem = indexed[cmd.target];
                    if (editItem && editItem.element && cmd.text) {
                        // 특수 양식 파싱 추가
                        const formattedHTML = this.parseTextFormatting(cmd.text);
                        editItem.element.innerHTML = formattedHTML;
                    }
                    break;

                case 'format':
                    const formatItem = indexed[cmd.target];
                    if (formatItem && formatItem.element && cmd.style) {
                        this.applyFormat(formatItem.element, cmd.style);
                    }
                    break;

                case 'delete':
                    const deleteItem = indexed[cmd.target];
                    if (deleteItem && deleteItem.element) {
                        deleteItem.element.remove();
                    }
                    break;

                case 'insert':
                    await this.insertElement(cmd, indexed);
                    break;
            }
        } catch (error) {
            console.error('명령 실행 오류:', error, cmd);
        }
    }

    // ai.js의 특수 양식 파싱 기능 추가
    parseTextFormatting(text) {
        const formatTags = [
            { tag: 'bold', open: '[bold]', close: '[/bold]', style: 'font-weight: bold;' },
            { tag: 'italic', open: '[italic]', close: '[/italic]', style: 'font-style: italic;' },
            { tag: 'underlined', open: '[underlined]', close: '[/underlined]', style: 'text-decoration: underline;' },
            { tag: 'strikethrough', open: '[strikethrough]', close: '[/strikethrough]', style: 'text-decoration: line-through;' }
        ];
        
        let result = text;
        
        result = result.replace(/\[tcolor:(#[0-9A-Fa-f]{6})\](.*?)\[\/tcolor\]/g, (match, color, content) => {
            const innerContent = this.parseTextFormatting(content);
            return `<span style="color: ${color};">${innerContent}</span>`;
        });
        
        formatTags.forEach(({ tag, open, close, style }) => {
            const regex = new RegExp(open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(.*?)' + close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            result = result.replace(regex, (match, content) => {
                const innerContent = this.parseTextFormatting(content);
                return `<span style="${style}">${innerContent}</span>`;
            });
        });
        
        result = result.replace(/\[link:(.*?)\](.*?)\[\/link\]/g, (match, text, url) => {
            const linkText = this.parseTextFormatting(text);
            return `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none; font-weight: 500;">${linkText}</a>`;
        });
        
        return result;
    }

    applyFormat(element, style) {
        if (style.includes('bold')) {
            element.style.fontWeight = 'bold';
        }
        if (style.includes('italic')) {
            element.style.fontStyle = 'italic';
        }
        if (style.includes('underline')) {
            element.style.textDecoration = 'underline';
        }
        if (style.includes('strike')) {
            element.style.textDecoration = 'line-through';
        }
        if (style.includes('color:')) {
            const color = style.match(/color:(#[0-9A-Fa-f]{6})/);
            if (color) {
                element.style.color = color[1];
            }
        }
    }

    async insertElement(cmd, indexed) {
        const afterItem = indexed[cmd.after];
        let newElement;

        switch (cmd.type) {
            case 'image':
                const imagePlugin = this.editor.getPlugin('image');
                if (imagePlugin && cmd.content && cmd.content.url) {
                    newElement = imagePlugin.createImageBlock({
                        url: cmd.content.url,
                        width: 320,
                        height: 180,
                        blockId: imagePlugin.generateBlockId()
                    });
                }
                break;

            case 'code':
                const codePlugin = this.editor.getPlugin('code');
                if (codePlugin && cmd.content) {
                    newElement = codePlugin.createCodeBlock();
                    const codeElement = newElement.querySelector('code');
                    if (codeElement && cmd.content.code) {
                        codeElement.textContent = cmd.content.code;
                        codeElement.classList.remove('code-placeholder');
                    }
                }
                break;
        }

        if (newElement && afterItem && afterItem.element) {
            afterItem.element.parentNode.insertBefore(newElement, afterItem.element.nextSibling);
        } else if (newElement) {
            this.editor.editor.appendChild(newElement);
        }
    }

    getCommandDescription(cmd) {
        switch (cmd.cmd) {
            case 'move': return `• ${cmd.from}을(를) ${cmd.to}번째 줄로 이동`;
            case 'edit': return `• ${cmd.target} 내용 수정`;
            case 'format': return `• ${cmd.target}에 ${cmd.style} 적용`;
            case 'insert': return `• ${cmd.type} 추가 (${cmd.after} 뒤)`;
            case 'delete': return `• ${cmd.target} 삭제`;
            default: return '• 알 수 없는 작업';
        }
    }

    async generateDomainSignature() {
        const domain = window.location.hostname;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.random().toString(36).substring(2, 15);
        const data = `${domain}|${timestamp}|${nonce}`;
        const signature = await this.hmacSha256(data, this.rateLimitSecret);
        return { domain, timestamp, nonce, signature };
    }

    async hmacSha256(message, secret) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(message);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, messageData);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    async generateVerifyHash(licenseToken, timestamp) {
        const data = `${licenseToken}|${timestamp}|${this.rateLimitSecret}`;
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    async generateSignature(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const key = encoder.encode(this.sharedSecret);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    closeModal() {
        this.pendingCommands = null;
        this.pendingIndexed = null;
        this.currentInstruction = null;
        
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    // 유틸리티 함수들
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.T2Ai_rearrangePlugin = T2Ai_rearrangePlugin;