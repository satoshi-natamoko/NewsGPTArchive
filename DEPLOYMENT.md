# 뉴스 아카이브 - Render 무료 배포 가이드

이 가이드는 **Render의 무료 플랜**을 사용하여 뉴스 크롤링 시스템을 24시간 운영하는 방법을 설명합니다.

## 📋 목차
1. [사전 준비](#사전-준비)
2. [GitHub 리포지토리 생성](#1-github-리포지토리-생성)
3. [Render 배포 설정](#2-render-배포-설정)
4. [환경 변수 설정](#3-환경-변수-설정)
5. [무료 24시간 가동 설정](#4-무료-24시간-가동-설정)
6. [배포 확인](#5-배포-확인)
7. [문제 해결](#문제-해결)

---

## 사전 준비

필요한 것들:
- ✅ GitHub 계정
- ✅ Render 계정 (무료, https://render.com 에서 가입)
- ✅ Naver Search API 키 (Client ID, Client Secret)
- ✅ OpenAI API 키

---

## 1. GitHub 리포지토리 생성

### 1.1 Replit에서 GitHub로 푸시

Replit 프로젝트를 GitHub에 올립니다:

```bash
# Replit Shell에서 실행
git init
git add .
git commit -m "Initial commit: News Archive System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/news-archive.git
git push -u origin main
```

> **참고**: Replit의 "Version Control" 기능을 사용하면 더 쉽게 GitHub에 연동할 수 있습니다.

### 1.2 리포지토리 확인

GitHub에서 다음 파일들이 있는지 확인:
- ✅ `render.yaml` - Render 배포 설정
- ✅ `package.json` - 의존성 및 스크립트
- ✅ `.gitignore` - `.env` 파일이 제외되었는지 확인

---

## 2. Render 배포 설정

### 2.1 Render 대시보드 접속

1. https://render.com 로그인
2. "New +" 버튼 클릭
3. "Blueprint" 선택

### 2.2 GitHub 리포지토리 연결

1. "Connect a repository" 클릭
2. GitHub 계정 연결 허용
3. `news-archive` 리포지토리 선택

### 2.3 Blueprint 자동 인식

Render가 `render.yaml` 파일을 자동으로 감지합니다:
- ✅ Web Service: `news-archive`
- ✅ PostgreSQL Database: `news-archive-db`

"Apply" 버튼 클릭하여 배포 시작

---

## 3. 환경 변수 설정

### 3.1 Render 대시보드에서 설정

배포가 시작되면 **환경 변수를 설정**해야 합니다:

1. Render 대시보드에서 `news-archive` 서비스 클릭
2. 왼쪽 메뉴에서 **"Environment"** 클릭
3. 다음 환경 변수들을 추가:

| 키 이름 | 값 | 설명 |
|---------|-----|------|
| `NAVER_CLIENT_ID` | `YOUR_NAVER_CLIENT_ID` | Naver API Client ID |
| `NAVER_CLIENT_SECRET` | `YOUR_NAVER_CLIENT_SECRET` | Naver API Client Secret |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API Key |
| `DATABASE_URL` | (자동 설정됨) | PostgreSQL 연결 URL |
| `SESSION_SECRET` | (자동 생성됨) | 세션 암호화 키 |

> **중요**: 환경 변수 추가 후 **"Save Changes"** 클릭하면 자동으로 재배포됩니다.

### 3.2 데이터베이스 마이그레이션

첫 배포 후 데이터베이스 테이블을 생성해야 합니다:

1. Render 대시보드 → `news-archive` 서비스
2. 상단 "Shell" 탭 클릭
3. 다음 명령어 실행:

```bash
npm run db:push
```

---

## 4. 무료 24시간 가동 설정

Render 무료 플랜은 **15분 비활성 시 서버가 sleep**됩니다.  
**해결책**: 외부에서 5분마다 서버를 깨우는 ping 보내기

### 4.1 cron-job.org 설정

1. https://cron-job.org 가입 (무료)
2. "Create cronjob" 클릭
3. 다음과 같이 설정:

```
Title: News Archive Keep-Alive
URL: https://news-archive.onrender.com/api/health
Schedule: */5 * * * * (5분마다)
```

4. "Create" 클릭

### 4.2 작동 확인

- cron-job.org 대시보드에서 성공적으로 ping이 가는지 확인
- 5분마다 초록색 체크 표시가 나타나야 함

---

## 5. 배포 확인

### 5.1 웹사이트 접속

배포 완료 후:
```
https://news-archive.onrender.com
```

### 5.2 기능 테스트

1. **메인 페이지 로드** 확인
2. **메뉴** → **수동 크롤링** 실행
3. **크롤링 진행 상황** 모니터링
4. **기사 목록** 표시 확인

### 5.3 스케줄러 설정 (선택사항)

자동 크롤링을 원하면:
1. 메뉴 → 스케줄 설정
2. "스케줄러 활성화" 체크
3. 원하는 시간대 설정 (예: 매일 오전 9시)

---

## 문제 해결

### Q1. 배포가 실패합니다

**해결 방법**:
1. Render 대시보드 → Logs 확인
2. 환경 변수가 모두 설정되었는지 확인
3. `DATABASE_URL`이 자동으로 연결되었는지 확인

### Q2. 데이터베이스 연결 오류

**해결 방법**:
```bash
# Render Shell에서 실행
npm run db:push
```

### Q3. 서버가 자주 멈춥니다

**해결 방법**:
- cron-job.org 설정 확인
- ping 간격을 5분에서 3분으로 줄이기
- cron-job.org에서 실행 로그 확인

### Q4. API 키 오류

**해결 방법**:
1. Render Environment 변수 확인
2. Naver API 키가 유효한지 확인
3. OpenAI API 키 잔액 확인

---

## 비용 안내

### Render 무료 플랜
- ✅ 웹 서비스: **무료**
- ✅ PostgreSQL: **무료** (1GB 용량)
- ⚠️ 제한: 15분 비활성 시 sleep (ping으로 해결)

### 외부 서비스
- ✅ cron-job.org: **무료** (무제한 크론잡)
- 💰 OpenAI GPT-4o-mini: 기사당 ~0.03원
- 💰 Naver Search API: 무료 (일일 25,000건)

**월 예상 비용**: **무료** (OpenAI API 사용량만 소액)

---

## 자동 배포

GitHub에 코드를 push하면 **자동으로 Render에 배포**됩니다:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render가 자동으로:
1. 새 코드 감지
2. 빌드 실행
3. 배포 완료
4. 서버 재시작

---

## 추가 정보

### 커스텀 도메인 연결 (선택사항)

Render는 커스텀 도메인을 무료로 지원합니다:
1. 도메인 구매 (예: GoDaddy, Namecheap)
2. Render 대시보드 → Settings → Custom Domains
3. DNS 설정 (CNAME 레코드 추가)

### 로그 모니터링

실시간 로그 확인:
1. Render 대시보드 → `news-archive`
2. "Logs" 탭 클릭
3. 크롤링 진행 상황 및 에러 확인

---

## 문의

문제가 있으면 다음을 확인하세요:
- Render Logs
- cron-job.org 실행 로그
- Naver/OpenAI API 상태

**배포 완료!** 🎉
