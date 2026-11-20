# Jiyu’s Word Garden — 가족 로그인·서버 저장 추가본

Made by mommy.

기존 Sites 3번 버전(커밋 ecb7a611d7688be19e13bc0e2a532bb4292b993a)의 화면·179개 카드·그림·학습 게임을 유지한 별도 복제본입니다.
기존 Sites 주소는 변경하지 않았습니다. GitHub 업로드나 외부 호스팅 배포도 아직 수행하지 않았습니다.

## 이번에 추가한 동작

- 가족 공용 아이디 1개로 로그인합니다. 기본 아이디는 요청하신 your-family-username입니다.
- 가족 로그인 설정은 로컬 `.env` 또는 배포 환경의 환경변수로 관리합니다.
- 회원가입 기능은 없습니다.
- 로그인 전에는 학습 화면·JS·단어 데이터·PNG·진도 API의 직접 주소 접근이 차단됩니다.
- 로그인 HTML 자체와 내용이 없는 /health 점검 경로만 공개합니다.
- Flask 기본 정적 폴더 제공을 끄고 모든 학습 파일 요청을 서버 로그인 확인 뒤에 처리합니다.
- 비밀번호·서버 코드·DB·세션 비밀키는 웹 주소로 제공하지 않습니다.
- 로그인된 기기의 학습 진도·오답·추가 단어·이미지·설정·게임 중간 위치를 서버 SQLite에 함께 저장합니다.
- 화면 위에 Saving / Saved / Not saved 상태를 표시합니다. 'Saved to our family garden'을 확인하면 서버 저장이 완료된 것입니다.
- 새 기기에서 같은 가족 계정으로 접속하면 서버의 저장된 기록을 읽습니다.
- 학습 중이 아닌 화면은 주기적으로 새 기록을 확인합니다. 기기를 번갈아 쓸 때는 기존 기기의 저장 완료 후 다른 기기를 새로 열거나 새로고침하세요.
- 두 기기가 동시에 오래된 기록을 저장하려 하면 덮어쓰지 않고 충돌 안내를 표시합니다. 해당 기기의 백업을 내려받고 서버 기록을 불러올 수 있습니다.
- 연결 실패 시 브라우저에 복구 사본을 남기고 재시도를 제공합니다. 저장 완료 표시 전에는 서버 저장이 끝난 것이 아닙니다.

## 서버 저장의 조건

실제 외부 웹사이트에서 이 기능을 쓰려면 이 서버 앱을 호스팅에 배포해야 합니다.
GitHub 저장소를 만드는 것만으로 사이트가 실행되거나 DB가 만들어지는 것은 아닙니다.
GitHub Pages 같은 정적 파일 제공만으로는 이 인증·서버 저장 요구를 충족하지 않습니다.

SQLite DB와 세션 비밀키가 있는 DATA_DIR에는 **재배포·재시작 후에도 유지되는 영구 디스크/볼륨**을 연결해야 합니다.
임시 파일시스템만 있는 호스팅이나 일반적인 무상태 서버리스 실행 환경에 그대로 올리는 구성은 지원하지 않습니다.
현재 구성은 단일 서버 인스턴스 + 로컬 영구 볼륨을 전제로 합니다. 여러 서버 인스턴스가 각각 다른 로컬 DB를 쓰게 배포하면 안 됩니다.
한 계정을 쓰는 모든 가족 기기는 **하나의 공용 학습 기록**을 공유합니다. 사람별 별도 프로필은 없습니다.

서버 저장 위치:
- DATA_DIR/word-garden.sqlite3 — 가족 공용 진도·학습 내용·로그인 세션·실패 횟수
- DATA_DIR/session-secret — 쿠키 서명 비밀키(SECRET_KEY 환경변수가 없을 때 자동 생성)
- 브라우저 localStorage — 복구용 사본; 서버가 최종 기준입니다.

## 실행

Python 3.12와 Node.js(테스트용)를 기준으로 확인했습니다.

    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt

로컬 컴퓨터 HTTP 확인:

    COOKIE_SECURE=false .venv/bin/python server.py

http://127.0.0.1:8000 에서 로그인합니다.
Windows PowerShell에서는 먼저 $env:COOKIE_SECURE="false"를 설정하고 .venv\Scripts\python.exe server.py를 실행합니다.
COOKIE_SECURE=false는 로컬 HTTP 확인용이며 운영 HTTPS 배포에서는 true를 유지합니다.

운영 실행 명령:

    gunicorn --bind 0.0.0.0:8000 --workers 1 --threads 4 --timeout 60 'server:create_app()'

운영에서는 HTTPS를 종료하는 프록시/호스팅 앞단을 사용해야 합니다.
모든 경로를 이 서버에 전달하고 dist를 별도의 공개 정적 사이트/CDN으로 제공하면 안 됩니다.
현재 보안 헤더는 공개 CDN 캐시를 막고, HTTPOnly·Secure·SameSite 쿠키와 CSRF 검증을 사용합니다.

Docker:
- Dockerfile과 compose.yaml을 포함했습니다.
- compose는 garden_data라는 영구 볼륨을 /data에 연결합니다.
- 기본 바인딩은 호스트의 127.0.0.1:8000이므로 HTTPS 프록시에서 연결할 수 있습니다.
- 로컬 HTTP 확인만 하려면 COOKIE_SECURE=false docker compose up --build를 사용합니다.
- 운영에서는 COOKIE_SECURE=true 상태로 HTTPS 프록시 뒤에서 실행하세요.

    docker compose up --build -d

환경변수:
- DATA_DIR: 영구 데이터 경로, 로컬 기본 instance/, Docker 기본 /data
- COOKIE_SECURE: 기본 true
- `FAMILY_USERNAME`: 필수. 가족 로그인 아이디
- `FAMILY_PASSWORD_HASH`: 필수. 가족 로그인 비밀번호의 scrypt 해시. `.env`에서는 `$`가 유지되도록 값을 작은따옴표로 감쌉니다.
- SECRET_KEY: 선택, 없으면 영구 DATA_DIR에서 키를 생성·재사용

.env.example은 참고용입니다. 앱이 .env 파일을 자동 로딩하지는 않습니다. 호스팅 환경변수나 실행 셸에서 설정하세요.
학습 기록 DB·비밀키·개인 JSON 백업은 Git에 넣지 마세요. 제외 규칙을 포함했습니다.

## 기존 Sites 기록 옮기기

1. 기록이 있는 기기/브라우저에서 기존 Sites를 엽니다.
2. Grown-ups → 백업 다운로드로 JSON 파일을 저장합니다.
3. 새로 배포한 가족 사이트에 로그인합니다.
4. Grown-ups → 백업 가져오기로 그 JSON을 읽습니다.
5. 화면 위 'Saved to our family garden' 표시를 확인합니다.

카드 ID는 기존 ivy-… / ivy2-…를 그대로 유지합니다.
원본에서 불완전했던 중간 게임 가져오기도 보완했습니다. 현재 게임이 없는 경우 유효한 백업 속 session을 복원하며, 일시 중단 게임도 합칩니다.
기존 서버 기록이 있는 경우 동일 카드의 진도는 가져온 백업 값으로 갱신됩니다. 가져오기는 실제 가족 서버 기록도 변경합니다.
내보내기는 현재 기록 전체이며 비밀번호나 로그인 쿠키는 포함하지 않습니다.
실제 지유의 브라우저 기록은 아직 가져오지 않았으므로 이 ZIP에는 들어 있지 않습니다.

## 구성

- server.py: 전체 자료 인증, 공용 로그인, 세션 만료·로그아웃, CSRF, 로그인 시도 제한, SQLite 저장/버전 충돌 검사
- templates/login.html: 로그인 화면
- dist/: 기존 디자인·데이터·그림·학습 앱
- dist/server-sync.js: 자동 저장, 복구 사본, 충돌 안내, 다른 기기 기록 불러오기
- requirements.txt: 검증한 Python 의존성 버전
- tests/: 원본 학습 로직, 서버, 저장 동작 테스트

## 검증 결과와 범위

실행 명령:

    node tests/learning.test.mjs
    node tests/sync.test.mjs
    .venv/bin/python -m unittest discover -s tests -p 'test_server.py' -v

- 원본 학습 로직 테스트 통과
- 서버 테스트 10개 통과: 미로그인 자료 차단, 로그인, CSRF, 자료 경로 제한, 기록 재시작 유지/다른 클라이언트 공유, 충돌 방지, 로그아웃 세션 무효화, 잘못된 데이터 거부, 로그인 시도 제한
- 저장 클라이언트 모형 테스트 통과: 자동 저장, 새 기기 이어하기, 연결 실패 복구, 동시 저장 충돌
- 실제 브라우저에서 미로그인 시 로그인 화면으로 이동하는 것과 로그인 화면 렌더링 확인
- 실제 브라우저의 비밀번호 입력·로그인 후 학습 화면까지는 수동 로그인 없이 검증하지 않았습니다.
- 운영 호스팅 HTTPS·영구 디스크·프록시 설정은 배포 대상 선정 후 확인해야 합니다.
- Docker 컨테이너 빌드/운영 호스팅 배포는 이번 환경에서 실행하지 않았습니다.

참고 문서:
- https://flask.palletsprojects.com/en/stable/web-security/
- https://flask.palletsprojects.com/en/stable/deploying/
