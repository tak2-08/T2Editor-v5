<?php
//Path: T2Editor/plugin/image/image_upload.php

include_once('../../../../../common.php');
include_once('../../config/upload_config.php');

// 그누보드5 환경에서 T2EDITOR 상수 직접 정의
if (defined('_GNUBOARD_')) {
    define('T2EDITOR_PATH', G5_PLUGIN_PATH.'/editor/t2editor');
    define('T2EDITOR_URL', G5_PLUGIN_URL.'/editor/t2editor');
    define('T2EDITOR_DATA_PATH', G5_DATA_PATH.'/editor');
    define('T2EDITOR_DATA_URL', G5_DATA_URL.'/editor');
    define('T2EDITOR_DIR_PERMISSION', G5_DIR_PERMISSION);
    define('T2EDITOR_FILE_PERMISSION', G5_FILE_PERMISSION);
} else {
    // 타 환경에서만 t2_config.php 포함
    include_once('../../config/t2_config.php');
}

// 파일 권한 확인 및 설정 함수
function check_and_set_permission($file_path) {
    if (file_exists($file_path)) {
        $current_perm = substr(sprintf('%o', fileperms($file_path)), -3);
        if ($current_perm != '755') {
            @chmod($file_path, 0755);
        }
    }
    return true;
}

// 현재 스크립트의 경로 확인
$current_script_path = __FILE__;
check_and_set_permission($current_script_path);

$uid = isset($_POST['uid']) ? $_POST['uid'] : '';
if (!$uid) {
    die(json_encode(['success' => false, 'message' => '잘못된 접근입니다.']));
}

// 현재 날짜로 폴더명 생성 (예: 250302)
$date_folder = date('ymd');
$upload_dir = T2EDITOR_DATA_PATH . '/' . $date_folder;
$upload_url = T2EDITOR_DATA_URL . '/' . $date_folder;

// 폴더가 없으면 생성
if (!is_dir($upload_dir)) {
    @mkdir($upload_dir, T2EDITOR_DIR_PERMISSION, true);
    @chmod($upload_dir, T2EDITOR_DIR_PERMISSION);
}

$uploaded_files = [];

// 파일 업로드 처리
if (!isset($_FILES['bf_file'])) {
    die(json_encode(['success' => false, 'message' => '업로드할 파일이 없습니다.']));
}

// 파일 배열 확인
$files = $_FILES['bf_file'];
$file_count = is_array($files['name']) ? count($files['name']) : 1;

// webp 변환 품질 설정 (85%)
$webp_quality = 85;

for ($i = 0; $i < $file_count; $i++) {
    if (is_array($files['name'])) {
        $file = $files['tmp_name'][$i];
        $filename = $files['name'][$i];
        $file_size = $files['size'][$i];
        $file_error = $files['error'][$i];
    } else {
        $file = $files['tmp_name'];
        $filename = $files['name'];
        $file_size = $files['size'];
        $file_error = $files['error'];
    }

    // 파일 업로드 오류 검사
    if ($file_error !== UPLOAD_ERR_OK) {
        continue;
    }
    
    if (!isset($filename) || empty($filename)) {
        continue;
    }
    
    // 통합 설정을 사용한 파일 검증
    $validation_result = validate_upload_file($filename, $file_size, 'image');
    if (!$validation_result['success']) {
        continue;
    }
    
    // 원본 파일 확장자 추출
    $file_ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    
    // 먼저 원본 파일을 임시 위치에 이동
    $temp_filepath = $upload_dir . '/temp_' . $uid . '_' . $i . '.' . $file_ext;
    if (!move_uploaded_file($file, $temp_filepath)) {
        continue;
    }
    
    // 원본 이미지 정보 가져오기
    $image_info = @getimagesize($temp_filepath);
    if (!$image_info) {
        @unlink($temp_filepath);
        continue;
    }
    
    // 이미 WebP 형식인 경우 변환하지 않고 그대로 사용
    if ($file_ext === 'webp') {
        $save_filename = $uid . '_' . $i . '.webp';
        $save_filepath = $upload_dir . '/' . $save_filename;
        
        if (@rename($temp_filepath, $save_filepath)) {
            @chmod($save_filepath, T2EDITOR_FILE_PERMISSION);
            
            $uploaded_files[] = [
                'url' => $upload_url . '/' . $save_filename,
                'width' => $image_info[0],
                'height' => $image_info[1]
            ];
        } else {
            @unlink($temp_filepath);
        }
        continue;
    }
    
    // WebP가 아닌 이미지 형식을 WebP로 변환
    $save_filename = $uid . '_' . $i . '.webp';
    $save_filepath = $upload_dir . '/' . $save_filename;
    
    $success = false;
    $src_image = null;
    
    // 이미지 리소스 생성
    switch ($file_ext) {
        case 'jpg':
        case 'jpeg':
            $src_image = @imagecreatefromjpeg($temp_filepath);
            break;
        case 'png':
            $src_image = @imagecreatefrompng($temp_filepath);
            if ($src_image) {
                // PNG 투명 배경 처리
                imagepalettetotruecolor($src_image);
                imagealphablending($src_image, false);
                imagesavealpha($src_image, true);
            }
            break;
        case 'gif':
            $src_image = @imagecreatefromgif($temp_filepath);
            break;
        case 'bmp':
            $src_image = @imagecreatefrombmp($temp_filepath);
            break;
    }
    
    // 이미지 리소스 생성 확인
    if ($src_image) {
        // 이미지 크기 제한 (최대 9000px)
        $original_width = $image_info[0];
        $original_height = $image_info[1];
        $max_dimension = 9000;
        
        if ($original_width > $max_dimension || $original_height > $max_dimension) {
            $ratio = min($max_dimension / $original_width, $max_dimension / $original_height);
            $new_width = floor($original_width * $ratio);
            $new_height = floor($original_height * $ratio);
            
            $resized_image = imagecreatetruecolor($new_width, $new_height);
            
            // 투명 배경 처리
            if ($file_ext === 'png') {
                imagealphablending($resized_image, false);
                imagesavealpha($resized_image, true);
                $transparent = imagecolorallocatealpha($resized_image, 255, 255, 255, 127);
                imagefill($resized_image, 0, 0, $transparent);
            }
            
            imagecopyresampled($resized_image, $src_image, 0, 0, 0, 0, $new_width, $new_height, $original_width, $original_height);
            imagedestroy($src_image);
            $src_image = $resized_image;
            
            // 새로운 크기로 업데이트
            $image_info[0] = $new_width;
            $image_info[1] = $new_height;
        }
        
        // WebP 형식으로 저장 시도
        if (function_exists('imagewebp')) {
            $success = @imagewebp($src_image, $save_filepath, $webp_quality);
        }
        imagedestroy($src_image);
        
        if ($success) {
            @chmod($save_filepath, T2EDITOR_FILE_PERMISSION);
            
            $uploaded_files[] = [
                'url' => $upload_url . '/' . $save_filename,
                'width' => $image_info[0],
                'height' => $image_info[1]
            ];
            
            @unlink($temp_filepath);
            continue;
        }
    }
    
    // WebP 변환 실패 시 원본 이미지 사용
    $org_save_filename = $uid . '_' . $i . '.' . $file_ext;
    $org_save_filepath = $upload_dir . '/' . $org_save_filename;
    
    if (@rename($temp_filepath, $org_save_filepath)) {
        @chmod($org_save_filepath, T2EDITOR_FILE_PERMISSION);
        
        $uploaded_files[] = [
            'url' => $upload_url . '/' . $org_save_filename,
            'width' => $image_info[0],
            'height' => $image_info[1]
        ];
    } else {
        @unlink($temp_filepath);
    }
}

if (empty($uploaded_files)) {
    die(json_encode(['success' => false, 'message' => '업로드된 이미지가 없습니다.']));
}

die(json_encode([
    'success' => true,
    'files' => $uploaded_files
]));
?>