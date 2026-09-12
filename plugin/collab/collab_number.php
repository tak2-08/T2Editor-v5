<?php
// Path: T2Editor/plugin/collab/collab_number.php

if (!defined('T2EDITOR_PATH')) {
    $possible = __DIR__ . '/../../config/t2_config.php';
    if (file_exists($possible)) include_once $possible;
}
if (!defined('T2EDITOR_PATH')) {
    define('T2EDITOR_PATH', realpath(__DIR__ . '/../..'));
    define('T2EDITOR_DIR_PERMISSION', 0777);
    define('T2EDITOR_FILE_PERMISSION', 0777);
}

header('Content-Type: application/json; charset=utf-8');

// 에러 로깅 활성화
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? 'create';

// collab 디렉토리 절대 경로
$collab_dir = T2EDITOR_PATH . '/collab';

// 강제 권한 설정 함수
function ensure_directory_permissions($dir) {
    if (!is_dir($dir)) {
        $oldmask = umask(0);
        $created = @mkdir($dir, 0777, true);
        umask($oldmask);
        
        if (!$created) {
            error_log("Failed to create directory: $dir - " . error_get_last()['message']);
            return false;
        }
    }
    
    // 항상 권한 설정 시도 (이미 존재하는 경우에도)
    $oldmask = umask(0);
    $chmod_result = @chmod($dir, 0777);
    umask($oldmask);
    
    if (!$chmod_result) {
        error_log("Failed to chmod directory: $dir - " . error_get_last()['message']);
    }
    
    // 하위 디렉토리들도 권한 확인
    $oldmask = umask(0);
    @chmod($dir, 0777);
    umask($oldmask);
    
    return is_writable($dir);
}

// 디렉토리 생성 및 권한 설정
if (!ensure_directory_permissions($collab_dir)) {
    error_log("Collab directory permission failed: $collab_dir");
    http_response_code(500);
    echo json_encode(['success'=>false,'error'=>'directory_creation_failed', 'path'=>$collab_dir]);
    exit;
}

// 디렉토리 쓰기 권한 확인 (이중 확인)
if (!is_writable($collab_dir)) {
    // 마지막 시도: 강제 권한 설정
    $oldmask = umask(0);
    @chmod($collab_dir, 0777);
    umask($oldmask);
    
    if (!is_writable($collab_dir)) {
        error_log("Collab directory is not writable: $collab_dir - permissions: " . substr(sprintf('%o', fileperms($collab_dir)), -4));
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'directory_not_writable', 'path'=>$collab_dir]);
        exit;
    }
}

function now_ts() { return date('c'); }

function code_to_path($code) {
    global $collab_dir;
    $code = preg_replace('/[^a-zA-Z0-9_-]/', '', $code);
    return $collab_dir . '/collab' . $code . '.json';
}

function safe_write_json($file, $data) {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        error_log("JSON encoding failed for file: $file - " . json_last_error_msg());
        return false;
    }
    
    $tmp = $file . '.tmp.' . uniqid(mt_rand(), true);
    
    $oldmask = umask(0);
    $bytes = @file_put_contents($tmp, $json, LOCK_EX);
    umask($oldmask);
    
    if ($bytes === false) {
        error_log("Failed to write temp file: $tmp - " . error_get_last()['message']);
        return false;
    }
    
    // 임시 파일 권한 강제 설정
    $oldmask = umask(0);
    @chmod($tmp, 0666);
    umask($oldmask);
    
    if (!@rename($tmp, $file)) {
        error_log("Failed to rename $tmp to $file - " . error_get_last()['message']);
        @unlink($tmp);
        return false;
    }
    
    // 최종 파일 권한 강제 설정
    $oldmask = umask(0);
    @chmod($file, 0666);
    umask($oldmask);
    
    return true;
}

function generate_room_code() {
    $tries = 0;
    do {
        try { 
            $code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT) . substr(bin2hex(random_bytes(2)), 0, 2); 
        } catch (Exception $e) { 
            $code = str_pad(mt_rand(100000,999999), 6, '0', STR_PAD_LEFT) . substr(md5(uniqid(mt_rand(), true)), 0, 2); 
        }
        $path = code_to_path($code);
        $tries++; 
        if ($tries > 20) break;
    } while (file_exists($path));
    return $code;
}

function get_client_ip() {
    if (defined('_GNUBOARD_') && function_exists('get_client_ip')) return get_client_ip();
    $keys = ['HTTP_CLIENT_IP','HTTP_X_FORWARDED_FOR','HTTP_X_FORWARDED','HTTP_X_CLUSTER_CLIENT_IP','HTTP_FORWARDED_FOR','HTTP_FORWARDED','REMOTE_ADDR'];
    foreach ($keys as $k) {
        if (!empty($_SERVER[$k])) {
            $ip = $_SERVER[$k];
            if (strpos($ip, ',') !== false) { 
                $ips = explode(',', $ip); 
                $ip = trim($ips[0]); 
            }
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return 'unknown';
}

function load_collab_file($path) {
    if (!file_exists($path)) return null;
    $json = @file_get_contents($path);
    if ($json === false) return null;
    $data = json_decode($json, true);
    if (!is_array($data)) return null;
    if (!isset($data['version'])) $data['version'] = 0;
    if (!isset($data['ops'])) $data['ops'] = [];
    if (!isset($data['content'])) $data['content'] = '';
    return $data;
}

switch ($action) {

    case 'create':
        $code = generate_room_code();
        $path = code_to_path($code);
        
        try {
            $host_token = bin2hex(random_bytes(16));
        } catch (Exception $e) {
            $host_token = md5(uniqid(mt_rand(), true));
        }
        
        $data = [
            'code'=>$code,
            'content'=>'',
            'version'=>0,
            'ops'=>[],
            'users'=>[],
            'created_at'=>now_ts(),
            'updated_at'=>now_ts(),
            'host_token'=>$host_token
        ];
        
        if (!safe_write_json($path, $data)) {
            error_log("safe_write_json failed for path: $path");
            http_response_code(500); 
            echo json_encode(['success'=>false,'error'=>'file_write_failed', 'path'=>$path]); 
            exit;
        }
        
        // 생성 확인 및 최종 권한 확인
        if (!file_exists($path)) {
            error_log("File was not created: $path");
            http_response_code(500);
            echo json_encode(['success'=>false,'error'=>'file_not_created', 'path'=>$path]);
            exit;
        }
        
        // 파일 권한 한번 더 확인
        $oldmask = umask(0);
        @chmod($path, 0666);
        umask($oldmask);
        
        if (!is_writable($path)) {
            error_log("Created file is not writable: $path - permissions: " . substr(sprintf('%o', fileperms($path)), -4));
            http_response_code(500);
            echo json_encode(['success'=>false,'error'=>'file_not_writable', 'path'=>$path]);
            exit;
        }
        
        echo json_encode(['success'=>true,'code'=>$code,'host_token'=>$host_token]); 
        exit;

    // ... (나머지 case 문들은 동일하게 유지)
    case 'exists':
        $code = $input['code'] ?? '';
        if ($code === '') { 
            echo json_encode(['success'=>false]); 
            exit; 
        }
        $path = code_to_path($code);
        echo json_encode(['success'=>file_exists($path)]); 
        exit;

    case 'get':
        $code = $input['code'] ?? '';
        $since_version = isset($input['since_version']) ? intval($input['since_version']) : null;
        
        if ($code === '') { 
            echo json_encode(['success'=>false,'error'=>'no_code']); 
            exit; 
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) { 
            echo json_encode(['success'=>false,'error'=>'no_room']); 
            exit; 
        }
        
        $data = load_collab_file($path);
        if ($data === null) { 
            echo json_encode(['success'=>false,'error'=>'load_failed']); 
            exit; 
        }

        if ($since_version !== null) {
            $ops = [];
            foreach ($data['ops'] as $o) {
                if (isset($o['version']) && $o['version'] > $since_version) {
                    $ops[] = $o;
                }
            }
            
            if (count($ops) === 0) {
                echo json_encode([
                    'success'=>true,
                    'has_updates'=>false,
                    'data'=>[
                        'version'=>$data['version'],
                        'content'=>$data['content'],
                        'users'=>$data['users']
                    ]
                ]);
                exit;
            }
            
            echo json_encode([
                'success'=>true,
                'has_updates'=>true,
                'data'=>[
                    'version'=>$data['version'],
                    'content'=>$data['content'],
                    'ops'=>$ops,
                    'users'=>$data['users']
                ]
            ]);
            exit;
        }
        
        echo json_encode([
            'success'=>true,
            'data'=>[
                'version'=>$data['version'],
                'content'=>$data['content'],
                'users'=>$data['users']
            ]
        ]);
        exit;

    case 'join':
        $code = $input['code'] ?? '';
        $client_id = trim($input['client_id'] ?? '');
        $nickname = trim($input['nickname'] ?? '익명');
        
        if ($code === '' || $client_id === '') {
            echo json_encode(['success'=>false,'error'=>'invalid_params']);
            exit;
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) {
            echo json_encode(['success'=>false,'error'=>'no_room']);
            exit;
        }
        
        $fp = fopen($path,'c+');
        if (!$fp) {
            echo json_encode(['success'=>false,'error'=>'file_open_failed']);
            exit;
        }
        
        if (flock($fp, LOCK_EX)) {
            $json = stream_get_contents($fp);
            $data = json_decode($json, true);
            if (!is_array($data)) $data = [];
            
            $is_host = false;
            $host_token = null;
            
            if (!isset($data['users'])) $data['users'] = [];
            
            if (count($data['users']) === 0) {
                $is_host = true;
                $host_token = $data['host_token'] ?? '';
            }
            
            $existing = false;
            foreach ($data['users'] as &$u) {
                if (($u['client_id'] ?? '') === $client_id) {
                    $u['nickname'] = $nickname;
                    $u['joined_at'] = now_ts();
                    $existing = true;
                    break;
                }
            }
            
            if (!$existing) {
                $data['users'][] = [
                    'client_id'=>$client_id,
                    'nickname'=>$nickname,
                    'joined_at'=>now_ts(),
                    'isHost'=>$is_host
                ];
            }
            
            $data['updated_at'] = now_ts();
            
            ftruncate($fp,0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
            fclose($fp);
            
            echo json_encode([
                'success'=>true,
                'is_host'=>$is_host,
                'host_token'=>$host_token,
                'data'=>[
                    'version'=>$data['version'],
                    'content'=>$data['content'],
                    'users'=>$data['users']
                ]
            ]);
            exit;
        } else {
            fclose($fp);
            echo json_encode(['success'=>false,'error'=>'lock_failed']);
            exit;
        }

    case 'leave':
        $code = $input['code'] ?? '';
        $client_id = trim($input['client_id'] ?? '');
        
        if ($code === '' || $client_id === '') {
            echo json_encode(['success'=>false,'error'=>'invalid_params']);
            exit;
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) {
            echo json_encode(['success'=>false,'error'=>'no_room']);
            exit;
        }
        
        $fp = fopen($path,'c+');
        if (!$fp) {
            echo json_encode(['success'=>false,'error'=>'file_open_failed']);
            exit;
        }
        
        if (flock($fp, LOCK_EX)) {
            $json = stream_get_contents($fp);
            $data = json_decode($json, true);
            if (!is_array($data)) $data = [];
            
            $newUsers = [];
            foreach ($data['users'] as $u) {
                if (($u['client_id'] ?? '') === $client_id) continue;
                $newUsers[] = $u;
            }
            $data['users'] = $newUsers;
            $data['updated_at'] = now_ts();
            
            ftruncate($fp,0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
            fclose($fp);
            
            echo json_encode(['success'=>true]);
            exit;
        } else {
            fclose($fp);
            echo json_encode(['success'=>false,'error'=>'lock_failed']);
            exit;
        }

    case 'stop':
        $code = $input['code'] ?? '';
        $host_token = $input['host_token'] ?? '';
        
        if ($code === '' || $host_token === '') {
            echo json_encode(['success'=>false,'error'=>'invalid_params']);
            exit;
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) {
            echo json_encode(['success'=>false,'error'=>'no_room']);
            exit;
        }
        
        $data = load_collab_file($path);
        if (!$data || !isset($data['host_token']) || $data['host_token'] !== $host_token) {
            echo json_encode(['success'=>false,'error'=>'unauthorized']);
            exit;
        }
        
        if (@unlink($path)) {
            echo json_encode(['success'=>true]);
        } else {
            echo json_encode(['success'=>false,'error'=>'delete_failed']);
        }
        exit;

    case 'update':
        $code = $input['code'] ?? '';
        $client_id = trim($input['client_id'] ?? '');
        $version = isset($input['version']) ? intval($input['version']) : 0;
        $diff = $input['diff'] ?? null;
        
        if ($code === '' || $client_id === '' || !is_array($diff)) {
            echo json_encode(['success'=>false,'error'=>'invalid_params']);
            exit;
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) {
            echo json_encode(['success'=>false,'error'=>'no_room']);
            exit;
        }
        
        $fp = fopen($path,'c+');
        if (!$fp) {
            echo json_encode(['success'=>false,'error'=>'file_open_failed']);
            exit;
        }
        
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            echo json_encode(['success'=>false,'error'=>'lock_failed']);
            exit;
        }
        
        $json = stream_get_contents($fp);
        $data = json_decode($json, true);
        if (!is_array($data)) $data = ['content'=>'','version'=>0,'ops'=>[],'users'=>[]];
        
        $allowed = false;
        if (isset($input['host_token']) && isset($data['host_token']) && $input['host_token'] === $data['host_token']) {
            $allowed = true;
        }
        foreach ($data['users'] as $u) {
            if (isset($u['client_id']) && $u['client_id'] === $client_id) {
                $allowed = true;
                break;
            }
        }
        
        if (!$allowed) {
            flock($fp, LOCK_UN);
            fclose($fp);
            echo json_encode(['success'=>false,'error'=>'not_allowed']);
            exit;
        }
        
        $current_version = isset($data['version']) ? intval($data['version']) : 0;
        
        if ($version < $current_version) {
            flock($fp, LOCK_UN);
            fclose($fp);
            echo json_encode([
                'success'=>false,
                'conflict'=>true,
                'current_version'=>$current_version,
                'current_content'=>$data['content']
            ]);
            exit;
        }
        
        if ($diff['type'] === 'full') {
            $newContent = $diff['content'] ?? '';
            
            if ($data['content'] !== $newContent) {
                $data['content'] = $newContent;
                $data['version'] = $current_version + 1;
                $data['updated_at'] = now_ts();
                
                $op_record = [
                    'type' => 'full',
                    'content' => $newContent,
                    'client_id' => $client_id,
                    'ts' => $diff['timestamp'] ?? now_ts(),
                    'version' => $data['version']
                ];
                
                if (!isset($data['ops']) || !is_array($data['ops'])) $data['ops'] = [];
                $data['ops'][] = $op_record;
                
                $MAX_OPS = 500;
                if (count($data['ops']) > $MAX_OPS) {
                    $data['ops'] = array_slice($data['ops'], -$MAX_OPS);
                }
                
                ftruncate($fp,0);
                rewind($fp);
                fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                fflush($fp);
            }
            
            flock($fp, LOCK_UN);
            fclose($fp);
            
            echo json_encode([
                'success'=>true,
                'new_version'=>$data['version']
            ]);
            exit;
        }
        
        flock($fp, LOCK_UN);
        fclose($fp);
        echo json_encode(['success'=>false,'error'=>'unsupported_diff_type']);
        exit;

    case 'kick':
        $code = $input['code'] ?? '';
        $target_client_id = trim($input['target_client_id'] ?? '');
        $host_token = $input['host_token'] ?? '';
        
        if ($code === '' || $target_client_id === '' || $host_token === '') {
            echo json_encode(['success'=>false,'error'=>'invalid_params']);
            exit;
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) {
            echo json_encode(['success'=>false,'error'=>'no_room']);
            exit;
        }
        
        $fp = fopen($path,'c+');
        if (!$fp) {
            echo json_encode(['success'=>false,'error'=>'file_open_failed']);
            exit;
        }
        
        if (flock($fp, LOCK_EX)) {
            $json = stream_get_contents($fp);
            $data = json_decode($json, true);
            if (!is_array($data)) $data = [];
            
            if (!isset($data['host_token']) || $data['host_token'] !== $host_token) {
                flock($fp, LOCK_UN);
                fclose($fp);
                echo json_encode(['success'=>false,'error'=>'unauthorized']);
                exit;
            }
            
            $newUsers = [];
            foreach ($data['users'] as $u) {
                if (($u['client_id'] ?? '') === $target_client_id) continue;
                $newUsers[] = $u;
            }
            $data['users'] = $newUsers;
            $data['updated_at'] = now_ts();
            
            ftruncate($fp,0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
            fclose($fp);
            
            echo json_encode(['success'=>true]);
            exit;
        } else {
            fclose($fp);
            echo json_encode(['success'=>false,'error'=>'lock_failed']);
            exit;
        }

    default:
        echo json_encode(['success'=>false,'error'=>'invalid_action']);
        exit;
}

@chmod(__FILE__, 0644);
?>
[file content end]