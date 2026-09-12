<?php
// Path: T2Editor/plugin/collab/collab_number.php

if (!defined('T2EDITOR_PATH')) {
    $possible = __DIR__ . '/../../config/t2_config.php';
    if (file_exists($possible)) include_once $possible;
}
if (!defined('T2EDITOR_PATH')) {
    define('T2EDITOR_PATH', realpath(__DIR__ . '/../..'));
    define('T2EDITOR_DIR_PERMISSION', 0755);
    define('T2EDITOR_FILE_PERMISSION', 0644);
}

header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? 'create';

$collab_dir = rtrim(T2EDITOR_PATH, '/\\') . '/collab';
if (!is_dir($collab_dir)) {
    if (!@mkdir($collab_dir, T2EDITOR_DIR_PERMISSION, true)) {
        error_log("Failed to create collab directory: $collab_dir");
        http_response_code(500);
        echo json_encode(['success'=>false,'error'=>'directory_creation_failed']);
        exit;
    }
    @chmod($collab_dir, T2EDITOR_DIR_PERMISSION);
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
        error_log("JSON encoding failed for file: $file");
        return false;
    }
    
    $tmp = $file . '.tmp.' . uniqid();
    $bytes = @file_put_contents($tmp, $json, LOCK_EX);
    if ($bytes === false) {
        error_log("Failed to write temp file: $tmp");
        return false;
    }
    
    if (!@chmod($tmp, 0644)) {
        error_log("Failed to chmod temp file: $tmp");
    }
    
    if (!@rename($tmp, $file)) {
        error_log("Failed to rename $tmp to $file");
        @unlink($tmp);
        return false;
    }
    
    return true;
}

function generate_room_code() {
    $tries = 0;
    do {
        try { 
            $code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT) . substr(bin2hex(random_bytes(2)), 0, 2); 
        } catch (Exception $e) { 
            $code = str_pad(mt_rand(100000,999999), 6, '0', STR_PAD_LEFT) . dechex(mt_rand(0,65535)); 
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
            http_response_code(500); 
            echo json_encode(['success'=>false,'error'=>'file_write_failed']); 
            exit;
        }
        
        echo json_encode(['success'=>true,'code'=>$code,'host_token'=>$host_token]); 
        exit;

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
                    'modified'=>false,
                    'version'=>$data['version']
                ]);
                exit;
            } else {
                echo json_encode([
                    'success'=>true,
                    'modified'=>true,
                    'version'=>$data['version'],
                    'ops'=>$ops,
                    'data'=>[
                        'content'=>$data['content'],
                        'version'=>$data['version'],
                        'users'=>$data['users'] ?? []
                    ]
                ]); 
                exit;
            }
        } else {
            $out = $data;
            unset($out['host_token']);
            echo json_encode(['success'=>true,'modified'=>true,'data'=>$out]); 
            exit;
        }

    case 'join':
        $code = $input['code'] ?? '';
        $nickname = trim($input['nickname'] ?? '');
        $client_id = trim($input['client_id'] ?? '');
        
        if ($code === '' || $nickname === '' || $client_id === '') { 
            echo json_encode(['success'=>false,'error'=>'invalid_params']); 
            exit; 
        }
        
        $path = code_to_path($code);
        if (!file_exists($path)) { 
            echo json_encode(['success'=>false,'error'=>'no_room']); 
            exit; 
        }

        $fp = fopen($path, 'c+'); 
        if (!$fp) { 
            echo json_encode(['success'=>false,'error'=>'file_open_failed']); 
            exit; 
        }
        
        if (flock($fp, LOCK_EX)) {
            $json = stream_get_contents($fp);
            $data = json_decode($json, true);
            if (!is_array($data)) {
                $data = ['content'=>'','version'=>0,'ops'=>[],'users'=>[]];
            }
            
            $ip = get_client_ip();

            $foundIndex = null;
            foreach ($data['users'] as $i => $u) {
                if (isset($u['client_id']) && $u['client_id'] === $client_id) { 
                    $foundIndex = $i; 
                    break; 
                }
            }

            $baseNick = $nickname; 
            $nickFinal = $baseNick; 
            $sameCount = 0;
            foreach ($data['users'] as $u) {
                if (($u['nickname'] ?? '') === $baseNick && ($u['client_id'] ?? '') !== $client_id) {
                    $sameCount++;
                }
            }
            if ($sameCount > 0) {
                $nickFinal = $baseNick . ' (' . ($sameCount + 1) . ')';
            }

            if ($foundIndex !== null) {
                $data['users'][$foundIndex]['nickname'] = $nickFinal;
                $data['users'][$foundIndex]['ip'] = $ip;
                $data['users'][$foundIndex]['last_active'] = now_ts();
            } else {
                $data['users'][] = [
                    'nickname'=>$nickFinal,
                    'client_id'=>$client_id,
                    'ip'=>$ip,
                    'joined_at'=>now_ts(),
                    'last_active'=>now_ts(),
                    'isHost'=>false
                ];
            }
            
            $data['updated_at'] = now_ts();
            
            ftruncate($fp, 0); 
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            fflush($fp); 
            flock($fp, LOCK_UN); 
            fclose($fp);

            $resp = $data; 
            unset($resp['host_token']);
            echo json_encode(['success'=>true,'data'=>$resp,'nickname'=>$nickFinal]); 
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

    case 'apply_op':
        $code = $input['code'] ?? '';
        $client_id = trim($input['client_id'] ?? '');
        $base_version = isset($input['base_version']) ? intval($input['base_version']) : null;
        $diff = $input['diff'] ?? null;
        $ts = $input['ts'] ?? now_ts();

        if ($code === '' || $client_id === '' || !is_array($diff) || $base_version === null) {
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
        if (!is_array($data)) { 
            $data = ['content'=>'','version'=>0,'ops'=>[],'users'=>[]]; 
        }

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
        
        // 전체 HTML 콘텐츠 업데이트
        if ($diff['type'] === 'full') {
            $newContent = $diff['content'] ?? '';
            
            // 내용이 실제로 변경된 경우에만 업데이트 (불필요한 파일 쓰기 방지)
            if ($data['content'] !== $newContent) {
                $data['content'] = $newContent;
                $data['version'] = $current_version + 1;
                $data['updated_at'] = now_ts();
                
                // 연산 기록
                $op_record = [
                    'type' => 'full',
                    'content' => $newContent,
                    'client_id' => $client_id ?? '',
                    'ts' => $ts ?? now_ts(),
                    'version' => $data['version']
                ];
                
                if (!isset($data['ops']) || !is_array($data['ops'])) $data['ops'] = [];
                $data['ops'][] = $op_record;
                
                $MAX_OPS = 500; // 1000 → 500으로 줄임 (메모리 최적화)
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
                'version'=>$data['version'],
                'content'=>$data['content']
            ]);
            exit;
        }
        
        // 기타 diff 타입 처리
        flock($fp, LOCK_UN); 
        fclose($fp);
        echo json_encode(['success'=>false,'error'=>'unsupported_diff_type']);
        exit;

    default:
        echo json_encode(['success'=>false,'error'=>'invalid_action']); 
        exit;
}
?>