<?php
//Path: T2Editor/config/t2_config.php

/**
 * T2Editor Configuration File
 * T2에디터 설정 파일
 */

// 상수가 이미 정의되어 있으면 재정의하지 않음
if (defined('T2EDITOR_PATH')) {
    return;
}

// 그누보드5 체크
if (defined('_GNUBOARD_')) {
    // GNUBOARD5 SYSTEM
    define('T2EDITOR_PATH', G5_PLUGIN_PATH.'/editor/t2editor');
    define('T2EDITOR_URL', G5_PLUGIN_URL.'/editor/t2editor');
    define('T2EDITOR_DATA_PATH', G5_DATA_PATH.'/editor');
    define('T2EDITOR_DATA_URL', G5_DATA_URL.'/editor');
    define('T2EDITOR_DIR_PERMISSION', G5_DIR_PERMISSION);
    define('T2EDITOR_FILE_PERMISSION', G5_FILE_PERMISSION);
} else {
    // BASIC SYSTEM (타 환경)
    // 현재 파일의 실제 경로 기준으로 설정 (config 폴더 상위)
    $t2_base_dir = dirname(__DIR__);
    
    // 프로토콜 결정
    $t2_protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
    $t2_host = $_SERVER['HTTP_HOST'];
    
    // 웹 경로 계산 - Windows/Linux 호환
    $t2_document_root = rtrim(str_replace('\\', '/', realpath($_SERVER['DOCUMENT_ROOT'])), '/');
    $t2_current_path = str_replace('\\', '/', realpath($t2_base_dir));
    
    // DOCUMENT_ROOT 제거하여 상대 경로 생성
    if (strpos($t2_current_path, $t2_document_root) === 0) {
        $t2_relative_path = substr($t2_current_path, strlen($t2_document_root));
    } else {
        // realpath가 다른 경로를 반환하는 경우 (심볼릭 링크 등)
        // $_SERVER['SCRIPT_NAME']을 기반으로 추정
        $t2_script_dir = dirname($_SERVER['SCRIPT_NAME']);
        $t2_relative_path = $t2_script_dir;
    }
    
    // 이중 슬래시 방지 및 정규화
    $t2_relative_path = '/' . trim($t2_relative_path, '/');
    
    define('T2EDITOR_PATH', $t2_base_dir);
    define('T2EDITOR_URL', $t2_protocol . $t2_host . $t2_relative_path);
    define('T2EDITOR_DATA_PATH', $t2_base_dir.'/data');
    define('T2EDITOR_DATA_URL', $t2_protocol . $t2_host . $t2_relative_path . '/data');
    define('T2EDITOR_DIR_PERMISSION', 0755);
    define('T2EDITOR_FILE_PERMISSION', 0644);
    
    // 임시 변수 정리
    unset($t2_base_dir, $t2_protocol, $t2_host, $t2_document_root, $t2_current_path, $t2_relative_path, $t2_script_dir);
}

// 데이터 디렉토리 생성
if (!is_dir(T2EDITOR_DATA_PATH)) {
    @mkdir(T2EDITOR_DATA_PATH, T2EDITOR_DIR_PERMISSION, true);
    @chmod(T2EDITOR_DATA_PATH, T2EDITOR_DIR_PERMISSION);
}
?>