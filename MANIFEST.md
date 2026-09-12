# T2Editor v5 배포본 매니페스트

**상태: EOL (지원 종료) — 이 계열의 모든 판본**
판본 32건 · 출처 시점 2026-09-27 · 배포 API `https://dsclub.kr/api/t2editor/version/index.php?action=list`

릴리즈 노트에 실리는 배포 설명 전문을 옮긴 기록이다.

---

## 1. v5.1.0-beta1.0.2

- **상태: EOL**
- 배포일: 2025-10-11
- 저장소 표제: T2Editor Ver 5.1.0-beta1.0.2 - (그누보드5 에디터 플러그인) <신기능 체험판 |
- 브랜치: `releases/v5.1.0-beta1.0.2` · 태그: `v5.1.0-beta1.0.2`
- ZIP: `5.1.0beta1-0-2.zip` (1209205 bytes)
- sha256: `598c8d08b012ffb59797c031bd0a032a41d9e0c0280dce3a5755e31f614e3cd5`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `17473399314892c3c3cc5087e6f610b1168df16a9b999293fe5b704506091d4e`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.1.0-beta1.0.2&file=0>
- 판본 성격: **베타/체험판** — 정식 판본이 아니다.

### 배포 설명

```text
[협업 기능 추가] - /plugin/collab/collab.js, /collab
/css/core.css, /css/dark.css, /js/utils.js 수정됨

*협업 방 생성 실패 메시지가 뜰 경우 sudo chmod 755 /path/t2editor/collab 으로 해결. /path는 사용자 환경에 맞게 변경
```

---

## 2. v5.0.0

- **상태: EOL**
- 배포일: 2025-10-08
- 저장소 표제: T2Editor 5.0.0
- 브랜치: `releases/v5.0.0` · 태그: `v5.0.0`
- ZIP: `5.0.0.zip` (1196514 bytes)
- sha256: `dd7903093fc2c03607c0396c158250b081072d1fd811117755afad9ca5bfd384`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `2568d83ee28cd46c28e668f31be8756f62732f71f638c21babc95a9b4c7712c3`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.0.0&file=0>

### 배포 설명

```text
그누보드5 환경뿐만아니라 다른 apache/nginx & php7.5+ 환경에서 호환 가능하도록 기존 호환 코드를 강화. (editor.lib.php, config/t2_config.php)
*그누보드5가 아닌 타 환경에서는 기존 그누보드5의 폼 제출 코드가 작동하지 않도록 수정
*그누보드5가 아닌 타 환경은 직접 폼 제출 부분을 구현하셔야 합니다.
```

---

## 3. v5.0.1

- **상태: EOL**
- 배포일: 2025-10-19
- 저장소 표제: T2Editor 5.0.1
- 브랜치: `releases/v5.0.1` · 태그: `v5.0.1`
- ZIP: `5.0.1.zip` (1192882 bytes)
- sha256: `4bb2df42be965a45a37aa79699f3027a6d7a2dd26aee7f45a3ef56af6efce932`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `cf7b255381fc8e6f272aee22003010629addf36f27222ef76c155f320b1c485c`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.0.1&file=0>

### 배포 설명

```text
라이센스 검증 오작동 및 에디터 경로 오류 수정 (/config/t2_config.php)
툴바 사용성 개선 (/js/core.js)
```

---

## 4. v5.1.0

- **상태: EOL**
- 배포일: 2025-10-21
- 저장소 표제: T2Editor 5.1.0
- 브랜치: `releases/v5.1.0` · 태그: `v5.1.0`
- ZIP: `5.1.0.zip` (1207629 bytes)
- sha256: `79375e91402a22982aa4676483488bd1a29fbaf4779e80a5945fab6aa08e3610`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `97b87aec011336e82700273f8a4f2dc6910b92ce3a75ba25a47370d51148209a`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.1.0&file=0>

### 배포 설명

```text
수정사항:
[협업 기능 추가] - /plugin/collab/collab.js, /collab 추가
/css/core.css, /css/dark.css, /js/utils.js 수정
*5.1.0beta의 collab 플러그인 스타일 수정 및 5.1.0의 editor.lib.php,core.js에 5.0.1의 editor.lib.php, core.js 적용
*5.0.1의 툴바 사용성 개선 (/js/core.js)

*협업 방 생성 실패 메시지가 뜰 경우 sudo chmod 755 /path/t2editor/collab 으로 해결. /path는 사용자 환경에 맞게 변경
```

---

## 5. v5.1.1

- **상태: EOL**
- 배포일: 2025-10-21
- 저장소 표제: T2Editor 5.1.1
- 브랜치: `releases/v5.1.1` · 태그: `v5.1.1`
- ZIP: `5.1.1.zip` (1208026 bytes)
- sha256: `85919922152422535836ac1f1b712f987e60580218a8ba49c2822d63f722854b`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `eb7cbab3fcf15c77527e80e31735101570ff56665aa0d60fedbff2a27baf4093`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.1.1&file=0>

### 배포 설명

```text
협업 플러그인의 방 생성 파일 collab_number.php의 권한 부여 실패로 인한 방 생성 오류 문제 해결 (/plugin/collab/collab_number.php)
```

---

## 6. v5.1.2

- **상태: EOL**
- 배포일: 2025-11-03
- 저장소 표제: T2Editor 5.1.2
- 브랜치: `releases/v5.1.2` · 태그: `v5.1.2`
- ZIP: `5.1.2.zip` (1193525 bytes)
- sha256: `4f35243ee2e8a73b5b7f552979e313c1d5afa394b439776254b116d7fc595f55`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `06cdd2ac9633837f2de0eec2e7230d597ca2eba9e7d58d037c5e3c9a0de2f03a`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.1.2&file=0>

### 배포 설명

```text
1. 협업 플러그인 권한 부여 관련 수정
- collab_number.php의 /collab 권한 부여 코드 삭제 (/t2editor/plugin/collab/collab_number.php)
- collab_verification.php가 협업 플러그인 실행 전 /collab 의 권한 확인 후 진행하도록 수정 (collab_verification.php는 권한 부여를 하지 못하고 오로지 검증만 가능, 권한 부여는 파일질라 또는 터미널을 통해 수동으로 707 권한을 부여해야 함) (/t2editor/plugin/collab/collab_verification.php)

2. 협업 플러그인 사용성 수정
- 협업 플러그인의 여러 사용자 편집 시 충돌 발생 오류 수정 (/t2editor/plugin/collab/collab.js, /t2editor/plugin/collab/collab_number.php)
- 협업 플러그인 실행 후 상대 이용자가 미디어, 테이블, 코드, 파일 블록 수정 또는 조작 및 편집 시 충돌 발생 오류 해결 (/t2editor/plugin/collab/collab.js, /t2editor/plugin/image/image.js, /t2editor/plugin/video/video.js, /t2editor/plugin/table/table.js, /t2editor/plugin/link/link.js, /t2editor/plugin/file/file.js, /t2editor/plugin/code/code.js)

3. 테이블 플러그인 수정
- 테이즐 블록 추가 및 수정 모달이 테이블 추가 후 자동으로 숨겨지지 않는 문제 수정 (/t2editor/plugin/table/table.js)
```

---

## 7. v5.1.3

- **상태: EOL**
- 배포일: 2025-11-03
- 저장소 표제: T2Editor 5.1.3
- 브랜치: `releases/v5.1.3` · 태그: `v5.1.3`
- ZIP: `5.1.3.zip` (1195068 bytes)
- sha256: `ef21615f1090c64c3b7e35d93f646949c2f13cb7ed57419bcbb3539637a6ffc6`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `caf209ab7f6150bc0e31f40c1199843b6847842249bb92e2a8bc92364a1b6d8e`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.1.3&file=0>

### 배포 설명

```text
링크 플러그인 작동 불가 오류 해결 (/t2editor/plugin/link/link.js)
```

---

## 8. v5.2.0

- **상태: EOL**
- 배포일: 2025-11-04
- 저장소 표제: T2Editor 5.2.0
- 브랜치: `releases/v5.2.0` · 태그: `v5.2.0`
- ZIP: `5.2.0.zip` (1201359 bytes)
- sha256: `44ce4e270b81b39898e2bb552a33ce50cac3879d0463fc3ec9a029ea83c18269`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `b02da709c58305d0674a72196d55d16dbd0537d2c3acf76d57d0d8d8c7b14d48`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.2.0&file=0>

### 배포 설명

```text
그림 플러그인과의 호환성 수정 (/t2editor/editor.lib.php)
그림 그리기 플러그인 추가 (/t2editor/plugin/draw/draw.js, /t2editor/css/core.css, /t2editor/css/dark.css, /t2editor/js/core.js)
```

---

## 9. v5.2.1

- **상태: EOL**
- 배포일: 2025-11-05
- 저장소 표제: T2Editor 5.2.1
- 브랜치: `releases/v5.2.1` · 태그: `v5.2.1`
- ZIP: `5.2.1.zip` (1200319 bytes)
- sha256: `98ec2f00b661e4b878abfa7355161b663e2ed59dcc86aeefd30983a0206a226e`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `2642e552fb3cacf5408fb62f8e28f2651418c50c0c59efbad5890c62bfd4d115`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.2.1&file=0>

### 배포 설명

```text
그림 플러그인 스타일 향상 (/t2editor/plugin/draw.js, /t2editor/css/core.css, /t2editor/css/dark.css)
이미지 플러그인의 이미지 링크를 통한 이미지 업로드 기능 제거 (수요 적음으로 판단) (/t2editor/plugin/image/image.js)
```

---

## 10. v5.2.2

- **상태: EOL**
- 배포일: 2025-11-06
- 저장소 표제: T2Editor 5.2.2
- 브랜치: `releases/v5.2.2` · 태그: `v5.2.2`
- ZIP: `5.2.2.zip` (1204410 bytes)
- sha256: `fadf8506106cd2f6b5211974a7333299d122decd0ddf04cd6a7b35636c5701de`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `ed367eabc6b4913bad2c74bb7ef6ea236a8226fc5c3f9a76ef8dce4a7da4c8f9`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.2.2&file=0>

### 배포 설명

```text
텍스트 색상 및 텍스트 배경색 적용 색상 팔레트의 스타일 및 사용성 향상 (/t2editor/js/core.js, /t2editor/css/core.css)
: 타일 형 고정된 색상 목록의 색상 팔레트 -> 고정 색상 + 색상 선택기 추가.
```

---

## 11. v5.3.0

- **상태: EOL**
- 배포일: 2025-11-07
- 저장소 표제: T2Editor 5.3.0
- 브랜치: `releases/v5.3.0` · 태그: `v5.3.0`
- ZIP: `5.3.0.zip` (1209792 bytes)
- sha256: `865d3d19cd7e3653d2f9b84dcaac71a037277e22f78918ff3877a215a036f3f1`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `41ccae2fe11a338b8cebaca41f5d5c9edd9e0a2b1908b8950383d24f80fab749`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.3.0&file=0>

### 배포 설명

```text
Ai기능 도입:
dsclub.kr에서 groq의 여러 ai모델을 사용하여 사용자의 요청에 따른 가장 적합한 ai모델을 선택, dsclub이 자체 재가공한 답변을 제공하는 기능입니다. (텍스트 답변만 가능)
Ai 버튼 추가 (/t2editor/editor.lib.php)
Ai 플러그인 추가 (/t2editor/plugin/ai/ai.js, /t2editor/editor.lib.php, /t2editor/js/core.js)
```

---

## 12. v5.4.0

- **상태: EOL**
- 배포일: 2025-11-08
- 저장소 표제: T2Editor 5.4.0
- 브랜치: `releases/v5.4.0` · 태그: `v5.4.0`
- ZIP: `5.4.0.zip` (1214944 bytes)
- sha256: `bc4c295e223479667ce6a6cf06cb49cef722ad90519c4ce95d907f6726e30fa4`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `d36299932d562c38406af950368d4852cc78b8a6c968335fb5cc015abb1b7b85`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.4.0&file=0>

### 배포 설명

```text
Ai기능 도입:
dsclub.kr에서 groq의 여러 ai모델을 사용하여 사용자의 요청에 따른 가장 적합한 ai모델을 선택, dsclub이 자체 재가공한 답변을 제공하는 기능입니다.
기존 텍스트 응답만 가능했던 T2Editor text AI에서 사용성을 향상시킨 T2Editor interaction AI는 에디터와 상호작용하며 니미지블록, 코드블록, 링크, 각종 서식(볼드, 기울임, 밑줄, 취소선), 테이블(표)를 최적의 위치에 삽입합니다.
(적절한 이미지를 T2Editor interaction AI가 Unsplash의 api 서비스를 통해 추가합니다. T2Editor interaction AI가 추가한 이미지는 부정확하거나 저작권 문제가 있을 수 있으니 유의하여 사용해주시길 바랍니다.)
```

---

## 13. v5.4.1

- **상태: EOL**
- 배포일: 2025-11-09
- 저장소 표제: T2Editor 5.4.1
- 브랜치: `releases/v5.4.1` · 태그: `v5.4.1`
- ZIP: `5.4.1.zip` (1216425 bytes)
- sha256: `999a4b42d592b70d421219dc3d5605480cba58376b83c552f7a6ea151991dd0c`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `b1b785dc1c80d06ba6b82e1bb81569f97a6ad2cb7301e0b6884d7b494d55f47a`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.4.1&file=0>

### 배포 설명

```text
1. 새로 업데이트된 T2Editor interaction AI V1.4.0 API의 유저 및 도메인 사용량 제한을 표시하도록 수정 (1.4.0은 기존 1.0.0 대비 콘텐츠 추가 오류 현상과 부적절한 발언을 대폭 줄인 버전입니다.)
2. 모바일 디자인 개선
3. powered by Ai의 모델 리스트 출력을 하드 코딩 방식에서 dsclub의 model_list.json에서 가져오도록 개선
4. Ai가 작업한 내용 미리보기를 콘텐츠가 실제 적용된 모습으로 수정
5. 일부 안내 내용 수정
 (/t2editor/plugin/ai/ai.js)
```

---

## 14. v5.4.2

- **상태: EOL**
- 배포일: 2025-11-10
- 저장소 표제: T2Editor 5.4.2
- 브랜치: `releases/v5.4.2` · 태그: `v5.4.2`
- ZIP: `5.4.2.zip` (1216734 bytes)
- sha256: `94f6df188098bc5e95b7b811a2b2accf9184d4246692e3d83f4ee863e85632a4`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `358c7184ae61ce447ebc735da0ca41e854162aaf7cbc9713c326b49b2d793f3e`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.4.2&file=0>

### 배포 설명

```text
1. 새로 업데이트 된 T2Editor Ai API 
1. 
7. 0의 보안 라이선스 요구를 충족하도록 ai플러그인 수정 (/t2editor/plugin/ai/ai.js) (
5. 
4. 2 미만의 버전은 신속히 ai플러그인을 업데이트 하시길 바랍니다.
ai플러그인과 reademe.txt만 수정)
```

---

## 15. v5.4.3

- **상태: EOL**
- 배포일: 2025-11-10
- 저장소 표제: T2Editor 5.4.3
- 브랜치: `releases/v5.4.3` · 태그: `v5.4.3`
- ZIP: `5.4.3.zip` (1218006 bytes)
- sha256: `9f22613ff6cdb6d549ae96f653ee67b863cccc2b16063970735dee9454d6a55b`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `a7dd966347d51549d32d73c908aa2153f8bc39ecf9a272a15df8caf63559f269`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.4.3&file=0>

### 배포 설명

```text
1. api 사용 제한 데이터 정보 가져오지 못하는 오류에 대한 ai플러그인 수정 (/t2editor/plugin/ai/ai.js)
2. 그림 그리기 플러그인 좀 더 고해상도 + 그리는 선 부드럽게 처리 (/t2editor/plugin/draw/draw.js)
```

---

## 16. v5.4.4

- **상태: EOL**
- 배포일: 2025-11-13
- 저장소 표제: T2Editor 5.4.4
- 브랜치: `releases/v5.4.4` · 태그: `v5.4.4`
- ZIP: `5.4.4.zip` (1215199 bytes)
- sha256: `6a9d8b9c574b7f6468ad168c7cc702269ad029db651930f38c2ef2f4dfec6431`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `47e6d03c541600c97a46100f254e321033bf7a4a1beca25caf5421b58f6a9002`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.4.4&file=0>

### 배포 설명

```text
미디어 블록 추가 시 자동으로 삽입되는 줄바꿈 영역에서, 사용자가 자동 줄바꿈 영역의 맨 처음에 텍스트를 입력하지 않을 경우 추가적인 줄바꿈이 정상적으로 동작하지 않는 문제가 확인되었습니다.
자동 줄바꿈이 삽입되는 위치의 첫 번째 줄에 가로폭이 없는 공백(U+200B) 문자를 자동 추가하여 미디어 블록 이후의 줄바꿈 동작이 정상적으로 작동할 수 있도록 수정하였습니다.
수정 파일: - /t2editor/plugin/video/video.js - /t2editor/plugin/tabl/table.js - /t2editor/plugin/image/image.js - /t2editor/plugin/file/file.js - /t2editor/plugin/draw/draw.js - /t2editor/plugin/code/code.js
```

---

## 17. v5.4.5

- **상태: EOL**
- 배포일: 2025-11-13
- 저장소 표제: T2Editor 5.4.5
- 브랜치: `releases/v5.4.5` · 태그: `v5.4.5`
- ZIP: `5.4.5.zip` (1216159 bytes)
- sha256: `a7534355ac01bf1b7340e3960871a6ce3ce973340333d0a8df45fea3db685cef`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `63b32b1df57b72ed76ddc1fc1b0fbd5fd21777b1b510831c6d84e60ada90b667`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.4.5&file=0>

### 배포 설명

```text
에디터에서 텍스트 붙여넣기 동작이 안되는 문제를 해결하였습니다.
(t2editor/js/core.js)
```

---

## 18. v5.5.0

- **상태: EOL**
- 배포일: 2025-11-14
- 저장소 표제: T2Editor 5.5.0
- 브랜치: `releases/v5.5.0` · 태그: `v5.5.0`
- ZIP: `5.5.0.zip` (1226784 bytes)
- sha256: `d1f90b6959cd2aefd0a637a69bb043b5a67903542521942eb136f7f191176c9c`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `0a0135ff892e4b6291558ae1f6eef64afdcb426490dd3c0e7f7645ac03def7f2`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.5.0&file=0>

### 배포 설명

```text
T2Editor Ai가 에디터 내의 콘텐츠와 상호작용하며 콘텐츠를 재배치 및 수정할 수 있는 기능 추가 (t2editor/plugin/ai_rearrange/ai_rearrange.js) - dsclub/api/ai/t2editor/groq/interaction_content v
1. 
0. 0
```

---

## 19. v5.5.1

- **상태: EOL**
- 배포일: 2025-11-15
- 저장소 표제: T2Editor 5.5.1
- 브랜치: `releases/v5.5.1` · 태그: `v5.5.1`
- ZIP: `5.5.1.zip` (1226859 bytes)
- sha256: `6f00c3343e28ef4c8c7b43993e1e242fca158395cd5647ef8f7d9d63d923c284`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `1fc0cd32b3662dd4107d472c84845ce8349506c33b39f954a44ff9864df69d33`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.5.1&file=0>

### 배포 설명

```text
안드로이드 환경에서 Ai플러그인이 에디터에 콘텐츠를 추가하지 못하는 문제 해결 (t2editor/plugin/ai/ai.js)
```

---

## 20. v5.6.0

- **상태: EOL**
- 배포일: 2025-11-16
- 저장소 표제: T2Editor 5.6.0
- 브랜치: `releases/v5.6.0` · 태그: `v5.6.0`
- ZIP: `5.6.0.zip` (1233738 bytes)
- sha256: `b1e61613d6514ca7f94206a9824a252bbf9de9da1d167a8bbcd2270749a5fd4c`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `e0840a19485211437c0e62de05a230a2aafffd849bc37d7333493de799133d22`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.6.0&file=0>

### 배포 설명

```text
T2Editor Ai interaction-content v
3. 
0. 0으로 안정화 업데이트 (코드블럭, 테이블 블럭 등의 콘텐츠 블록 전달 오류 수정)AI 콘텐트 재배치 플러그인의 블록 추가 오류 문제 해결 및 선택 편집하기 기능 추가(t2editor/plugin/ai_rearrange/ai_rearrange.js)*선택 편집하기 기능을 소개합니다.AI 콘텐트 재배치 플러그인의 선택 편집하기를 누르면 에디터 안의 콘텐트들을 선택하고 AI에게 해당 부분만 세부 편집을 할 수 있는 기능입니다.단일 또는 여러개의 텍스트, 콘텐트 블록들을 클릭하여 AI에게 수정 요청을 할 수 있습니다.
```

---

## 21. v5.6.1

- **상태: EOL**
- 배포일: 2025-11-17
- 저장소 표제: T2Editor 5.6.1
- 브랜치: `releases/v5.6.1` · 태그: `v5.6.1`
- ZIP: `5.6.1.zip` (1233379 bytes)
- sha256: `c0aa6591f268bbb13385046b93cf35c0517756495fc2221d932fc63511f362d0`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `5eb209d564d5ca222163389bfca5007fd70249c9e91196cc153665b98a6dde76`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.6.1&file=0>

### 배포 설명

```text
T2Editor Ai interaction 안정화 업데이트&스타일 수정 (코드블럭, 테이블 블럭 등의 콘텐츠 블록 전달 오류 수정) (t2editor/plugin/ai/ai.js)AI 콘텐츠 재배치 플러그인 스타일 및 사용성 향상 (t2editor/plugin/ai_rearrange/ai_rearrange.js)*선택 편집하기 기능을 소개합니다.AI 콘텐트 재배치 플러그인의 선택 편집하기를 누르면 에디터 안의 콘텐트들을 선택하고 AI에게 해당 부분만 세부 편집을 할 수 있는 기능입니다.단일 또는 여러개의 텍스트, 콘텐트 블록들을 클릭하여 AI에게 수정 요청을 할 수 있습니다.
```

---

## 22. v5.6.2

- **상태: EOL**
- 배포일: 2025-11-18
- 저장소 표제: T2Editor 5.6.2
- 브랜치: `releases/v5.6.2` · 태그: `v5.6.2`
- ZIP: `5.6.2.zip` (1230393 bytes)
- sha256: `75bd8b4ff8eebda91b270a16d3214b16f4d0130a170073df5e6781657e1cf86f`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `5cbe74b711df45a6e7ef0b52614165cc9607f7c47dc03986caa5e29587bc12c3`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.6.2&file=0>

### 배포 설명

```text
이미지 붙여넣기 시 이미지블록으로 추가 기능 추가(t2editor/plugin/imeage/imeage.js)
```

---

## 23. v5.7.0

- **상태: EOL**
- 배포일: 2025-11-22
- 저장소 표제: T2Editor 5.7.0
- 브랜치: `releases/v5.7.0` · 태그: `v5.7.0`
- ZIP: `5.7.0.zip` (1238247 bytes)
- sha256: `0e5b674fc81fcfdb78da1b2907637dccdfeadbb22a444c6c200109b80a3d6999`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `91e6747731794d1a0ca3da6e47e146af767a4373bd77fe217960072b0df6b085`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.7.0&file=0>

### 배포 설명

```text
그림 그리기 플러그인 롤백 
5. 
6. 2 -&gt; 
5. 
4. 2 버전 (t2editor/plugin/draw/draw.js)검색 기능 추가 (t2editor/plugin/search/search.js)- T2Search API 적용 ( https://dsclub.kr/service/search )- 에디터 내의 텍스트 검색가능- T2Search API로 검색한 검색 결과를 클릭하여 에디터에 제목-본문(코드블럭)-링크로 추가 가능
```

---

## 24. v5.7.1

- **상태: EOL**
- 배포일: 2025-11-23
- 저장소 표제: T2Editor 5.7.1
- 브랜치: `releases/v5.7.1` · 태그: `v5.7.1`
- ZIP: `5.7.1.zip` (1239726 bytes)
- sha256: `5e938db25eba127faeff9b106b0a471ea2fab4de3412421a971082ca5dd82bb7`
- 배포 시점 유효 라이선스: **1.0.1**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `9acedd43dd4d754ac64461c04ca8621901c0ebccbe1da6cb531c4f41fc672aa7`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.7.1&file=0>

### 배포 설명

```text
캐시 도입을 통한 검색 속도 개선 (t2editor/plugin/search/search.js)- T2Search API 캐시 도입- 검색 결과 없음 안내 표시 추가- API 응답 불가 안내 표시 추가
```

---

## 25. v5.7.2

- **상태: EOL**
- 배포일: 2025-11-26
- 저장소 표제: T2Editor 5.7.2
- 브랜치: `releases/v5.7.2` · 태그: `v5.7.2`
- ZIP: `5.7.2.zip` (1239753 bytes)
- sha256: `71245084729f75d9fc419e5121833dee3ad09426733ebc61c144273a24c5d87f`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `bd3c023a0a7e97cf728cfc062bae85ef1b8fdcb30967849a24470148976afcd3`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.7.2&file=0>

### 배포 설명

```text
라이선스 수정 (t2editor/editor.lib.php, t2editor/reademe.txt)수정된 라이선스:*요약: T2Editor 외의 자체 개발 플러그인 및 관련 서비스의 유료 판매 및 제공 허용-___- T2Editor License_Ko Version: 
2. 
0. 0 Initial development period: 
2025. 
01. 23 - 
2025. 
02. 11 Copyright (c) 2025 Tak2 (dsclub.kr) [한국어 버전] 저작권 및 소유권: T2Editor의 저작권은 Tak2(dsclub.kr)에게 있습니다.
이메일: dsclub2023@gmail.com 사용 권한: 
1. dsclub.kr에서 배포하는 T2Editor 코어 파일 및 기본 제공 플러그인: - 사용, 복사, 수정, 재배포 가능 - 모든 배포물(수정본 포함)은 무료로 제공해야 함 - 상업적 판매 금지 
2. 외부 자체 개발 플러그인 및 관련 서비스: - T2Editor와 연동되는 독자 개발 플러그인의 유료 판매 허용 - 자체 개발 플러그인 기반 유료 서비스(구독형 등) 제공 허용 - 단, dsclub.kr 기본 제공 소프트웨어는 무료로 유지되어야 함 제한사항: - 저작권 고지 제거 또는 수정 금지 - dsclub.kr 기본 배포 파일의 상업적 판매 금지 배포 및 문의: 최신 버전: https://dsclub.kr/service/editor 사용 안내: https://dsclub.kr/service/editor 이 라이선스는 2025년 11월 26일부터 유효합니다.
-___- T2Editor License_En Version: 
2. 
0. 0 Initial development period: 
2025. 
01. 23 - 
2025. 
02. 11 Copyright (c) 2025 Tak2 (dsclub.kr) [English Version] Copyright and Ownership: T2Editor is copyrighted by Tak2 (ds...
```

---

## 26. v5.8.0

- **상태: EOL**
- 배포일: 2025-11-29
- 저장소 표제: T2Editor 5.8.0
- 브랜치: `releases/v5.8.0` · 태그: `v5.8.0`
- ZIP: `5.8.0.zip` (1242880 bytes)
- sha256: `a216c62fa1e053b52013ec2c2efb6b654831bef9c5921d740f29e9a796344d6e`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `d9265497d50376bc689003cde270d3da1d7c3993b6275b961fd90fe2786309a1`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.8.0&file=0>

### 배포 설명

```text
에디터의 가로 사이즈에 따른 반응형 툴바 기능을 추가했습니다.반응형 툴바 - 그룹 버튼이란 에디터 너비에 따라 버튼을 자동 그룹화하여 서브 툴바로 대체하는 기능입니다.모바일, 테블릿 환경에서 툴바의 버튼 수가 과다하게 많아져 사용 경험과 심미성이 저하되는 문제를 해결합니다.반응형 툴바 - 그룹 버튼 설정 안내:T2_TOOLBAR_GROUPS 안에 원하는 범위의 그룹을 설정합니다.- 키: ‘WidthA-WidthB’ (에디터 너비 범위, px 단위) - 값: 배열로 그룹 목록.
각 객체는: - 'groupIcon' : 그룹 버튼 아이콘 (Material Icons 이름).
- 'groupLabel' : 그룹 설명 (툴팁).
- 'buttons': 배열로 그룹화할 버튼의 data-command 값.
- 'position' : 그룹 버튼의 툴바 위치 (숫자, 1부터 시작).
​예시:window.T2_TOOLBAR_GROUPS = { '0-599': [ // 모바일 (0~599px) { groupIcon: 'text_fields', groupLabel: '텍스트', buttons: ['fontSize', 'bold', 'italic', 'underline', 'strikeThrough'], position: 3 }, { groupIcon: 'photo_camera', groupLabel: '콘텐츠', buttons: ['insertImage', 'insertYouTube', 'attachFile'], position: 4 } ], '600-1023': [ // 태블릿 (600~1023px) { groupIcon: 'more_horiz', groupLabel: '기타', buttons: ['insertTable', 'exportHTML'], position: 10 } ] };​
```

---

## 27. v5.8.1

- **상태: EOL**
- 배포일: 2025-12-01
- 저장소 표제: T2Editor 5.8.1
- 브랜치: `releases/v5.8.1` · 태그: `v5.8.1`
- ZIP: `5.8.1.zip` (1244456 bytes)
- sha256: `49c785a80b38fc5dcba07e0389aad54a3fd89d2b758149c757c55789198b0c67`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `0e94748f34eb3a3bccb304a7af4843ca9f31580ec02e14ad217725190c69febd`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.8.1&file=0>

### 배포 설명

```text
파일 플러그인의 코드가 그림 그리기 플러그인의 코드로 대체되어있는 것을 발견하여 
5. 
4. 0으로 롤백 (t2editor/plugin/file/file.js)​
```

---

## 28. v5.8.2

- **상태: EOL**
- 배포일: 2025-12-05
- 저장소 표제: T2Editor 5.8.2
- 브랜치: `releases/v5.8.2` · 태그: `v5.8.2`
- ZIP: `5.8.2.zip` (1254264 bytes)
- sha256: `6a4082f5e9ea79e38d2daacfa04e15e0276f757d97c779d82c52feb325572df5`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `d76c17e4c1073b31d786ca4d27c7f9c7e7b024e1f884b64be145701320c8398c`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.8.2&file=0>

### 배포 설명

```text
기존의 editor.lib.php에 위치한 서브툴바 기능이 안드로이드, 윈도우, 리눅스 기기에서 작동하지 않는 문제를 해결하였습니다.
(경로 변경: editor.lib.php -&gt; t2editor/js/toolbar.js)---반응형 서브 툴바 사용 안내:에디터의 가로 사이즈에 따른 반응형 툴바 기능을 추가했습니다.반응형 툴바 - 그룹 버튼이란 에디터 너비에 따라 버튼을 자동 그룹화하여 서브 툴바로 대체하는 기능입니다.모바일, 테블릿 환경에서 툴바의 버튼 수가 과다하게 많아져 사용 경험과 심미성이 저하되는 문제를 해결합니다.반응형 툴바 - 그룹 버튼 설정 안내:t2editor/js/toolbar.js의 getDefaultConfig 안에 원하는 범위의 그룹을 설정합니다.
(
5. 
8. 0에서의 설정 방법과 같습니다.
5. 
8. 0과 
5. 
8. 1 이용자분들은 기존 설정을 복사&amp;붙여넣기 하시면 됩니다.)반응형 툴바 - 그룹 버튼 설정 안내:t2editor/js/toolbar.js의 getDefaultConfig 안에 원하는 범위의 그룹을 설정합니다.- 키: ‘WidthA-WidthB’ (에디터 너비 범위, px 단위) - 값: 배열로 그룹 목록.
각 객체는: - 'groupIcon' : 그룹 버튼 아이콘 (Material Icons 이름).
- 'groupLabel' : 그룹 설명 (툴팁).
- 'buttons': 배열로 그룹화할 버튼의 data-command 값.
- 'position' : 그룹 버튼의 툴바 위치 (숫자, 1부터 시작).
​예시: getDefaultConfig() { return { '0-599': [ { groupIcon: 'text_fields', groupLabel: '텍스트', buttons: ['fontSize', 'bold', 'italic', 'underline', 'strikeThrough', 'justifyContent', 'foreColor', 'backColor', 'createLink', 'insertC...
```

---

## 29. v5.8.3

- **상태: EOL**
- 배포일: 2025-12-06
- 저장소 표제: T2Editor 5.8.3
- 브랜치: `releases/v5.8.3` · 태그: `v5.8.3`
- ZIP: `5.8.3.zip` (1254360 bytes)
- sha256: `eccd40608d7e3afeee357d7256e606fff7e6e8ce01eca6d452df66be7428dda1`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `23701de8aa5e7cd23e18220ef0f1df4864de4acb71dcd3e80448499538ecb3a8`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.8.3&file=0>

### 배포 설명

```text
기존의 editor.lib.php에 위치한 서브툴바 기능 함수명 수정 (t2editor/js/toolbar.js)---반응형 서브 툴바 사용 안내:에디터의 가로 사이즈에 따른 반응형 툴바 기능을 추가했습니다.반응형 툴바 - 그룹 버튼이란 에디터 너비에 따라 버튼을 자동 그룹화하여 서브 툴바로 대체하는 기능입니다.모바일, 테블릿 환경에서 툴바의 버튼 수가 과다하게 많아져 사용 경험과 심미성이 저하되는 문제를 해결합니다.반응형 툴바 - 그룹 버튼 설정 안내:t2editor/js/toolbar.js의 getT2DefaultConfig 안에 원하는 범위의 그룹을 설정합니다.
(
5. 
8. 0에서의 설정 방법과 같습니다.
5. 
8. 0과 
5. 
8. 1, 
5. 
8. 2 이용자분들은 기존 설정을 복사&amp;붙여넣기 하시면 됩니다.)반응형 툴바 - 그룹 버튼 설정 안내:t2editor/js/toolbar.js의 getT2DefaultConfig 안에 원하는 범위의 그룹을 설정합니다.- 키: ‘WidthA-WidthB’ (에디터 너비 범위, px 단위) - 값: 배열로 그룹 목록.
각 객체는: - 'groupIcon' : 그룹 버튼 아이콘 (Material Icons 이름).
- 'groupLabel' : 그룹 설명 (툴팁).
- 'buttons': 배열로 그룹화할 버튼의 data-command 값.
- 'position' : 그룹 버튼의 툴바 위치 (숫자, 1부터 시작).
​예시: getT2DefaultConfig() { return { '0-599': [ { groupIcon: 'text_fields', groupLabel: '텍스트', buttons: ['fontSize', 'bold', 'italic', 'underline', 'strikeThrough', 'justifyContent', 'foreColor', 'backColor', 'createLink', 'insertCodeBlock'], position: 3 }, { groupIcon: 'photo_...
```

---

## 30. v5.8.4

- **상태: EOL**
- 배포일: 2025-12-07
- 저장소 표제: T2Editor 5.8.4
- 브랜치: `releases/v5.8.4` · 태그: `v5.8.4`
- ZIP: `5.8.4.zip` (1254022 bytes)
- sha256: `a5820513a68c623d001c879d2cec2a486611110fb0bb6fd2a267f77d773d6772`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `6efe99c2fe049903b3430973ea5f26d9953c39187796b36ec7308aaf503d5026`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.8.4&file=0>

### 배포 설명

```text
이미지 추가 불가 오류를 해결하였습니다 (/t2editor/plugin/image/image.js)​
```

---

## 31. v5.9.0

- **상태: EOL**
- 배포일: 2025-12-07
- 저장소 표제: T2Editor 5.9.0
- 브랜치: `releases/v5.9.0` · 태그: `v5.9.0`
- ZIP: `5.9.0.zip` (1255527 bytes)
- sha256: `bc302d95daedf8b0c66bc8e1e3fb31aa3ef4c902998f15564a7df09e5ccee3ec`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `95f6abb0bdfdb861cbcb17a48a0ea994b7df74f3af0d14c0befe2060cebfc9a9`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.9.0&file=0>

### 배포 설명

```text
각 블록(이미지 블록, 동영상 블록, 코드 블록, 테이블 블록, 그림 블록)들을 위, 아래로 이동할 수 있는 알약형 이동 바를 블록 하단에 추가하도록 구현하였습니다.
(파일 블록 제외)​
```

---

## 32. v5.10.0

- **상태: EOL**
- 배포일: 2025-12-08
- 저장소 표제: T2Editor 5.10.0
- 브랜치: `releases/v5.10.0` · 태그: `v5.10.0`
- ZIP: `5.10.0.zip` (1254349 bytes)
- sha256: `4a5f36966d53c04d49265f678703b45a63bbfbf7c33fa54caf6e6a60a0d69e27`
- 배포 시점 유효 라이선스: **2.0.0**
- 라이선스 원본 위치: 배포본 안 `readme.txt`
- readme.txt: 포함 (sha256 `8a1b0b8392f5cac5ca0eae8903aa81ed7864b717c9a670f7469f9a87666d8b37`)
- 배포 API 원본: <https://dsclub.kr/api/t2editor/version/index.php?action=download&version=5.10.0&file=0>

### 배포 설명

```text
1. 블록 이동 버튼 기능 안정화 (t2editor/js/core.js, t2editor/plugin/image/image.js, t2editor/plugin/video/video.js, t2editor/plugin/code/code.js, t2editor/plugin/table/table.js, t2editor/plugin/draw/draw.js)(게시글 편집 시 삭제/편집/리사이즈/이동 버튼 안뜨는 오류 해결)
2. 파일 블록에도 이동 버튼 기능 추가 (t2editor/plugin/file/file.js)
3. 플러그인 순차 로딩 기능 추가 (t2editor/editor.lib.php)editor.lib.php의 $plugin_priority에서 순서 설정 가능.0 = 즉시, 1,2,
3. ..
= 순차, 미지정 = 자동으로 뒤로, 중복 순서 = 용량 적은 순으로 순차 로딩​
```
