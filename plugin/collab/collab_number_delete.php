<?php
// Path: T2Editor/plugin/collab/collab_number_delete.php

if (!defined('T2EDITOR_PATH')) {
    $possible = __DIR__ . '/../../config/t2_config.php';
    if (file_exists($possible)) {
        include_once $possible;
    }
}
if (!defined('T2EDITOR_PATH')) {
    define('T2EDITOR_PATH', realpath(__DIR__ . '/../..'));
}

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
$code = $input['code'] ?? '';
$host_token = $input['host_token'] ?? '';

if ($code === '' || $host_token === '') { 
    echo json_encode(['success'=>false,'error'=>'invalid_params']); 
    exit; 
}

$collab_dir = rtrim(T2EDITOR_PATH, '/\\') . '/collab';
$code = preg_replace('/[^a-zA-Z0-9_-]/','',$code);
$path = $collab_dir . '/collab' . $code . '.json';

if (!file_exists($path)) { 
    echo json_encode(['success'=>false,'error'=>'no_room']); 
    exit; 
}

$json = @file_get_contents($path);
if ($json === false) {
    echo json_encode(['success'=>false,'error'=>'read_failed']); 
    exit;
}

$data = json_decode($json, true);
if (!is_array($data) || !isset($data['host_token']) || $data['host_token'] !== $host_token) {
    echo json_encode(['success'=>false,'error'=>'unauthorized']); 
    exit;
}

if (@unlink($path)) {
    echo json_encode(['success'=>true]);
} else {
    echo json_encode(['success'=>false,'error'=>'delete_failed']);
}
exit;
?>