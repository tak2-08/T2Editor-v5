<?php
// Path: T2Editor/plugin/collab/collab_number_delete.php

// 세션 잠금 방지
if (session_id()) {
    session_write_close();
}

// 실행 시간 제한 해제
set_time_limit(0);

// 출력 버퍼링 비활성화
if (ob_get_level()) {
    ob_end_clean();
}

// JSON 헤더 설정
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// CORS 헤더 (필요한 경우)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// 연결 종료 후에도 스크립트 실행 계속
ignore_user_abort(true);

if (!defined('T2EDITOR_PATH')) {
    $possible = __DIR__ . '/../../config/t2_config.php';
    if (file_exists($possible)) {
        include_once $possible;
    }
}
if (!defined('T2EDITOR_PATH')) {
    define('T2EDITOR_PATH', realpath(__DIR__ . '/../..'));
}

// 빠른 응답 후 백그라운드에서 처리
function quickResponse($success, $error = '') {
    echo json_encode(['success' => $success, 'error' => $error]);
    
    // 출력 플러시
    if (ob_get_level()) {
        ob_flush();
    }
    flush();
    
    // 클라이언트에 응답 전송 후에도 스크립트 계속 실행
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
}

$input = json_decode(file_get_contents('php://input'), true);
$code = $input['code'] ?? '';
$host_token = $input['host_token'] ?? '';

if ($code === '' || $host_token === '') { 
    quickResponse(false, 'invalid_params');
    exit; 
}

$collab_dir = rtrim(T2EDITOR_PATH, '/\\') . '/collab';
$code = preg_replace('/[^a-zA-Z0-9_-]/','',$code);
$path = $collab_dir . '/collab' . $code . '.json';

if (!file_exists($path)) { 
    quickResponse(false, 'no_room');
    exit; 
}

$json = @file_get_contents($path);
if ($json === false) {
    quickResponse(false, 'read_failed');
    exit;
}

$data = json_decode($json, true);
if (!is_array($data) || !isset($data['host_token']) || $data['host_token'] !== $host_token) {
    quickResponse(false, 'unauthorized');
    exit;
}

// 파일 삭제 시도 (최대 3번 재시도)
$maxRetries = 3;
$retryDelay = 100000; // 0.1초

for ($i = 0; $i < $maxRetries; $i++) {
    if (@unlink($path)) {
        quickResponse(true);
        exit;
    }
    
    // 마지막 시도가 아니면 잠시 대기
    if ($i < $maxRetries - 1) {
        usleep($retryDelay);
    }
}

quickResponse(false, 'delete_failed');
exit;
?>