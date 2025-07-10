// Firebase 설정 
const firebaseConfig = {
    apiKey: "AIzaSyAQUnV8DLfyVAwSILM55J4uOGfOSHGA4NQ",
    authDomain: "baekya-protocol.firebaseapp.com",
    projectId: "baekya-protocol",
    storageBucket: "baekya-protocol.firebasestorage.app",
    messagingSenderId: "855589367088",
    appId: "1:855589367088:web:7a5437ebab3efe9e92ecf5",
    measurementId: "G-6NKBPGQRCT"
};

// Firebase 초기화
try {
  firebase.initializeApp(firebaseConfig);
  console.log('🔥 Firebase 초기화 완료');
} catch (error) {
  console.error('❌ Firebase 초기화 실패:', error);
  console.log('⚠️  Firebase 설정을 확인하세요.');
}

// Firebase Auth 및 GitHub 프로바이더 설정
const auth = firebase.auth();
const githubProvider = new firebase.auth.GithubAuthProvider();

// GitHub 스코프 설정 (사용자 정보 및 public 저장소 접근)
githubProvider.addScope('user');
githubProvider.addScope('user:email');
githubProvider.addScope('public_repo');

// 추가 사용자 정보 요청
githubProvider.setCustomParameters({
  'allow_signup': 'true'
});

// Firebase Auth 상태 변경 리스너
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('🔥 Firebase 사용자 로그인됨:', user.displayName || user.email);
    updateUIForAuthenticatedUser(user);
  } else {
    console.log('🔥 Firebase 사용자 로그아웃됨');
    updateUIForUnauthenticatedUser();
  }
});

// 모바일 기기 감지
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
}

// GitHub 로그인 함수
async function signInWithGitHub() {
  try {
    console.log('🔥 GitHub 로그인 시도 중...');
    
    // 모바일에서는 경고 후 중단
    if (isMobile()) {
      console.log('📱 모바일 환경 감지 - PC 진행 안내');
      throw new Error('모바일에서는 GitHub 연동이 제한됩니다. PC에서 진행해주세요.');
    }
    
    // PC에서만 팝업 방식 사용
    console.log('💻 PC 환경 - 팝업 방식 사용');
    const result = await auth.signInWithPopup(githubProvider);
    const user = result.user;
    
    // credential 안전 처리
    const credential = firebase.auth.GithubAuthProvider.credentialFromResult(result);
    const accessToken = credential ? credential.accessToken : null;
    
    console.log('🔥 GitHub 로그인 성공:', user.displayName || user.email);
    console.log('🔑 Access Token 확인:', accessToken ? '있음' : '없음');
    
    // credential이 없어도 사용자 정보는 있으므로 진행
    await linkGitHubAccount(user, accessToken);
    
    return { user, accessToken };
  } catch (error) {
    console.error('❌ GitHub 로그인 오류:', error);
    
    // 구체적인 오류 처리
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('로그인 팝업이 닫혔습니다. 다시 시도해주세요.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해주세요.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('다른 로그인 요청이 진행 중입니다.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    }
    
    throw error;
  }
}

// GitHub 계정 연동 함수
async function linkGitHubAccount(user, accessToken) {
  try {
    const idToken = await user.getIdToken();
    
    // GitHub 사용자명 추출
    const githubUsername = user.reloadUserInfo?.screenName || 
                          user.providerData?.[0]?.displayName || 
                          extractUsernameFromEmail(user.email);
    
    console.log('🔗 GitHub 계정 연동 시도:', githubUsername);
    
    // 현재 백야 프로토콜 사용자 DID 가져오기
    const currentUser = window.dapp?.currentUser;
    const userDID = currentUser?.did;
    
    console.log('🔗 현재 백야 사용자:', userDID);
    
    // 헤더 구성
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (userDID) {
      headers['Authorization'] = `Bearer ${userDID}`;
    }
    
    const response = await fetch('/api/github/link-account', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        idToken: idToken,
        accessToken: accessToken,
        githubUsername: githubUsername,
        userDID: userDID // 백야 사용자 DID 직접 전송
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'GitHub 계정 연동 실패');
    }

    const result = await response.json();
    console.log('✅ GitHub 계정 연동 성공:', result);
    return result;
  } catch (error) {
    console.error('❌ GitHub 계정 연동 오류:', error);
    throw error;
  }
}

// 이메일에서 사용자명 추출 (fallback)
function extractUsernameFromEmail(email) {
  if (!email) return 'unknown';
  return email.split('@')[0];
}

// 로그아웃 함수
async function signOut() {
  try {
    await auth.signOut();
    console.log('🔥 Firebase 로그아웃 완료');
  } catch (error) {
    console.error('❌ Firebase 로그아웃 오류:', error);
  }
}

// UI 업데이트 함수들
function updateUIForAuthenticatedUser(user) {
  const connectButton = document.getElementById('connectGitHub');
  const userInfo = document.getElementById('userInfo');
  
  if (connectButton) {
    connectButton.textContent = '연결됨';
    connectButton.disabled = true;
    connectButton.classList.add('connected');
    connectButton.innerHTML = '<i class="fas fa-check"></i> 연결됨';
  }
  
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="user-profile">
        <img src="${user.photoURL || '/icons/icon-192x192.png'}" alt="프로필" class="profile-image">
        <div class="user-details">
          <h3>${user.displayName || '사용자'}</h3>
          <p>@${user.reloadUserInfo?.screenName || extractUsernameFromEmail(user.email)}</p>
        </div>
        <button onclick="signOut()" class="logout-btn">
          <i class="fas fa-sign-out-alt"></i> 로그아웃
        </button>
      </div>
    `;
  }
}

function updateUIForUnauthenticatedUser() {
  const connectButton = document.getElementById('connectGitHub');
  const userInfo = document.getElementById('userInfo');
  
  if (connectButton) {
    connectButton.textContent = 'GitHub 계정 연결';
    connectButton.disabled = false;
    connectButton.classList.remove('connected');
    connectButton.innerHTML = '<i class="fab fa-github"></i> GitHub 계정 연결';
  }
  
  if (userInfo) {
    userInfo.innerHTML = '';
  }
}

// Firebase Auth 상태 확인 함수
function getCurrentUser() {
  return auth.currentUser;
}

// Firebase Auth 준비 상태 확인
function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// 전역 함수로 노출
window.signInWithGitHub = signInWithGitHub;
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.waitForAuth = waitForAuth; 