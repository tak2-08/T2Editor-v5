// Path: T2Editor/plugin/ai/ai.js
class T2AiPlugin {
    constructor(editor) {
        this.editor = editor;
        this.commands = ['insertAI'];
        this.modal = null;
        this.currentResponse = null;
        this.currentPrompt = null;
        
        this.apiUrl = 'https://dsclub.kr/api/ai/t2editor/groq/text/';
        this.sharedSecret = 'dsclubT2Editor2025';
        this.maxChars = 350;
        
        this.aiModels = [
            'gpt-oss-120b',
            'gpt-oss-20b',
            'groq-compound',
            'groq-compound-mini',
            'llama-3.1-8b-instant',
            'llama-3.3-70b-versatile',
            'llama-guard-4-12b',
            'llama-4-maverick-17b-128e-instruct',
            'llama-4-scout-17b-16e-instruct',
            'llama-prompt-guard-2-22m',
            'llama-prompt-guard-2-86m',
            'kimi-k2-instruct-0905',
            'kimi-k2-instruct',
            'qwen3-32b',
            'deepseek-r1-distill-llama-70b',
            'gemma2-9b-it',
            'allam-2-7b',
            'deepseek-r1-distill-qwen-32b'
        ];
        
        console.log('T2AiPlugin initialized with commands:', this.commands);
    }

    handleCommand(command, button) {
        console.log('AI Plugin handling command:', command);
        if (command === 'insertAI') {
            this.openAiModal();
        }
    }

    openAiModal() {
        if (this.modal) {
            this.modal.remove();
        }

        const overlay = document.createElement('div');
        overlay.className = 't2-ai-modal-overlay';
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
        modal.className = 't2-ai-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
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
                <span class="material-icons" style="color: #3b82f6;">auto_awesome</span>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">AI 글쓰기</h3>
            </div>
            <button class="t2-ai-close" style="
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

        const inputArea = document.createElement('div');
        inputArea.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
        `;
        inputArea.innerHTML = `
            <div style="position: relative;">
                <textarea 
                    class="t2-ai-input" 
                    placeholder="어떤 내용을 작성하고 싶으신가요? (예: 제품 소개글 작성, 블로그 포스트 작성 등)"
                    maxlength="${this.maxChars}"
                    style="
                        width: 100%;
                        min-height: 80px;
                        padding: 12px 12px 30px 12px;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 14px;
                        resize: vertical;
                        font-family: inherit;
                        box-sizing: border-box;
                        outline: none;
                    "
                ></textarea>
                <div class="t2-ai-char-count" style="
                    position: absolute;
                    bottom: 8px;
                    right: 12px;
                    font-size: 12px;
                    color: #9ca3af;
                    pointer-events: none;
                ">0/${this.maxChars}자</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <button class="t2-ai-powered" style="
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
                    <div style="font-size: 10px; color: #9ca3af; padding: 0 4px; line-height: 1.3;">
                        본 서비스는 Groq의 AI API를 이용하며<br>DSc(dsclub.kr)가 재가공하여 중개 및 제공합니다<br>* 일부 콘텐츠는 법적·윤리적·DSc 자체 기준에 따라 입/출력 내용 제한 및 필터링함
                    </div>
                </div>
                <button class="t2-ai-generate" style="
                    padding: 10px 20px;
                    background: #3b82f6;
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
                    <span class="material-icons" style="font-size: 18px;">auto_awesome</span>
                    생성하기
                </button>
            </div>
        `;

        const resultArea = document.createElement('div');
        resultArea.className = 't2-ai-result-area';
        resultArea.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: none;
        `;

        const footer = document.createElement('div');
        footer.className = 't2-ai-footer';
        footer.style.cssText = `
            padding: 15px 20px;
            border-top: 1px solid #e5e7eb;
            display: none;
            justify-content: flex-end;
            align-items: center;
        `;
        footer.innerHTML = `
            <button class="t2-ai-insert" style="
                padding: 8px 20px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
            ">
                <span class="material-icons" style="font-size: 18px;">add</span>
                추가하기
            </button>
        `;

        modal.appendChild(header);
        modal.appendChild(inputArea);
        modal.appendChild(resultArea);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        this.modal = overlay;

        const closeBtn = header.querySelector('.t2-ai-close');
        const generateBtn = inputArea.querySelector('.t2-ai-generate');
        const insertBtn = footer.querySelector('.t2-ai-insert');
        const textarea = inputArea.querySelector('.t2-ai-input');
        const charCount = inputArea.querySelector('.t2-ai-char-count');
        const poweredBtn = inputArea.querySelector('.t2-ai-powered');

        // 글자 수 카운터 업데이트
        const updateCharCount = () => {
            const length = textarea.value.length;
            charCount.textContent = `${length}/${this.maxChars}자`;
            if (length >= this.maxChars) {
                charCount.style.color = '#ef4444';
            } else if (length >= this.maxChars * 0.9) {
                charCount.style.color = '#f59e0b';
            } else {
                charCount.style.color = '#9ca3af';
            }
        };

        textarea.addEventListener('input', updateCharCount);

        closeBtn.addEventListener('click', () => this.closeModal());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        generateBtn.addEventListener('click', () => {
            const prompt = textarea.value.trim();
            if (prompt) {
                this.generateContent(prompt, resultArea, footer);
            }
        });

        insertBtn.addEventListener('click', () => {
            if (this.currentResponse) {
                this.insertToEditor(this.currentResponse);
                this.closeModal();
            }
        });

        poweredBtn.addEventListener('click', () => {
            this.showAiInfoPopup();
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                generateBtn.click();
            }
        });

        textarea.focus();
    }

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

        const modelList = this.aiModels.map(model => `<li style="margin: 4px 0;">${model}</li>`).join('');

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
                    <span class="material-icons" style="color: #3b82f6; font-size: 28px;">auto_awesome</span>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">AI 모델 정보</h3>
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
                    T2Editor Ai 서비스는 다양한 AI 모델들 중 가장 적합한 모델을 이용하여 최적의 답변을 제공합니다.
                </p>
                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #111827;">
                        <span class="material-icons" style="font-size: 18px; vertical-align: middle; color: #3b82f6;">auto_mode</span>
                        사용 가능한 AI 모델
                    </h4>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6b7280; max-height: 200px; overflow-y: auto;">
                        ${modelList}
                    </ul>
                </div>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">
                    <span class="material-icons" style="font-size: 16px; vertical-align: middle; color: #10b981;">check_circle</span>
                    요청마다 가장 적합한 모델이 자동으로 선택되어 답변을 생성합니다.
                </p>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
                        본 AI 서비스는 Groq의 AI API를 이용하며, DSc(dsclub.kr)가 재가공하여 중개 및 제공합니다.
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        const closeBtn = popup.querySelector('.t2-ai-info-close');
        let autoCloseTimer = null;

        const closePopup = () => {
            if (autoCloseTimer) {
                clearTimeout(autoCloseTimer);
            }
            popup.style.animation = 'slideOut 0.3s ease-in';
            popup.style.setProperty('animation', 'slideOut 0.3s ease-in');
            setTimeout(() => {
                popup.remove();
            }, 300);
        };

        // 닫기 버튼 클릭
        closeBtn.addEventListener('click', closePopup);

        // 팝업 외부 클릭
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10001;
        `;
        document.body.insertBefore(overlay, popup);
        
        overlay.addEventListener('click', () => {
            overlay.remove();
            closePopup();
        });

        // 10초 후 자동 닫기
        autoCloseTimer = setTimeout(() => {
            overlay.remove();
            closePopup();
        }, 10000);

        // slideOut 애니메이션 추가
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideOut {
                from {
                    transform: translate(-50%, -50%);
                    opacity: 1;
                }
                to {
                    transform: translate(-50%, -60%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    async generateContent(prompt, resultArea, footer) {
        this.currentPrompt = prompt;
        
        resultArea.style.display = 'block';
        resultArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 40px 0;">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid #e5e7eb;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
                <p style="color: #6b7280; margin: 0;">AI가 콘텐츠를 생성하고 있습니다...</p>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        footer.style.display = 'none';

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.sharedSecret) {
                const signature = await this.generateSignature(prompt);
                headers['X-DSCLUB-SIGN'] = signature;
            }

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ text: prompt })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);
            
            // Groq API는 OpenAI 형식 사용
            let generatedText = '';
            if (data.choices && data.choices[0] && data.choices[0].message) {
                generatedText = data.choices[0].message.content;
            } else if (data.response) {
                generatedText = data.response;
            } else if (data.text) {
                generatedText = data.text;
            } else if (typeof data === 'string') {
                generatedText = data;
            } else {
                throw new Error('응답 형식을 인식할 수 없습니다.');
            }

            this.currentResponse = generatedText;
            this.displayResult(generatedText, resultArea, footer);

        } catch (error) {
            console.error('AI 생성 오류:', error);
            resultArea.innerHTML = `
                <div style="
                    padding: 20px;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 8px;
                    color: #991b1b;
                ">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <span class="material-icons">error_outline</span>
                        <strong>오류 발생</strong>
                    </div>
                    <p style="margin: 0;">${error.message}</p>
                </div>
            `;
            footer.style.display = 'none';
        }
    }

    displayResult(text, resultArea, footer) {
        resultArea.innerHTML = `
            <div style="position: relative;">
                <div style="
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px 16px 50px 16px;
                    white-space: pre-wrap;
                    line-height: 1.6;
                    font-size: 14px;
                    color: #374151;
                ">${this.escapeHtml(text)}</div>
                <button class="t2-ai-regenerate-inline" style="
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    padding: 6px 12px;
                    background: white;
                    color: #6b7280;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                " onmouseover="this.style.background='#f9fafb'; this.style.borderColor='#d1d5db';" onmouseout="this.style.background='white'; this.style.borderColor='#e5e7eb';">
                    <span class="material-icons" style="font-size: 16px;">refresh</span>
                    재작성
                </button>
            </div>
        `;
        
        const regenerateBtn = resultArea.querySelector('.t2-ai-regenerate-inline');
        regenerateBtn.addEventListener('click', () => {
            if (this.currentPrompt) {
                this.generateContent(this.currentPrompt, resultArea, footer);
            }
        });
        
        footer.style.display = 'flex';
    }

    insertToEditor(text) {
        const htmlContent = text.split('\n').map(line => {
            return line.trim() ? `<p>${this.escapeHtml(line)}</p>` : '<p><br></p>';
        }).join('');

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let currentBlock = this.editor.getClosestBlock(range.startContainer);

            if (!currentBlock || currentBlock === this.editor.editor) {
                currentBlock = document.createElement('p');
                currentBlock.innerHTML = '<br>';
                this.editor.editor.appendChild(currentBlock);
            }

            const fragment = document.createDocumentFragment();
            Array.from(tempDiv.children).forEach(child => {
                fragment.appendChild(child);
            });

            currentBlock.parentNode.insertBefore(fragment, currentBlock.nextSibling);
        } else {
            Array.from(tempDiv.children).forEach(child => {
                this.editor.editor.appendChild(child);
            });
        }

        this.editor.normalizeContent();
        this.editor.createUndoPoint();
        this.editor.autoSave();
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    closeModal() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

window.T2AiPlugin = T2AiPlugin;