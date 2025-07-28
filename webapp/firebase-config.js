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

// Firebase Auth 설정
const auth = firebase.auth();

// Firebase Auth 상태 변경 리스너
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('🔥 Firebase 사용자 로그인됨:', user.displayName || user.email);
    
    // GitHub 연동 상태를 localStorage에 저장
    const githubInfo = getGitHubInfoFromUser(user);
    
    if (window.dapp && window.dapp.currentUser && window.dapp.currentUser.did) {
      // 연동 상태 저장
      const integrationData = {
        githubUsername: githubInfo.githubUsername,
        displayName: githubInfo.displayName,
        photoURL: githubInfo.photoURL,
        targetRepository: 'baekya-protocol/baekya-protocol',
        connectedAt: new Date().toISOString(),
        uid: githubInfo.uid
      };
      
      // dev-dao에 대한 연동 상태 저장
      const key = `github_integration_${window.dapp.currentUser.did}`;
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      existing['dev-dao'] = integrationData;
      localStorage.setItem(key, JSON.stringify(existing));
      
      console.log('🔗 Firebase GitHub 연동 상태 저장됨:', integrationData);
    }
    
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
    
    // credential 안전 처리 (Firebase v8 호환)
    let credential = null;
    let accessToken = null;
    
    try {
      // result에서 직접 credential 가져오기 (Firebase v8/v9 호환)
      credential = result.credential || null;
      accessToken = credential?.accessToken || null;
      
      // 추가적으로 additionalUserInfo에서도 확인
      if (!accessToken && result.additionalUserInfo) {
        accessToken = result.additionalUserInfo.accessToken || null;
      }
    } catch (credentialError) {
      console.log('⚠️ Credential 추출 실패 (무시하고 계속):', credentialError.message);
      // credential 없이도 사용자 정보는 있으므로 계속 진행
    }
    
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
    
    // GitHub 사용자명 추출 (더 정확한 방식)
    let githubUsername = null;
    
    // 1순위: reloadUserInfo에서 screenName
    if (user.reloadUserInfo?.screenName) {
      githubUsername = user.reloadUserInfo.screenName;
    }
    // 2순위: providerData에서 displayName 먼저 시도 (실제 사용자명)
    else if (user.providerData && user.providerData.length > 0) {
      const githubProvider = user.providerData.find(p => p.providerId === 'github.com');
      if (githubProvider) {
        // displayName이 실제 GitHub 사용자명인 경우가 많음
        githubUsername = githubProvider.displayName || githubProvider.uid;
        
        // 숫자로만 이루어진 경우 GitHub ID이므로 이메일에서 추출 시도
        if (githubUsername && /^\d+$/.test(githubUsername)) {
          console.log(`⚠️ GitHub ID 감지 (${githubUsername}), 이메일에서 사용자명 추출 시도`);
          githubUsername = null; // 이메일에서 추출하도록
        }
      }
    }
    // 3순위: 이메일에서 추출
    if (!githubUsername && user.email) {
      githubUsername = extractUsernameFromEmail(user.email);
    }
    
    // 최종 검증: 여전히 숫자로만 이루어져 있으면 이메일에서 강제 추출
    if (githubUsername && /^\d+$/.test(githubUsername) && user.email) {
      console.log(`⚠️ 최종 검증: GitHub ID 발견, 이메일에서 강제 추출`);
      githubUsername = extractUsernameFromEmail(user.email);
    }
    
    console.log('🔗 GitHub 계정 연동 시도:', githubUsername);
    console.log('🔍 사용자 정보 디버깅:');
    console.log('  - reloadUserInfo:', user.reloadUserInfo);
    console.log('  - providerData:', user.providerData);
    console.log('  - email:', user.email);
    
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
    
    if (!githubUsername) {
      throw new Error('GitHub 사용자명을 찾을 수 없습니다');
    }

    console.log('📡 서버에 GitHub 연동 요청 전송:', {
      githubUsername,
      userDID,
      hasIdToken: !!idToken,
      hasAccessToken: !!accessToken
    });

    // GitHub 연동은 풀노드에 직접 요청 (릴레이서버 우회)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const githubApiUrl = isLocal 
      ? '/api/github/link-account'  // 로컬에서는 상대 경로
      : 'https://baekya-node-3000.loca.lt/api/github/link-account'; // 배포 환경에서는 풀노드 직접 호출
    
    console.log('📡 GitHub API 요청 URL:', githubApiUrl);
    
    const response = await fetch(githubApiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        idToken: idToken,
        accessToken: accessToken,
        githubUsername: githubUsername,
        userDID: userDID // 백야 사용자 DID 직접 전송
      })
    });

    console.log('📡 서버 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      // 응답이 JSON인지 확인
      const contentType = response.headers.get('content-type');
      let errorMessage = 'GitHub 계정 연동 실패';
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('❌ JSON 파싱 실패:', parseError);
          const errorText = await response.text();
          console.error('❌ 서버 응답 텍스트:', errorText);
          errorMessage = `서버 오류 (${response.status}): ${errorText.substring(0, 100)}`;
        }
      } else {
        const errorText = await response.text();
        console.error('❌ 서버 HTML 응답:', errorText);
        errorMessage = `서버 오류 (${response.status}): HTML 응답 수신`;
      }
      
      throw new Error(errorMessage);
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
  
  // 이메일에서 @ 앞의 사용자명 추출
  const username = email.split('@')[0];
  
  // vialucis1597@gmail.com -> vialucis1597 (올바른 추출)
  console.log(`📧 이메일에서 사용자명 추출: ${email} -> ${username}`);
  
  return username;
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
window.signOut = signOut;
window.getCurrentUser = getCurrentUser;
window.waitForAuth = waitForAuth; 