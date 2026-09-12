<?php
//Path: T2Editor/editor.lib.php
include 'config/t2_config.php';
if (!defined('T2EDITOR_PATH')) define('T2EDITOR_PATH', __DIR__);
if (!defined('T2EDITOR_URL'))  define('T2EDITOR_URL', '/t2editor');
// 라이센스 검증
function _t2e_hash($s) { return hash('sha256', $s); }
function _t2e_b64d($s) { return base64_decode($s); }
function _t2e_b64e($d) { return base64_encode($d); }
function _t2e_norm($s) {
    $s = preg_replace("/\r\n|\r|\n/", "\n", $s);
    $s = preg_replace("/[ \t]+/u", " ", $s);
    $s = preg_replace("/\n{2,}/u", "\n\n", $s);
    return trim($s);
}
function _t2e_extract_kor($content) {
    if (preg_match('/사용 권한:[\s\S]*?(?=제한사항:|배포 및 문의:|$)/u', $content, $m)) {
        return _t2e_norm($m[0]);
    }
    if (preg_match('/사용 권한:[\s\S]*?b\)[\s\S]*?(?=(\n){2}|배포:|Usage Rights:|$)/iu', $content, $m)) {
        return _t2e_norm($m[0]);
    }
    return '';
}
function _t2e_extract_eng($content) {
    if (preg_match('/Usage Rights:[\s\S]*?(?=Restrictions:|Distribution and Contact:|$)/u', $content, $m)) {
        return _t2e_norm($m[0]);
    }
    if (preg_match('/Usage Rights:[\s\S]*?b\)[\s\S]*?(?=(\n){2}|Distribution:|$)/u', $content, $m)) {
        return _t2e_norm($m[0]);
    }
    return '';
}
function _t2e_extract_fileline($content) {
    if (preg_match('/The_first\.license_License_ko\.txt\s*&\s*License_en\.txt/i', $content, $m)) {
        return trim($m[0]);
    }
    if (strpos($content, 'The_first.license_License_ko.txt') !== false) {
        return 'The_first.license_License_ko.txt & License_en.txt';
    }
    return '';
}
function _t2e_validate_readme($path) {
    if (!file_exists($path)) return array(false, '라이센스 파일이 존재하지 않습니다.');
    $content = file_get_contents($path);
    $kor_block = _t2e_extract_kor($content);
    $eng_block = _t2e_extract_eng($content);
    $file_line = _t2e_extract_fileline($content);
    if ($kor_block === '') return array(false, '라이센스 내용(KO) 없음');
    if ($eng_block === '') return array(false, '라이센스 내용(EN) 없음');
    if ($file_line === '') return array(false, '라이센스 참조파일 정보 없음');
    $kor_hash = hash('sha256', $kor_block);
    $eng_hash = hash('sha256', $eng_block);
    $file_hash = hash('sha256', $file_line);
    $KOR_PARTS = [
        'YWIxMjVmYmI=',
        'ZTEzMDg5NGI=',
        'ZGY4MWNlNWU=',
        'NDA3ODRiYzc=',
        'M2IyZjI1ZDk=',
        'MTYwMTBlYTY=',
        'NjRjYTM4MWI=',
        'MzZlNjNmZDc=',
    ];
    $ENG_PARTS = [
        'ZjQ3NTEwMTQ=',
        'M2QyYjkxMmE=',
        'NTc0YTA1NzQ=',
        'Nzk0OGU4N2E=',
        'YmRlZDdhY2Y=',
        'ODZhMzdlNmI=',
        'NGQ0OTEzYzI=',
        'MTNiODEwNjk=',
    ];
    $FILE_PARTS = [
        'Yzg0YmQxODA=',
        'YmJmYTA4ZTc=',
        'ZTUyYjIxNmE=',
        'NGM3OTNhMmU=',
        'MDlkY2FiYTY=',
        'MGU1NjAyZDU=',
        'NzM4ZWZhNDc=',
        'YWY1MTRiOTQ=',
    ];
    $rebuild = function($parts){
        $out = '';
        foreach($parts as $p){
            $d = base64_decode($p);
            $out .= strrev($d);
        }
        return $out;
    };
    $expected_kor = $rebuild($KOR_PARTS);
    $expected_eng = $rebuild($ENG_PARTS);
    $expected_file = $rebuild($FILE_PARTS);
    if (!hash_equals($expected_kor, $kor_hash)) return array(false, '라이센스 내용(KO) 불일치');
    if (!hash_equals($expected_eng, $eng_hash)) return array(false, '라이센스 내용(EN) 불일치');
    if (!hash_equals($expected_file, $file_hash)) return array(false, '라이센스 참조파일 정보 불일치');
    return array(true, '');
}
function _t2e_get_status() {
    $p = T2EDITOR_PATH . '/';
    $readme = $p . 'readme.txt';
    return _t2e_validate_readme($readme);
}
function get_readme_version() {
    $readme_path = T2EDITOR_PATH . '/readme.txt';
    if (file_exists($readme_path)) {
        $content = file_get_contents($readme_path);
        if (preg_match('/ver_([0-9.]+)/', $content, $matches)) {
            return $matches[1];
        }
    }
    return 'readme.txt 오류! 재설치 해주세요.';
}
function editor_html($id, $content, $is_dhtml_editor=true) {
    global $g5, $config;
    static $js = true;
    // 라이센스 검증
    list($valid, $msg) = _t2e_get_status();
    if (!$valid) {
        return '<div class="alert alert-danger"><strong>Error:</strong> '.$msg.'</div>';
    }
    $editor_url = T2EDITOR_URL;
    $html = "<span class=\"sound_only\" style=\"display:none\">웹에디터 시작</span>";
    if ($js) {
        // css 파일 로드
        $html .= "\n<link href=\"{$editor_url}/css/core.css\" rel=\"stylesheet\">";
        $html .= "\n<link href=\"{$editor_url}/css/dark.css\" rel=\"stylesheet\" id=\"t2editor-dark-css\">";
        // 자바스크립트 파일 로드
        $html .= "\n<script src=\"{$editor_url}/js/utils.js\"></script>";
        $html .= "\n<script src=\"{$editor_url}/js/core.js\"></script>";
        $readme_path = T2EDITOR_PATH . '/readme.txt';
        $readme_contents = file_exists($readme_path) ? file_get_contents($readme_path) : '';
        $license_token = _t2e_hash($readme_contents . $editor_url);
        $plugin_list = ['image', 'video', 'file', 'table', 'code', 'link', 'export', 'collab', 'draw', 'ai', 'ai_rearrange', 'search'];
        $plugin_array_js = json_encode($plugin_list);
        $html .= "\n<script>";
        $html .= "window.T2EDITOR_LICENSE_TOKEN = " . json_encode($license_token) . ";";
        $html .= "window.T2EDITOR_PLUGIN_LIST = {$plugin_array_js};";
        $html .= "window.T2EDITOR_URL = " . json_encode($editor_url) . ";";
        $html .= "(function(){";
        $html .= "  function loadScript(src, onload){var s=document.createElement('script');s.src=src;s.onload=onload;s.defer=true;document.head.appendChild(s);}";
        $html .= "  try{ var token = window.T2EDITOR_LICENSE_TOKEN; if(!token){ throw 'no-token'; } var plugins = window.T2EDITOR_PLUGIN_LIST || []; plugins.forEach(function(p){ loadScript(window.T2EDITOR_URL + '/plugin/' + p + '/' + p + '.js'); }); }catch(e){ console.warn('T2Editor: license validation failed. Plugins not loaded.'); }";
        $html .= "})();";
        $html .= "</script>";
        $js = false;
    }
    if ($is_dhtml_editor) {
        $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $escaped_content = str_replace(
            array("\\", "'", "\r", "\n"),
            array("\\\\", "\\'", "\\r", "\\n"),
            $content
        );
        ob_start(); ?>
<script>
const t2editor_url = <?php echo json_encode(T2EDITOR_URL ?? ""); ?>;
</script>
<?php
// 안드로이드 환경에서 CDN으로 Material Icons 로드
if (isset($_SERVER['HTTP_USER_AGENT']) && stripos($_SERVER['HTTP_USER_AGENT'], 'Android') !== false) {
    echo '<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">' . "\n";
    echo '<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">' . "\n";
}
?>
<!-- 다크모드 초기화 스크립트 -->
<script>
(function() {
    const T2EditorConfig = {
        enableDarkModeButton: true,
        forcedTheme: null
    };
    if (!T2EditorConfig.enableDarkModeButton && T2EditorConfig.forcedTheme) {
        document.documentElement.setAttribute('data-t2editor-theme', T2EditorConfig.forcedTheme);
        localStorage.setItem('t2editor-dark-mode', T2EditorConfig.forcedTheme === 'dark');
    } else {
        var isDarkMode = localStorage.getItem('t2editor-dark-mode') === 'true';
        if (isDarkMode === null) {
            isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        if (isDarkMode) {
            document.documentElement.setAttribute('data-t2editor-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-t2editor-theme', 'light');
        }
    }
    document.addEventListener('DOMContentLoaded', function() {
        var darkModeToggle = document.querySelector('.t2-dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.style.display = T2EditorConfig.enableDarkModeButton ? 'flex' : 'none';
        }
    });
})();
</script>
<!-- Material Icons 폰트 로딩 -->
<style>
@font-face {
  font-family: "Material Icons";
  font-style: normal;
  font-weight: 400;
  src: url("<?php echo T2EDITOR_URL ?>/fonts/material-icons/MaterialIcons-Regular.eot");
  src: local("Material Icons"),
       url("<?php echo T2EDITOR_URL ?>/fonts/material-icons/MaterialIcons-Regular.woff2") format("woff2"),
       url("<?php echo T2EDITOR_URL ?>/fonts/material-icons/MaterialIcons-Regular.woff") format("woff"),
       url("<?php echo T2EDITOR_URL ?>/fonts/material-icons/MaterialIcons-Regular.ttf") format("truetype");
  font-display: swap;
}
.material-icons {
  font-family: "Material Icons";
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
  -webkit-font-feature-settings: "liga";
  font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  -moz-osx-font-smoothing: grayscale;
}
@font-face {
  font-family: "Material Icons Outlined";
  font-style: normal;
  font-weight: 400;
  src: url("<?php echo T2EDITOR_URL ?>/fonts/material-icons/MaterialIconsOutlined-Regular.woff2") format("woff2"),
       url("<?php echo T2EDITOR_URL ?>/fonts/material-icons/MaterialIconsOutlined-Regular.ttf") format("truetype");
  font-display: swap;
}
.material-icons-outlined {
  font-family: "Material Icons Outlined";
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: "liga";
  font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* 반응형 툴바 그룹 스타일 */
.t2-editor-container {
  position: relative;
}
.t2-toolbar-group-btn {
  position: relative;
}
.t2-toolbar-group-btn.active {
  background: var(--t2-btn-hover-bg, #e0e0e0);
}

/* 가로 스크롤 서브 툴바 */
.t2-sub-toolbar {
  display: none;
  position: relative;
  flex-wrap: nowrap;
  gap: 4px;
  padding: 8px;
  background: var(--t2-toolbar-bg, #f5f5f5);
  border-top: 1px solid var(--t2-border-color, #ddd);
  animation: slideDown 0.2s ease-out;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

/* 스크롤바 숨김 */
.t2-sub-toolbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.t2-sub-toolbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

[data-t2editor-theme="dark"] .t2-sub-toolbar {
  background: #3a3a3a;
  border-top: 1px solid #555;
}

.t2-sub-toolbar.active {
  display: flex;
}

.t2-sub-toolbar .t2-btn {
  flex-shrink: 0;
  min-width: 40px;
}

/* 닫기 버튼 - 서브 툴바 아래 5px 고정 */
.t2-sub-toolbar-close {
  display: none;
  position: absolute;
  top: 5px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(40, 40, 40, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(40, 40, 40, 0.3);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 1000;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}

.t2-sub-toolbar-close.active {
  display: flex;
}

[data-t2editor-theme="dark"] .t2-sub-toolbar-close {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.t2-sub-toolbar-close:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  background: rgba(40, 40, 40, 0.8);
}

[data-t2editor-theme="dark"] .t2-sub-toolbar-close:hover {
  box-shadow: 0 4px 16px rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.35);
}

.t2-sub-toolbar-close .material-icons {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.85);
}

[data-t2editor-theme="dark"] .t2-sub-toolbar-close .material-icons {
  color: rgba(30, 30, 30, 0.85);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
<div class="t2-editor-container" id="<?php echo $id ?>_container">
    <div class="t2-toolbar">
<button class="t2-btn" data-command="undo" disabled>
    <span class="material-icons">undo</span>
</button>
<button class="t2-btn" data-command="redo" disabled>
    <span class="material-icons">redo</span>
</button>
<button class="t2-btn" data-command="bold">
    <span class="material-icons">format_bold</span>
</button>
<button class="t2-btn" data-command="italic">
    <span class="material-icons">format_italic</span>
</button>
<button class="t2-btn" data-command="underline">
    <span class="material-icons">format_underlined</span>
</button>
<button class="t2-btn" data-command="strikeThrough">
    <span class="material-icons">format_strikethrough</span>
</button>
<button class="t2-btn" data-command="justifyContent">
    <span class="material-icons">format_align_left</span>
</button>
<button class="t2-btn" data-command="fontSize">
    <span class="material-icons">format_size</span>
</button>
<button class="t2-btn" data-command="foreColor">
    <span class="material-icons">format_color_text</span>
</button>
<button class="t2-btn" data-command="backColor">
    <span class="material-icons">format_color_fill</span>
</button>
<button class="t2-btn" data-command="insertImage">
    <span class="material-icons">image</span>
</button>
<button class="t2-btn" data-command="insertYouTube" style="color:#f04f48">
    <span class="material-icons">smart_display</span>
</button>
<button class="t2-btn" data-command="insertTable">
    <span class="material-icons-outlined">table_chart</span>
</button>
<button class="t2-btn" data-command="attachFile">
    <span class="material-icons">attach_file</span>
</button>
<button class="t2-btn" data-command="insertCodeBlock">
    <span class="material-icons">code</span>
</button>
<button class="t2-btn" data-command="createLink">
    <span class="material-icons">link</span>
</button>
<button class="t2-btn" data-command="search">
    <span class="material-icons">manage_search</span>
</button>
<button class="t2-btn" data-command="insertAI" style="color:#7c3aed">
    <span class="material-icons">auto_awesome</span>
</button>
<button class="t2-btn" data-command="rearrangeContent" style="color:#667eea">
    <span class="material-icons" style="animation: rainbow 2s infinite;">auto_fix_high</span>
</button>
<button class="t2-btn" data-command="collab">
    <span class="material-icons">group</span>
</button>
<button class="t2-btn" data-command="insertDrawing">
    <span class="material-icons">brush</span>
</button>
<button class="t2-btn" data-command="exportHTML">
    <span class="material-icons-outlined">ios_share</span>
</button>
    </div>
    <div class="t2-editor" contenteditable="true" id="<?php echo $id ?>_editor"></div>
    <textarea name="<?php echo $id ?>" id="<?php echo $id ?>" style="display:none;">
<?php echo $content ?>
    </textarea>
    <div class="t2-editor-status">
        <div class="t2-status-left">
            <a href="//dsclub.kr/service/editor">
                <div class="t2-logo">
                    <span class="t2-logo-prefix">T2</span>
                    <span class="t2-logo-suffix">Editor</span>
                </div>
            </a>
        </div>
        <div class="t2-dark-mode-toggle">
            <button type="button" class="t2-dark-mode-btn" onclick="toggleT2EditorTheme(event)">
                <span class="material-icons t2-dark-mode-icon">dark_mode</span>
                <span class="material-icons t2-light-mode-icon">light_mode</span>
            </button>
        </div>
        <div class="t2-char-count">
            txt: <span>0</span>
        </div>
    </div>
    <span style="color: #999; position: absolute; right: 5px; margin:5px 0; font-size: 11px; font-weight: 500; display: flex; align-items: center;">
        <i class="material-icons-outlined" style="margin-right: 4px; font-size: 14px">info</i>
        <?php echo (strpos($v = get_readme_version(), '오류') !== false) ? $v : "T2Editor Ver $v"; ?>
    </span>
</div>

<!-- 반응형 툴바 그룹 설정 -->
<script>
/*
사용법:
WidthA-WidthB: 반응형 그룹화 버튼이 작동할 에디터의 가로 사이즈의 대략적 범위
groupIcon: 그룹화 버튼 아이콘
groupLabel: 그룹화 버튼의 간략 설명
buttons: 그룹에 넣을 툴바 버튼들의 data-command 값
position: 그룹화 버튼이 기존 툴바에서 몇 번 째 순서에 위치하게 할 지의 값
*/
window.T2_TOOLBAR_GROUPS = {
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
</script>

<script>
function toggleT2EditorTheme(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const currentTheme = document.documentElement.getAttribute('data-t2editor-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-t2editor-theme', newTheme);
    localStorage.setItem('t2editor-dark-mode', newTheme === 'dark');
}

// 반응형 툴바 그룹 핸들러
(function() {
    function initResponsiveToolbar(container) {
        const toolbar = container.querySelector('.t2-toolbar');
        if (!toolbar) return;

        const groups = window.T2_TOOLBAR_GROUPS || {};
        const groupButtons = new Map();
        const subToolbars = new Map();
        const originalButtons = new Map();
        const clonedButtonsMap = new Map();
        const hiddenButtonsByGroup = new Map();
        let activeGroup = null;
        let closeButton = null;

        const allGroupConfigs = [];
        Object.keys(groups).forEach(function(range) {
            const rangeData = range.split('-');
            const minStr = rangeData[0];
            const maxStr = rangeData[1];
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);
            
            groups[range].forEach(function(group, index) {
                const groupId = 'group-' + range + '-' + index;
                allGroupConfigs.push({
                    groupId: groupId,
                    range: { min: min, max: max },
                    group: group,
                    rangeKey: range
                });
            });
        });
        
        allGroupConfigs.sort(function(a, b) {
            const posA = a.group.position !== undefined ? a.group.position : Infinity;
            const posB = b.group.position !== undefined ? b.group.position : Infinity;
            return posB - posA;
        });
        
        // 닫기 버튼 생성 (컨테이너에 직접 추가)
        closeButton = document.createElement('div');
        closeButton.className = 't2-sub-toolbar-close';
        closeButton.innerHTML = '<span class="material-icons">close</span>';
        container.appendChild(closeButton);
        
        allGroupConfigs.forEach(function(config) {
            const groupId = config.groupId;
            const range = config.range;
            const group = config.group;
            
            hiddenButtonsByGroup.set(groupId, new Set());
            
            const groupBtn = document.createElement('button');
            groupBtn.className = 't2-btn t2-toolbar-group-btn';
            groupBtn.setAttribute('data-group-id', groupId);
            groupBtn.setAttribute('data-range', config.rangeKey);
            groupBtn.setAttribute('type', 'button');
            groupBtn.title = group.groupLabel;
            groupBtn.innerHTML = '<span class="material-icons">' + group.groupIcon + '</span>';
            groupBtn.style.display = 'none';
            
            const position = group.position !== undefined ? group.position : toolbar.children.length;
            const targetButton = toolbar.children[position];
            if (targetButton) {
                toolbar.insertBefore(groupBtn, targetButton);
            } else {
                toolbar.appendChild(groupBtn);
            }
            
            const subToolbar = document.createElement('div');
            subToolbar.className = 't2-sub-toolbar';
            subToolbar.setAttribute('data-group-id', groupId);
            
            const originalButtonRefs = [];
            const clonedButtons = [];
            group.buttons.forEach(function(command) {
                const originalBtn = toolbar.querySelector('[data-command="' + command + '"]');
                if (originalBtn) {
                    originalButtonRefs.push(originalBtn);
                    const clonedBtn = originalBtn.cloneNode(true);
                    clonedBtn.setAttribute('type', 'button');
                    clonedBtn.setAttribute('data-cloned-command', command);
                    clonedButtons.push(clonedBtn);
                    subToolbar.appendChild(clonedBtn);
                    
                    if (!clonedButtonsMap.has(originalBtn)) {
                        clonedButtonsMap.set(originalBtn, []);
                    }
                    clonedButtonsMap.get(originalBtn).push(clonedBtn);
                    
                    if (originalBtn.disabled) {
                        clonedBtn.setAttribute('disabled', 'disabled');
                    }
                    if (originalBtn.classList.contains('active')) {
                        clonedBtn.classList.add('active');
                    }
                }
            });
            
            toolbar.insertAdjacentElement('afterend', subToolbar);
            
            groupButtons.set(groupId, {
                button: groupBtn,
                commands: group.buttons,
                range: range
            });
            subToolbars.set(groupId, subToolbar);
            originalButtons.set(groupId, originalButtonRefs);
            
            groupBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const isActive = subToolbar.classList.contains('active');
                
                subToolbars.forEach(function(st) {
                    st.classList.remove('active');
                });
                groupButtons.forEach(function(g) {
                    g.button.classList.remove('active');
                });
                closeButton.classList.remove('active');
                
                if (!isActive) {
                    subToolbar.classList.add('active');
                    groupBtn.classList.add('active');
                    closeButton.classList.add('active');
                    activeGroup = groupId;
                    
                    // 닫기 버튼 위치 조정
                    setTimeout(function() {
                        const toolbarRect = toolbar.getBoundingClientRect();
                        const subToolbarRect = subToolbar.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        const topPosition = (toolbarRect.bottom - containerRect.top) + (subToolbarRect.height) + 5;
                        closeButton.style.top = topPosition + 'px';
                    }, 0);
                } else {
                    activeGroup = null;
                }
            });
            
            clonedButtons.forEach(function(clonedBtn) {
                clonedBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const command = clonedBtn.getAttribute('data-cloned-command');
                    if (command) {
                        const originalBtn = toolbar.querySelector('[data-command="' + command + '"]');
                        if (originalBtn) {
                            const mouseEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            originalBtn.dispatchEvent(mouseEvent);
                            
                            setTimeout(function() {
                                const stateClasses = ['active', 't2-active'];
                                stateClasses.forEach(function(cls) {
                                    if (originalBtn.classList.contains(cls)) {
                                        clonedBtn.classList.add(cls);
                                    } else {
                                        clonedBtn.classList.remove(cls);
                                    }
                                });
                            }, 10);
                        }
                    }
                });
            });
        });
        
        // 닫기 버튼 클릭 이벤트
        closeButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            subToolbars.forEach(function(st) {
                st.classList.remove('active');
            });
            groupButtons.forEach(function(g) {
                g.button.classList.remove('active');
            });
            closeButton.classList.remove('active');
            activeGroup = null;
        });
        
        // 툴바의 일반 버튼 클릭 시 서브 툴바 닫기
        toolbar.addEventListener('click', function(e) {
            const target = e.target.closest('.t2-btn');
            // 서브 툴바 내부의 버튼인지 확인
            const isInSubToolbar = e.target.closest('.t2-sub-toolbar');
            
            if (target && !target.classList.contains('t2-toolbar-group-btn') && !isInSubToolbar) {
                // 일반 버튼 클릭 시 (서브 툴바 버튼 제외)
                subToolbars.forEach(function(st) {
                    st.classList.remove('active');
                });
                groupButtons.forEach(function(g) {
                    g.button.classList.remove('active');
                });
                closeButton.classList.remove('active');
                activeGroup = null;
            }
        });

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes') {
                    const originalBtn = mutation.target;
                    const clonedBtns = clonedButtonsMap.get(originalBtn);
                    
                    if (clonedBtns) {
                        clonedBtns.forEach(function(clonedBtn) {
                            if (mutation.attributeName === 'class') {
                                const stateClasses = ['active', 't2-active'];
                                stateClasses.forEach(function(cls) {
                                    if (originalBtn.classList.contains(cls)) {
                                        clonedBtn.classList.add(cls);
                                    } else {
                                        clonedBtn.classList.remove(cls);
                                    }
                                });
                            }
                            
                            if (mutation.attributeName === 'disabled') {
                                if (originalBtn.disabled) {
                                    clonedBtn.setAttribute('disabled', 'disabled');
                                } else {
                                    clonedBtn.removeAttribute('disabled');
                                }
                            }
                            
                            if (mutation.attributeName === 'style') {
                                if (originalBtn.style.color) {
                                    clonedBtn.style.color = originalBtn.style.color;
                                }
                                if (originalBtn.style.backgroundColor) {
                                    clonedBtn.style.backgroundColor = originalBtn.style.backgroundColor;
                                }
                            }
                        });
                    }
                } else if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    let targetBtn = mutation.target;
                    
                    while (targetBtn && !targetBtn.classList) {
                        targetBtn = targetBtn.parentElement;
                    }
                    
                    while (targetBtn && targetBtn.classList && !targetBtn.classList.contains('t2-btn')) {
                        targetBtn = targetBtn.parentElement;
                    }
                    
                    if (targetBtn && targetBtn.classList && targetBtn.classList.contains('t2-btn')) {
                        const clonedBtns = clonedButtonsMap.get(targetBtn);
                        if (clonedBtns) {
                            const originalIcon = targetBtn.querySelector('.material-icons, .material-icons-outlined');
                            if (originalIcon) {
                                clonedBtns.forEach(function(clonedBtn) {
                                    const clonedIcon = clonedBtn.querySelector('.material-icons, .material-icons-outlined');
                                    if (clonedIcon) {
                                        clonedIcon.textContent = originalIcon.textContent;
                                    }
                                });
                            }
                        }
                    }
                }
            });
        });

        clonedButtonsMap.forEach(function(clonedBtns, originalBtn) {
            observer.observe(originalBtn, {
                attributes: true,
                attributeFilter: ['class', 'disabled', 'style'],
                childList: true,
                subtree: true,
                characterData: true
            });
        });

        function handleResize() {
            const width = toolbar.offsetWidth;
            
            groupButtons.forEach(function(group, groupId) {
                hiddenButtonsByGroup.set(groupId, new Set());
            });
            
            groupButtons.forEach(function(group, groupId) {
                const button = group.button;
                const commands = group.commands;
                const range = group.range;
                const inRange = width >= range.min && width <= range.max;
                
                if (inRange) {
                    button.style.display = '';
                    commands.forEach(function(cmd) {
                        const btn = toolbar.querySelector('[data-command="' + cmd + '"]');
                        if (btn && !btn.classList.contains('t2-toolbar-group-btn')) {
                            btn.style.display = 'none';
                            hiddenButtonsByGroup.get(groupId).add(cmd);
                        }
                    });
                } else {
                    button.style.display = 'none';
                    const subToolbar = subToolbars.get(groupId);
                    if (subToolbar && subToolbar.classList.contains('active')) {
                        subToolbar.classList.remove('active');
                        closeButton.classList.remove('active');
                    }
                    button.classList.remove('active');
                }
            });
            
            groupButtons.forEach(function(group, groupId) {
                const button = group.button;
                const commands = group.commands;
                const range = group.range;
                const inRange = width >= range.min && width <= range.max;
                
                if (!inRange) {
                    commands.forEach(function(cmd) {
                        let isHiddenByOtherGroup = false;
                        groupButtons.forEach(function(otherGroup, otherGroupId) {
                            if (groupId !== otherGroupId && hiddenButtonsByGroup.get(otherGroupId).has(cmd)) {
                                isHiddenByOtherGroup = true;
                            }
                        });
                        
                        if (!isHiddenByOtherGroup) {
                            const btn = toolbar.querySelector('[data-command="' + cmd + '"]');
                            if (btn && !btn.classList.contains('t2-toolbar-group-btn')) {
                                btn.style.display = '';
                            }
                        }
                    });
                }
            });
        }

        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(function() {
                handleResize();
            });
            resizeObserver.observe(toolbar);
        } else {
            window.addEventListener('resize', handleResize);
        }
        
        handleResize();
    }

    const container = document.getElementById('<?php echo $id ?>_container');
    if (container) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(function() { initResponsiveToolbar(container); }, 100);
            });
        } else {
            setTimeout(function() { initResponsiveToolbar(container); }, 100);
        }
    }
})();

(function() {
    const editor = new T2Editor(document.getElementById('<?php echo $id ?>_container'));
    window.<?php echo $id ?>_editor = editor;
if ('<?php echo $escaped_content ?>') {
    try {
        var contentToLoad = '<?php echo $escaped_content ?>';
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentToLoad;
        tempDiv.querySelectorAll('.table-responsive').forEach(function(responsiveWrapper) {
            var table = responsiveWrapper.querySelector('table');
            if (table) {
                if (!table.classList.contains('t2-table')) {
                    table.classList.add('t2-table');
                }
                var isLargeTable = table.classList.contains('t2-table-large') ||
                                  (table.rows.length > 10 || (table.rows[0] && table.rows[0].cells.length > 10));
                if (isLargeTable && !table.classList.contains('t2-table-large')) {
                    table.classList.add('t2-table-large');
                }
                var tableWrapper = document.createElement('div');
                tableWrapper.className = 't2-table-wrapper';
                tableWrapper.contentEditable = false;
                responsiveWrapper.parentNode.insertBefore(tableWrapper, responsiveWrapper);
                if (isLargeTable) {
                    var scrollWrapper = document.createElement('div');
                    scrollWrapper.className = 't2-table-scroll-wrapper';
                    tableWrapper.appendChild(scrollWrapper);
                    scrollWrapper.appendChild(table);
                } else {
                    tableWrapper.appendChild(table);
                }
                responsiveWrapper.remove();
            }
        });
        tempDiv.querySelectorAll('.t2-drawing-block').forEach(function(drawingBlock) {
            var img = drawingBlock.querySelector('img');
            if (img && img.src) {
                drawingBlock.classList.remove('t2-drawing-block');
                if (!drawingBlock.classList.contains('t2-media-block')) {
                    drawingBlock.classList.add('t2-media-block');
                }
            }
        });
        editor.setContent(tempDiv.innerHTML);
        setTimeout(function() {
            for (let [name, plugin] of editor.plugins) {
                if (plugin.onContentSet) {
                    plugin.onContentSet(tempDiv.innerHTML);
                }
            }
        }, 100);
    } catch (e) {
        console.error('에디터 초기화 오류:', e);
    }
}
})();
</script>
<?php
        $html .= ob_get_clean();
    } else {
        $html .= "\n<textarea id=\"{$id}\" name=\"{$id}\" style=\"width:100%;height:300px\">{$content}</textarea>";
    }
    return $html;
}
function get_editor_js($id, $is_dhtml_editor=true) {
    if ($is_dhtml_editor) {
        $t2editor_url = T2EDITOR_URL;
        return "
var _submitContent = function() {
    var editorContent = document.getElementById('{$id}_editor').innerHTML;
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorContent;
    tempDiv.querySelectorAll('.t2-code-block code').forEach(function(codeElement) {
        var codeContent = codeElement.textContent;
        codeElement.textContent = '';
        codeElement.appendChild(document.createTextNode(codeContent));
    });
    tempDiv.querySelectorAll('.t2-file-block').forEach(function(block) {
        const controls = block.querySelector('.t2-media-controls');
        if (controls) {
            controls.remove();
        }
    });
    tempDiv.querySelectorAll('.t2-drawing-block').forEach(function(block) {
        const controls = block.querySelector('.t2-media-controls');
        if (controls) {
            controls.remove();
        }
    });
    tempDiv.querySelectorAll('.t2-video-block, .t2-media-block:has(video)').forEach(function(block) {
        if (!block.classList.contains('t2-video-block')) {
            block.classList.add('t2-video-block');
        }
        var container = block.querySelector('div:first-child');
        var videoElement = container ? container.querySelector('video') : null;
        if (videoElement) {
            if (container.style.width) {
                videoElement.style.width = container.style.width;
            }
            if (container.style.height) {
                videoElement.style.height = container.style.height;
            }
            if (!videoElement.hasAttribute('controls')) {
                videoElement.setAttribute('controls', 'controls');
            }
            if (!videoElement.style.backgroundColor) {
                videoElement.style.backgroundColor = '#000';
            }
        }
        var controls = block.querySelector('.t2-media-controls');
        if (controls) {
            controls.remove();
        }
    });
    tempDiv.querySelectorAll('.t2-media-block:not(.t2-video-block):not(.t2-file-block):not(.t2-drawing-block)').forEach(function(block) {
        var container = block.querySelector('div:first-child');
        var mediaElement = container ? container.querySelector('iframe, img') : null;
        if (mediaElement) {
            if (container.style.width) {
                mediaElement.style.width = container.style.width;
            }
            if (container.style.height && mediaElement.tagName === 'IFRAME') {
                mediaElement.style.height = container.style.height;
            }
            var controls = block.querySelector('.t2-media-controls');
            if (controls) {
                controls.remove();
            }
        }
    });
    tempDiv.querySelectorAll('.t2-table-wrapper').forEach(function(wrapper) {
        const table = wrapper.querySelector('table');
        if (table) {
            const controls = wrapper.querySelector('.t2-table-controls');
            if (controls) {
                controls.remove();
            }
            const downloadBtn = wrapper.querySelector('.t2-table-download-btn');
            if (downloadBtn) {
                downloadBtn.remove();
            }
            const isLargeTable = table.classList.contains('t2-table-large') ||
                               (table.rows.length > 10 || (table.rows[0] && table.rows[0].cells.length > 10));
            const hasScrollWrapper = wrapper.querySelector('.t2-table-scroll-wrapper');
            if (isLargeTable || hasScrollWrapper) {
                const scrollContainer = document.createElement('div');
                scrollContainer.className = 'table-responsive';
                scrollContainer.style.cssText = 'display:block; width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;';
                wrapper.parentNode.insertBefore(scrollContainer, wrapper);
                if (hasScrollWrapper) {
                    hasScrollWrapper.parentNode.insertBefore(table, hasScrollWrapper);
                    hasScrollWrapper.remove();
                }
                scrollContainer.appendChild(table);
                wrapper.remove();
            } else {
                wrapper.parentNode.insertBefore(table, wrapper);
                wrapper.remove();
            }
        }
    });
    tempDiv.querySelectorAll('.t2-code-block').forEach(function(block) {
        const controls = block.querySelector('.t2-media-controls');
        if (controls) {
            controls.remove();
        }
    });
    var contentStyle = '<link href=\"{$t2editor_url}/css/content.css\" rel=\"stylesheet\">';
    var finalContent = tempDiv.innerHTML;
    if (finalContent.indexOf('t2-media-block') !== -1 || finalContent.indexOf('t2-table') !== -1 || finalContent.indexOf('t2-code-block') !== -1 || finalContent.indexOf('t2-drawing-block') !== -1) {
        finalContent += contentStyle;
    }
    document.getElementById('{$id}').value = finalContent;
};
            _submitContent();\n";
    }
    return "var {$id}_editor = document.getElementById('{$id}');\n";
}
function chk_editor_js($id, $is_dhtml_editor=true) {
    if ($is_dhtml_editor) {
        return "
            var editorContent = document.getElementById('{$id}_editor').innerHTML;
            function hasRealContent(html) {
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                var textContent = tempDiv.textContent.trim();
                if (textContent) return true;
                if (tempDiv.querySelector('img, video, iframe')) return true;
                if (tempDiv.querySelector('.t2-file-block, .file-container')) return true;
                if (tempDiv.querySelector('table')) return true;
                return false;
            }
            if (!hasRealContent(editorContent)) {
                alert('내용을 입력해 주십시오.');
                document.getElementById('{$id}_editor').focus();
                return false;
            }\n";
    }
    return "if (!{$id}_editor.value) { alert('내용을 입력해 주십시오.'); {$id}_editor.focus(); return false; }\n";
}
?>