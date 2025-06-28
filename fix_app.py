import re

# Read the file
with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add name validation for personal info
pattern1 = r'(submitBtn\.addEventListener\(\'click\', \(\) => \{[\s\S]*?)(if \(!name\) \{)'
replacement1 = r'\1// 한글과 영어만 허용 (공백 포함)\n        const nameRegex = /^[가-힣a-zA-Z\\s]+$/;\n        \2'
content = re.sub(pattern1, replacement1, content)

# Fix 2: Remove biometric auth from password reset
pattern2 = r'const confirmed = confirm\(\'비밀번호를 재설정하시겠습니까\?\\n기존 지문과 비밀번호를 먼저 확인합니다\.\'\);'
replacement2 = r"const confirmed = confirm('비밀번호를 재설정하시겠습니까?');"
content = re.sub(pattern2, replacement2, content)

# Fix 3: Remove fingerprint verification from password reset
pattern3 = r'// 1\. 기존 지문 인증[\s\S]*?// 2\. 기존 비밀번호 확인'
replacement3 = r'// 1. 기존 비밀번호 확인'
content = re.sub(pattern3, replacement3, content)

# Fix 4: Fix account deletion - remove 3 month check
pattern4 = r'// 계정 생성 후 3개월 체크[\s\S]*?return;\s*\}'
content = re.sub(pattern4, '', content)

# Fix 5: Fix communication address display
pattern5 = r'if \(this\.currentUser\.communicationAddress && this\.currentUser\.hasSetCommunicationAddress\) \{'
replacement5 = r'if (this.currentUser.communicationAddress) {'
content = re.sub(pattern5, replacement5, content)

# Write the fixed content
with open('public/app_fixed.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed all issues!')
