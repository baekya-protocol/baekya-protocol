# Firebase Authentication 설정 가이드

백야 프로토콜에서 Firebase Authentication을 통한 GitHub 연동을 설정하는 방법을 안내합니다.

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속합니다.
2. "프로젝트 추가"를 클릭합니다.
3. 프로젝트 이름을 입력합니다 (예: `baekya-protocol`)
4. Google Analytics 설정을 완료합니다.

## 2. Firebase 프로젝트 설정

### 2.1 웹 앱 추가
1. 프로젝트 설정 > 일반 탭에서 "앱 추가"를 클릭합니다.
2. 웹 앱을 선택합니다.
3. 앱 별명을 입력합니다 (예: `baekya-protocol-web`)
4. 호스팅 설정은 나중에 구성할 수 있습니다.

### 2.2 Firebase SDK 설정
웹 앱을 추가한 후 Firebase SDK 설정 정보를 복사합니다:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", 
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

이 정보를 `public/firebase-config.js` 파일에 복사합니다.

## 3. GitHub OAuth 앱 생성

### 3.1 GitHub에서 OAuth 앱 생성
1. GitHub 설정 > Developer settings > OAuth Apps로 이동합니다.
2. "New OAuth App"을 클릭합니다.
3. 다음 정보를 입력합니다:
   - **Application name**: `Baekya Protocol`
   - **Homepage URL**: `https://your-domain.com` (또는 `http://localhost:3000`)
   - **Authorization callback URL**: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
4. "Register application"을 클릭합니다.
5. 생성된 **Client ID**와 **Client Secret**를 복사합니다.

### 3.2 Firebase에서 GitHub 프로바이더 설정
1. Firebase Console > Authentication > Sign-in method로 이동합니다.
2. "GitHub"을 찾아 클릭합니다.
3. "사용 설정"을 켭니다.
4. GitHub OAuth 앱에서 복사한 **Client ID**와 **Client Secret**를 입력합니다.
5. "저장"을 클릭합니다.

## 4. Firebase Admin SDK 설정 (서버용)

### 4.1 서비스 계정 키 생성
1. Firebase Console > 프로젝트 설정 > 서비스 계정 탭으로 이동합니다.
2. "새 비공개 키 생성"을 클릭합니다.
3. JSON 파일이 다운로드됩니다.

### 4.2 서버 설정
`server.js` 파일에서 Firebase Admin SDK 설정을 업데이트합니다:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});
```

## 5. 환경 변수 설정 (권장)

보안을 위해 환경 변수를 사용하는 것이 좋습니다:

### 5.1 `.env` 파일 생성
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 5.2 서버 설정 수정
```javascript
const admin = require('firebase-admin');

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  // ... 기타 필요한 필드들
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});
```

## 6. 도메인 승인 설정

### 6.1 승인된 도메인 추가
1. Firebase Console > Authentication > Settings > 승인된 도메인으로 이동합니다.
2. 개발 환경에서는 `localhost`가 이미 추가되어 있습니다.
3. 배포 환경의 도메인을 추가합니다.

### 6.2 GitHub OAuth 앱 설정 업데이트
배포 시 GitHub OAuth 앱의 **Authorization callback URL**을 업데이트해야 합니다.

## 7. 테스트

설정이 완료되면 다음을 테스트합니다:

1. 웹 앱에서 "GitHub 계정 연결" 버튼을 클릭합니다.
2. GitHub 로그인 팝업이 나타나는지 확인합니다.
3. 로그인 후 사용자 정보가 올바르게 표시되는지 확인합니다.
4. 서버 콘솔에서 Firebase 토큰 검증이 성공하는지 확인합니다.

## 8. 문제 해결

### 8.1 팝업 차단
- 브라우저의 팝업 차단 설정을 확인합니다.
- 사용자에게 팝업 허용 안내를 제공합니다.

### 8.2 CORS 오류
- Firebase Console에서 승인된 도메인을 확인합니다.
- 서버의 CORS 설정을 확인합니다.

### 8.3 토큰 검증 실패
- 서버의 Firebase Admin SDK 설정을 확인합니다.
- 서비스 계정 키가 올바른지 확인합니다.

## 9. 보안 고려사항

1. **환경 변수 사용**: 민감한 정보는 환경 변수로 관리합니다.
2. **도메인 제한**: 승인된 도메인만 추가합니다.
3. **토큰 만료**: Firebase ID 토큰의 만료 시간을 확인합니다.
4. **HTTPS 사용**: 프로덕션 환경에서는 반드시 HTTPS를 사용합니다.

이제 Firebase Authentication을 통한 GitHub 연동이 완료되었습니다! 🎉 