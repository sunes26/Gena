# SECURITY.md
# 🔒 SummaryGenie 보안 가이드

## 📌 긴급 조치 사항

### ⚠️ 노출된 API 키 처리
귀하의 OpenAI API 키가 노출되었습니다. **즉시 다음 조치를 취하세요:**

1. **OpenAI 대시보드에서 현재 키 무효화**
   ```
   https://platform.openai.com/api-keys
   → 노출된 키 찾기 → Revoke 클릭
   ```

2. **새 API 키 생성**
   ```
   → Create new secret key
   → 안전한 곳에 저장
   ```

3. **Git 히스토리에서 제거**
   ```bash
   # .env 파일 추적 중지
   git rm --cached .env
   
   # 히스토리에서 완전 제거 (BFG Repo-Cleaner 사용)
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force
   ```

## 🛡️ 환경변수 보안 모범 사례

### 1. 로컬 개발 환경

#### 초기 설정
```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일 권한 설정 (Unix/Linux/Mac)
chmod 600 .env

# .env 파일이 .gitignore에 포함되었는지 확인
grep "^.env$" .gitignore || echo ".env" >> .gitignore
```

#### 안전한 키 생성
```javascript
// 강력한 랜덤 키 생성 스크립트
const crypto = require('crypto');

// JWT Secret 생성 (32자)
console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('hex'));

// Admin Key 생성 (16자)
console.log('ADMIN_KEY=' + crypto.randomBytes(16).toString('hex'));
```

### 2. 프로덕션 환경

#### 옵션 1: 환경변수 직접 설정 (Linux/Docker)
```bash
# 시스템 환경변수 설정
export OPENAI_API_KEY="sk-proj-xxxxx"
export JWT_SECRET="your-strong-secret-key"
export NODE_ENV="production"

# systemd 서비스 파일에 설정
# /etc/systemd/system/summarygenie.service
[Service]
Environment="OPENAI_API_KEY=sk-proj-xxxxx"
Environment="JWT_SECRET=your-strong-secret"
EnvironmentFile=/etc/summarygenie/.env
```

#### 옵션 2: AWS Secrets Manager
```javascript
// AWS SDK를 사용한 시크릿 로드
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getSecrets() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'summarygenie/prod/api-keys'
  }).promise();
  
  return JSON.parse(secret.SecretString);
}
```

#### 옵션 3: HashiCorp Vault
```bash
# Vault에 시크릿 저장
vault kv put secret/summarygenie/prod \
  openai_api_key="sk-proj-xxxxx" \
  jwt_secret="your-secret"

# Node.js에서 읽기
const vault = require('node-vault')({
  endpoint: 'https://vault.example.com',
  token: process.env.VAULT_TOKEN
});

const secrets = await vault.read('secret/summarygenie/prod');
```

#### 옵션 4: Kubernetes Secrets
```yaml
# k8s-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: summarygenie-secrets
type: Opaque
data:
  openai-api-key: <base64-encoded-key>
  jwt-secret: <base64-encoded-secret>

---
# deployment.yaml
env:
  - name: OPENAI_API_KEY
    valueFrom:
      secretKeyRef:
        name: summarygenie-secrets
        key: openai-api-key
```

### 3. CI/CD 파이프라인

#### GitHub Actions 예시
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: |
          # 배포 스크립트
          ./deploy.sh
```

GitHub에서 시크릿 설정:
1. Repository → Settings → Secrets and variables → Actions
2. New repository secret 클릭
3. Name과 Value 입력

### 4. Docker 보안

#### Docker 빌드 시 시크릿 제외
```dockerfile
# .dockerignore 파일
.env
.env.*
!.env.example
.git
node_modules
npm-debug.log
```

#### Docker Compose 보안 실행
```bash
# .env 파일 사용
docker-compose --env-file .env.production up -d

# Docker Secrets 사용 (Swarm mode)
echo "sk-proj-xxxxx" | docker secret create openai_api_key -
docker service create \
  --secret openai_api_key \
  --env OPENAI_API_KEY_FILE=/run/secrets/openai_api_key \
  summarygenie:latest
```

### 5. 클라우드 플랫폼별 설정

#### Vercel
```bash
vercel env add OPENAI_API_KEY production
vercel env add JWT_SECRET production
```

#### Heroku
```bash
heroku config:set OPENAI_API_KEY=sk-proj-xxxxx
heroku config:set JWT_SECRET=your-secret
```

#### Railway
```bash
railway variables set OPENAI_API_KEY=sk-proj-xxxxx
railway variables set JWT_SECRET=your-secret
```

#### AWS Elastic Beanstalk
```bash
eb setenv OPENAI_API_KEY=sk-proj-xxxxx JWT_SECRET=your-secret
```

## 🔐 API 키 로테이션 전략

### 자동 로테이션 스크립트
```javascript
// rotate-keys.js
const schedule = require('node-schedule');

// 매월 1일 자정에 실행
schedule.scheduleJob('0 0 1 * *', async () => {
  try {
    // 1. 새 API 키 생성
    const newKey = await generateNewAPIKey();
    
    // 2. Secrets Manager 업데이트
    await updateSecretInVault(newKey);
    
    // 3. 서비스 재시작
    await restartServices();
    
    // 4. 이전 키 30일 후 삭제 예약
    await scheduleOldKeyDeletion();
    
    console.log('API 키 로테이션 완료');
  } catch (error) {
    console.error('키 로테이션 실패:', error);
    // 알림 전송
  }
});
```

## 🚨 보안 체크리스트

### 개발 단계
- [ ] `.env` 파일이 `.gitignore`에 포함됨
- [ ] `.env.example` 파일에 실제 키가 없음
- [ ] 모든 시크릿이 강력한 랜덤 값임
- [ ] 코드에 하드코딩된 시크릿이 없음
- [ ] Git 히스토리에 시크릿이 없음

### 배포 단계
- [ ] 프로덕션 환경변수가 안전하게 설정됨
- [ ] HTTPS 사용 중
- [ ] Rate limiting 활성화
- [ ] 로깅에 민감 정보 제외
- [ ] 정기적인 키 로테이션 계획

### 모니터링
- [ ] API 사용량 모니터링
- [ ] 비정상적인 활동 감지
- [ ] 보안 알림 설정
- [ ] 정기적인 보안 감사

## 📚 추가 리소스

- [OpenAI API 보안 가이드](https://platform.openai.com/docs/guides/safety-best-practices)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js 보안 체크리스트](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Docker 보안 모범 사례](https://docs.docker.com/develop/security-best-practices/)

## 🆘 보안 사고 대응

보안 사고 발생 시:
1. 노출된 키 즉시 무효화
2. 새 키 생성 및 배포
3. 로그 검토로 피해 범위 파악
4. 필요시 사용자에게 통지
5. 사고 보고서 작성 및 개선점 도출

## 📧 보안 문의

보안 취약점 발견 시 공개하지 마시고 다음으로 연락주세요:
- Email: security@summarygenie.com
- 보안 버그 바운티 프로그램 참여 가능