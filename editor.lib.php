<?php
//Path: T2Editor/editor.lib.php

if (!defined('T2EDITOR_PATH')) {
    include_once __DIR__ . '/config/t2_config.php';
}

function a($s) { return hash('sha256', $s); }
function b($s) { return base64_decode($s); }
function c($d) { return base64_encode($d); }

function d($s) {
    $s = preg_replace("/\r\n|\r|\n/", "\n", $s);
    $s = preg_replace("/[ \t]+/u", " ", $s);
    $s = preg_replace("/\n{2,}/u", "\n\n", $s);
    return trim($s);
}

function e($content) {
    if (preg_match('/사용 권한:[\s\S]*?b\)[\s\S]*?(?=(\n){2}|Usage Rights:|$)/iu', $content, $m)) {
        return d($m[0]);
    }
    return '';
}

function f($content) {
    if (preg_match('/Usage Rights:[\s\S]*?b\)[\s\S]*?(?=(\n){2}|$)/u', $content, $m)) {
        return d($m[0]);
    }
    return '';
}

function g($content) {
    if (preg_match('/The_first\.license_License_ko\.txt\s*&\s*License_en\.txt/i', $content, $m)) {
        return trim($m[0]);
    }
    if (strpos($content, 'The_first.license_License_ko.txt') !== false) {
        return 'The_first.license_License_ko.txt & License_en.txt';
    }
    return '';
}

function h($path) {
    if (!file_exists($path)) return array(false, 'reademe.txt가 존재하지 않습니다.');
    $content = file_get_contents($path);
    
    if (strlen($content) < 100) return array(false, 'reademe.txt 손상');

    $kor_block = e($content);
    $eng_block = f($content);
    $file_line = g($content);

    if ($kor_block === '') return array(false, 'reademe.txt 라이선스(KO) 없음');
    if ($eng_block === '') return array(false, 'reademe.txt 라이선스(EN) 없음');
    if ($file_line === '') return array(false, 'reademe.txt 라이선스 정보 없음');

    $kor_hash = a($kor_block);
    $eng_hash = a($eng_block);
    $file_hash = a($file_line);

    $KOR_PARTS = [
        'MDg1OGI4NjY=', 'YjhkZTE3ZjQ=', 'MzQ0ZTQxZjk=', 'MGRkY2MxZDc=',
        'ODdjNWYxMjY=', 'MmRiZjBhNTM=', 'ZDNiNzgxMmE=', 'NDhlOTZhZGQ='
    ];
    $ENG_PARTS = [
        'MTkwZDgxYmU=', 'MTlkZjAzZWQ=', 'M2IwNTEyYjU=', 'NTExMzFiNGQ=',
        'YTI1MzFmMTc=', 'OWEzZGQzMjU=', 'ZTVmMzY0ZDk=', 'YTVlNTcyNzg='
    ];
    $FILE_PARTS = [
        'Yzg0YmQxODA=', 'YmJmYTA4ZTc=', 'ZTUyYjIxNmE=', 'NGM3OTNhMmU=',
        'MDlkY2FiYTY=', 'MGU1NjAyZDU=', 'NzM4ZWZhNDc=', 'YWY1MTRiOTQ='
    ];

    $rebuild = function($parts){
        $out = '';
        foreach($parts as $p){
            $d = b($p);
            $out .= strrev($d);
        }
        return $out;
    };

    $expected_kor = $rebuild($KOR_PARTS);
    $expected_eng = $rebuild($ENG_PARTS);
    $expected_file = $rebuild($FILE_PARTS);

    if (!hash_equals($expected_kor, $kor_hash)) return array(false, 'reademe.txt 라이선스(KO) 수정 확인됨');
    if (!hash_equals($expected_eng, $eng_hash)) return array(false, 'reademe.txt 라이선스(EN) 수정 확인됨');
    if (!hash_equals($expected_file, $file_hash)) return array(false, 'reademe.txt 라이선스 수정 확인됨');

    return array(true, a($content . $kor_hash . $eng_hash . $file_hash . filesize($path)));
}

function i() {
    $p = T2EDITOR_PATH . '/';
    $readme = $p . 'readme.txt';
    return h($readme);
}

function j($path) {
    if (!file_exists($path)) return '';
    $c = file_get_contents($path);
    return (strlen($c) > 50) ? $c : '';
}

function k($editor_url, $content) {
    list($v1, $m1) = i();
    if (!$v1 || strlen($content) < 50) return '';
    return a($content . $editor_url . $m1);
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

function l($token1, $token2) {
    return hash_equals($token1, $token2) && strlen($token1) === 64;
}

function m($readme_contents, $url) {
    list($v, $msg) = i();
    if (!$v || strlen($readme_contents) < 50) return '';
    $h1 = a($readme_contents . $url . $msg);
    $h2 = a($url . $readme_contents . $msg);
    return substr($h1, 0, 32) . substr($h2, 32);
}

function n($content, $url) {
    list($v, $fingerprint) = i();
    if (!$v) return '';
    return a($fingerprint . $content . $url . php_uname() . __FILE__);
}

function o($t1, $t2, $t3) {
    if (strlen($t1) !== 64 || strlen($t2) !== 64 || strlen($t3) !== 64) return false;
    list($v, $fp) = i();
    if (!$v) return false;
    $check = a($t1 . $t2 . $t3 . $fp);
    return substr($check, 16, 16);
}

function editor_html($id, $content, $is_dhtml_editor=true) {
    global $g5, $config;
    static $js = true;

    // 그누보드5 환경 체크
    $is_gnuboard = defined('_GNUBOARD_');

    list($valid, $msg) = i();
    if (!$valid) {
        return '<div class="alert alert-danger"><strong>Error:</strong> '.$msg.'</div>';
    }

    $editor_url = T2EDITOR_URL;
    $html = "<span class=\"sound_only\" style=\"display:none\">웹에디터 시작</span>";

    $readme_path = T2EDITOR_PATH . '/readme.txt';
    $readme_contents = j($readme_path);
    
    if (strlen($readme_contents) < 50) {
        return '<div class="alert alert-danger"><strong>Error:</strong>reademe.txt 라이선스 검증 실패</div>';
    }

    $license_token = k($editor_url, $readme_contents);
    $secondary_token = m($readme_contents, $editor_url);
    $tertiary_token = n($readme_contents, $editor_url);

    if (strlen($license_token) !== 64 || strlen($secondary_token) !== 64 || strlen($tertiary_token) !== 64) {
        return '<div class="alert alert-danger"><strong>Error:</strong> 토큰 생성 오류</div>';
    }

    $integrity_check = o($license_token, $secondary_token, $tertiary_token);
    if (!$integrity_check || strlen($integrity_check) !== 16) {
        return '<div class="alert alert-danger"><strong>Error:</strong> 무결성 검증 실패</div>';
    }

    if ($js) {
        $html .= "\n<link href=\"{$editor_url}/css/core.css\" rel=\"stylesheet\">";
        $html .= "\n<link href=\"{$editor_url}/css/dark.css\" rel=\"stylesheet\" id=\"t2editor-dark-css\">";

        $html .= "\n<script src=\"{$editor_url}/js/utils.js\"></script>";
        $html .= "\n<script src=\"{$editor_url}/js/core.js\"></script>";

        $plugin_list = ['image', 'video', 'file', 'table', 'code', 'link', 'export', 'collab'];
        $plugin_array_js = json_encode($plugin_list);

        $obfuscated_check = c(json_encode([
            't' => substr($license_token, 0, 16),
            's' => substr($secondary_token, 16, 16),
            'r' => substr($tertiary_token, 24, 16),
            'v' => get_readme_version(),
            'i' => $integrity_check
        ]));

        $split_tokens = [
            'p1' => substr($license_token, 0, 21),
            'p2' => substr($license_token, 21, 22),
            'p3' => substr($license_token, 43),
            's1' => substr($secondary_token, 0, 21),
            's2' => substr($secondary_token, 21, 22),
            's3' => substr($secondary_token, 43),
            't1' => substr($tertiary_token, 0, 21),
            't2' => substr($tertiary_token, 21, 22),
            't3' => substr($tertiary_token, 43)
        ];

        $html .= "\n<script>";
        $html .= "(function(){";
        $html .= "var _p=" . json_encode($split_tokens) . ";";
        $html .= "window.T2EDITOR_LICENSE_TOKEN=_p.p1+_p.p2+_p.p3;";
        $html .= "window.T2EDITOR_SECONDARY=_p.s1+_p.s2+_p.s3;";
        $html .= "window.T2EDITOR_TERTIARY=_p.t1+_p.t2+_p.t3;";
        $html .= "window.T2EDITOR_VERIFY=" . json_encode($obfuscated_check) . ";";
        $html .= "window.T2EDITOR_INTEGRITY=" . json_encode($integrity_check) . ";";
        $html .= "window.T2EDITOR_PLUGIN_LIST={$plugin_array_js};";
        $html .= "window.T2EDITOR_URL=" . json_encode($editor_url) . ";";
        $html .= "window.T2EDITOR_IS_GNUBOARD=" . ($is_gnuboard ? 'true' : 'false') . ";";
        $html .= "delete _p;";
        $html .= "function _vt(t,s,r,v,i){";
        $html .= "if(!t||!s||!r||!v||!i)return false;";
        $html .= "if(t.length!==64||s.length!==64||r.length!==64)return false;";
        $html .= "if(i.length!==16)return false;";
        $html .= "try{var d=JSON.parse(atob(v));";
        $html .= "if(!d.t||!d.s||!d.r||!d.v||!d.i)return false;";
        $html .= "if(t.indexOf(d.t)!==0)return false;";
        $html .= "if(s.indexOf(d.s)===-1)return false;";
        $html .= "if(r.indexOf(d.r)===-1)return false;";
        $html .= "if(d.i!==i)return false;";
        $html .= "}catch(e){return false;}";
        $html .= "return true;";
        $html .= "}";
        $html .= "if(!_vt(window.T2EDITOR_LICENSE_TOKEN,window.T2EDITOR_SECONDARY,window.T2EDITOR_TERTIARY,window.T2EDITOR_VERIFY,window.T2EDITOR_INTEGRITY)){";
        $html .= "console.error('Validation failed');return;";
        $html .= "}";
        $html .= "window.T2EDITOR_VALIDATE=_vt;";
        $html .= "function loadScript(src,onload){var s=document.createElement('script');s.src=src;s.onload=onload;s.defer=true;document.head.appendChild(s);}";
        $html .= "var plugins=window.T2EDITOR_PLUGIN_LIST||[];";
        $html .= "plugins.forEach(function(p){loadScript(window.T2EDITOR_URL+'/plugin/'+p+'/'+p+'.js');});";
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
</style>

<div class="t2-editor-container" id="<?php echo $id ?>_container" 
     data-lt="<?php echo htmlspecialchars($license_token); ?>"
     data-verify="<?php echo htmlspecialchars($obfuscated_check); ?>"
     data-st="<?php echo htmlspecialchars($secondary_token); ?>"
     data-tt="<?php echo htmlspecialchars($tertiary_token); ?>"
     data-ic="<?php echo htmlspecialchars($integrity_check); ?>">
    <div class="t2-toolbar">
        <button class="t2-btn" data-command="undo" disabled>
            <span class="material-icons">undo</span>
        </button>
        <button class="t2-btn" data-command="redo" disabled>
            <span class="material-icons">redo</span>
        </button>
        <button class="t2-btn" data-command="fontSize">
            <span class="material-icons">format_size</span>
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
        <button class="t2-btn" data-command="attachFile">
            <span class="material-icons">attach_file</span>
        </button>
        <button class="t2-btn" data-command="createLink">
            <span class="material-icons">link</span>
        </button>
        <button class="t2-btn" data-command="insertTable">
            <span class="material-icons-outlined">table_chart</span>
        </button>
        <button class="t2-btn" data-command="insertCodeBlock">
            <span class="material-icons">code</span>
        </button>
        <button class="t2-btn" data-command="collab">
         <span class="material-icons">group</span>
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
        <!-- 다크모드 토글 -->
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

function validateT2EditorLicense() {
    const container = document.getElementById('<?php echo $id ?>_container');
    if (!container) return false;
    
    const t1 = container.dataset.lt || '';
    const t2 = container.dataset.st || '';
    const t3 = container.dataset.tt || '';
    const ic = container.dataset.ic || '';
    const v = container.dataset.verify || '';
    
    if (!window.T2EDITOR_LICENSE_TOKEN || !window.T2EDITOR_SECONDARY || !window.T2EDITOR_TERTIARY) return false;
    if (!window.T2EDITOR_VERIFY || !window.T2EDITOR_INTEGRITY) return false;
    if (!window.T2EDITOR_VALIDATE) return false;
    
    if (!window.T2EDITOR_VALIDATE(window.T2EDITOR_LICENSE_TOKEN, window.T2EDITOR_SECONDARY, window.T2EDITOR_TERTIARY, window.T2EDITOR_VERIFY, window.T2EDITOR_INTEGRITY)) return false;
    
    if (window.T2EDITOR_LICENSE_TOKEN !== t1) return false;
    if (window.T2EDITOR_SECONDARY !== t2) return false;
    if (window.T2EDITOR_TERTIARY !== t3) return false;
    if (window.T2EDITOR_INTEGRITY !== ic) return false;
    if (window.T2EDITOR_VERIFY !== v) return false;
    
    if (t1.length !== 64 || t2.length !== 64 || t3.length !== 64 || ic.length !== 16) return false;
    
    try {
        const decoded = JSON.parse(atob(v));
        if (!decoded.t || !decoded.s || !decoded.r || !decoded.v || !decoded.i) return false;
        if (t1.indexOf(decoded.t) !== 0) return false;
        if (t2.indexOf(decoded.s) === -1) return false;
        if (t3.indexOf(decoded.r) === -1) return false;
        if (decoded.i !== ic) return false;
    } catch(e) {
        return false;
    }
    
    return true;
}

function executeT2Command(cmd) {
    if (!validateT2EditorLicense()) {
        alert('reademe.txt 라이선스 검증 실패: 에디터 기능을 사용할 수 없습니다.');
        return;
    }
    const event = new CustomEvent('t2editor-command', { detail: { command: cmd } });
    document.dispatchEvent(event);
}

document.addEventListener('DOMContentLoaded', function() {
    const toolbar = document.querySelector('#<?php echo $id ?>_container .t2-toolbar');
    if (toolbar) {
        toolbar.addEventListener('click', function(e) {
            const btn = e.target.closest('.t2-btn');
            if (btn && btn.dataset.command) {
                e.preventDefault();
                executeT2Command(btn.dataset.command);
            }
        });
    }
});

(function() {
    const container = document.getElementById('<?php echo $id ?>_container');
    if (!validateT2EditorLicense()) {
        if (container) {
            container.innerHTML = '<div class="alert alert-danger">reademe.txt 라이선스 검증 실패: 에디터를 사용할 수 없습니다.</div>';
        }
        return;
    }

    const editor = new T2Editor(container);
    
    if (!editor || !editor.setContent) {
        container.innerHTML = '<div class="alert alert-danger">에디터 초기화 실패</div>';
        return;
    }
    
    window.<?php echo $id ?>_editor = editor;

    editor._licenseCheck = function() {
        return validateT2EditorLicense();
    };

    const originalSetContent = editor.setContent;
    editor.setContent = function(content) {
        if (!this._licenseCheck()) {
            throw new Error('License validation failed');
        }
        return originalSetContent.call(this, content);
    };

    <?php if ($is_gnuboard): ?>
    // 그누보드5 환경: 폼 제출 처리 활성화
    editor._formSubmitEnabled = true;
    <?php else: ?>
    // 비-그누보드 환경: 사용자 직접 구현 필요
    editor._formSubmitEnabled = false;
    console.info('T2Editor: 폼 제출 처리를 직접 구현하세요. editor.getContent() 또는 document.getElementById("<?php echo $id ?>_editor").innerHTML 사용');
    
    // 에디터 컨텐츠 가져오기 헬퍼 함수 제공
    editor.getContent = function() {
        if (!this._licenseCheck()) {
            throw new Error('License validation failed');
        }
        return document.getElementById('<?php echo $id ?>_editor').innerHTML;
    };
    <?php endif; ?>

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
    // 그누보드5 환경 체크
    $is_gnuboard = defined('_GNUBOARD_');
    
    if (!$is_dhtml_editor) {
        return "var {$id}_editor = document.getElementById('{$id}');\n";
    }

    list($v, $m) = i();
    if (!$v) return "alert('reademe.txt 검증 실패');\n";

    // 그누보드5가 아닌 경우: 기본적인 라이선스 체크만 반환
    if (!$is_gnuboard) {
        return "
// 비-그누보드 환경: 사용자가 직접 폼 제출 처리 구현 필요
// 에디터 인스턴스: window.{$id}_editor
// 컨텐츠 가져오기: window.{$id}_editor.getContent() 또는 document.getElementById('{$id}_editor').innerHTML

if (!window.{$id}_editor || !window.{$id}_editor._licenseCheck || !window.{$id}_editor._licenseCheck()) {
    console.error('T2Editor 라이선스 검증 실패');
}
";
    }

    // 그누보드5 환경: 기존 폼 제출 처리 코드
    $t2editor_url = T2EDITOR_URL;
    return "
if (!window.{$id}_editor || !window.{$id}_editor._licenseCheck || !window.{$id}_editor._licenseCheck()) {
    alert('라이선스 검증실패: 폼을 제출할 수 없습니다.');
    return false;
}

var _submitContent = function() {
    var editorContent = document.getElementById('{$id}_editor').innerHTML;
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = editorContent;

    // 코드블럭 HTML 이스케이프 처리
    tempDiv.querySelectorAll('.t2-code-block code').forEach(function(codeElement) {
        var codeContent = codeElement.textContent;
        codeElement.textContent = '';
        codeElement.appendChild(document.createTextNode(codeContent));
    });

    // 파일 블록 처리
    tempDiv.querySelectorAll('.t2-file-block').forEach(function(block) {
        const controls = block.querySelector('.t2-media-controls');
        if (controls) {
            controls.remove();
        }
    });

    // 비디오 블록 처리
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

    // 미디어 블록 처리
    tempDiv.querySelectorAll('.t2-media-block:not(.t2-video-block):not(.t2-file-block)').forEach(function(block) {
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

    // 테이블 래퍼 및 컨트롤 처리
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

    // 코드 블록 처리 - 컨트롤만 제거
    tempDiv.querySelectorAll('.t2-code-block').forEach(function(block) {
        const controls = block.querySelector('.t2-media-controls');
        if (controls) {
            controls.remove();
        }
    });

    var contentStyle = '<link href=\"{$t2editor_url}/css/content.css\" rel=\"stylesheet\">';

    var finalContent = tempDiv.innerHTML;

    if (finalContent.indexOf('t2-media-block') !== -1 || finalContent.indexOf('t2-table') !== -1 || finalContent.indexOf('t2-code-block') !== -1) {
        finalContent += contentStyle;
    }

    document.getElementById('{$id}').value = finalContent;
};
            _submitContent();\n";
}

function chk_editor_js($id, $is_dhtml_editor=true) {
    // 그누보드5 환경 체크
    $is_gnuboard = defined('_GNUBOARD_');
    
    if (!$is_dhtml_editor) {
        return "if (!{$id}_editor.value) { alert('내용을 입력해 주십시오.'); {$id}_editor.focus(); return false; }\n";
    }

    $readme_path = T2EDITOR_PATH . '/readme.txt';
    $readme_contents = j($readme_path);
    $editor_url = T2EDITOR_URL;
    
    if (strlen($readme_contents) < 50) {
        return "alert('reademe.txt 손상'); return false;\n";
    }
    
    $vtoken = k($editor_url, $readme_contents);
    $vtoken2 = m($readme_contents, $editor_url);
    $vtoken3 = n($readme_contents, $editor_url);
    
    if (strlen($vtoken) !== 64 || strlen($vtoken2) !== 64 || strlen($vtoken3) !== 64) {
        return "alert('reademe.txt 검증 실패'); return false;\n";
    }
    
    $integrity = o($vtoken, $vtoken2, $vtoken3);
    if (!$integrity || strlen($integrity) !== 16) {
        return "alert('reademe.txt 수정 확인됨'); return false;\n";
    }

    // 그누보드5가 아닌 경우: 기본 라이선스 체크만
    if (!$is_gnuboard) {
        return "
// 비-그누보드 환경: 사용자가 직접 폼 검증 구현 필요
if (!window.{$id}_editor || typeof window.{$id}_editor._licenseCheck !== 'function') {
    console.error('T2Editor가 올바르게 초기화되지 않았습니다.');
    return false;
}

if (!window.{$id}_editor._licenseCheck()) {
    console.error('T2Editor 라이선스 검증 실패');
    return false;
}

// 여기에 사용자 정의 검증 로직 추가
// 예: var content = window.{$id}_editor.getContent();
";
    }

    // 그누보드5 환경: 기존 검증 코드
    $vtoken_parts = [
        substr($vtoken, 0, 8),
        substr($vtoken, 16, 8),
        substr($vtoken, 32, 8),
        substr($vtoken, 48, 8)
    ];
    $vtoken2_parts = [
        substr($vtoken2, 8, 8),
        substr($vtoken2, 24, 8),
        substr($vtoken2, 40, 8)
    ];
    $vtoken3_parts = [
        substr($vtoken3, 12, 8),
        substr($vtoken3, 28, 8),
        substr($vtoken3, 52, 8)
    ];
    
    return "
        if (!window.{$id}_editor || typeof window.{$id}_editor._licenseCheck !== 'function') {
            alert('에디터가 올바르게 초기화되지 않았습니다.');
            return false;
        }
        
        if (!window.{$id}_editor._licenseCheck()) {
            alert('reademe.txt 검증 실패: 내용을 제출할 수 없습니다.');
            return false;
        }
        
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
        }
        
        var container = document.getElementById('{$id}_container');
        if (!container) {
            alert('에디터 컨테이너를 찾을 수 없습니다.');
            return false;
        }
        
        var t1 = container.dataset.lt || '';
        var t2 = container.dataset.st || '';
        var t3 = container.dataset.tt || '';
        var ic = container.dataset.ic || '';
        var vf = container.dataset.verify || '';
        
        if (t1.length !== 64 || t2.length !== 64 || t3.length !== 64 || ic.length !== 16) {
            alert('라이선스 토큰이 올바르지 않습니다.');
            return false;
        }
        
        if (!window.T2EDITOR_LICENSE_TOKEN || !window.T2EDITOR_SECONDARY || !window.T2EDITOR_TERTIARY) {
            alert('reademe.txt 라이선스 정보가 없습니다.');
            return false;
        }
        
        if (!window.T2EDITOR_INTEGRITY || !window.T2EDITOR_VERIFY || !window.T2EDITOR_VALIDATE) {
            alert('reademe.txt 검증 정보가 없습니다.');
            return false;
        }
        
        if (!window.T2EDITOR_VALIDATE(window.T2EDITOR_LICENSE_TOKEN, window.T2EDITOR_SECONDARY, window.T2EDITOR_TERTIARY, window.T2EDITOR_VERIFY, window.T2EDITOR_INTEGRITY)) {
            alert('검증 실패');
            return false;
        }
        
        var _vp = ['" . implode("','", $vtoken_parts) . "'];
        var _vp2 = ['" . implode("','", $vtoken2_parts) . "'];
        var _vp3 = ['" . implode("','", $vtoken3_parts) . "'];
        var _ic = '{$integrity}';
        
        for (var i = 0; i < _vp.length; i++) {
            if (window.T2EDITOR_LICENSE_TOKEN.indexOf(_vp[i]) === -1) {
                alert('reademe.txt 검증에 실패했습니다.');
                return false;
            }
        }
        
        for (var j = 0; j < _vp2.length; j++) {
            if (window.T2EDITOR_SECONDARY.indexOf(_vp2[j]) === -1) {
                alert('reademe.txt 검증에 실패했습니다.');
                return false;
            }
        }
        
        for (var k = 0; k < _vp3.length; k++) {
            if (window.T2EDITOR_TERTIARY.indexOf(_vp3[k]) === -1) {
                alert('reademe.txt 검증에 실패했습니다.');
                return false;
            }
        }
        
        if (window.T2EDITOR_INTEGRITY !== _ic || ic !== _ic) {
            alert('reademe.txt 무결성 검증에 실패했습니다.');
            return false;
        }
        
        if (t1 !== window.T2EDITOR_LICENSE_TOKEN || t2 !== window.T2EDITOR_SECONDARY || t3 !== window.T2EDITOR_TERTIARY) {
            alert('토큰 불일치');
            return false;
        }
        
        try {
            var _dv = JSON.parse(atob(vf));
            if (!_dv.t || !_dv.s || !_dv.r || !_dv.i || _dv.i !== _ic) {
                alert('검증 데이터 오류');
                return false;
            }
        } catch(e) {
            alert('검증 처리 오류');
            return false;
        }\n";
}
?>