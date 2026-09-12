(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        .t2-toolbar-group-btn {
            position: relative;
            min-width: 36px;
            transition: background-color 0.2s;
        }
        
        .t2-toolbar-group-btn.active {
            background-color: rgba(99, 102, 241, 0.15);
        }

        [data-t2editor-theme="dark"] .t2-toolbar-group-btn.active {
            background-color: rgba(99, 102, 241, 0.25);
        }

        .t2-subtoolbar-container {
            position: relative;
            width: 100%;
            overflow: hidden;
            max-height: 0;
            opacity: 0;
            transition: max-height 0.2s ease-out, opacity 0.2s ease-out;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }

        [data-t2editor-theme="dark"] .t2-subtoolbar-container {
            background: #1e1e1e;
            border-bottom-color: #333;
        }

        .t2-subtoolbar-container.active {
            max-height: 60px;
            opacity: 1;
        }

        .t2-subtoolbar {
            display: flex;
            gap: 4px;
            padding: 8px 50px 8px 8px;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .t2-subtoolbar::-webkit-scrollbar {
            display: none;
        }

        .t2-subtoolbar .t2-btn {
            flex-shrink: 0;
        }

        .t2-subtoolbar-close {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid #aaa;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            z-index: 10;
        }

        [data-t2editor-theme="dark"] .t2-subtoolbar-close {
            background: rgba(255, 255, 255, 0.1);
        }

        .t2-subtoolbar-close:hover {
            background: rgba(0, 0, 0, 0.2);
            transform: scale(1.05);
        }

        [data-t2editor-theme="dark"] .t2-subtoolbar-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .t2-subtoolbar-close .material-icons {
            font-size: 20px;
            color: #666;
        }

        [data-t2editor-theme="dark"] .t2-subtoolbar-close .material-icons {
            color: #aaa;
        }

        .t2-btn.t2-hidden {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    class T2ResponsiveToolbar {
        constructor(container) {
            this.container = container;
            this.toolbar = container.querySelector('.t2-toolbar');
            if (!this.toolbar) return;

            this.config = window.T2_TOOLBAR_GROUPS || this.getDefaultConfig();
            this.currentRange = null;
            this.groupButtons = new Map();
            this.subtoolbarContainer = null;
            this.activeGroupId = null;
            this.observers = new Map();

            this.init();
        }

        getDefaultConfig() {
            return {
                '0-599': [
                    {
                        groupIcon: 'text_fields',
                        groupLabel: '텍스트',
                        buttons: ['fontSize', 'bold', 'italic', 'underline', 'strikeThrough', 'justifyContent', 'foreColor', 'backColor', 'createLink', 'insertCodeBlock'],
                        position: 3
                    },
                    {
                        groupIcon: 'photo_camera',
                        groupLabel: '콘텐츠 업로드',
                        buttons: ['attachFile', 'insertImage', 'insertYouTube', 'insertTable'],
                        position: 4
                    },
                    {
                        groupIcon: 'more_horiz',
                        groupLabel: '기타 기능',
                        buttons: ['insertCodeBlock', 'createLink', 'insertDrawing', 'collab', 'exportHTML'],
                        position: 19
                    }
                ],
                '600-1023': [
                    {
                        groupIcon: 'text_fields',
                        groupLabel: '텍스트',
                        buttons: ['fontSize', 'strikeThrough', 'justifyContent', 'foreColor', 'backColor', 'insertCodeBlock'],
                        position: 2
                    },
                    {
                        groupIcon: 'more_horiz',
                        groupLabel: '기타 기능',
                        buttons: ['insertTable', 'insertCodeBlock', 'insertDrawing', 'collab', 'exportHTML'],
                        position: 19
                    }
                ]
            };
        }

        init() {
            this.createSubtoolbar();
            this.setupResizeObserver();
            this.setupMainToolbarClick();
            this.handleResize();
        }

        createSubtoolbar() {
            this.subtoolbarContainer = document.createElement('div');
            this.subtoolbarContainer.className = 't2-subtoolbar-container';
            
            const subtoolbar = document.createElement('div');
            subtoolbar.className = 't2-subtoolbar';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 't2-subtoolbar-close';
            closeBtn.type = 'button';
            closeBtn.innerHTML = '<span class="material-icons">close</span>';
            closeBtn.addEventListener('click', () => this.closeSubtoolbar());
            
            this.subtoolbarContainer.appendChild(subtoolbar);
            this.subtoolbarContainer.appendChild(closeBtn);
            this.toolbar.parentNode.insertBefore(this.subtoolbarContainer, this.toolbar.nextSibling);
        }

        setupResizeObserver() {
            if (typeof ResizeObserver !== 'undefined') {
                const resizeObserver = new ResizeObserver(() => this.handleResize());
                resizeObserver.observe(this.toolbar);
            } else {
                window.addEventListener('resize', () => this.handleResize());
            }
        }

        setupMainToolbarClick() {
            this.toolbar.addEventListener('click', (e) => {
                const button = e.target.closest('.t2-btn');
                
                if (button && !button.classList.contains('t2-toolbar-group-btn')) {
                    this.closeSubtoolbar();
                }
            });
        }

        handleResize() {
            const width = this.toolbar.offsetWidth;
            const newRange = this.getActiveRange(width);

            if (newRange !== this.currentRange) {
                this.currentRange = newRange;
                this.updateToolbar();
            }
        }

        getActiveRange(width) {
            for (const range in this.config) {
                const [min, max] = range.split('-').map(Number);
                if (width >= min && width <= max) {
                    return range;
                }
            }
            return null;
        }

        updateToolbar() {
            this.groupButtons.forEach((btn, id) => {
                btn.remove();
                this.stopObservingButtons(id);
            });
            this.groupButtons.clear();
            this.closeSubtoolbar();

            this.toolbar.querySelectorAll('.t2-btn').forEach(btn => {
                btn.classList.remove('t2-hidden');
            });

            if (!this.currentRange) return;

            const groups = this.config[this.currentRange];
            if (!groups || !Array.isArray(groups)) return;

            const sortedGroups = [...groups].sort((a, b) => (b.position || 0) - (a.position || 0));

            sortedGroups.forEach((group, idx) => {
                this.createGroupButton(group, `group-${this.currentRange}-${idx}`);
            });
        }

        createGroupButton(group, groupId) {
            const buttons = this.toolbar.querySelectorAll('.t2-btn');
            const buttonsToHide = [];
            
            group.buttons.forEach(cmd => {
                const btn = Array.from(buttons).find(b => 
                    b.getAttribute('data-command') === cmd && !b.classList.contains('t2-hidden')
                );
                if (btn) buttonsToHide.push(btn);
            });

            if (buttonsToHide.length === 0) return;

            const groupBtn = document.createElement('button');
            groupBtn.className = 't2-btn t2-toolbar-group-btn';
            groupBtn.type = 'button';
            groupBtn.title = group.groupLabel || '';
            groupBtn.innerHTML = `<span class="material-icons">${group.groupIcon}</span>`;
            groupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSubtoolbar(groupId, buttonsToHide);
            });

            const position = group.position || 0;
            const allButtons = Array.from(this.toolbar.querySelectorAll('.t2-btn'));
            const insertBefore = allButtons[position] || null;
            
            if (insertBefore) {
                this.toolbar.insertBefore(groupBtn, insertBefore);
            } else {
                this.toolbar.appendChild(groupBtn);
            }

            this.groupButtons.set(groupId, groupBtn);

            buttonsToHide.forEach(btn => btn.classList.add('t2-hidden'));
        }

        toggleSubtoolbar(groupId, buttons) {
            if (this.activeGroupId === groupId) {
                this.closeSubtoolbar();
            } else {
                this.openSubtoolbar(groupId, buttons);
            }
        }

        openSubtoolbar(groupId, buttons) {
            this.closeSubtoolbar();
            
            const subtoolbar = this.subtoolbarContainer.querySelector('.t2-subtoolbar');
            subtoolbar.innerHTML = '';

            buttons.forEach(originalBtn => {
                const clonedBtn = originalBtn.cloneNode(true);
                clonedBtn.classList.remove('t2-hidden');
                
                clonedBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    originalBtn.click();
                });

                subtoolbar.appendChild(clonedBtn);

                this.observeButton(groupId, originalBtn, clonedBtn);
            });

            this.subtoolbarContainer.classList.add('active');
            this.activeGroupId = groupId;
            
            const groupBtn = this.groupButtons.get(groupId);
            if (groupBtn) groupBtn.classList.add('active');
        }

        closeSubtoolbar() {
            if (!this.activeGroupId) return;

            this.subtoolbarContainer.classList.remove('active');
            
            const groupBtn = this.groupButtons.get(this.activeGroupId);
            if (groupBtn) groupBtn.classList.remove('active');

            this.stopObservingButtons(this.activeGroupId);
            this.activeGroupId = null;
        }

        observeButton(groupId, original, clone) {
            if (!this.observers.has(groupId)) {
                this.observers.set(groupId, []);
            }

            const observer = new MutationObserver(() => {
                this.syncButtonState(original, clone);
            });

            observer.observe(original, {
                attributes: true,
                attributeFilter: ['disabled', 'class', 'style'],
                childList: true,
                characterData: true,
                subtree: true
            });

            this.observers.get(groupId).push(observer);
            this.syncButtonState(original, clone);
        }

        syncButtonState(original, clone) {
            if (original.disabled) {
                clone.disabled = true;
            } else {
                clone.disabled = false;
            }

            const classesToSync = ['active', 'disabled'];
            classesToSync.forEach(cls => {
                if (original.classList.contains(cls)) {
                    clone.classList.add(cls);
                } else {
                    clone.classList.remove(cls);
                }
            });

            if (original.style.color) {
                clone.style.color = original.style.color;
            }

            const originalIcon = original.querySelector('.material-icons');
            const cloneIcon = clone.querySelector('.material-icons');
            if (originalIcon && cloneIcon && originalIcon.textContent !== cloneIcon.textContent) {
                cloneIcon.textContent = originalIcon.textContent;
            }
        }

        stopObservingButtons(groupId) {
            const observers = this.observers.get(groupId);
            if (observers) {
                observers.forEach(obs => obs.disconnect());
                this.observers.delete(groupId);
            }
        }
    }

    function initResponsiveToolbar() {
        const containers = document.querySelectorAll('.t2-editor-container');
        containers.forEach(container => {
            if (!container._responsiveToolbar) {
                container._responsiveToolbar = new T2ResponsiveToolbar(container);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initResponsiveToolbar, 300);
        });
    } else {
        setTimeout(initResponsiveToolbar, 300);
    }

    window.T2ResponsiveToolbar = T2ResponsiveToolbar;
})();