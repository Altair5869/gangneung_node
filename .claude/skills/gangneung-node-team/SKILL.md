---
name: gangneung-node-team
description: 강릉 노드 프로젝트에서 새 기능 개발, PRD/기획 분석, 버그 수정, 기능 QA가 필요할 때 pm-analyst·developer·qa-engineer 3인 에이전트 팀을 조율하는 오케스트레이터. "기능 추가해줘", "이 요구사항 구현해줘", "버그 고쳐줘", "QA 해줘", "검증해줘", "PRD 분석해줘", "기획 검토해줘" 요청 시 사용. 후속 작업(재QA, 이전 결과 수정/보완, 일부 기능만 다시 구현, FIX 반영 확인, 이어서 개발)에도 반드시 이 스킬을 사용.
---

# 강릉 노드 개발 팀 오케스트레이터

강릉 노드(Next.js/TypeScript, 한국관광공사 OpenAPI 공모전 제출작)의 기능 개발 요청을 PRD 분석 → 구현 → QA 흐름으로 조율한다.

## 실행 모드: 에이전트 팀

3인 모두 요청 전체 생애주기(분석 → 구현 → QA → FIX 루프)에 걸쳐 서로 직접 소통해야 하므로 팀 모드를 쓴다. developer가 요구사항 해석에 막히면 pm-analyst에게, qa-engineer가 FIX를 지시하면 developer에게 — 리더를 거치지 않고 즉시 오갈 수 있어야 재작업 비용이 줄어든다.

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| pm-analyst | 커스텀 (`.claude/agents/pm-analyst.md`) | 요구사항/영향범위/완료기준 정리, 기획서-구현 불일치 플래그 | `prd-analysis` | `01_pm-analyst_requirements.md` |
| developer | 커스텀 (`.claude/agents/developer.md`) | Next.js/TS 구현, 데이터 규칙 준수 | `gangneung-dev-guide` | `02_developer_changes.md` + 실제 코드 변경 |
| qa-engineer | 커스텀 (`.claude/agents/qa-engineer.md`, `general-purpose` 기반) | 경계면 교차 검증, 하드코딩 탐지 | `gangneung-qa-checklist` | `03_qa_report.md` |

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)

1. `.claude/_workspace/` 존재 여부 확인
2. 실행 모드 결정:
   - **미존재** → 초기 실행. Phase 1로 진행
   - **존재 + "재QA"/"다시 검증"/"FIX 반영됐는지 확인" 등 QA 재실행 요청** → Phase 4(QA)만 재실행. pm-analyst/developer는 스폰하지 않고 qa-engineer만 기존 `01_`/`02_` 문서를 입력으로 재검증
   - **존재 + "이 부분만 수정"/"보완" 등 부분 수정 요청** → 해당 에이전트만 재호출 (예: 구현만 다시면 developer만, developer가 pm-analyst의 기존 요구사항 문서를 그대로 참조)
   - **존재 + 완전히 새로운 기능 요청** → 기존 `.claude/_workspace/`를 `.claude/_workspace_{YYYYMMDD_HHMMSS}/`로 이동한 뒤 Phase 1부터 새로 진행
3. 부분 재실행 시 해당 에이전트 프롬프트에 이전 산출물 경로를 포함해, 기존 결과를 읽고 피드백을 반영하도록 지시

### Phase 1: 준비

1. 사용자 요청 분석 — 신규 기능인지, 버그 수정인지, QA 단독 요청인지 판단
2. `.claude/_workspace/` 생성 (초기/새 실행 시)
3. 요청이 아주 사소한 수정(예: 오타, 스타일 한 줄)이면 팀 전체를 띄우지 않고 developer만 서브 에이전트로 직접 호출하는 것도 고려 — 단, 이 경우도 `gangneung-dev-guide` 스킬은 반드시 참조하게 한다

### Phase 2: 팀 구성

```
TeamCreate(
  team_name: "gangneung-node-team",
  members: [
    { name: "pm-analyst", agent_type: "pm-analyst", model: "opus",
      prompt: "사용자 요청: {요청 원문}. prd-analysis 스킬을 따라 요구사항을 분석하고 .claude/_workspace/01_pm-analyst_requirements.md에 작성한 뒤 developer에게 SendMessage로 전달하라." },
    { name: "developer", agent_type: "developer", model: "opus",
      prompt: "pm-analyst의 요구사항 문서(.claude/_workspace/01_pm-analyst_requirements.md)를 기다렸다가, gangneung-dev-guide 스킬을 따라 구현하라. 완료 시 .claude/_workspace/02_developer_changes.md 작성 후 qa-engineer에게 전달하라." },
    { name: "qa-engineer", agent_type: "qa-engineer", model: "opus",
      prompt: "developer의 변경사항을 기다렸다가, gangneung-qa-checklist 스킬을 따라 검증하라. .claude/_workspace/03_qa_report.md 작성 후 FIX가 있으면 developer에게, 완료되면 리더에게 보고하라." }
  ]
)

TaskCreate(tasks: [
  { title: "요구사항 분석", description: "{요청 원문} 분석, 완료기준 작성", assignee: "pm-analyst" },
  { title: "기능 구현", description: "요구사항 문서 기반 구현", assignee: "developer", depends_on: ["요구사항 분석"] },
  { title: "기능 QA", description: "구현 결과 교차 검증", assignee: "qa-engineer", depends_on: ["기능 구현"] }
])
```

> 3명 × 1개 핵심 작업 — 소규모 작업 가이드라인(2~3명, 3~5개)에 부합. 요청 규모가 크면(여러 화면/API에 걸침) pm-analyst 단계에서 작업을 여러 개로 쪼개 TaskCreate에 추가한다.

### Phase 3: 분석 → 구현 → QA (팀원 자체 조율)

**실행 방식:** 팀원들이 SendMessage/공유 작업 목록으로 자체 조율. 리더는 모니터링하며 막힌 지점만 개입.

**진행 순서 (강한 순차 의존):**
1. pm-analyst가 요구사항 작성 → developer에게 SendMessage
2. developer가 구현, 막히면 pm-analyst에게 SendMessage로 질문 → 즉답받고 계속
3. developer 완료 → qa-engineer에게 SendMessage
4. qa-engineer가 검증 → FIX 있으면 developer에게 파일:라인 단위로 SendMessage → developer 수정 → qa-engineer 재검증 (최대 2회 루프)
5. 2회 루프 후에도 미해결이면 qa-engineer가 REDO로 격상하고 리더에게 에스컬레이션

**리더 모니터링:**
- 팀원이 유휴 상태가 되면 자동 알림 수신
- 특정 팀원이 30분 이상 응답 없이 막히면 SendMessage로 상태 확인
- 전체 진행률은 TaskGet으로 확인

### Phase 4: 통합 및 보고

1. TaskGet으로 전체 완료 확인
2. `.claude/_workspace/01_`, `02_`, `03_` 세 문서를 Read로 수집
3. 사용자에게 요약 보고: 무엇을 구현했는지, QA 결과(PASS/FIX 이력/미검증 항목), 남은 리스크

### Phase 5: 정리

1. 팀원들에게 종료 요청 (SendMessage)
2. `TeamDelete`
3. `.claude/_workspace/`는 보존 (git에는 커밋 안 됨 — `.gitignore` 처리됨. 사후 감사 추적용)
4. 사용자에게 결과 요약 + 개선 피드백 요청 기회 제공

## 데이터 흐름

```
[리더] → TeamCreate → [pm-analyst] ──SendMessage──→ [developer] ──SendMessage──→ [qa-engineer]
                                                          ↑                            │
                                                          └────── FIX 지시 (최대 2회) ──┘
                                                          │
                                     질문 ──SendMessage──→ [pm-analyst] (막히면)
                                     ↓
                          .claude/_workspace/01_, 02_, 03_ *.md
                                     ↓
                              [리더: 통합 보고]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| pm-analyst가 기획서(`Gangneung_Node_Plan.md`)를 못 찾음 | `CLAUDE.md`/`docs/`만으로 진행, 사용자에게 파일 위치 문의 (진행 중단하지 않음) |
| 요구사항이 데이터 규칙과 정면 충돌 (예: wifi 속도 표시 요청) | pm-analyst가 요구사항化하지 않고 대안 제시, 리더가 사용자에게 확인 |
| developer가 요구사항 해석에 막힘 | pm-analyst에게 SendMessage로 질문 → 재개 |
| qa-engineer가 FIX를 2회 지시했는데도 미해결 | REDO로 격상, 리더에게 에스컬레이션, 접근 방식 재검토 여부를 사용자에게 확인 |
| 팀원 1명 응답 없음/중지 | 리더가 유휴 알림 감지 → SendMessage로 상태 확인 → 재시작 |
| 팀원 간 데이터 규칙 해석 충돌 | 삭제하지 않고 근거(CLAUDE.md 조항) 병기, 리더가 최종 판단 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "지도 페이지에 소음 필터 옵션을 추가해줘"
2. Phase 0에서 `.claude/_workspace/` 미존재 → 초기 실행
3. Phase 2에서 3인 팀 구성 + 3개 작업 등록
4. Phase 3: pm-analyst가 `noise` 필드 3단계 신호 규칙을 반영한 요구사항 작성 → developer가 `SpotFilter.tsx`/관련 API 구현 → qa-engineer가 하드코딩 여부·필터 소비 여부 교차 검증 → PASS
5. Phase 4에서 세 문서 통합해 요약 보고
6. Phase 5에서 팀 정리, `.claude/_workspace/` 보존
7. 예상 결과: 기능 구현 완료 + QA PASS 보고

### 에러 흐름
1. 사용자: "와이파이 속도(Mbps) 필터도 추가해줘"
2. Phase 3에서 pm-analyst가 `CLAUDE.md` 규칙("wifi.speedMbps 수집 안 함")과 충돌 확인
3. 요구사항화하지 않고 "이 필드는 전화 확인으로도 정확한 값을 못 얻어 수집 대상에서 제외됨" 설명을 `01_pm-analyst_requirements.md`에 기록
4. developer에게 구현 작업을 넘기지 않고 리더가 사용자에게 대안(예: "충분함/제한적/없음" 콘센트 필터는 이미 있음) 제시
5. 최종 보고서에 "요청하신 필드는 데이터 신뢰성 정책상 구현하지 않음" 명시
